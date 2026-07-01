import {
  CHALLENGE_SOLVER_VARIANT_VALUES,
  HTTP_PROXY_SCHEME_VALUES,
  PROXY_PROFILE_KIND_VALUES,
  PROXY_PROFILE_TEST_OUTCOME_VALUES,
  type PublicUser,
  type UpsertProxyProfileRequest,
} from "@arrtemplar/shared";
import { Elysia, t } from "elysia";
import { apiErrorResponseSchema } from "../api/api-error-schema";
import { ApiKeyService } from "../auth/api-key.service";
import { AuthService } from "../auth/auth.service";
import { SESSION_COOKIE_NAME } from "../auth/session-token";
import {
  type MaybePromise,
  type RouteRequestContext,
  readRouteSessionCookie,
  type ServiceResponse,
  type SettingsRouteContext,
  type StatusHandler,
  withSettingsPermissionResult,
} from "../auth/settings-route-auth";
import type { DatabaseClient } from "../db/client";
import { ProxyProfileService } from "./proxy-profile.service";

type ProxySettingsRoutesOptions = {
  database: DatabaseClient;
  secretEncryptionKey: string | null;
};

type BaseRouteContext = SettingsRouteContext;
type ProxyProfileIdRouteContext = BaseRouteContext & { params: { proxyProfileId: unknown } };
type ProxyProfileBodyRouteContext = BaseRouteContext & { body: unknown };
type ProxyProfileBodyIdRouteContext = ProxyProfileIdRouteContext & { body: unknown };

