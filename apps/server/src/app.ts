import { extname, join } from "node:path";
import { APP_LOG_CATEGORY, APP_NAME, APP_VERSION, type HealthResponse } from "@arrtemplar/shared";
import { cors } from "@elysia/cors";
import { openapi } from "@elysia/openapi";
import { elysiaLogger } from "@logtape/elysia";
import { getLogger } from "@logtape/logtape";
import { Elysia, t } from "elysia";
import { elysiaHelmet } from "elysiajs-helmet";
import type { LoginRateLimiter } from "./auth/rate-limit";
import { createAuthRoutes } from "./auth/routes";
import { env } from "./config/env";
import { createDatabase, type DatabaseClient } from "./db/client";
import { createHelpRoutes } from "./help/routes";
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
const frontendImmutableCacheControl = "public, max-age=31536000, immutable";
const frontendNoCacheControl = "no-cache";
const missingFrontendIndexWarnings = new Set<string>();
const serverLogger = getLogger([APP_LOG_CATEGORY, "server"]);

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
  frontendDistRoot?: string | null;
  loginRateLimiter?: LoginRateLimiter;
  oauthClientSecretEncryptionKey?: string | null;
  sessionCookieSecure?: boolean;
};

export function createApp(options: CreateAppOptions = {}) {
  const database = options.database ?? createDatabase();
  const frontendBuildConfig = resolveFrontendBuildConfig(
    "frontendDistRoot" in options ? options.frontendDistRoot : env.frontendDistRoot,
  );
  const authRoutesOptions = {
    database,
    oauthClientSecretEncryptionKey:
      "oauthClientSecretEncryptionKey" in options
        ? options.oauthClientSecretEncryptionKey
        : env.oauthClientSecretEncryptionKey,
    sessionCookieSecure: options.sessionCookieSecure ?? env.sessionCookieSecure,
    ...(options.loginRateLimiter ? { rateLimiter: options.loginRateLimiter } : {}),
  };

  const app = new Elysia()
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
            { name: "Help", description: "Help tickets, attachments, and FAQ scaffolding" },
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
      createHelpRoutes({
        database,
        scanMode: env.helpTicketScanMode,
        storageRoot: env.helpTicketStorageRoot,
      }),
    )
    .use(
      createServiceIntegrationRoutes({
        database,
        secretEncryptionKey: authRoutesOptions.oauthClientSecretEncryptionKey,
      }),
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

  if (frontendBuildConfig) {
    serverLogger.info("Frontend static serving enabled from {distRoot}", {
      event: "frontend.static.enabled",
      distRoot: frontendBuildConfig.distRoot,
    });

    return app.get("/*", ({ request }) =>
      serveFrontendRequest(new URL(request.url).pathname, frontendBuildConfig),
    );
  }

  return app.get(
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

type FrontendBuildConfig = {
  distRoot: string;
  indexPath: string;
};

type FrontendAssetKind = "asset" | "index";

type FrontendAssetResolution =
  | {
      kind: "root";
    }
  | {
      kind: "asset";
      assetPath: string;
    }
  | {
      kind: "invalid";
    };

function resolveFrontendBuildConfig(
  frontendDistRoot: string | null | undefined,
): FrontendBuildConfig | null {
  const distRoot = frontendDistRoot?.trim();

  if (!distRoot) {
    return null;
  }

  return {
    distRoot,
    indexPath: join(distRoot, "index.html"),
  };
}

async function serveFrontendRequest(
  pathname: string,
  frontendBuildConfig: FrontendBuildConfig,
): Promise<Response> {
  if (isReservedBackendPath(pathname)) {
    return new Response("Not Found", { status: 404 });
  }

  const assetResolution = resolveFrontendAssetPath(pathname, frontendBuildConfig.distRoot);

  if (assetResolution.kind === "invalid") {
    return new Response("Not Found", { status: 404 });
  }

  try {
    if (assetResolution.kind === "asset") {
      const assetFile = Bun.file(assetResolution.assetPath);

      if (await assetFile.exists()) {
        return createFrontendFileResponse(
          assetFile,
          resolveFrontendAssetCachePolicy(pathname),
          "asset",
        );
      }

      if (extname(assetResolution.assetPath)) {
        return new Response("Not Found", { status: 404 });
      }
    }

    const indexFile = Bun.file(frontendBuildConfig.indexPath);

    if (await indexFile.exists()) {
      return createFrontendFileResponse(indexFile, frontendNoCacheControl, "index");
    }

    logMissingFrontendIndex(frontendBuildConfig);
    return new Response("Frontend build is missing index.html.", { status: 500 });
  } catch (error) {
    logFrontendStaticError(assetResolution.kind === "asset" ? "asset" : "index", error);
    return new Response("Failed to serve frontend asset.", { status: 500 });
  }
}

function isReservedBackendPath(pathname: string): boolean {
  return ["/api", "/health", "/openapi"].some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function resolveFrontendAssetPath(pathname: string, distRoot: string): FrontendAssetResolution {
  let decodedPath: string;

  try {
    decodedPath = decodeURIComponent(pathname).replaceAll("\\", "/");
  } catch {
    return { kind: "invalid" };
  }

  const pathSegments = decodedPath.split("/").filter(Boolean);

  if (pathSegments.length === 0) {
    return { kind: "root" };
  }

  if (pathSegments.some((segment) => segment === "..")) {
    return { kind: "invalid" };
  }

  return {
    kind: "asset",
    assetPath: join(distRoot, ...pathSegments),
  };
}

function createFrontendFileResponse(
  file: ReturnType<typeof Bun.file>,
  cachePolicy: string,
  assetKind: FrontendAssetKind,
): Response {
  const headers = new Headers({
    "Cache-Control": cachePolicy,
  });

  if (file.type) {
    headers.set("Content-Type", file.type);
  }

  serverLogger.debug("Served frontend asset {assetKind} with cache policy {cachePolicy}", {
    event: "frontend.static.served",
    assetKind,
    cachePolicy,
  });

  return new Response(file, { headers });
}

function resolveFrontendAssetCachePolicy(pathname: string): string {
  return pathname === "/assets" || pathname.startsWith("/assets/")
    ? frontendImmutableCacheControl
    : frontendNoCacheControl;
}

function logMissingFrontendIndex(frontendBuildConfig: FrontendBuildConfig): void {
  if (missingFrontendIndexWarnings.has(frontendBuildConfig.indexPath)) {
    return;
  }

  missingFrontendIndexWarnings.add(frontendBuildConfig.indexPath);
  serverLogger.warn("Frontend build index is missing from {distRoot}", {
    event: "frontend.static.index_missing",
    distRoot: frontendBuildConfig.distRoot,
  });
}

function logFrontendStaticError(assetKind: FrontendAssetKind, error: unknown): void {
  serverLogger.error("Failed to serve frontend asset {assetKind}", {
    event: "frontend.static.error",
    assetKind,
    errorName: error instanceof Error ? error.name : "UnknownError",
  });
}
