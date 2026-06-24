import {
  type ApiErrorResponse,
  DOWNLOAD_CLIENT_AUTH_MODE_VALUES,
  DOWNLOAD_CLIENT_KIND_VALUES,
  DOWNLOAD_CLIENT_PROBE_OUTCOME_VALUES,
  type DownloadClientKind,
  type PublicUser,
  type UpsertDownloadClientRequest,
} from "@arrtemplar/shared";
import { Elysia, t } from "elysia";
import { AuthService } from "../auth/auth.service";
import { createRequestContext } from "../auth/routes";
import { SESSION_COOKIE_NAME } from "../auth/session-token";
import type { DatabaseClient } from "../db/client";
import { DownloadClientService } from "./download-client.service";

// biome-ignore lint/suspicious/noExplicitAny: Elysia SelectiveStatus callback types vary per route and are impractical to model precisely in these shared helpers.
type StatusHandler = (...args: any[]) => any;

type DownloadClientRoutesOptions = {
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
  params: { clientId: unknown };
};
type KindRequestRouteContext = BaseRouteContext & { params: { kind: unknown } };
type InstanceRequestRouteContext = BaseRouteContext & { params: { clientId: unknown } };
type KindStatusRouteContext = {
  cookie: Record<string, { value?: unknown } | undefined>;
  params: { kind: unknown };
  status: unknown;
};
type InstanceStatusRouteContext = {
  cookie: Record<string, { value?: unknown } | undefined>;
  params: { clientId: unknown };
  status: unknown;
};

const downloadClientKindSchema = t.Union(
  DOWNLOAD_CLIENT_KIND_VALUES.map((kind) => t.Literal(kind)) as [
    ReturnType<typeof t.Literal>,
    ...ReturnType<typeof t.Literal>[],
  ],
);
const downloadClientAuthModeSchema = t.Union(
  DOWNLOAD_CLIENT_AUTH_MODE_VALUES.map((mode) => t.Literal(mode)) as [
    ReturnType<typeof t.Literal>,
    ...ReturnType<typeof t.Literal>[],
  ],
);
const downloadClientProbeOutcomeSchema = t.Union(
  DOWNLOAD_CLIENT_PROBE_OUTCOME_VALUES.map((outcome) => t.Literal(outcome)) as [
    ReturnType<typeof t.Literal>,
    ...ReturnType<typeof t.Literal>[],
  ],
);

