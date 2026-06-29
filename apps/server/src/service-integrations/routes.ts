import {
  type ApiErrorResponse,
  type PublicUser,
  SERVICE_INTEGRATION_AUTH_MODE_VALUES,
  SERVICE_INTEGRATION_KIND_VALUES,
  SERVICE_INTEGRATION_PROBE_OUTCOME_VALUES,
  type ServiceIntegrationKind,
  type UpsertServiceIntegrationRequest,
} from "@arrtemplar/shared";
import { Elysia, t } from "elysia";
import { ApiKeyService } from "../auth/api-key.service";
import { AuthService } from "../auth/auth.service";
import { resolveRoutePrincipal } from "../auth/route-principal";
import { createRequestContext } from "../auth/routes";
import { SESSION_COOKIE_NAME } from "../auth/session-token";
import type { DatabaseClient } from "../db/client";
import { ServiceIntegrationService } from "./service-integration.service";

// biome-ignore lint/suspicious/noExplicitAny: Elysia SelectiveStatus callback types vary per route and are impractical to model precisely in these shared helpers.
type StatusHandler = (...args: any[]) => any;

type ServiceIntegrationRoutesOptions = {
  database: DatabaseClient;
  secretEncryptionKey: string | null;
};
type RequestContextServer = Parameters<typeof createRequestContext>[1];
type ServiceResponse<T> =
  | { ok: true; body: T }
  | { ok: false; status: number; body: ApiErrorResponse };
type MaybePromise<T> = T | Promise<T>;
type RouteRequestContext = ReturnType<typeof createRequestContext>;
type BaseRouteContext = {
  cookie: Record<string, { value?: unknown } | undefined>;
  request: Request;
  server: RequestContextServer;
  status: unknown;
};
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
const apiErrorResponseSchema = t.Object({
  error: t.Object({
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
});
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
  authMode: serviceIntegrationAuthModeSchema,
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
    await withSettingsRequestResultAsync(
      apiKeyService,
      authService,
      readRouteSessionCookie(cookie),
      request,
      server,
      status as StatusHandler,
      (actor, context) =>
        action(
          params.kind as ServiceIntegrationKind,
          body as UpsertServiceIntegrationRequest,
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
    await withSettingsRequestResultAsync(
      apiKeyService,
      authService,
      readRouteSessionCookie(cookie),
      request,
      server,
      status as StatusHandler,
      (actor, context) =>
        action(
          params.integrationId as string,
          body as UpsertServiceIntegrationRequest,
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
    await withSettingsRequestResultAsync(
      apiKeyService,
      authService,
      readRouteSessionCookie(cookie),
      request,
      server,
      status as StatusHandler,
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
    await withSettingsRequestResultAsync(
      apiKeyService,
      authService,
      readRouteSessionCookie(cookie),
      request,
      server,
      status as StatusHandler,
      (actor, context) => action(params.integrationId as string, actor, context),
    );
}

function createKindStatusRouteHandler<T>(
  apiKeyService: ApiKeyService,
  authService: AuthService,
  action: (kind: ServiceIntegrationKind) => MaybePromise<ServiceResponse<T>>,
) {
  return async ({ cookie, params, request, server, status }: KindStatusRouteContext) =>
    await withSettingsRequestResultAsync(
      apiKeyService,
      authService,
      readRouteSessionCookie(cookie),
      request,
      server,
      status as StatusHandler,
      async () => await action(params.kind as ServiceIntegrationKind),
    );
}

function createInstanceStatusRouteHandler<T>(
  apiKeyService: ApiKeyService,
  authService: AuthService,
  action: (id: string) => MaybePromise<ServiceResponse<T>>,
) {
  return async ({ cookie, params, request, server, status }: InstanceStatusRouteContext) =>
    await withSettingsRequestResultAsync(
      apiKeyService,
      authService,
      readRouteSessionCookie(cookie),
      request,
      server,
      status as StatusHandler,
      async () => await action(params.integrationId as string),
    );
}

function readRouteSessionCookie(cookie: Record<string, { value?: unknown } | undefined>): unknown {
  return cookie[SESSION_COOKIE_NAME]?.value;
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
        await withSettingsRequestResultAsync(
          apiKeyService,
          authService,
          readRouteSessionCookie(cookie),
          request,
          server,
          status as StatusHandler,
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
        await withSettingsRequestResultAsync(
          apiKeyService,
          authService,
          readRouteSessionCookie(cookie),
          request,
          server,
          status as StatusHandler,
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

async function withSettingsRequestResultAsync<T>(
  apiKeyService: ApiKeyService,
  authService: AuthService,
  sessionCookieValue: unknown,
  request: Request,
  server: RequestContextServer,
  status: StatusHandler,
  onAllowed: (
    actor: PublicUser | undefined,
    context: ReturnType<typeof createRequestContext>,
  ) => MaybePromise<ServiceResponse<T>>,
): Promise<T | ReturnType<StatusHandler>> {
  const context = createRequestContext(request, server);
  const principalResult = resolveRoutePrincipal({
    apiKeyService,
    authService,
    context,
    request,
    requiredPermission: "settings:services",
    sessionToken: readSessionToken(sessionCookieValue),
  });

  if (!principalResult.ok) {
    return status(principalResult.status, principalResult.body);
  }

  return responseOrStatus(
    await onAllowed(
      principalResult.principal.kind === "session" ? principalResult.principal.user : undefined,
      context,
    ),
    status,
  );
}

function responseOrStatus<T>(
  result: { ok: true; body: T } | { ok: false; status: number; body: ApiErrorResponse },
  status: StatusHandler,
): T | ReturnType<StatusHandler> {
  return result.ok ? result.body : status(result.status, result.body);
}

function readSessionToken(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}
