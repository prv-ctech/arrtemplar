import { afterEach, describe, expect, it } from "bun:test";
import { dispose, getConfig, getLogger } from "@logtape/logtape";
import { $ } from "bun";
import { resolveWorkspacePath } from "../../../../../apps/server/src/config/database-paths";
import { readRuntimeEnv } from "../../../../../apps/server/src/config/env";
import { configureServerLogging } from "../../../../../apps/server/src/logging/config";
import { configureRedactedLogCapture, resetLogTape } from "../../../../helpers/logging";

const testLogPath = "data/logs/logtape-config-test.jsonl";
const resolvedTestLogPath = resolveWorkspacePath(testLogPath);

afterEach(async () => {
  await resetLogTape();
  await $`rm -f ${resolvedTestLogPath} ${resolvedTestLogPath}.1 ${resolvedTestLogPath}.2`.quiet();
});

describe("LogTape server logging configuration", () => {
  it("redacts sensitive structured fields and formatted message patterns", async () => {
    const { records, formattedOutput } = await configureRedactedLogCapture();

    getLogger(["arrtemplar", "auth"]).info(
      "Login for user@example.local with bearer eyJhbGciOiJIUzI1NiJ9.payload.signature and card 4111111111111111",
      {
        email: "user@example.local",
        password: "correct-horse-battery-staple",
        passwordHash: "$argon2id$secret",
        sessionToken: "raw-session-token",
        tokenHash: "hashed-session-token",
        cookie: "arrtemplar_session=raw-cookie-value",
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

  it("keeps non-sensitive locally generated startup URLs visible", async () => {
    const { records, formattedOutput } = await configureRedactedLogCapture((record) => {
      return record.message.join("");
    });

    getLogger(["arrtemplar", "server"]).info("Server listening on {serverUrl}", {
      serverUrl: "http://localhost:3124",
    });

    expect(JSON.stringify(records)).toContain("http://localhost:3124");
    expect(formattedOutput.join("\n")).toContain("http://localhost:3124");
  });

  it("keeps request paths visible while redacting URL and referrer query values", async () => {
    const { records, formattedOutput } = await configureRedactedLogCapture();

    getLogger(["arrtemplar", "http"]).info("GET {url} from {referrer}", {
      url: "/api/auth/me?token=query-secret",
      referrer: "http://localhost/login?session=referrer-secret",
    });

    const serializedRecords = JSON.stringify(records);
    const formattedRecords = formattedOutput.join("\n");

    expect(serializedRecords).toContain("/api/auth/me");
    expect(serializedRecords).not.toContain("query-secret");
    expect(serializedRecords).not.toContain("referrer-secret");
    expect(formattedRecords).toContain("/api/auth/me");
    expect(formattedRecords).not.toContain("query-secret");
    expect(formattedRecords).not.toContain("referrer-secret");
  });

  it("writes redacted application logs to the configured rotating JSONL file", async () => {
    const runtimeEnv = readRuntimeEnv({
      LOG_LEVEL: "debug",
      LOG_FILE_PATH: testLogPath,
      LOG_FILE_MAX_SIZE_BYTES: "1048576",
      LOG_FILE_MAX_FILES: "2",
      LOG_CONSOLE: "false",
    });

    await configureServerLogging(runtimeEnv);

    getLogger(["arrtemplar", "server"]).info("Server started for {email}", {
      email: "operator@example.local",
      sessionToken: "startup-session-token",
    });

    await dispose();

    const logText = await Bun.file(resolvedTestLogPath).text();

    expect(logText).toContain("Server started");
    expect(logText).toContain("arrtemplar.server");
    expect(logText).not.toContain("operator@example.local");
    expect(logText).not.toContain("startup-session-token");
  });

  it("routes development application logs to both terminal console and rotating file sinks", async () => {
    const runtimeEnv = readRuntimeEnv({
      LOG_LEVEL: "debug",
      LOG_FILE_PATH: testLogPath,
      LOG_FILE_MAX_SIZE_BYTES: "1048576",
      LOG_FILE_MAX_FILES: "2",
    });

    await configureServerLogging(runtimeEnv);

    const arrweebLogger = getConfig()?.loggers.find((logger) => {
      return Array.isArray(logger.category) && logger.category.join(".") === "arrtemplar";
    });

    expect(arrweebLogger?.sinks).toEqual(["appFile", "appConsole"]);
  });

  it("keeps production application logs file-only unless console logging is explicitly enabled", async () => {
    const productionEnv = readRuntimeEnv({
      NODE_ENV: "production",
      LOG_FILE_PATH: testLogPath,
      LOG_FILE_MAX_SIZE_BYTES: "1048576",
      LOG_FILE_MAX_FILES: "2",
    });

    await configureServerLogging(productionEnv);

    const fileOnlyLogger = getConfig()?.loggers.find((logger) => {
      return Array.isArray(logger.category) && logger.category.join(".") === "arrtemplar";
    });

    expect(fileOnlyLogger?.sinks).toEqual(["appFile"]);

    await resetLogTape();

    const consoleEnabledEnv = readRuntimeEnv({
      NODE_ENV: "production",
      LOG_CONSOLE: "true",
      LOG_FILE_PATH: testLogPath,
      LOG_FILE_MAX_SIZE_BYTES: "1048576",
      LOG_FILE_MAX_FILES: "2",
    });

    await configureServerLogging(consoleEnabledEnv);

    const consoleEnabledLogger = getConfig()?.loggers.find((logger) => {
      return Array.isArray(logger.category) && logger.category.join(".") === "arrtemplar";
    });

    expect(consoleEnabledLogger?.sinks).toEqual(["appFile", "appConsole"]);
  });

  it("filters debug application logs when runtime log level is info", async () => {
    const runtimeEnv = readRuntimeEnv({
      NODE_ENV: "production",
      LOG_FILE_PATH: testLogPath,
      LOG_FILE_MAX_SIZE_BYTES: "1048576",
      LOG_FILE_MAX_FILES: "2",
    });

    await configureServerLogging(runtimeEnv);

    const logger = getLogger(["arrtemplar", "database", "query"]);

    logger.debug("Debug query should stay out of production logs", { query: "select 1" });
    logger.info("Info query summary should be logged", { query: "select 1" });

    await dispose();

    const logText = await Bun.file(resolvedTestLogPath).text();

    expect(logText).toContain("Info query summary should be logged");
    expect(logText).not.toContain("Debug query should stay out of production logs");
  });
});