const downloadClientParamsSchema = t.Object({ kind: downloadClientKindSchema });
const downloadClientInstanceParamsSchema = t.Object({ clientId: t.String({ minLength: 1 }) });
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
const downloadClientSavedConfigSchema = t.Object({
  id: t.String({ minLength: 1 }),
  kind: downloadClientKindSchema,
  displayName: t.String({ minLength: 1 }),
  isDefault: t.Boolean(),
  enabled: t.Boolean(),
  useSsl: t.Boolean(),
  host: t.String({ minLength: 1 }),
  port: t.Number({ minimum: 1, maximum: 65_535 }),
  urlBase: t.Union([t.String(), t.Null()]),
  authMode: downloadClientAuthModeSchema,
  username: t.Union([t.String(), t.Null()]),
  hasApiKey: t.Boolean(),
  hasPassword: t.Boolean(),
  lastTestedAt: t.Union([t.String({ format: "date-time" }), t.Null()]),
  lastTestOutcome: t.Union([downloadClientProbeOutcomeSchema, t.Null()]),
  lastTestMessage: t.Union([t.String(), t.Null()]),
  lastStatusCheckedAt: t.Union([t.String({ format: "date-time" }), t.Null()]),
  lastStatusOutcome: t.Union([downloadClientProbeOutcomeSchema, t.Null()]),
  lastStatusMessage: t.Union([t.String(), t.Null()]),
  createdAt: t.String({ format: "date-time" }),
  updatedAt: t.String({ format: "date-time" }),
});
const downloadClientResponseSchema = t.Object({
  client: t.Union([downloadClientSavedConfigSchema, t.Null()]),
});
const downloadClientListResponseSchema = t.Object({
  clients: t.Array(downloadClientSavedConfigSchema),
});
const downloadClientProbeResultSchema = t.Object({
  kind: downloadClientKindSchema,
  configured: t.Boolean(),
  enabled: t.Boolean(),
  outcome: downloadClientProbeOutcomeSchema,
  summary: t.String(),
  checkedAt: t.String({ format: "date-time" }),
  reachable: t.Boolean(),
  authenticated: t.Boolean(),
  compatible: t.Boolean(),
  version: t.Union([t.String(), t.Null()]),
  webApiVersion: t.Union([t.String(), t.Null()]),
  connectionState: t.Union([t.String(), t.Null()]),
});
const downloadClientProbeResponseSchema = t.Object({
  result: downloadClientProbeResultSchema,
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
const deleteDownloadClientResponseSchema = t.Object({
  status: t.Literal("ok"),
  deletedId: t.String({ minLength: 1 }),
  deletedKind: downloadClientKindSchema,
});
const upsertDownloadClientRequestSchema = t.Object({
  displayName: t.Optional(t.Union([t.String(), t.Null()])),
  enabled: t.Boolean(),
  useSsl: t.Boolean(),
  host: t.String({ minLength: 1 }),
  port: t.Number({ minimum: 1, maximum: 65_535 }),
  urlBase: t.Optional(t.Union([t.String(), t.Null()])),
  authMode: downloadClientAuthModeSchema,
  username: t.Optional(t.Union([t.String(), t.Null()])),
  apiKey: t.Optional(t.String()),
  password: t.Optional(t.String()),
});
const emptyRequestSchema = t.Object({});
const authErrorResponseSchemas = {
  401: apiErrorResponseSchema,
  403: apiErrorResponseSchema,
} as const;
const downloadClientReadResponseSchemas = {
  200: downloadClientResponseSchema,
  ...authErrorResponseSchemas,
} as const;
const downloadClientSaveResponseSchemas = {
  ...downloadClientReadResponseSchemas,
  422: apiErrorResponseSchema,
  503: apiErrorResponseSchema,
} as const;
const downloadClientInstanceSaveResponseSchemas = {
  ...downloadClientSaveResponseSchemas,
  404: apiErrorResponseSchema,
} as const;
const downloadClientDeleteResponseSchemas = {
  200: deleteDownloadClientResponseSchema,
  ...authErrorResponseSchemas,
  404: apiErrorResponseSchema,
} as const;
const downloadClientInstanceDeleteResponseSchemas = {
  ...downloadClientDeleteResponseSchemas,
  422: apiErrorResponseSchema,
} as const;
const downloadClientProbeResponseSchemas = {
  200: downloadClientProbeResponseSchema,
  ...authErrorResponseSchemas,
  404: apiErrorResponseSchema,
  422: apiErrorResponseSchema,
  503: apiErrorResponseSchema,
} as const;
const downloadClientStatusResponseSchemas = {
  200: downloadClientProbeResponseSchema,
  ...authErrorResponseSchemas,
  422: apiErrorResponseSchema,
  503: apiErrorResponseSchema,
} as const;
const downloadClientInstanceStatusResponseSchemas = {
  ...downloadClientStatusResponseSchemas,
  404: apiErrorResponseSchema,
} as const;

function createKindBodyRouteHandler<T>(
  authService: AuthService,
  action: (
    kind: DownloadClientKind,
    input: UpsertDownloadClientRequest,
    user: PublicUser,
    context: RouteRequestContext,
  ) => MaybePromise<ServiceResponse<T>>,
) {
  return async ({ body, cookie, params, request, server, status }: KindBodyRouteContext) =>
    await withSettingsRequestResultAsync(
      authService,
      readRouteSessionCookie(cookie),
      status as StatusHandler,
      request,
      server,
      (user, context) =>
        action(
          params.kind as DownloadClientKind,
          body as UpsertDownloadClientRequest,
          user,
          context,
        ),
    );
}

function createInstanceBodyRouteHandler<T>(
  authService: AuthService,
  action: (
    id: string,
    input: UpsertDownloadClientRequest,
    user: PublicUser,
    context: RouteRequestContext,
  ) => MaybePromise<ServiceResponse<T>>,
) {
  return async ({ body, cookie, params, request, server, status }: InstanceBodyRouteContext) =>
    await withSettingsRequestResultAsync(
      authService,
      readRouteSessionCookie(cookie),
      status as StatusHandler,
      request,
      server,
      (user, context) =>
        action(params.clientId as string, body as UpsertDownloadClientRequest, user, context),
    );
}

function createKindRequestRouteHandler<T>(
  authService: AuthService,
  action: (
    kind: DownloadClientKind,
    user: PublicUser,
    context: RouteRequestContext,
  ) => MaybePromise<ServiceResponse<T>>,
) {
  return async ({ cookie, params, request, server, status }: KindRequestRouteContext) =>
    await withSettingsRequestResultAsync(
      authService,
      readRouteSessionCookie(cookie),
      status as StatusHandler,
      request,
      server,
      (user, context) => action(params.kind as DownloadClientKind, user, context),
    );
}

function createInstanceRequestRouteHandler<T>(
  authService: AuthService,
  action: (
    id: string,
    user: PublicUser,
    context: RouteRequestContext,
  ) => MaybePromise<ServiceResponse<T>>,
) {
  return async ({ cookie, params, request, server, status }: InstanceRequestRouteContext) =>
    await withSettingsRequestResultAsync(
      authService,
      readRouteSessionCookie(cookie),
      status as StatusHandler,
      request,
      server,
      (user, context) => action(params.clientId as string, user, context),
    );
}

function createKindStatusRouteHandler<T>(
  authService: AuthService,
  action: (kind: DownloadClientKind) => MaybePromise<ServiceResponse<T>>,
) {
  return async ({ cookie, params, status }: KindStatusRouteContext) =>
    await withSettingsServiceResultAsync(
      authService,
      readRouteSessionCookie(cookie),
      status as StatusHandler,
      () => action(params.kind as DownloadClientKind),
    );
}

function createInstanceStatusRouteHandler<T>(
  authService: AuthService,
  action: (id: string) => MaybePromise<ServiceResponse<T>>,
) {
  return async ({ cookie, params, status }: InstanceStatusRouteContext) =>
    await withSettingsServiceResultAsync(
      authService,
      readRouteSessionCookie(cookie),
      status as StatusHandler,
      () => action(params.clientId as string),
    );
}

function readRouteSessionCookie(cookie: Record<string, { value?: unknown } | undefined>): unknown {
  return cookie[SESSION_COOKIE_NAME]?.value;
}

export function createDownloadClientRoutes(options: DownloadClientRoutesOptions) {
  const authService = new AuthService(options.database);
  const downloadClientService = new DownloadClientService(options.database, {
    secretEncryptionKey: options.secretEncryptionKey,
  });
  const createInstance = createKindBodyRouteHandler(authService, (kind, input, user, context) =>
    downloadClientService.createConfig(kind, input, user, context),
  );
  const saveDefault = createKindBodyRouteHandler(authService, (kind, input, user, context) =>
    downloadClientService.upsertConfig(kind, input, user, context),
  );
  const saveInstance = createInstanceBodyRouteHandler(authService, (id, input, user, context) =>
    downloadClientService.updateConfigById(id, input, user, context),
  );
  const deleteDefault = createKindRequestRouteHandler(authService, (kind, user, context) =>
    downloadClientService.deleteConfig(kind, user, context),
  );
  const deleteInstance = createInstanceRequestRouteHandler(authService, (id, user, context) =>
    downloadClientService.deleteConfigById(id, user, context),
  );
  const testDefault = createKindRequestRouteHandler(authService, (kind, user, context) =>
    downloadClientService.testConfig(kind, user, context),
  );
  const testInstance = createInstanceRequestRouteHandler(authService, (id, user, context) =>
    downloadClientService.testConfigById(id, user, context),
  );
  const readDefaultStatus = createKindStatusRouteHandler(authService, (kind) =>
    downloadClientService.getStatus(kind),
  );
  const readInstanceStatus = createInstanceStatusRouteHandler(authService, (id) =>
    downloadClientService.getStatusById(id),
  );

  return new Elysia({ prefix: "/api" })
    .get(
      "/settings/services",
      ({ cookie, status }) =>
        withSettingsServices(
          authService,
          cookie[SESSION_COOKIE_NAME]?.value,
          status as StatusHandler,
          () => downloadClientService.listConfigs(),
        ),
      {
        cookie: sessionCookieSchema,
        response: { 200: downloadClientListResponseSchema, ...authErrorResponseSchemas },
        detail: {
          summary: "List download client settings",
          description: "Returns safe download client settings metadata without secrets.",
          tags: ["Settings"],
        },
      },
    )
    .get(
      "/settings/services/:kind",
      ({ cookie, params, status }) =>
        withSettingsServices(
          authService,
          cookie[SESSION_COOKIE_NAME]?.value,
          status as StatusHandler,
          () => downloadClientService.getConfig(params.kind as DownloadClientKind),
        ),
      {
        params: downloadClientParamsSchema,
        cookie: sessionCookieSchema,
        response: downloadClientReadResponseSchemas,
        detail: {
          summary: "Get one download client setting",
          description: "Returns one safe download client config or null when it is not configured.",
          tags: ["Settings"],
        },
      },
    )
    .post("/settings/services/:kind/instances", createInstance, {
      params: downloadClientParamsSchema,
      body: upsertDownloadClientRequestSchema,
      cookie: sessionCookieSchema,
      response: downloadClientSaveResponseSchemas,
      detail: {
        summary: "Create a download client instance",
        description: "Creates one additional named download client config for a supported kind.",
        tags: ["Settings"],
      },
    })
    .put("/settings/services/:kind", saveDefault, {
      params: downloadClientParamsSchema,
      body: upsertDownloadClientRequestSchema,
      cookie: sessionCookieSchema,
      response: downloadClientSaveResponseSchemas,
      detail: {
        summary: "Save download client settings",
        description:
          "Creates or updates one download client config while preserving stored secrets unless replaced.",
        tags: ["Settings"],
      },
    })
    .put("/settings/services/instances/:clientId", saveInstance, {
      params: downloadClientInstanceParamsSchema,
      body: upsertDownloadClientRequestSchema,
      cookie: sessionCookieSchema,
      response: downloadClientInstanceSaveResponseSchemas,
      detail: {
        summary: "Save one download client instance",
        description:
          "Updates one named download client config while preserving stored secrets unless replaced.",
        tags: ["Settings"],
      },
    })
    .delete("/settings/services/:kind", deleteDefault, {
      params: downloadClientParamsSchema,
      cookie: sessionCookieSchema,
      response: downloadClientDeleteResponseSchemas,
      detail: {
        summary: "Delete download client settings",
        description: "Deletes one saved download client config.",
        tags: ["Settings"],
      },
    })
    .delete("/settings/services/instances/:clientId", deleteInstance, {
      params: downloadClientInstanceParamsSchema,
      cookie: sessionCookieSchema,
      response: downloadClientInstanceDeleteResponseSchemas,
      detail: {
        summary: "Delete one additional download client instance",
        description: "Deletes one non-default named download client config.",
        tags: ["Settings"],
      },
    })
    .post("/settings/services/:kind/test", testDefault, {
      params: downloadClientParamsSchema,
      body: emptyRequestSchema,
      cookie: sessionCookieSchema,
      response: downloadClientProbeResponseSchemas,
      detail: {
        summary: "Test download client connectivity",
        description: "Runs a live connectivity/auth probe for one configured download client.",
        tags: ["Settings"],
      },
    })
    .post("/settings/services/instances/:clientId/test", testInstance, {
      params: downloadClientInstanceParamsSchema,
      body: emptyRequestSchema,
      cookie: sessionCookieSchema,
      response: downloadClientProbeResponseSchemas,
      detail: {
        summary: "Test download client instance connectivity",
        description: "Runs a live connectivity/auth probe for one named download client.",
        tags: ["Settings"],
      },
    })
    .get("/settings/services/:kind/status", readDefaultStatus, {
      params: downloadClientParamsSchema,
      cookie: sessionCookieSchema,
      response: downloadClientStatusResponseSchemas,
      detail: {
        summary: "Read download client status",
        description:
          "Returns normalized status for a configured, disabled, or missing download client.",
        tags: ["Settings"],
      },
    })
    .get("/settings/services/instances/:clientId/status", readInstanceStatus, {
      params: downloadClientInstanceParamsSchema,
      cookie: sessionCookieSchema,
      response: downloadClientInstanceStatusResponseSchemas,
      detail: {
        summary: "Read download client instance status",
        description: "Returns normalized status for one saved named download client.",
        tags: ["Settings"],
      },
    });
}

async function withSettingsServiceResultAsync<T>(
  authService: AuthService,
  sessionCookieValue: unknown,
  status: StatusHandler,
  onAllowed: (user: PublicUser) => MaybePromise<ServiceResponse<T>>,
): Promise<T | ReturnType<StatusHandler>> {
  return await withSettingsServicesAsync(authService, sessionCookieValue, status, async (user) =>
    responseOrStatus(await onAllowed(user), status),
  );
}

async function withSettingsRequestResultAsync<T>(
  authService: AuthService,
  sessionCookieValue: unknown,
  status: StatusHandler,
  request: Request,
  server: RequestContextServer,
  onAllowed: (
    user: PublicUser,
    context: ReturnType<typeof createRequestContext>,
  ) => MaybePromise<ServiceResponse<T>>,
): Promise<T | ReturnType<StatusHandler>> {
  return await withSettingsServiceResultAsync(authService, sessionCookieValue, status, (user) =>
    onAllowed(user, createRequestContext(request, server)),
  );
}

function withSettingsServices<T>(
  authService: AuthService,
  sessionCookieValue: unknown,
  status: StatusHandler,
  onAllowed: (user: PublicUser) => T,
): T | ReturnType<StatusHandler> {
  const permissionResult = authService.requirePermission(
    readSessionToken(sessionCookieValue),
    "settings:services",
  );

  if (!permissionResult.ok) {
    return status(permissionResult.status, permissionResult.body);
  }

  return onAllowed(permissionResult.user);
}

async function withSettingsServicesAsync<T>(
  authService: AuthService,
  sessionCookieValue: unknown,
  status: StatusHandler,
  onAllowed: (user: PublicUser) => Promise<T>,
): Promise<T | ReturnType<StatusHandler>> {
  const permissionResult = authService.requirePermission(
    readSessionToken(sessionCookieValue),
    "settings:services",
  );

  if (!permissionResult.ok) {
    return status(permissionResult.status, permissionResult.body);
  }

  return await onAllowed(permissionResult.user);
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
