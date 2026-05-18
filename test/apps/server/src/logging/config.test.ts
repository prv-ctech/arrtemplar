import { afterEach, describe, expect, it } from "bun:test";
import { configure, dispose, getLogger } from "@logtape/logtape";
import { $ } from "bun";
import { resolveWorkspacePath } from "../../../../../apps/server/src/config/database-paths";
import { readRuntimeEnv } from "../../../../../apps/server/src/config/env";
import { configureServerLogging } from "../../../../../apps/server/src/logging/config";
import {
  createRedactedSink,
  createRedactedTextFormatter,
} from "../../../../../apps/server/src/logging/redaction";
import { createLogBuffer, resetLogTape } from "../../../../helpers/logging";

const testLogPath = "data/logs/logtape-config-test.jsonl";
const resolvedTestLogPath = resolveWorkspacePath(testLogPath);

afterEach(async () => {
  await resetLogTape();
  await $`rm -f ${resolvedTestLogPath} ${resolvedTestLogPath}.1 ${resolvedTestLogPath}.2`.quiet();
});

describe("LogTape server logging configuration", () => {
  it("redacts sensitive structured fields and formatted message patterns", async () => {
    const { records, sink } = createLogBuffer();
    const formattedOutput: string[] = [];
    const formatter = createRedactedTextFormatter((record) => {
      return `${record.message.join("")} ${JSON.stringify(record.properties)}`;
    });

    await configure({
      sinks: {
        buffer: createRedactedSink((record) => {
          sink(record);
          formattedOutput.push(formatter(record));
        }),
      },
      loggers: [{ category: ["arrweeb"], sinks: ["buffer"] }],
    });

    getLogger(["arrweeb", "auth"]).info(
      "Login for user@example.local with bearer eyJhbGciOiJIUzI1NiJ9.payload.signature and card 4111111111111111",
      {
        email: "user@example.local",
        password: "correct-horse-battery-staple",
        passwordHash: "$argon2id$secret",
        sessionToken: "raw-session-token",
        tokenHash: "hashed-session-token",
        cookie: "arrweeb_session=raw-cookie-value",
      },
    );

    const rawProperties = JSON.stringify(records.map((record) => record.properties));
    const formattedRecords = formattedOutput.join("\n");

    expect(rawProperties).not.toContain("user@example.local");
    expect(rawProperties).not.toContain("correct-horse-battery-staple");
    expect(rawProperties).not.toContain("$argon2id$secret");
    expect(rawProperties).not.toContain("raw-session-token");
    expect(rawProperties).not.toContain("hashed-session-token");
    expect(rawProperties).not.toContain("raw-cookie-value");
    expect(formattedRecords).not.toContain("user@example.local");
    expect(formattedRecords).not.toContain("eyJhbGciOiJIUzI1NiJ9.payload.signature");
    expect(formattedRecords).not.toContain("4111111111111111");
  });

  it("writes redacted application logs to the configured rotating JSONL file", async () => {
    const runtimeEnv = readRuntimeEnv({
      LOG_LEVEL: "debug",
      LOG_FILE_PATH: testLogPath,
      LOG_FILE_MAX_SIZE_BYTES: "1048576",
      LOG_FILE_MAX_FILES: "2",
    });

    await configureServerLogging(runtimeEnv);

    getLogger(["arrweeb", "server"]).info("Server started for {email}", {
      email: "operator@example.local",
      sessionToken: "startup-session-token",
    });

    await dispose();

    const logText = await Bun.file(resolvedTestLogPath).text();

    expect(logText).toContain("Server started");
    expect(logText).toContain("arrweeb.server");
    expect(logText).not.toContain("operator@example.local");
    expect(logText).not.toContain("startup-session-token");
  });

  it("filters debug application logs when runtime log level is info", async () => {
    const runtimeEnv = readRuntimeEnv({
      NODE_ENV: "production",
      LOG_FILE_PATH: testLogPath,
      LOG_FILE_MAX_SIZE_BYTES: "1048576",
      LOG_FILE_MAX_FILES: "2",
    });

    await configureServerLogging(runtimeEnv);

    const logger = getLogger(["arrweeb", "database", "query"]);

    logger.debug("Debug query should stay out of production logs", { query: "select 1" });
    logger.info("Info query summary should be logged", { query: "select 1" });

    await dispose();

    const logText = await Bun.file(resolvedTestLogPath).text();

    expect(logText).toContain("Info query summary should be logged");
    expect(logText).not.toContain("Debug query should stay out of production logs");
  });
});
