import { afterEach, describe, expect, it } from "bun:test";
import { configure, dispose } from "@logtape/logtape";
import { $ } from "bun";
import { createSessionExpiresAt } from "../../../../../apps/server/src/auth/session-token";
import { resolveWorkspacePath } from "../../../../../apps/server/src/config/database-paths";
import { readRuntimeEnv } from "../../../../../apps/server/src/config/env";
import type { DatabaseClient } from "../../../../../apps/server/src/db/client";
import { sessions, users } from "../../../../../apps/server/src/db/schema";
import { configureServerLogging } from "../../../../../apps/server/src/logging/config";
import { APP_LOG_CATEGORY } from "../../../../../packages/shared/src";
import { resetAndOpenTestDatabase } from "../../../../helpers/database";
import {
  configureRedactedLogCapture,
  createLogBuffer,
  resetLogTape,
} from "../../../../helpers/logging";

let database: DatabaseClient | null = null;
const testLogPath = "data/logs/drizzle-client-test.jsonl";
const resolvedTestLogPath = resolveWorkspacePath(testLogPath);

afterEach(async () => {
  database?.close();
  database = null;
  await resetLogTape();
  await $`rm -f ${resolvedTestLogPath} ${resolvedTestLogPath}.1 ${resolvedTestLogPath}.2`.quiet();
});

describe("createDatabase", () => {
  it("logs SQLite-formatted Drizzle queries through the database query category", async () => {
    const { records, sink } = createLogBuffer();

    await configure({
      sinks: { buffer: sink, meta: () => undefined },
      loggers: [
        { category: ["logtape", "meta"], sinks: ["meta"] },
        { category: [APP_LOG_CATEGORY, "database", "query"], sinks: ["buffer"] },
      ],
    });

    database = await resetAndOpenTestDatabase();
    records.splice(0);

    database.db
      .insert(users)
      .values({
        id: Bun.randomUUIDv7(),
        publicId: "SqliteFmt",
        username: "sqlite-dialect-user",
        email: "sqlite-dialect@example.local",
        passwordHash: "hash-for-sqlite-dialect-test",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .run();

    expect(records).toHaveLength(1);
    expect(records[0]?.category).toEqual([APP_LOG_CATEGORY, "database", "query"]);
    expect(records[0]?.level).toBe("debug");
    expect(records[0]?.properties).toMatchObject({
      query: expect.stringContaining("insert into"),
      formattedQuery: expect.stringContaining("'sqlite-dialect@example.local'"),
    });
    expect(records[0]?.properties).toHaveProperty("params");
  });

  it("filters Drizzle debug query logs when runtime log level is info", async () => {
    const runtimeEnv = readRuntimeEnv({
      NODE_ENV: "production",
      LOG_CONSOLE: "false",
      LOG_FILE_PATH: testLogPath,
      LOG_FILE_MAX_SIZE_BYTES: "1048576",
      LOG_FILE_MAX_FILES: "2",
    });

    await configureServerLogging(runtimeEnv);

    database = await resetAndOpenTestDatabase();
    database.db.select().from(users).all();

    await dispose();

    const logFile = Bun.file(resolvedTestLogPath);
    const logText = (await logFile.exists()) ? await logFile.text() : "";

    expect(logText).not.toContain(`${APP_LOG_CATEGORY}.database.query`);
    expect(logText).not.toContain("Query:");
  });

  it("redacts Drizzle positional params before query logs are persisted", async () => {
    const { records, formattedOutput } = await configureRedactedLogCapture();
    const userId = Bun.randomUUIDv7();
    const sessionId = Bun.randomUUIDv7();

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
