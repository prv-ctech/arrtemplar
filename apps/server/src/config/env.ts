import { DEV_DATABASE_URL, TEST_DATABASE_URL } from "./database-paths";
import { DEFAULT_WEB_ORIGIN, DEV_SERVER_PORT, TEST_SERVER_PORT } from "./runtime-defaults";

export { DEV_DATABASE_URL, TEST_DATABASE_URL } from "./database-paths";
export { DEV_SERVER_PORT, TEST_SERVER_PORT } from "./runtime-defaults";

type RuntimeEnvironment = Record<string, string | undefined>;

export type RuntimeEnv = {
  serverPort: number;
  webOrigin: string;
  databaseUrl: string;
  sessionCookieSecure: boolean;
  logLevel: RuntimeLogLevel;
  logFilePath: string;
  logFileMaxSizeBytes: number;
  logFileMaxFiles: number;
  logConsoleEnabled: boolean;
};

export type RuntimeLogLevel = "trace" | "debug" | "info" | "warning" | "error" | "fatal";

const runtimeLogLevels = ["trace", "debug", "info", "warning", "error", "fatal"] as const;
const DEFAULT_LOG_FILE_PATH = "data/logs/arrweeb-anime.jsonl";
const DEFAULT_LOG_FILE_MAX_SIZE_BYTES = 10 * 1024 * 1024;
const DEFAULT_LOG_FILE_MAX_FILES = 5;

function readPort(value: string | undefined, environment: RuntimeEnvironment): number {
  if (!value) {
    return isTestEnvironment(environment) ? TEST_SERVER_PORT : DEV_SERVER_PORT;
  }

  const port = Number(value);

  if (!Number.isInteger(port) || port <= 0 || port > 65_535) {
    throw new Error(`SERVER_PORT must be an integer from 1 to 65535, received: ${value}`);
  }

  return port;
}

function readBoolean(value: string | undefined, defaultValue: boolean): boolean {
  if (!value) {
    return defaultValue;
  }

  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  throw new Error(`Expected boolean environment value to be true or false, received: ${value}`);
}

function readNamedBoolean(name: string, value: string | undefined, defaultValue: boolean): boolean {
  if (!value) {
    return defaultValue;
  }

  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  throw new Error(`${name} must be true or false, received: ${value}`);
}

function readLogLevel(value: string | undefined, environment: RuntimeEnvironment): RuntimeLogLevel {
  const logLevel = value?.trim() ?? defaultLogLevel(environment);

  if (isRuntimeLogLevel(logLevel)) {
    return logLevel;
  }

  throw new Error(`LOG_LEVEL must be one of ${runtimeLogLevels.join(", ")}, received: ${value}`);
}

function defaultLogLevel(environment: RuntimeEnvironment): RuntimeLogLevel {
  if (isTestEnvironment(environment)) {
    return "fatal";
  }

  return environment.NODE_ENV === "production" ? "info" : "debug";
}

function defaultLogConsoleEnabled(environment: RuntimeEnvironment): boolean {
  return !isTestEnvironment(environment) && environment.NODE_ENV !== "production";
}

function isRuntimeLogLevel(value: string): value is RuntimeLogLevel {
  return runtimeLogLevels.some((logLevel) => logLevel === value);
}

function readLogFilePath(value: string | undefined): string {
  const path = value?.trim() ?? DEFAULT_LOG_FILE_PATH;

  if (!path) {
    throw new Error("LOG_FILE_PATH must not be empty.");
  }

  return path;
}

function readPositiveInteger(
  name: "LOG_FILE_MAX_SIZE_BYTES" | "LOG_FILE_MAX_FILES",
  value: string | undefined,
  defaultValue: number,
): number {
  if (!value) {
    return defaultValue;
  }

  const parsedValue = Number(value);

  if (!Number.isInteger(parsedValue) || parsedValue <= 0) {
    throw new Error(`${name} must be a positive integer, received: ${value}`);
  }

  return parsedValue;
}

function readDatabaseUrl(environment: RuntimeEnvironment): string {
  const databaseUrl = readConfiguredDatabaseUrl(environment);

  assertFileDatabaseUrl(databaseUrl);
  assertSafeTestDatabaseUrl(databaseUrl, environment);

  return databaseUrl;
}

function readConfiguredDatabaseUrl(environment: RuntimeEnvironment): string {
  const fallbackDatabaseUrl = isTestEnvironment(environment) ? TEST_DATABASE_URL : DEV_DATABASE_URL;
  const databaseUrl = environment.DATABASE_URL?.trim() ?? fallbackDatabaseUrl;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL must not be empty.");
  }

  return databaseUrl;
}

function assertFileDatabaseUrl(databaseUrl: string): void {
  if (databaseUrl !== ":memory:" && !databaseUrl.startsWith("file:")) {
    return;
  }

  throw new Error(`DATABASE_URL must be a SQLite file path, received: ${databaseUrl}`);
}

function assertSafeTestDatabaseUrl(databaseUrl: string, environment: RuntimeEnvironment): void {
  if (!isTestEnvironment(environment)) {
    return;
  }

  if (databaseUrl === DEV_DATABASE_URL) {
    throw new Error(`NODE_ENV=test cannot use the development database (${DEV_DATABASE_URL}).`);
  }

  if (databaseUrl !== TEST_DATABASE_URL) {
    throw new Error(
      `NODE_ENV=test requires DATABASE_URL to be ${TEST_DATABASE_URL}, received: ${databaseUrl}`,
    );
  }
}

function isTestEnvironment(environment: RuntimeEnvironment): boolean {
  return environment.NODE_ENV === "test";
}

export function readRuntimeEnv(environment: RuntimeEnvironment = Bun.env): RuntimeEnv {
  return {
    serverPort: readPort(environment.SERVER_PORT, environment),
    webOrigin: environment.WEB_ORIGIN ?? DEFAULT_WEB_ORIGIN,
    databaseUrl: readDatabaseUrl(environment),
    sessionCookieSecure: readBoolean(environment.SESSION_COOKIE_SECURE, true),
    logLevel: readLogLevel(environment.LOG_LEVEL, environment),
    logFilePath: readLogFilePath(environment.LOG_FILE_PATH),
    logFileMaxSizeBytes: readPositiveInteger(
      "LOG_FILE_MAX_SIZE_BYTES",
      environment.LOG_FILE_MAX_SIZE_BYTES,
      DEFAULT_LOG_FILE_MAX_SIZE_BYTES,
    ),
    logFileMaxFiles: readPositiveInteger(
      "LOG_FILE_MAX_FILES",
      environment.LOG_FILE_MAX_FILES,
      DEFAULT_LOG_FILE_MAX_FILES,
    ),
    logConsoleEnabled: readNamedBoolean(
      "LOG_CONSOLE",
      environment.LOG_CONSOLE,
      defaultLogConsoleEnabled(environment),
    ),
  };
}

export const env = readRuntimeEnv();
