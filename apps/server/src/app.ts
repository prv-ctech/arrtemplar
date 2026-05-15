import { APP_NAME, APP_VERSION, type HealthResponse } from "@animehub/shared";
import { cors } from "@elysia/cors";
import { openapi } from "@elysia/openapi";
import { Elysia, t } from "elysia";
import { env } from "./config/env";

const healthResponseSchema = t.Object({
  name: t.Literal(APP_NAME),
  version: t.String(),
  status: t.Literal("ok"),
  timestamp: t.String({ format: "date-time" }),
});

export const app = new Elysia()
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
        tags: [{ name: "System", description: "Application status and diagnostics" }],
      },
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

export type App = typeof app;
