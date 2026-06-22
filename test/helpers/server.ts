import { createApp } from "../../apps/server/src/app";
import type { LoginRateLimiter } from "../../apps/server/src/auth/rate-limit";
import type { DatabaseClient } from "../../apps/server/src/db/client";
import { CSRF_HEADER_NAME, CSRF_HEADER_VALUE } from "../../packages/shared/src";
import { resetAndOpenTestDatabase } from "./database";

export const TEST_WEB_ORIGIN = "http://localhost:5173";

export type TestAppContext = {
  app: ReturnType<typeof createApp>;
  database: DatabaseClient;
};

export async function createServerTestApp(
  openDatabases: DatabaseClient[],
  options: {
    loginRateLimiter?: LoginRateLimiter;
    oauthClientSecretEncryptionKey?: string | null;
  } = {},
): Promise<TestAppContext> {
  const database = await resetAndOpenTestDatabase();
  openDatabases.push(database);

  return {
    app: createApp({
      database,
      sessionCookieSecure: true,
      ...(options.loginRateLimiter ? { loginRateLimiter: options.loginRateLimiter } : {}),
      ...("oauthClientSecretEncryptionKey" in options
        ? { oauthClientSecretEncryptionKey: options.oauthClientSecretEncryptionKey }
        : {}),
    }),
    database,
  };
}

export function closeServerTestDatabases(openDatabases: DatabaseClient[]): void {
  for (const database of openDatabases.splice(0)) {
    database.close();
  }
}

export function csrfJsonRequest(
  path: string,
  body: unknown,
  headers: Record<string, string> = {},
): Request {
  return new Request(`http://localhost${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": "127.0.0.1",
      origin: TEST_WEB_ORIGIN,
      [CSRF_HEADER_NAME]: CSRF_HEADER_VALUE,
      ...headers,
    },
    body: JSON.stringify(body),
  });
}
