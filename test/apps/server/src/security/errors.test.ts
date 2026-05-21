import { afterEach, describe, expect, it } from "bun:test";
import { configure } from "@logtape/logtape";
import type { DatabaseClient } from "../../../../../apps/server/src/db/client";
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
      sinks: { buffer: sink },
      loggers: [{ category: ["arrtemplar", "security"], sinks: ["buffer"] }],
    });

    app.get("/api/force-error", () => {
      throw new Error(
        "database exploded at /workspaces/arrweeb-anime/apps/server/src/db/client.ts token=secret",
      );
    });

    const response = await app.handle(new Request("http://localhost/api/force-error"));
    const bodyText = await response.text();
    const body = JSON.parse(bodyText);

    expect(response.status).toBe(500);
    expect(body).toEqual({
      error: { code: "INTERNAL_SERVER_ERROR", message: "Internal server error." },
    });
    expect(bodyText).not.toContain("database exploded");
    expect(bodyText).not.toContain("/workspaces/arrweeb-anime");
    expect(bodyText).not.toContain("token=secret");

    const serializedLogs = JSON.stringify(records);

    expect(records).toHaveLength(1);
    expect(records[0]?.category).toEqual(["arrtemplar", "security"]);
    expect(records[0]?.level).toBe("error");
    expect(records[0]?.properties).toMatchObject({ code: "UNKNOWN", errorType: "Error" });
    expect(serializedLogs).not.toContain("database exploded");
    expect(serializedLogs).not.toContain("token=secret");
  });
});

async function createErrorTestApp(): Promise<TestAppContext["app"]> {
  const { app } = await createServerTestApp(openDatabases);

  return app;
}
