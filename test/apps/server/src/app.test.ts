import { describe, expect, it } from "bun:test";
import { AsyncLocalStorage } from "node:async_hooks";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { configure, getLogger } from "@logtape/logtape";
import { createApp } from "../../../../apps/server/src/app";
import { APP_LOG_CATEGORY, APP_NAME, APP_VERSION } from "../../../../packages/shared/src";
import { resetAndOpenTestDatabase } from "../../../helpers/database";
import {
  configureRedactedLogCapture,
  createLogBuffer,
  resetLogTape,
} from "../../../helpers/logging";
import { csrfJsonRequest } from "../../../helpers/server";

type FrontendFixture = {
  distRoot: string;
  cleanup: () => Promise<void>;
};

async function createFrontendFixture(
  options: { withIndex?: boolean } = {},
): Promise<FrontendFixture> {
  const distRoot = await mkdtemp("/tmp/arrtemplar-frontend-");
  const withIndex = options.withIndex ?? true;

  await mkdir(join(distRoot, "assets"), { recursive: true });
  await Bun.write(join(distRoot, "assets", "main.js"), "console.log('frontend-asset');");

  if (withIndex) {
    await Bun.write(
      join(distRoot, "index.html"),
      "<!doctype html><html><head><title>Frontend Shell</title></head><body>frontend-shell</body></html>",
    );
  }

  return {
    distRoot,
    cleanup: () => rm(distRoot, { recursive: true, force: true }),
  };
}

describe("GET /", () => {
  it("returns a backend landing response instead of an Elysia not-found error", async () => {
    const database = await resetAndOpenTestDatabase();
    const app = createApp({ database });

    const response = await app.handle(new Request("http://localhost/"));
    const body = await response.json();

    try {
      expect(response.status).toBe(200);
      expect(body).toMatchObject({
        name: APP_NAME,
        version: APP_VERSION,
        service: "backend",
        frontendUrl: "http://localhost:5173",
        links: {
          frontend: "http://localhost:5173",
          health: "http://localhost/health",
          openapi: "http://localhost/openapi",
        },
      });
    } finally {
      database.close();
    }
  });
});

