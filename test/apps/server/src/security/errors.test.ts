import { afterEach, describe, expect, it } from "bun:test";
import { AsyncLocalStorage } from "node:async_hooks";
import { configure } from "@logtape/logtape";
import type { DatabaseClient } from "../../../../../apps/server/src/db/client";
import { APP_LOG_CATEGORY } from "../../../../../packages/shared/src";
import { createLogBuffer, resetLogTape } from "../../../../helpers/logging";
import {
  closeServerTestDatabases,
  createServerTestApp,
  csrfJsonRequest,
  type TestAppContext,
} from "../../../../helpers/server";

const openDatabases: DatabaseClient[] = [];

afterEach(async () => {
  closeServerTestDatabases(openDatabases);
  await resetLogTape();
});

describe("safe API error handling", () => {
  it("returns a generic JSON not-found response", async () => {
    const app = await createErrorTestApp();

    const response = await app.handle(new Request("http://localhost/api/missing"));
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body).toEqual({ error: { code: "NOT_FOUND", message: "Not found." } });
  });

  it("returns a safe validation response without internal details", async () => {
    const app = await createErrorTestApp();

    const response = await app.handle(
      csrfJsonRequest("/api/auth/login", { email: "not-an-email", password: "" }),
    );
    const bodyText = await response.text();
    const body = JSON.parse(bodyText);

    expect(response.status).toBe(422);
    expect(body).toEqual({ error: { code: "VALIDATION_ERROR", message: "Invalid request." } });
    expect(bodyText).not.toContain("apps/server");
    expect(bodyText).not.toContain("passwordHash");
    expect(bodyText).not.toContain("stack");
  });

  it("does not expose thrown internal errors", async () => {
    const { records, sink } = createLogBuffer();
    const app = await createErrorTestApp();

    await configure({
      contextLocalStorage: new AsyncLocalStorage(),
      sinks: { buffer: sink },
      loggers: [
        { category: [APP_LOG_CATEGORY, "security"], sinks: ["buffer"] },
        { category: ["logtape", "meta"], sinks: ["buffer"] },
      ],
    });

    app.get("/api/force-error", () => {
      throw new Error(
        "database exploded at /workspaces/arrweeb-anime/apps/server/src/db/client.ts token=secret",
      );
    });

    const response = await app.handle(
      new Request("http://localhost/api/force-error?token=response-query-secret", {
        headers: { "x-request-id": "req-safe-error-test" },
      }),
    );
    const bodyText = await response.text();
    const body = JSON.parse(bodyText);

    expect(response.status).toBe(500);
    expect(body).toEqual({
      error: { code: "INTERNAL_SERVER_ERROR", message: "Internal server error." },
    });
    expect(bodyText).not.toContain("database exploded");
    expect(bodyText).not.toContain("/workspaces/arrweeb-anime");
    expect(bodyText).not.toContain("token=secret");

    const securityRecords = records.filter((record) => {
      return record.category.join(".") === `${APP_LOG_CATEGORY}.security`;
    });
    const serializedLogs = JSON.stringify(securityRecords);
    const properties = securityRecords[0]?.properties;

    expect(securityRecords).toHaveLength(1);
    expect(securityRecords[0]?.category).toEqual([APP_LOG_CATEGORY, "security"]);
    expect(securityRecords[0]?.level).toBe("error");
    expect(properties).toMatchObject({
      event: "request.unexpected_error",
      code: "UNKNOWN",
      errorType: "Error",
      requestId: "req-safe-error-test",
      method: "GET",
      path: "/api/force-error",
      status: 500,
    });
    expect(properties && "eventId" in properties && typeof properties.eventId === "string").toBe(
      true,
    );
    expect(serializedLogs).not.toContain("database exploded");
    expect(serializedLogs).not.toContain("token=secret");
    expect(serializedLogs).not.toContain("response-query-secret");
  });

  it("uses normalized request context for unexpected error IDs", async () => {
    const { records, sink } = createLogBuffer();
    const app = await createErrorTestApp();

    await configure({
      contextLocalStorage: new AsyncLocalStorage(),
      sinks: { buffer: sink },
      loggers: [
        { category: [APP_LOG_CATEGORY, "security"], sinks: ["buffer"] },
        { category: ["logtape", "meta"], sinks: ["buffer"] },
      ],
    });

    app.get("/api/force-invalid-request-id-error", () => {
      throw new Error("forced invalid request id failure");
    });

    const response = await app.handle(
      new Request("http://localhost/api/force-invalid-request-id-error", {
        headers: { "x-request-id": "invalid request id with spaces" },
      }),
    );
    const securityRecord = records.find((record) => {
      return record.category.join(".") === `${APP_LOG_CATEGORY}.security`;
    });
    const responseRequestId = response.headers.get("x-request-id");

    expect(response.status).toBe(500);
    expect(responseRequestId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(securityRecord?.properties).toMatchObject({
      event: "request.unexpected_error",
      requestId: responseRequestId,
      path: "/api/force-invalid-request-id-error",
    });
    expect(JSON.stringify(securityRecord?.properties)).not.toContain("invalid request id");
  });
});

async function createErrorTestApp(): Promise<TestAppContext["app"]> {
  const { app } = await createServerTestApp(openDatabases);

  return app;
}
