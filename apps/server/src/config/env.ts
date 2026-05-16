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
};

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
  };
}

export const env = readRuntimeEnv();