describe("GET /health", () => {
  it("returns service status", async () => {
    const database = await resetAndOpenTestDatabase();
    const app = createApp({ database });

    const response = await app.handle(new Request("http://localhost/health"));
    const body = await response.json();

    try {
      expect(response.status).toBe(200);
      expect(body).toMatchObject({
        name: APP_NAME,
        version: APP_VERSION,
        status: "ok",
      });
      expect(new Date(body.timestamp).toString()).not.toBe("Invalid Date");
    } finally {
      database.close();
    }
  });

  it("skips health logs and logs non-health requests without sensitive request data", async () => {
    const { records, sink } = createLogBuffer();
    const database = await resetAndOpenTestDatabase();
    const app = createApp({ database });

    await configure({
      contextLocalStorage: new AsyncLocalStorage(),
      sinks: { buffer: sink, meta: () => undefined },
      loggers: [
        { category: ["logtape", "meta"], sinks: ["meta"] },
        { category: [APP_LOG_CATEGORY, "http"], sinks: ["buffer"] },
      ],
    });

    try {
      const healthResponse = await app.handle(new Request("http://localhost/health"));
      const loginResponse = await app.handle(
        csrfJsonRequest(
          "/api/auth/login",
          {
            email: "operator@example.local",
            password: "correct-horse-battery-staple",
          },
          {
            authorization: "Bearer raw-authorization-token",
            cookie: "arrtemplar_session=raw-cookie-value",
            "x-request-id": "login-request-id",
          },
        ),
      );

      const httpLogs = records.filter(
        (record) => record.category.join(".") === `${APP_LOG_CATEGORY}.http`,
      );
      const serializedLogs = JSON.stringify(httpLogs);

      expect(healthResponse.status).toBe(200);
      expect(loginResponse.status).toBe(401);
      expect(loginResponse.headers.get("x-request-id")).toBe("login-request-id");
      expect(httpLogs).toHaveLength(1);
      expect(httpLogs[0]?.properties).toMatchObject({
        event: "http.request",
        requestId: "login-request-id",
        method: "POST",
        url: "/api/auth/login",
        path: "/api/auth/login",
        status: 401,
      });
      expect(httpLogs[0]?.properties).toHaveProperty("responseTime");
      expect(httpLogs[0]?.properties).toHaveProperty("durationMs");
      expect(httpLogs[0]?.properties).toHaveProperty("contentLength");
      expect(serializedLogs).not.toContain("correct-horse-battery-staple");
      expect(serializedLogs).not.toContain("raw-authorization-token");
      expect(serializedLogs).not.toContain("raw-cookie-value");
    } finally {
      await resetLogTape();
      database.close();
    }
  });

  it("propagates request IDs to handler logs and generated response headers", async () => {
    const { records, sink } = createLogBuffer();
    const database = await resetAndOpenTestDatabase();
    const app = createApp({ database });
    const handlerLogger = getLogger([APP_LOG_CATEGORY, "request-context-test"]);

    app.get("/api/request-context-log", () => {
      handlerLogger.info("Handled request context check");
      return { ok: true };
    });

    await configure({
      contextLocalStorage: new AsyncLocalStorage(),
      sinks: { buffer: sink, meta: () => undefined },
      loggers: [
        { category: ["logtape", "meta"], sinks: ["meta"] },
        { category: [APP_LOG_CATEGORY], sinks: ["buffer"] },
      ],
    });

    try {
      const response = await app.handle(new Request("http://localhost/api/request-context-log"));
      const handlerLog = records.find(
        (record) => record.category.join(".") === `${APP_LOG_CATEGORY}.request-context-test`,
      );
      const requestLog = records.find(
        (record) => record.category.join(".") === `${APP_LOG_CATEGORY}.http`,
      );

      expect(response.status).toBe(200);
      expect(response.headers.get("x-request-id")).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
      );
      expect(handlerLog?.properties).toMatchObject({
        requestId: response.headers.get("x-request-id"),
      });
      expect(requestLog?.properties).toMatchObject({
        event: "http.request",
        requestId: response.headers.get("x-request-id"),
        method: "GET",
        url: "/api/request-context-log",
        path: "/api/request-context-log",
        status: 200,
      });
      expect(requestLog?.properties).toHaveProperty("responseTime");
      expect(requestLog?.properties).toHaveProperty("durationMs");
      expect(requestLog?.properties).toHaveProperty("contentLength");
    } finally {
      await resetLogTape();
      database.close();
    }
  });

  it("rejects invalid incoming request IDs before echoing them", async () => {
    const { records, sink } = createLogBuffer();
    const database = await resetAndOpenTestDatabase();
    const app = createApp({ database });

    await configure({
      contextLocalStorage: new AsyncLocalStorage(),
      sinks: { buffer: sink, meta: () => undefined },
      loggers: [
        { category: ["logtape", "meta"], sinks: ["meta"] },
        { category: [APP_LOG_CATEGORY], sinks: ["buffer"] },
      ],
    });

    try {
      const response = await app.handle(
        new Request("http://localhost/", {
          headers: { "x-request-id": "invalid request id with spaces" },
        }),
      );
      const requestLog = records.find(
        (record) => record.category.join(".") === `${APP_LOG_CATEGORY}.http`,
      );
      const responseRequestId = response.headers.get("x-request-id");

      expect(response.status).toBe(200);
      expect(responseRequestId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
      );
      expect(responseRequestId).not.toBe("invalid request id with spaces");
      expect(requestLog?.properties).toMatchObject({ requestId: responseRequestId });
    } finally {
      await resetLogTape();
      database.close();
    }
  });

  it("redacts sensitive Elysia adapter error fields before app logs are persisted", async () => {
    const { records, formattedOutput } = await configureRedactedLogCapture();
    const database = await resetAndOpenTestDatabase();
    const app = createApp({ database });

    app.get("/api/adapter-error", () => {
      throw new Error("adapter exploded token=super-secret-session-token cookie=raw-cookie-value");
    });

    try {
      const response = await app.handle(
        new Request("http://localhost/api/adapter-error?token=query-secret", {
          headers: {
            referer: "http://localhost/login?token=referrer-secret",
            cookie: "arrtemplar_session=raw-cookie-value",
          },
        }),
      );

      const serializedRecords = JSON.stringify(records);
      const formattedRecords = formattedOutput.join("\n");

      expect(response.status).toBe(500);
      expect(
        records.some((record) => record.category.join(".") === `${APP_LOG_CATEGORY}.http`),
      ).toBe(true);
      expect(serializedRecords).not.toContain("super-secret-session-token");
      expect(serializedRecords).not.toContain("raw-cookie-value");
      expect(serializedRecords).not.toContain("query-secret");
      expect(serializedRecords).not.toContain("referrer-secret");
      expect(formattedRecords).not.toContain("super-secret-session-token");
      expect(formattedRecords).not.toContain("raw-cookie-value");
      expect(formattedRecords).not.toContain("query-secret");
      expect(formattedRecords).not.toContain("referrer-secret");
    } finally {
      await resetLogTape();
      database.close();
    }
  });
});

