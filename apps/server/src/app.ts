import { APP_LOG_CATEGORY, APP_NAME, APP_VERSION, type HealthResponse } from "@arrtemplar/shared";
import { cors } from "@elysia/cors";
import { openapi } from "@elysia/openapi";
import { elysiaLogger } from "@logtape/elysia";
import { Elysia, t } from "elysia";
import { elysiaHelmet } from "elysiajs-helmet";
import type { LoginRateLimiter } from "./auth/rate-limit";
import { createAuthRoutes } from "./auth/routes";
import { env } from "./config/env";
import { createDatabase, type DatabaseClient } from "./db/client";
import {
  corsAllowedHeaders,
  corsAllowedMethods,
  removeRejectedOriginCredentials,
} from "./security/cors";
import { enforceCsrfPolicy } from "./security/csrf";
import { handleSafeError } from "./security/errors";
import { appendSupplementalCspDirectives, securityHeaderConfig } from "./security/headers";
import { createServiceIntegrationRoutes } from "./service-integrations/routes";

const requestIdPattern = /^[A-Za-z0-9._:-]{1,128}$/;

const healthResponseSchema = t.Object({
  name: t.Literal(APP_NAME),
  version: t.String(),
  status: t.Literal("ok"),
  timestamp: t.String({ format: "date-time" }),
});

const backendRootResponseSchema = t.Object({
  name: t.Literal(APP_NAME),
  version: t.String(),
  service: t.Literal("backend"),
  frontendUrl: t.String({ format: "uri" }),
  links: t.Object({
    frontend: t.String({ format: "uri" }),
    health: t.String({ format: "uri" }),
    openapi: t.String({ format: "uri" }),
  }),
});

type BackendRootResponse = {
  name: typeof APP_NAME;
  version: string;
  service: "backend";
  frontendUrl: string;
  links: {
    frontend: string;
    health: string;
    openapi: string;
  };
};

type RequestLogContext = {
  path: string;
  request: Request;
  set: {
    headers: Record<string, string | undefined>;
    status?: number | string;
  };
};

export type CreateAppOptions = {
  database?: DatabaseClient;
  loginRateLimiter?: LoginRateLimiter;
  oauthClientSecretEncryptionKey?: string | null;
  sessionCookieSecure?: boolean;
};

export function createApp(options: CreateAppOptions = {}) {
  const database = options.database ?? createDatabase();
  const authRoutesOptions = {
    database,
    oauthClientSecretEncryptionKey:
      "oauthClientSecretEncryptionKey" in options
        ? options.oauthClientSecretEncryptionKey
        : env.oauthClientSecretEncryptionKey,
    sessionCookieSecure: options.sessionCookieSecure ?? env.sessionCookieSecure,
    ...(options.loginRateLimiter ? { rateLimiter: options.loginRateLimiter } : {}),
  };

  return new Elysia()
    .use(
      elysiaLogger({
        category: [APP_LOG_CATEGORY, "http"],
        level: "info",
        logRequest: false,
        scope: "global",
        context: {
          requestId: {
            generate: () => Bun.randomUUIDv7(),
            normalize: normalizeRequestId,
          },
        },
        skip: ({ path }) => path === "/health",
        format: (context: RequestLogContext, responseTime: number) => ({
          event: "http.request",
          method: context.request.method,
          url: context.path,
          path: context.path,
          status: normalizeStatusCode(context.set.status, readResponseValue(context)),
          durationMs: responseTime,
          responseTime,
          contentLength: context.set.headers["content-length"],
        }),
      }),
    )
    .use(
      cors({
        origin: env.webOrigin,
        credentials: true,
        methods: corsAllowedMethods,
        allowedHeaders: corsAllowedHeaders,
      }),
    )
    .onRequest(removeRejectedOriginCredentials(env.webOrigin))
    .use(elysiaHelmet(securityHeaderConfig))
    .onAfterHandle(appendSupplementalCspDirectives)
    .onRequest(enforceCsrfPolicy(env.webOrigin))
    .onError(handleSafeError)
    .use(
      openapi({
        documentation: {
          info: {
            title: `${APP_NAME} API`,
            version: APP_VERSION,
            description: `${APP_NAME} API — extend for your domain.`,
          },
          tags: [
            { name: "System", description: "Application status and diagnostics" },
            { name: "Auth", description: "Authentication, sessions, and role checks" },
            {
              name: "Settings",
              description: "Admin-controlled settings and integration endpoints",
            },
          ],
        },
      }),
    )
    .use(createAuthRoutes(authRoutesOptions))
    .use(
      createServiceIntegrationRoutes({
        database,
        secretEncryptionKey: authRoutesOptions.oauthClientSecretEncryptionKey,
      }),
    )
    .get(
      "/",
      ({ request }): BackendRootResponse => ({
        name: APP_NAME,
        version: APP_VERSION,
        service: "backend",
        frontendUrl: env.webOrigin,
        links: {
          frontend: env.webOrigin,
          health: resolveRequestUrl("/health", request),
          openapi: resolveRequestUrl("/openapi", request),
        },
      }),
      {
        response: backendRootResponseSchema,
        detail: {
          summary: "Show backend service links",
          description:
            "Confirms the Elysia API is running and points developers to the Vite frontend, health endpoint, and OpenAPI UI.",
          tags: ["System"],
        },
      },
    )
    .get(
      "/health",
      (): HealthResponse => ({
        name: APP_NAME,
        version: APP_VERSION,
        status: "ok",
        timestamp: new Date().toISOString(),
      }),
      {
        response: healthResponseSchema,
        detail: {
          summary: "Check API health",
          description: "Returns basic service status for frontend and deployment smoke tests.",
          tags: ["System"],
        },
      },
    );
}

export type App = ReturnType<typeof createApp>;

function resolveRequestUrl(path: string, request: Request): string {
  return new URL(path, request.url).toString();
}

function normalizeStatusCode(status: number | string | undefined, responseValue: unknown): number {
  const responseStatus = readCustomStatusCode(responseValue);

  if (responseStatus !== null) {
    return responseStatus;
  }

  if (typeof status === "number") {
    return status;
  }

  if (status) {
    return Number(status);
  }

  return 200;
}

function readResponseValue(context: object): unknown {
  return "responseValue" in context ? context.responseValue : null;
}

function readCustomStatusCode(responseValue: unknown): number | null {
  if (!responseValue || typeof responseValue !== "object" || !("code" in responseValue)) {
    return null;
  }

  return typeof responseValue.code === "number" ? responseValue.code : null;
}

function normalizeRequestId(value: string): string | null {
  const requestId = value.trim();

  return requestIdPattern.test(requestId) ? requestId : null;
}
