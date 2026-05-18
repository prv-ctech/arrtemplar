import { describe, expect, it } from "bun:test";
import { configure } from "@logtape/logtape";
import { createApp } from "../../../../apps/server/src/app";
import { APP_NAME, APP_VERSION } from "../../../../packages/shared/src";
import { resetAndOpenTestDatabase } from "../../../helpers/database";
import {
  configureRedactedLogCapture,
  createLogBuffer,
  resetLogTape,
} from "../../../helpers/logging";
import { csrfJsonRequest } from "../../../helpers/server";

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
      sinks: { buffer: sink },
      loggers: [{ category: ["arrweeb", "http"], sinks: ["buffer"] }],
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
            cookie: "arrweeb_session=raw-cookie-value",
          },
        ),
      );

      const httpLogs = records.filter((record) => record.category.join(".") === "arrweeb.http");
      const serializedLogs = JSON.stringify(httpLogs);

      expect(healthResponse.status).toBe(200);
      expect(loginResponse.status).toBe(401);
      expect(httpLogs).toHaveLength(1);
      expect(httpLogs[0]?.properties).toMatchObject({
        method: "POST",
        url: "/api/auth/login",
        path: "/api/auth/login",
        status: 401,
      });
      expect(httpLogs[0]?.properties).toHaveProperty("responseTime");
      expect(serializedLogs).not.toContain("correct-horse-battery-staple");
      expect(serializedLogs).not.toContain("raw-authorization-token");
      expect(serializedLogs).not.toContain("raw-cookie-value");
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
            cookie: "arrweeb_session=raw-cookie-value",
          },
        }),
      );

      const serializedRecords = JSON.stringify(records);
      const formattedRecords = formattedOutput.join("\n");

      expect(response.status).toBe(500);
      expect(records.some((record) => record.category.join(".") === "arrweeb.http")).toBe(true);
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