describe("frontend static serving", () => {
  it("serves built assets with immutable caching and SPA fallbacks with no-cache", async () => {
    const database = await resetAndOpenTestDatabase();
    const frontend = await createFrontendFixture();
    const app = createApp({ database, frontendDistRoot: frontend.distRoot });

    const assetResponse = await app.handle(new Request("http://localhost/assets/main.js"));
    const assetBody = await assetResponse.text();
    const fallbackResponse = await app.handle(new Request("http://localhost/settings/profile"));
    const fallbackBody = await fallbackResponse.text();

    try {
      expect(assetResponse.status).toBe(200);
      expect(assetResponse.headers.get("cache-control")).toBe(
        "public, max-age=31536000, immutable",
      );
      expect(assetBody).toContain("frontend-asset");

      expect(fallbackResponse.status).toBe(200);
      expect(fallbackResponse.headers.get("cache-control")).toBe("no-cache");
      expect(fallbackBody).toContain("frontend-shell");
    } finally {
      await frontend.cleanup();
      database.close();
    }
  });

  it("keeps reserved backend paths and unsafe traversal requests out of the SPA fallback", async () => {
    const database = await resetAndOpenTestDatabase();
    const frontend = await createFrontendFixture();
    const app = createApp({ database, frontendDistRoot: frontend.distRoot });

    const reservedPathResponse = await app.handle(new Request("http://localhost/api/unknown"));
    const traversalResponse = await app.handle(
      new Request("http://localhost/assets/%2e%2e/secret.txt"),
    );
    const missingAssetResponse = await app.handle(
      new Request("http://localhost/assets/missing.js"),
    );

    try {
      expect(reservedPathResponse.status).toBe(404);
      expect(traversalResponse.status).toBe(404);
      expect(await traversalResponse.text()).toBe("Not Found");
      expect(missingAssetResponse.status).toBe(404);
    } finally {
      await frontend.cleanup();
      database.close();
    }
  });

  it("logs frontend static enablement and served cache policies", async () => {
    const { recorder, sink } = createLogBuffer();
    const database = await resetAndOpenTestDatabase();
    const frontend = await createFrontendFixture();

    await configure({
      contextLocalStorage: new AsyncLocalStorage(),
      sinks: { buffer: sink, meta: () => undefined },
      loggers: [
        { category: ["logtape", "meta"], sinks: ["meta"] },
        { category: [APP_LOG_CATEGORY, "server"], lowestLevel: "debug", sinks: ["buffer"] },
      ],
    });

    const app = createApp({ database, frontendDistRoot: frontend.distRoot });

    try {
      const response = await app.handle(new Request("http://localhost/assets/main.js"));

      expect(response.status).toBe(200);
      recorder.assertLogged({
        category: [APP_LOG_CATEGORY, "server"],
        level: "info",
        message: /Frontend static serving enabled from/,
        properties: {
          event: "frontend.static.enabled",
          distRoot: frontend.distRoot,
        },
      });
      recorder.assertLogged({
        category: [APP_LOG_CATEGORY, "server"],
        level: "debug",
        properties: {
          event: "frontend.static.served",
          assetKind: "asset",
          cachePolicy: "public, max-age=31536000, immutable",
        },
      });
    } finally {
      await resetLogTape();
      await frontend.cleanup();
      database.close();
    }
  });

  it("warns once when the frontend build is missing index.html", async () => {
    const { records, recorder, sink } = createLogBuffer();
    const database = await resetAndOpenTestDatabase();
    const frontend = await createFrontendFixture({ withIndex: false });

    await configure({
      contextLocalStorage: new AsyncLocalStorage(),
      sinks: { buffer: sink, meta: () => undefined },
      loggers: [
        { category: ["logtape", "meta"], sinks: ["meta"] },
        { category: [APP_LOG_CATEGORY, "server"], lowestLevel: "debug", sinks: ["buffer"] },
      ],
    });

    const app = createApp({ database, frontendDistRoot: frontend.distRoot });

    try {
      const firstResponse = await app.handle(new Request("http://localhost/"));
      const secondResponse = await app.handle(new Request("http://localhost/settings"));
      const missingIndexWarnings = records.filter(
        (record) =>
          record.category.join(".") === `${APP_LOG_CATEGORY}.server` &&
          record.properties.event === "frontend.static.index_missing",
      );

      expect(firstResponse.status).toBe(500);
      expect(secondResponse.status).toBe(500);
      expect(missingIndexWarnings).toHaveLength(1);
      recorder.assertLogged({
        category: [APP_LOG_CATEGORY, "server"],
        level: "warning",
        message: /Frontend build index is missing from/,
        properties: {
          event: "frontend.static.index_missing",
          distRoot: frontend.distRoot,
        },
      });
    } finally {
      await resetLogTape();
      await frontend.cleanup();
      database.close();
    }
  });
});