const proxyProfileKindSchema = t.Union(
  PROXY_PROFILE_KIND_VALUES.map((kind) => t.Literal(kind)) as [
    ReturnType<typeof t.Literal>,
    ...ReturnType<typeof t.Literal>[],
  ],
);
const challengeSolverVariantSchema = t.Union(
  CHALLENGE_SOLVER_VARIANT_VALUES.map((variant) => t.Literal(variant)) as [
    ReturnType<typeof t.Literal>,
    ...ReturnType<typeof t.Literal>[],
  ],
);
const httpProxySchemeSchema = t.Union(
  HTTP_PROXY_SCHEME_VALUES.map((scheme) => t.Literal(scheme)) as [
    ReturnType<typeof t.Literal>,
    ...ReturnType<typeof t.Literal>[],
  ],
);
const proxyProfileTestOutcomeSchema = t.Union(
  PROXY_PROFILE_TEST_OUTCOME_VALUES.map((outcome) => t.Literal(outcome)) as [
    ReturnType<typeof t.Literal>,
    ...ReturnType<typeof t.Literal>[],
  ],
);
const sessionCookieSchema = t.Cookie({ [SESSION_COOKIE_NAME]: t.Optional(t.String()) });
const proxyProfileIdParamsSchema = t.Object({ proxyProfileId: t.String({ minLength: 1 }) });
const proxyProfileSummarySchema = t.Object({
  id: t.String({ minLength: 1 }),
  kind: proxyProfileKindSchema,
  variant: t.Union([challengeSolverVariantSchema, t.Null()]),
  name: t.String({ minLength: 1, maxLength: 80 }),
  description: t.Union([t.String(), t.Null()]),
  enabled: t.Boolean(),
  scheme: httpProxySchemeSchema,
  host: t.String({ minLength: 1 }),
  port: t.Number({ minimum: 1, maximum: 65_535 }),
  path: t.Union([t.String(), t.Null()]),
  requestTimeoutMs: t.Number({ minimum: 1_000, maximum: 300_000 }),
  sessionName: t.Union([t.String(), t.Null()]),
  sessionTtlMinutes: t.Union([t.Number({ minimum: 1, maximum: 1_440 }), t.Null()]),
  username: t.Union([t.String(), t.Null()]),
  hasPassword: t.Boolean(),
  lastTestedAt: t.Union([t.String({ format: "date-time" }), t.Null()]),
  lastTestOutcome: t.Union([proxyProfileTestOutcomeSchema, t.Null()]),
  lastTestMessage: t.Union([t.String(), t.Null()]),
  createdAt: t.String({ format: "date-time" }),
  updatedAt: t.String({ format: "date-time" }),
});
const proxyProfileResponseSchema = t.Object({ profile: proxyProfileSummarySchema });
const proxyProfileListResponseSchema = t.Object({ profiles: t.Array(proxyProfileSummarySchema) });
const deleteProxyProfileResponseSchema = t.Object({
  status: t.Literal("ok"),
  deletedId: t.String({ minLength: 1 }),
  deletedKind: proxyProfileKindSchema,
});
const proxyProfileTestResponseSchema = t.Object({
  result: t.Object({
    profileId: t.String({ minLength: 1 }),
    kind: proxyProfileKindSchema,
    outcome: proxyProfileTestOutcomeSchema,
    message: t.String(),
    testedAt: t.String({ format: "date-time" }),
    statusCode: t.Union([t.Number(), t.Null()]),
    responseTimeMs: t.Union([t.Number(), t.Null()]),
  }),
});
const upsertProxyProfileRequestSchema = t.Object({
  kind: proxyProfileKindSchema,
  variant: t.Optional(t.Union([challengeSolverVariantSchema, t.Null()])),
  name: t.String({ minLength: 1, maxLength: 80 }),
  description: t.Optional(t.Union([t.String({ maxLength: 200 }), t.Null()])),
  enabled: t.Optional(t.Boolean()),
  scheme: httpProxySchemeSchema,
  host: t.String({ minLength: 1 }),
  port: t.Number({ minimum: 1, maximum: 65_535 }),
  path: t.Optional(t.Union([t.String(), t.Null()])),
  requestTimeoutMs: t.Optional(t.Number({ minimum: 1_000, maximum: 300_000 })),
  sessionName: t.Optional(t.Union([t.String({ maxLength: 120 }), t.Null()])),
  sessionTtlMinutes: t.Optional(t.Union([t.Number({ minimum: 1, maximum: 1_440 }), t.Null()])),
  username: t.Optional(t.Union([t.String({ maxLength: 120 }), t.Null()])),
  password: t.Optional(t.String()),
  clearPassword: t.Optional(t.Boolean()),
});
const emptyRequestSchema = t.Object({});
const authErrorResponseSchemas = {
  401: apiErrorResponseSchema,
  403: apiErrorResponseSchema,
} as const;
const proxyProfileMutationErrorSchemas = {
  ...authErrorResponseSchemas,
  404: apiErrorResponseSchema,
  409: apiErrorResponseSchema,
  422: apiErrorResponseSchema,
  503: apiErrorResponseSchema,
} as const;

