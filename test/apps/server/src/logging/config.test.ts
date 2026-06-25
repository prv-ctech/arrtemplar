import { afterEach, describe, expect, it } from "bun:test";
import { dispose, getConfig, getLogger } from "@logtape/logtape";
import { $ } from "bun";
import { resolveWorkspacePath } from "../../../../../apps/server/src/config/database-paths";
import { readRuntimeEnv } from "../../../../../apps/server/src/config/env";
import { configureServerLogging } from "../../../../../apps/server/src/logging/config";
import { APP_LOG_CATEGORY } from "../../../../../packages/shared/src";
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

    getLogger([APP_LOG_CATEGORY, "auth"]).info(
      "Login for user@example.local with bearer eyJhbGciOiJIUzI1NiJ9.payload.signature and card 4111111111111111",
      {
        Authorization: "Bearer raw-authorization-token",
        "Set-Cookie": "arrtemplar_session=raw-set-cookie-value",
        apiKey: "raw-api-key",
        email: "user@example.local",
        errorMessage: "failure at /private/path token=raw-error-token",
        formattedQuery: "select * from users where email = 'drizzle@example.local'",
        oauthAccessToken: "raw-oauth-access-token",
        params: ["drizzle-secret-param"],
        password: "correct-horse-battery-staple",
        passwordHash: "$argon2id$secret",
        query: "select * from api_keys where key = 'raw-query-secret'",
        refresh_token: "raw-refresh-token",
        sessionToken: "raw-session-token",
        csrfToken: "raw-csrf-token",
        tokenHash: "hashed-session-token",
        cookie: "arrtemplar_session=raw-cookie-value",
      },
    );

    const rawProperties = JSON.stringify(records.map((record) => record.properties));
    const formattedRecords = formattedOutput.join("\n");

    expect(rawProperties).not.toContain("user@example.local");
    expect(rawProperties).not.toContain("raw-authorization-token");
    expect(rawProperties).not.toContain("raw-set-cookie-value");
    expect(rawProperties).not.toContain("raw-api-key");
    expect(rawProperties).not.toContain("raw-error-token");
    expect(rawProperties).not.toContain("drizzle@example.local");
    expect(rawProperties).not.toContain("raw-oauth-access-token");
    expect(rawProperties).not.toContain("drizzle-secret-param");
    expect(rawProperties).not.toContain("correct-horse-battery-staple");
    expect(rawProperties).not.toContain("$argon2id$secret");
    expect(rawProperties).not.toContain("raw-query-secret");
    expect(rawProperties).not.toContain("raw-refresh-token");
    expect(rawProperties).not.toContain("raw-session-token");
    expect(rawProperties).not.toContain("raw-csrf-token");
    expect(rawProperties).not.toContain("hashed-session-token");
    expect(rawProperties).not.toContain("raw-cookie-value");
    expect(formattedRecords).not.toContain("user@example.local");
    expect(formattedRecords).not.toContain("eyJhbGciOiJIUzI1NiJ9.payload.signature");
    expect(formattedRecords).not.toContain("4111111111111111");
  });

  it("redacts sensitive free-form auth, cookie, token, and OAuth patterns", async () => {
    const { formattedOutput } = await configureRedactedLogCapture();

    getLogger([APP_LOG_CATEGORY, "auth"]).warn(
      "Auth failed: Authorization: Bearer bearer-secret Cookie: arrtemplar_session=session-secret api_key=api-secret access_token=access-secret refresh_token=refresh-secret csrf_token=csrf-secret email=operator@example.local card=4111111111111111 jwt=eyJhbGciOiJIUzI1NiJ9.payload.signature",
    );
    getLogger([APP_LOG_CATEGORY, "auth"]).info(
      "Cookie: theme=dark; remember_token=raw-remember-token; locale=en",
    );

    const formattedRecords = formattedOutput.join("\n");

    expect(formattedRecords).not.toContain("bearer-secret");
    expect(formattedRecords).not.toContain("session-secret");
    expect(formattedRecords).not.toContain("api-secret");
    expect(formattedRecords).not.toContain("access-secret");
    expect(formattedRecords).not.toContain("refresh-secret");
    expect(formattedRecords).not.toContain("csrf-secret");
    expect(formattedRecords).not.toContain("operator@example.local");
    expect(formattedRecords).not.toContain("4111111111111111");
    expect(formattedRecords).not.toContain("eyJhbGciOiJIUzI1NiJ9.payload.signature");
    expect(formattedRecords).not.toContain("raw-remember-token");
    expect(formattedRecords).toContain("theme=dark");
    expect(formattedRecords).toContain("locale=en");
  });

  it("can be configured repeatedly in one process", async () => {
    const runtimeEnv = readRuntimeEnv({
      LOG_FILE_PATH: testLogPath,
      LOG_FILE_MAX_SIZE_BYTES: "1048576",
      LOG_FILE_MAX_FILES: "2",
    });

    await configureServerLogging(runtimeEnv);
    await configureServerLogging(runtimeEnv);

    const appLogger = getConfig()?.loggers.find((logger) => {
      return Array.isArray(logger.category) && logger.category.join(".") === APP_LOG_CATEGORY;
    });

    expect(appLogger?.sinks).toEqual(["appFile", "appConsole"]);
  });

  it("keeps non-sensitive locally generated startup URLs visible", async () => {
    const { records, formattedOutput } = await configureRedactedLogCapture((record) => {
      return record.message.join("");
    });

    getLogger([APP_LOG_CATEGORY, "server"]).info("Server listening on {serverUrl}", {
      serverUrl: "http://localhost:3124",
    });

    expect(JSON.stringify(records)).toContain("http://localhost:3124");
    expect(formattedOutput.join("\n")).toContain("http://localhost:3124");
  });

  it("keeps request paths visible while redacting URL and referrer query values", async () => {
    const { records, formattedOutput } = await configureRedactedLogCapture();

    getLogger([APP_LOG_CATEGORY, "http"]).info("GET {url} from {referrer} callback {requestUrl}", {
      url: "/api/auth/me?token=query-secret",
      referrer: "http://localhost/login?session=referrer-secret",
      requestUrl: "http://localhost:5173/oauth/callback?code=oauth-code&state=csrf-state#complete",
    });

    const serializedRecords = JSON.stringify(records);
    const formattedRecords = formattedOutput.join("\n");

    expect(serializedRecords).toContain("/api/auth/me");
    expect(serializedRecords).toContain("http://localhost:5173/oauth/callback");
    expect(serializedRecords).toContain("#complete");
    expect(serializedRecords).not.toContain("query-secret");
    expect(serializedRecords).not.toContain("referrer-secret");
    expect(serializedRecords).not.toContain("oauth-code");
    expect(serializedRecords).not.toContain("csrf-state");
    expect(formattedRecords).toContain("/api/auth/me");
    expect(formattedRecords).toContain("http://localhost:5173/oauth/callback");
    expect(formattedRecords).toContain("#complete");
    expect(formattedRecords).not.toContain("query-secret");
    expect(formattedRecords).not.toContain("referrer-secret");
    expect(formattedRecords).not.toContain("oauth-code");
    expect(formattedRecords).not.toContain("csrf-state");
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

    getLogger([APP_LOG_CATEGORY, "server"]).info("Server started for {email}", {
      email: "operator@example.local",
      sessionToken: "startup-session-token",
    });

    await dispose();

    const logText = await Bun.file(resolvedTestLogPath).text();

    expect(logText).toContain("Server started");
    expect(logText).toContain(`${APP_LOG_CATEGORY}.server`);
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
      return Array.isArray(logger.category) && logger.category.join(".") === APP_LOG_CATEGORY;
    });

    expect(arrweebLogger?.sinks).toEqual(["appFile", "appConsole"]);
  });

  it("routes LogTape diagnostics to a dedicated meta sink", async () => {
    const runtimeEnv = readRuntimeEnv({
      LOG_LEVEL: "debug",
      LOG_FILE_PATH: testLogPath,
      LOG_FILE_MAX_SIZE_BYTES: "1048576",
      LOG_FILE_MAX_FILES: "2",
    });

    await configureServerLogging(runtimeEnv);

    const loggers = getConfig()?.loggers ?? [];
    const metaLoggers = loggers.filter((logger) => {
      return Array.isArray(logger.category) && logger.category.join(".") === "logtape.meta";
    });
    const appMetaLogger = loggers.find((logger) => {
      return (
        Array.isArray(logger.category) && logger.category.join(".") === `${APP_LOG_CATEGORY}.meta`
      );
    });

    expect(metaLoggers).toHaveLength(1);
    expect(metaLoggers[0]?.sinks).toEqual(["meta"]);
    expect(metaLoggers[0]?.filters).toEqual(["metaWarnings"]);
    expect(appMetaLogger).toBeUndefined();
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
      return Array.isArray(logger.category) && logger.category.join(".") === APP_LOG_CATEGORY;
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
      return Array.isArray(logger.category) && logger.category.join(".") === APP_LOG_CATEGORY;
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

    const logger = getLogger([APP_LOG_CATEGORY, "database", "query"]);

    logger.debug("Debug query should stay out of production logs", { query: "select 1" });
    logger.info("Info query summary should be logged", { query: "select 1" });

    await dispose();

    const logText = await Bun.file(resolvedTestLogPath).text();

    expect(logText).toContain("Info query summary should be logged");
    expect(logText).not.toContain("Debug query should stay out of production logs");
  });
});
