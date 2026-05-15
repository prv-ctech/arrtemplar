import { APP_NAME, APP_VERSION, type HealthResponse } from "@arrweeb-anime/shared";
import { cors } from "@elysia/cors";
import { openapi } from "@elysia/openapi";
import { Elysia, t } from "elysia";
import type { LoginRateLimiter } from "./auth/rate-limit";
import { createAuthRoutes } from "./auth/routes";
import { env } from "./config/env";
import { createDatabase, type DatabaseClient } from "./db/client";

const healthResponseSchema = t.Object({
  name: t.Literal(APP_NAME),
  version: t.String(),
  status: t.Literal("ok"),
  timestamp: t.String({ format: "date-time" }),
});

export type CreateAppOptions = {
  database?: DatabaseClient;
  loginRateLimiter?: LoginRateLimiter;
  sessionCookieSecure?: boolean;
};

export function createApp(options: CreateAppOptions = {}) {
  const database = options.database ?? createDatabase();
  const authRoutesOptions = {
    database,
    sessionCookieSecure: options.sessionCookieSecure ?? env.sessionCookieSecure,
    ...(options.loginRateLimiter ? { rateLimiter: options.loginRateLimiter } : {}),
  };

  return new Elysia()
    .use(
      cors({
        origin: env.webOrigin,
        credentials: true,
      }),
    )
    .use(
      openapi({
        documentation: {
          info: {
            title: `${APP_NAME} API`,
            version: APP_VERSION,
            description: "Anime-native media request, automation, and watching API.",
          },
          tags: [
            { name: "System", description: "Application status and diagnostics" },
            { name: "Auth", description: "Authentication, sessions, and role checks" },
          ],
        },
      }),
    )
    .use(createAuthRoutes(authRoutesOptions))
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