export function createProxySettingsRoutes(options: ProxySettingsRoutesOptions) {
  const authService = new AuthService(options.database);
  const apiKeyService = new ApiKeyService(options.database);
  const proxyProfileService = new ProxyProfileService(options.database, {
    secretEncryptionKey: options.secretEncryptionKey,
  });
  const deleteProxyProfile = createProxyProfileIdRouteHandler(
    apiKeyService,
    authService,
    (proxyProfileId, actor, context) =>
      proxyProfileService.deleteProfile(proxyProfileId, actor, context),
  );
  const testProxyProfile = createProxyProfileIdRouteHandler(
    apiKeyService,
    authService,
    (proxyProfileId, actor, context) =>
      proxyProfileService.testProfile(proxyProfileId, actor, context),
  );

  return new Elysia({ prefix: "/api" })
    .get(
      "/settings/proxies",
      async ({ cookie, request, server, status }) =>
        await withSettingsPermissionResult({
          apiKeyService,
          authService,
          sessionCookieValue: readRouteSessionCookie(cookie, SESSION_COOKIE_NAME),
          request,
          server,
          status: status as StatusHandler,
          requiredPermission: "settings:general",
          onAllowed: async () => ({ ok: true, body: proxyProfileService.listProfiles() }),
        }),
      {
        cookie: sessionCookieSchema,
        response: { 200: proxyProfileListResponseSchema, ...authErrorResponseSchemas },
        detail: {
          summary: "List proxy profiles",
          description: "Returns saved proxy settings without exposing secret material.",
          tags: ["Settings"],
        },
      },
    )
    .post(
      "/settings/proxies",
      async ({ body, cookie, request, server, status }: ProxyProfileBodyRouteContext) =>
        await withSettingsPermissionResult({
          apiKeyService,
          authService,
          sessionCookieValue: readRouteSessionCookie(cookie, SESSION_COOKIE_NAME),
          request,
          server,
          status: status as StatusHandler,
          requiredPermission: "settings:general",
          onAllowed: (actor, context) =>
            proxyProfileService.createProfile(body as UpsertProxyProfileRequest, actor, context),
        }),
      {
        body: upsertProxyProfileRequestSchema,
        cookie: sessionCookieSchema,
        response: { 200: proxyProfileResponseSchema, ...proxyProfileMutationErrorSchemas },
        detail: {
          summary: "Create proxy profile",
          description: "Creates one saved proxy profile for challenge solving or HTTP proxying.",
          tags: ["Settings"],
        },
      },
    )
    .put(
      "/settings/proxies/:proxyProfileId",
      async ({ body, cookie, params, request, server, status }: ProxyProfileBodyIdRouteContext) =>
        await withSettingsPermissionResult({
          apiKeyService,
          authService,
          sessionCookieValue: readRouteSessionCookie(cookie, SESSION_COOKIE_NAME),
          request,
          server,
          status: status as StatusHandler,
          requiredPermission: "settings:general",
          onAllowed: (actor, context) =>
            proxyProfileService.updateProfile(
              params.proxyProfileId as string,
              body as UpsertProxyProfileRequest,
              actor,
              context,
            ),
        }),
      {
        params: proxyProfileIdParamsSchema,
        body: upsertProxyProfileRequestSchema,
        cookie: sessionCookieSchema,
        response: { 200: proxyProfileResponseSchema, ...proxyProfileMutationErrorSchemas },
        detail: {
          summary: "Update proxy profile",
          description:
            "Updates one saved proxy profile while preserving hidden secrets unless replaced.",
          tags: ["Settings"],
        },
      },
    )
    .delete("/settings/proxies/:proxyProfileId", deleteProxyProfile, {
      params: proxyProfileIdParamsSchema,
      cookie: sessionCookieSchema,
      response: { 200: deleteProxyProfileResponseSchema, ...proxyProfileMutationErrorSchemas },
      detail: {
        summary: "Delete proxy profile",
        description: "Deletes one saved proxy profile.",
        tags: ["Settings"],
      },
    })
    .post("/settings/proxies/:proxyProfileId/test", testProxyProfile, {
      params: proxyProfileIdParamsSchema,
      body: emptyRequestSchema,
      cookie: sessionCookieSchema,
      response: { 200: proxyProfileTestResponseSchema, ...proxyProfileMutationErrorSchemas },
      detail: {
        summary: "Test proxy profile",
        description: "Runs a safe connectivity check for one saved proxy profile.",
        tags: ["Settings"],
      },
    });
}

function createProxyProfileIdRouteHandler<T>(
  apiKeyService: ApiKeyService,
  authService: AuthService,
  action: (
    proxyProfileId: string,
    actor: PublicUser | undefined,
    context: RouteRequestContext,
  ) => MaybePromise<ServiceResponse<T>>,
) {
  return async ({ cookie, params, request, server, status }: ProxyProfileIdRouteContext) =>
    await withSettingsPermissionResult({
      apiKeyService,
      authService,
      sessionCookieValue: readRouteSessionCookie(cookie, SESSION_COOKIE_NAME),
      request,
      server,
      status: status as StatusHandler,
      requiredPermission: "settings:general",
      onAllowed: (actor, context) => action(params.proxyProfileId as string, actor, context),
    });
}
