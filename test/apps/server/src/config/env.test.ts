import { describe, expect, it } from "bun:test";
import {
  DEV_DATABASE_URL,
  DEV_SERVER_PORT,
  readRuntimeEnv,
  TEST_DATABASE_URL,
  TEST_SERVER_PORT,
} from "../../../../../apps/server/src/config/env";
import { APP_IDENTIFIER } from "../../../../../packages/shared/src";

describe("server environment database paths", () => {
  it("uses the canonical development database and server port by default", () => {
    const env = readRuntimeEnv({});

    expect(env.databaseUrl).toBe(DEV_DATABASE_URL);
    expect(env.serverPort).toBe(DEV_SERVER_PORT);
    expect(env.logLevel).toBe("debug");
    expect(env.logFilePath).toBe(`data/logs/${APP_IDENTIFIER}.jsonl`);
    expect(env.logFileMaxSizeBytes).toBe(10 * 1024 * 1024);
    expect(env.logFileMaxFiles).toBe(5);
    expect(env.logConsoleEnabled).toBe(true);
    expect(DEV_DATABASE_URL).toBe(`data/db/${APP_IDENTIFIER}-dev.sqlite`);
  });

  it("uses the canonical test database and isolated server port in test mode", () => {
    expect(readRuntimeEnv({ NODE_ENV: "test", DATABASE_URL: TEST_DATABASE_URL })).toMatchObject({
      databaseUrl: TEST_DATABASE_URL,
      serverPort: TEST_SERVER_PORT,
      logLevel: "fatal",
      logConsoleEnabled: false,
    });
    expect(readRuntimeEnv({ NODE_ENV: "test" })).toMatchObject({
      databaseUrl: TEST_DATABASE_URL,
      serverPort: TEST_SERVER_PORT,
      logLevel: "fatal",
      logConsoleEnabled: false,
    });
    expect(TEST_DATABASE_URL).toBe(`data/db/${APP_IDENTIFIER}-test.sqlite`);
    expect(TEST_SERVER_PORT).not.toBe(DEV_SERVER_PORT);
  });

  it("uses production logging defaults when NODE_ENV is production", () => {
    expect(readRuntimeEnv({ NODE_ENV: "production" })).toMatchObject({
      databaseUrl: DEV_DATABASE_URL,
      serverPort: DEV_SERVER_PORT,
      logLevel: "info",
      logFilePath: `data/logs/${APP_IDENTIFIER}.jsonl`,
      logFileMaxSizeBytes: 10 * 1024 * 1024,
      logFileMaxFiles: 5,
      logConsoleEnabled: false,
    });
  });

  it("keeps logging settings overridable", () => {
    expect(
      readRuntimeEnv({
        LOG_LEVEL: "trace",
        LOG_FILE_PATH: "tmp/custom-app.jsonl",
        LOG_FILE_MAX_SIZE_BYTES: "1024",
        LOG_FILE_MAX_FILES: "2",
        LOG_CONSOLE: "false",
      }),
    ).toMatchObject({
      logLevel: "trace",
      logFilePath: "tmp/custom-app.jsonl",
      logFileMaxSizeBytes: 1024,
      logFileMaxFiles: 2,
      logConsoleEnabled: false,
    });

    expect(readRuntimeEnv({ NODE_ENV: "production", LOG_CONSOLE: "true" })).toMatchObject({
      logConsoleEnabled: true,
    });
  });

  it("keeps explicit test server ports overridable", () => {
    expect(
      readRuntimeEnv({ NODE_ENV: "test", DATABASE_URL: TEST_DATABASE_URL, SERVER_PORT: "3101" })
        .serverPort,
    ).toBe(3101);
  });

  it("rejects unsafe test database settings", () => {
    expect(() => readRuntimeEnv({ NODE_ENV: "test", DATABASE_URL: DEV_DATABASE_URL })).toThrow(
      "NODE_ENV=test cannot use the development database",
    );
  });

  it("rejects invalid SQLite database paths", () => {
    const memoryDatabaseUrl = [":", "memory:"].join("");

    expect(() => readRuntimeEnv({ DATABASE_URL: "   " })).toThrow("DATABASE_URL must not be empty");
    expect(() => readRuntimeEnv({ DATABASE_URL: memoryDatabaseUrl })).toThrow(
      "DATABASE_URL must be a SQLite file path",
    );
  });

  it("rejects invalid logging settings", () => {
    expect(() => readRuntimeEnv({ LOG_LEVEL: "verbose" })).toThrow(
      "LOG_LEVEL must be one of trace, debug, info, warning, error, fatal",
    );
    expect(() => readRuntimeEnv({ LOG_FILE_PATH: "   " })).toThrow(
      "LOG_FILE_PATH must not be empty",
    );
    expect(() => readRuntimeEnv({ LOG_FILE_MAX_SIZE_BYTES: "0" })).toThrow(
      "LOG_FILE_MAX_SIZE_BYTES must be a positive integer",
    );
    expect(() => readRuntimeEnv({ LOG_FILE_MAX_FILES: "0" })).toThrow(
      "LOG_FILE_MAX_FILES must be a positive integer",
    );
    expect(() => readRuntimeEnv({ LOG_CONSOLE: "sometimes" })).toThrow(
      "LOG_CONSOLE must be true or false",
    );
  });
});
