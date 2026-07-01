import {
  type PublicUser,
  SERVICE_INTEGRATION_AUTH_MODE_VALUES,
  SERVICE_INTEGRATION_KIND_VALUES,
  SERVICE_INTEGRATION_PROBE_OUTCOME_VALUES,
  type ServiceIntegrationKind,
  type UpsertServiceIntegrationRequest,
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
import { ServiceIntegrationService } from "./service-integration.service";

type ServiceIntegrationRoutesOptions = {
  database: DatabaseClient;
  secretEncryptionKey: string | null;
};
type BaseRouteContext = SettingsRouteContext;
type KindBodyRouteContext = BaseRouteContext & {
  body: unknown;
  params: { kind: unknown };
};
type InstanceBodyRouteContext = BaseRouteContext & {
  body: unknown;
  params: { integrationId: unknown };
};
type KindRequestRouteContext = BaseRouteContext & { params: { kind: unknown } };
type InstanceRequestRouteContext = BaseRouteContext & { params: { integrationId: unknown } };
type KindStatusRouteContext = BaseRouteContext & { params: { kind: unknown } };
type InstanceStatusRouteContext = BaseRouteContext & { params: { integrationId: unknown } };
type RouteUpsertServiceIntegrationRequest = Omit<UpsertServiceIntegrationRequest, "authMode"> & {
  authMode?: UpsertServiceIntegrationRequest["authMode"];
};

const serviceIntegrationKindSchema = t.Union(
  SERVICE_INTEGRATION_KIND_VALUES.map((kind) => t.Literal(kind)) as [
    ReturnType<typeof t.Literal>,
    ...ReturnType<typeof t.Literal>[],
  ],
);
const serviceIntegrationAuthModeSchema = t.Union(
  SERVICE_INTEGRATION_AUTH_MODE_VALUES.map((mode) => t.Literal(mode)) as [
    ReturnType<typeof t.Literal>,
    ...ReturnType<typeof t.Literal>[],
  ],
);
const serviceIntegrationProbeOutcomeSchema = t.Union(
  SERVICE_INTEGRATION_PROBE_OUTCOME_VALUES.map((outcome) => t.Literal(outcome)) as [
    ReturnType<typeof t.Literal>,
    ...ReturnType<typeof t.Literal>[],
  ],
);

const serviceIntegrationParamsSchema = t.Object({ kind: serviceIntegrationKindSchema });
const serviceIntegrationInstanceParamsSchema = t.Object({
  integrationId: t.String({ minLength: 1 }),
});
const sessionCookieSchema = t.Cookie({ [SESSION_COOKIE_NAME]: t.Optional(t.String()) });
const serviceIntegrationSavedConfigSchema = t.Object({
  id: t.String({ minLength: 1 }),
  kind: serviceIntegrationKindSchema,
  displayName: t.String({ minLength: 1 }),
  isDefault: t.Boolean(),
  enabled: t.Boolean(),
  useSsl: t.Boolean(),
  host: t.String({ minLength: 1 }),
  port: t.Number({ minimum: 1, maximum: 65_535 }),
  urlBase: t.Union([t.String(), t.Null()]),
  authMode: serviceIntegrationAuthModeSchema,
  username: t.Union([t.String(), t.Null()]),
  hasApiKey: t.Boolean(),
  hasPassword: t.Boolean(),
  lastTestedAt: t.Union([t.String({ format: "date-time" }), t.Null()]),
  lastTestOutcome: t.Union([serviceIntegrationProbeOutcomeSchema, t.Null()]),
  lastTestMessage: t.Union([t.String(), t.Null()]),
  lastStatusCheckedAt: t.Union([t.String({ format: "date-time" }), t.Null()]),
  lastStatusOutcome: t.Union([serviceIntegrationProbeOutcomeSchema, t.Null()]),
  lastStatusMessage: t.Union([t.String(), t.Null()]),
  createdAt: t.String({ format: "date-time" }),
  updatedAt: t.String({ format: "date-time" }),
});
const serviceIntegrationResponseSchema = t.Object({
  integration: t.Union([serviceIntegrationSavedConfigSchema, t.Null()]),
});
const serviceIntegrationListResponseSchema = t.Object({
  integrations: t.Array(serviceIntegrationSavedConfigSchema),
});
const serviceIntegrationProbeResultSchema = t.Object({
  kind: serviceIntegrationKindSchema,
  configured: t.Boolean(),
  enabled: t.Boolean(),
  outcome: serviceIntegrationProbeOutcomeSchema,
  summary: t.String(),
  checkedAt: t.String({ format: "date-time" }),
  reachable: t.Boolean(),
  authenticated: t.Boolean(),
  compatible: t.Boolean(),
  version: t.Union([t.String(), t.Null()]),
  webApiVersion: t.Union([t.String(), t.Null()]),
  connectionState: t.Union([t.String(), t.Null()]),
});
const serviceIntegrationProbeResponseSchema = t.Object({
  result: serviceIntegrationProbeResultSchema,
  error: t.Optional(
    t.Object({
      code: t.String(),
      message: t.String(),
      fieldErrors: t.Optional(
        t.Array(
          t.Object({
            field: t.String(),
            code: t.String(),
            message: t.String(),
          }),
        ),
      ),
    }),
  ),
});
const deleteServiceIntegrationResponseSchema = t.Object({
  status: t.Literal("ok"),
  deletedId: t.String({ minLength: 1 }),
  deletedKind: serviceIntegrationKindSchema,
});
const upsertServiceIntegrationRequestSchema = t.Object({
  displayName: t.Optional(t.Union([t.String(), t.Null()])),
  enabled: t.Optional(t.Boolean()),
  useSsl: t.Boolean(),
  host: t.String({ minLength: 1 }),
  port: t.Number({ minimum: 1, maximum: 65_535 }),
  urlBase: t.Optional(t.Union([t.String(), t.Null()])),
  authMode: t.Optional(serviceIntegrationAuthModeSchema),
  username: t.Optional(t.Union([t.String(), t.Null()])),
  apiKey: t.Optional(t.String()),
  password: t.Optional(t.String()),
});
const emptyRequestSchema = t.Object({});
const authErrorResponseSchemas = {
  401: apiErrorResponseSchema,
  403: apiErrorResponseSchema,
} as const;
const serviceIntegrationReadResponseSchemas = {
  200: serviceIntegrationResponseSchema,
  ...authErrorResponseSchemas,
} as const;
const serviceIntegrationSaveResponseSchemas = {
  ...serviceIntegrationReadResponseSchemas,
  422: apiErrorResponseSchema,
  503: apiErrorResponseSchema,
} as const;
const serviceIntegrationInstanceSaveResponseSchemas = {
  ...serviceIntegrationSaveResponseSchemas,
  404: apiErrorResponseSchema,
} as const;
const serviceIntegrationDeleteResponseSchemas = {
  200: deleteServiceIntegrationResponseSchema,
  ...authErrorResponseSchemas,
  404: apiErrorResponseSchema,
} as const;
const serviceIntegrationInstanceDeleteResponseSchemas = {
  ...serviceIntegrationDeleteResponseSchemas,
  422: apiErrorResponseSchema,
} as const;
const serviceIntegrationProbeResponseSchemas = {
  200: serviceIntegrationProbeResponseSchema,
  ...authErrorResponseSchemas,
  404: apiErrorResponseSchema,
  422: apiErrorResponseSchema,
  503: apiErrorResponseSchema,
} as const;
const serviceIntegrationStatusResponseSchemas = {
  200: serviceIntegrationProbeResponseSchema,
  ...authErrorResponseSchemas,
  422: apiErrorResponseSchema,
  503: apiErrorResponseSchema,
} as const;
const serviceIntegrationInstanceStatusResponseSchemas = {
  ...serviceIntegrationStatusResponseSchemas,
  404: apiErrorResponseSchema,
} as const;

function createKindBodyRouteHandler<T>(
  apiKeyService: ApiKeyService,
  authService: AuthService,
  action: (
    kind: ServiceIntegrationKind,
    input: UpsertServiceIntegrationRequest,
    actor: PublicUser | undefined,
    context: RouteRequestContext,
  ) => MaybePromise<ServiceResponse<T>>,
) {
  return async ({ body, cookie, params, request, server, status }: KindBodyRouteContext) =>
    await withServiceSettingsRouteResult(
      apiKeyService,
      authService,
      { cookie, request, server, status },
      (actor, context) =>
        action(
          params.kind as ServiceIntegrationKind,
          normalizeUpsertServiceIntegrationInput(body as RouteUpsertServiceIntegrationRequest),
          actor,
          context,
        ),
    );
}

function createInstanceBodyRouteHandler<T>(
  apiKeyService: ApiKeyService,
  authService: AuthService,
  action: (
    id: string,
    input: UpsertServiceIntegrationRequest,
    actor: PublicUser | undefined,
    context: RouteRequestContext,
  ) => MaybePromise<ServiceResponse<T>>,
) {
  return async ({ body, cookie, params, request, server, status }: InstanceBodyRouteContext) =>
    await withServiceSettingsRouteResult(
      apiKeyService,
      authService,
      { cookie, request, server, status },
      (actor, context) =>
        action(
          params.integrationId as string,
          normalizeUpsertServiceIntegrationInput(body as RouteUpsertServiceIntegrationRequest),
          actor,
          context,
        ),
    );
}

function createKindRequestRouteHandler<T>(
  apiKeyService: ApiKeyService,
  authService: AuthService,
  action: (
    kind: ServiceIntegrationKind,
    actor: PublicUser | undefined,
    context: RouteRequestContext,
  ) => MaybePromise<ServiceResponse<T>>,
) {
  return async ({ cookie, params, request, server, status }: KindRequestRouteContext) =>
    await withServiceSettingsRouteResult(
      apiKeyService,
      authService,
      { cookie, request, server, status },
      (actor, context) => action(params.kind as ServiceIntegrationKind, actor, context),
    );
}

function createInstanceRequestRouteHandler<T>(
  apiKeyService: ApiKeyService,
  authService: AuthService,
  action: (
    id: string,
    actor: PublicUser | undefined,
    context: RouteRequestContext,
  ) => MaybePromise<ServiceResponse<T>>,
) {
  return async ({ cookie, params, request, server, status }: InstanceRequestRouteContext) =>
    await withServiceSettingsRouteResult(
      apiKeyService,
      authService,
      { cookie, request, server, status },
      (actor, context) => action(params.integrationId as string, actor, context),
    );
}

function createKindStatusRouteHandler<T>(
  apiKeyService: ApiKeyService,
  authService: AuthService,
  action: (kind: ServiceIntegrationKind) => MaybePromise<ServiceResponse<T>>,
) {
  return async ({ cookie, params, request, server, status }: KindStatusRouteContext) =>
    await withServiceSettingsRouteResult(
      apiKeyService,
      authService,
      { cookie, request, server, status },
      async () => await action(params.kind as ServiceIntegrationKind),
    );
}

function createInstanceStatusRouteHandler<T>(
  apiKeyService: ApiKeyService,
  authService: AuthService,
  action: (id: string) => MaybePromise<ServiceResponse<T>>,
) {
  return async ({ cookie, params, request, server, status }: InstanceStatusRouteContext) =>
    await withServiceSettingsRouteResult(
      apiKeyService,
      authService,
      { cookie, request, server, status },
      async () => await action(params.integrationId as string),
    );
}

function withServiceSettingsRouteResult<T>(
  apiKeyService: ApiKeyService,
  authService: AuthService,
  route: BaseRouteContext,
  onAllowed: (
    actor: PublicUser | undefined,
    context: RouteRequestContext,
  ) => MaybePromise<ServiceResponse<T>>,
) {
  return withSettingsPermissionResult({
    apiKeyService,
    authService,
    sessionCookieValue: readRouteSessionCookie(route.cookie, SESSION_COOKIE_NAME),
    request: route.request,
    server: route.server,
    status: route.status as StatusHandler,
    requiredPermission: "settings:services",
    onAllowed,
  });
}

export function createServiceIntegrationRoutes(options: ServiceIntegrationRoutesOptions) {
  const authService = new AuthService(options.database);
  const apiKeyService = new ApiKeyService(options.database);
  const serviceIntegrationService = new ServiceIntegrationService(options.database, {
    secretEncryptionKey: options.secretEncryptionKey,
  });
  const createInstance = createKindBodyRouteHandler(
    apiKeyService,
    authService,
    (kind, input, actor, context) =>
      serviceIntegrationService.createConfig(kind, input, actor, context),
  );
  const saveDefault = createKindBodyRouteHandler(
    apiKeyService,
    authService,
    (kind, input, actor, context) =>
      serviceIntegrationService.upsertConfig(kind, input, actor, context),
  );
  const saveInstance = createInstanceBodyRouteHandler(
    apiKeyService,
    authService,
    (id, input, actor, context) =>
      serviceIntegrationService.updateConfigById(id, input, actor, context),
  );
  const deleteDefault = createKindRequestRouteHandler(
    apiKeyService,
    authService,
    (kind, actor, context) => serviceIntegrationService.deleteConfig(kind, actor, context),
  );
  const deleteInstance = createInstanceRequestRouteHandler(
    apiKeyService,
    authService,
    (id, actor, context) => serviceIntegrationService.deleteConfigById(id, actor, context),
  );
  const testDefault = createKindRequestRouteHandler(
    apiKeyService,
    authService,
    (kind, actor, context) => serviceIntegrationService.testConfig(kind, actor, context),
  );
  const testInstance = createInstanceRequestRouteHandler(
    apiKeyService,
    authService,
    (id, actor, context) => serviceIntegrationService.testConfigById(id, actor, context),
  );
  const readDefaultStatus = createKindStatusRouteHandler(apiKeyService, authService, (kind) =>
    serviceIntegrationService.getStatus(kind),
  );
  const readInstanceStatus = createInstanceStatusRouteHandler(apiKeyService, authService, (id) =>
    serviceIntegrationService.getStatusById(id),
  );

  return new Elysia({ prefix: "/api" })
    .get(
      "/settings/services",
      async ({ cookie, request, server, status }) =>
        await withServiceSettingsRouteResult(
          apiKeyService,
          authService,
          { cookie, request, server, status },
          async () => ({ ok: true, body: serviceIntegrationService.listConfigs() }),
        ),
      {
        cookie: sessionCookieSchema,
        response: { 200: serviceIntegrationListResponseSchema, ...authErrorResponseSchemas },
        detail: {
          summary: "List service integrations",
          description: "Returns safe service integration settings metadata without secrets.",
          tags: ["Settings"],
        },
      },
    )
    .get(
      "/settings/services/:kind",
      async ({ cookie, params, request, server, status }) =>
        await withServiceSettingsRouteResult(
          apiKeyService,
          authService,
          { cookie, request, server, status },
          async () => ({
            ok: true,
            body: serviceIntegrationService.getConfig(params.kind as ServiceIntegrationKind),
          }),
        ),
      {
        params: serviceIntegrationParamsSchema,
        cookie: sessionCookieSchema,
        response: serviceIntegrationReadResponseSchemas,
        detail: {
          summary: "Get one service integration",
          description:
            "Returns one safe service integration config or null when it is not configured.",
          tags: ["Settings"],
        },
      },
    )
    .post("/settings/services/:kind/instances", createInstance, {
      params: serviceIntegrationParamsSchema,
      body: upsertServiceIntegrationRequestSchema,
      cookie: sessionCookieSchema,
      response: serviceIntegrationSaveResponseSchemas,
      detail: {
        summary: "Create a service integration instance",
        description:
          "Creates one additional named service integration config for a supported kind.",
        tags: ["Settings"],
      },
    })
    .put("/settings/services/:kind", saveDefault, {
      params: serviceIntegrationParamsSchema,
      body: upsertServiceIntegrationRequestSchema,
      cookie: sessionCookieSchema,
      response: serviceIntegrationSaveResponseSchemas,
      detail: {
        summary: "Save service integration settings",
        description:
          "Creates or updates one service integration config while preserving stored secrets unless replaced.",
        tags: ["Settings"],
      },
    })
    .put("/settings/services/instances/:integrationId", saveInstance, {
      params: serviceIntegrationInstanceParamsSchema,
      body: upsertServiceIntegrationRequestSchema,
      cookie: sessionCookieSchema,
      response: serviceIntegrationInstanceSaveResponseSchemas,
      detail: {
        summary: "Save one service integration instance",
        description:
          "Updates one named service integration config while preserving stored secrets unless replaced.",
        tags: ["Settings"],
      },
    })
    .delete("/settings/services/:kind", deleteDefault, {
      params: serviceIntegrationParamsSchema,
      cookie: sessionCookieSchema,
      response: serviceIntegrationDeleteResponseSchemas,
      detail: {
        summary: "Delete service integration settings",
        description: "Deletes one saved service integration config.",
        tags: ["Settings"],
      },
    })
    .delete("/settings/services/instances/:integrationId", deleteInstance, {
      params: serviceIntegrationInstanceParamsSchema,
      cookie: sessionCookieSchema,
      response: serviceIntegrationInstanceDeleteResponseSchemas,
      detail: {
        summary: "Delete one additional service integration instance",
        description: "Deletes one non-default named service integration config.",
        tags: ["Settings"],
      },
    })
    .post("/settings/services/:kind/test", testDefault, {
      params: serviceIntegrationParamsSchema,
      body: emptyRequestSchema,
      cookie: sessionCookieSchema,
      response: serviceIntegrationProbeResponseSchemas,
      detail: {
        summary: "Test service integration connectivity",
        description: "Runs a live connectivity/auth probe for one configured service integration.",
        tags: ["Settings"],
      },
    })
    .post("/settings/services/instances/:integrationId/test", testInstance, {
      params: serviceIntegrationInstanceParamsSchema,
      body: emptyRequestSchema,
      cookie: sessionCookieSchema,
      response: serviceIntegrationProbeResponseSchemas,
      detail: {
        summary: "Test service integration instance connectivity",
        description: "Runs a live connectivity/auth probe for one named service integration.",
        tags: ["Settings"],
      },
    })
    .get("/settings/services/:kind/status", readDefaultStatus, {
      params: serviceIntegrationParamsSchema,
      cookie: sessionCookieSchema,
      response: serviceIntegrationStatusResponseSchemas,
      detail: {
        summary: "Read service integration status",
        description:
          "Returns normalized status for a configured, disabled, or missing service integration.",
        tags: ["Settings"],
      },
    })
    .get("/settings/services/instances/:integrationId/status", readInstanceStatus, {
      params: serviceIntegrationInstanceParamsSchema,
      cookie: sessionCookieSchema,
      response: serviceIntegrationInstanceStatusResponseSchemas,
      detail: {
        summary: "Read service integration instance status",
        description: "Returns normalized status for one saved named service integration.",
        tags: ["Settings"],
      },
    });
}

function normalizeUpsertServiceIntegrationInput(
  input: RouteUpsertServiceIntegrationRequest,
): UpsertServiceIntegrationRequest {
  if (input.authMode) {
    const { authMode, ...rest } = input;

    return {
      ...rest,
      authMode,
    };
  }

  return {
    ...input,
    authMode: "api_key",
  };
}
