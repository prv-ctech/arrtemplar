import { describe, expect, it } from "bun:test";
import {
  DEV_DATABASE_URL,
  DEV_SERVER_PORT,
  readRuntimeEnv,
  TEST_DATABASE_URL,
  TEST_SERVER_PORT,
} from "../../../../../apps/server/src/config/env";

describe("server environment database paths", () => {
  it("uses the canonical development database and server port by default", () => {
    const env = readRuntimeEnv({});

    expect(env.databaseUrl).toBe(DEV_DATABASE_URL);
    expect(env.serverPort).toBe(DEV_SERVER_PORT);
    expect(DEV_DATABASE_URL).toBe("data/db/arrweeb-dev.sqlite");
  });

  it("uses the canonical test database and isolated server port in test mode", () => {
    expect(readRuntimeEnv({ NODE_ENV: "test", DATABASE_URL: TEST_DATABASE_URL })).toMatchObject({
      databaseUrl: TEST_DATABASE_URL,
      serverPort: TEST_SERVER_PORT,
    });
    expect(readRuntimeEnv({ NODE_ENV: "test" })).toMatchObject({
      databaseUrl: TEST_DATABASE_URL,
      serverPort: TEST_SERVER_PORT,
    });
    expect(TEST_DATABASE_URL).toBe("data/db/arrweeb-test.sqlite");
    expect(TEST_SERVER_PORT).not.toBe(DEV_SERVER_PORT);
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
});
