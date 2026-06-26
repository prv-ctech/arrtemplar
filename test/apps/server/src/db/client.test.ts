import { afterEach, describe, expect, it } from "bun:test";
import { configure, dispose } from "@logtape/logtape";
import { $ } from "bun";
import { createSessionExpiresAt } from "../../../../../apps/server/src/auth/session-token";
import { resolveWorkspacePath } from "../../../../../apps/server/src/config/database-paths";
import { readRuntimeEnv } from "../../../../../apps/server/src/config/env";
import { createDatabase, type DatabaseClient } from "../../../../../apps/server/src/db/client";
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
const lifecycleTestDatabaseUrl = "data/db/arrtemplar-client-lifecycle-test.sqlite";
const fileUriTestDatabaseUrl = "data/db/arrtemplar-client-file-uri-test.sqlite";
const absolutePathTestDatabaseUrl = "data/db/arrtemplar-client-absolute-test.sqlite";
const clientTestDatabaseFiles = [
  resolveWorkspacePath(lifecycleTestDatabaseUrl),
  `${resolveWorkspacePath(lifecycleTestDatabaseUrl)}-shm`,
  `${resolveWorkspacePath(lifecycleTestDatabaseUrl)}-wal`,
  resolveWorkspacePath(fileUriTestDatabaseUrl),
  `${resolveWorkspacePath(fileUriTestDatabaseUrl)}-shm`,
  `${resolveWorkspacePath(fileUriTestDatabaseUrl)}-wal`,
  resolveWorkspacePath(absolutePathTestDatabaseUrl),
  `${resolveWorkspacePath(absolutePathTestDatabaseUrl)}-shm`,
  `${resolveWorkspacePath(absolutePathTestDatabaseUrl)}-wal`,
] as const;

afterEach(async () => {
  database?.close();
  database = null;
  await resetLogTape();
  await $`rm -f ${resolvedTestLogPath} ${resolvedTestLogPath}.1 ${resolvedTestLogPath}.2`.quiet();
  for (const filePath of clientTestDatabaseFiles) {
    await $`rm -f ${filePath}`.quiet();
  }
});

describe("createDatabase", () => {
  it("configures SQLite with safe PRAGMAs for memory databases", () => {
    database = createDatabase(":memory:");

    expect(
      database.sqlite.query<{ foreign_keys: number }, []>("PRAGMA foreign_keys").get(),
    ).toEqual({
      foreign_keys: 1,
    });
    expect(database.sqlite.query<{ timeout: number }, []>("PRAGMA busy_timeout").get()).toEqual({
      timeout: 5000,
    });
    expect(database.sqlite.query<{ synchronous: number }, []>("PRAGMA synchronous").get()).toEqual({
      synchronous: 1,
    });
    expect(
      database.sqlite.query<{ trusted_schema: number }, []>("PRAGMA trusted_schema").get(),
    ).toEqual({
      trusted_schema: 0,
    });
    expect(
      database.sqlite.query<{ journal_mode: string }, []>("PRAGMA journal_mode").get(),
    ).toEqual({
      journal_mode: "memory",
    });
  });

  it("opens supported database URL forms without leaking raw paths into lifecycle logs", async () => {
    const { records, sink } = createLogBuffer();

    await configure({
      sinks: { buffer: sink, meta: () => undefined },
      loggers: [
        { category: ["logtape", "meta"], sinks: ["meta"] },
        { category: [APP_LOG_CATEGORY, "database", "lifecycle"], sinks: ["buffer"] },
      ],
    });

    const absoluteDatabaseUrl = resolveWorkspacePath(absolutePathTestDatabaseUrl);

    for (const databaseUrl of [
      lifecycleTestDatabaseUrl,
      absoluteDatabaseUrl,
      ":memory:",
      `file:${fileUriTestDatabaseUrl}`,
    ]) {
      const currentDatabase = createDatabase(databaseUrl);
      currentDatabase.close();
    }

    const configuredEvents = records.filter(
      (record) => record.properties.event === "database.connection_configured",
    );

    expect(configuredEvents.map((record) => record.properties.databaseUrlKind)).toEqual([
      "relative-path",
      "absolute-path",
      "memory",
      "file-uri",
    ]);
    expect(JSON.stringify(records)).not.toContain(lifecycleTestDatabaseUrl);
    expect(JSON.stringify(records)).not.toContain(absoluteDatabaseUrl);
  });

  it("rejects unsupported SQLite URI forms before file lifecycle handling runs", async () => {
    const { records, sink } = createLogBuffer();

    await configure({
      sinks: { buffer: sink, meta: () => undefined },
      loggers: [
        { category: ["logtape", "meta"], sinks: ["meta"] },
        { category: [APP_LOG_CATEGORY, "database", "lifecycle"], sinks: ["buffer"] },
      ],
    });

    expect(() => createDatabase("file::memory:")).toThrow("Unsupported SQLite database URL form");
    expect(() => createDatabase("file:memdb1?mode=memory&cache=shared")).toThrow(
      "Unsupported SQLite database URL form",
    );
    expect(() => createDatabase(`file:${fileUriTestDatabaseUrl}?mode=ro`)).toThrow(
      "Unsupported SQLite database URL form",
    );
    expect(records.map((record) => record.properties.event)).toEqual([
      "database.connection_rejected",
      "database.connection_rejected",
      "database.connection_rejected",
    ]);
  });

  it("runs static optimize PRAGMAs on file database open and close", async () => {
    const { records, sink } = createLogBuffer();

    await configure({
      sinks: { buffer: sink, meta: () => undefined },
      loggers: [
        { category: ["logtape", "meta"], sinks: ["meta"] },
        { category: [APP_LOG_CATEGORY, "database", "lifecycle"], sinks: ["buffer"] },
      ],
    });

    const openedDatabase = createDatabase(lifecycleTestDatabaseUrl);
    openedDatabase.close();
    database = null;

    expect(
      records
        .filter((record) => record.properties.event === "database.optimization_completed")
        .map((record) => record.properties.mode),
    ).toEqual(["open", "close"]);
    expect(() => openedDatabase.sqlite.query("select 1").get()).toThrow();
  });

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
