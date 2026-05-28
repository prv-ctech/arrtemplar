import { afterEach, describe, expect, it } from "bun:test";
import { configure } from "@logtape/logtape";
import { createSessionExpiresAt } from "../../../../../apps/server/src/auth/session-token";
import type { DatabaseClient } from "../../../../../apps/server/src/db/client";
import { sessions, users } from "../../../../../apps/server/src/db/schema";
import { resetAndOpenTestDatabase } from "../../../../helpers/database";
import {
  configureRedactedLogCapture,
  createLogBuffer,
  resetLogTape,
} from "../../../../helpers/logging";

let database: DatabaseClient | null = null;

afterEach(async () => {
  database?.close();
  database = null;
  await resetLogTape();
});

describe("createDatabase", () => {
  it("logs Drizzle queries through the database query category", async () => {
    const { records, sink } = createLogBuffer();

    await configure({
      sinks: { buffer: sink },
      loggers: [{ category: ["arrtemplar", "database", "query"], sinks: ["buffer"] }],
    });

    database = await resetAndOpenTestDatabase();
    records.splice(0);

    database.db.select().from(users).all();

    expect(records).toHaveLength(1);
    expect(records[0]?.category).toEqual(["arrtemplar", "database", "query"]);
    expect(records[0]?.level).toBe("debug");
    expect(records[0]?.properties).toMatchObject({
      query: expect.stringContaining("select"),
      formattedQuery: expect.stringContaining("select"),
    });
  });

  it("redacts Drizzle positional params before query logs are persisted", async () => {
    const { records, formattedOutput } = await configureRedactedLogCapture();
    const userId = crypto.randomUUID();
    const sessionId = crypto.randomUUID();

    database = await resetAndOpenTestDatabase();
    records.splice(0);
    formattedOutput.splice(0);

    database.db
      .insert(users)
      .values({
        id: userId,
        publicId: "Abc123XyZ",
        username: "secret-user",
        email: "secret-user@example.local",
        passwordHash: "$argon2id$super-secret-password-hash",
        role: "admin",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .run();
    database.db
      .insert(sessions)
      .values({
        id: sessionId,
        userId,
        tokenHash: "super-secret-session-token-hash",
        expiresAt: createSessionExpiresAt().toISOString(),
        ipAddress: "127.0.0.1",
        userAgent: "test-agent",
        createdAt: new Date().toISOString(),
      })
      .run();

    const serializedRecords = JSON.stringify(records);
    const formattedRecords = formattedOutput.join("\n");

    expect(records.length).toBeGreaterThanOrEqual(2);
    expect(serializedRecords).not.toContain("secret-user@example.local");
    expect(serializedRecords).not.toContain("$argon2id$super-secret-password-hash");
    expect(serializedRecords).not.toContain("super-secret-session-token-hash");
    expect(formattedRecords).not.toContain("secret-user@example.local");
    expect(formattedRecords).not.toContain("$argon2id$super-secret-password-hash");
    expect(formattedRecords).not.toContain("super-secret-session-token-hash");
  });
});
