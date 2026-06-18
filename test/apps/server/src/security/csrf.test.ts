import { afterEach, describe, expect, it } from "bun:test";
import type { DatabaseClient } from "../../../../../apps/server/src/db/client";
import { CSRF_HEADER_NAME, CSRF_HEADER_VALUE } from "../../../../../packages/shared/src";
import {
  closeServerTestDatabases,
  createServerTestApp,
  TEST_WEB_ORIGIN,
  type TestAppContext,
} from "../../../../helpers/server";

const openDatabases: DatabaseClient[] = [];

afterEach(() => {
  closeServerTestDatabases(openDatabases);
});

describe("CSRF request policy", () => {
  it("allows safe methods without a CSRF header", async () => {
    const app = await createCsrfTestApp();

    const healthResponse = await app.handle(new Request("http://localhost/health"));
    const setupStatusResponse = await app.handle(new Request("http://localhost/api/auth/setup"));
    const meResponse = await app.handle(new Request("http://localhost/api/auth/me"));

    expect(healthResponse.status).toBe(200);
    expect(setupStatusResponse.status).toBe(200);
    expect(meResponse.status).toBe(200);
  });

  it("allows unsafe API requests from the configured SPA origin with the CSRF header", async () => {
    const app = await createCsrfTestApp();

    const response = await app.handle(
      unsafeJsonRequest("/api/auth/setup", {
        username: "owner",
        email: "owner@example.local",
        password: "correct-horse-battery-staple",
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("vary")).toContain("Sec-Fetch-Site");
    expect(response.headers.get("vary")).toContain("Origin");
  });

  it("rejects cross-site unsafe API requests before auth handlers run", async () => {
    const app = await createCsrfTestApp();

    const response = await app.handle(
      unsafeJsonRequest(
        "/api/auth/setup",
        {
          username: "owner",
          email: "owner@example.local",
          password: "correct-horse-battery-staple",
        },
        { origin: "https://evil.example", secFetchSite: "cross-site" },
      ),
    );
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body).toEqual({
      error: {
        code: "CSRF_REJECTED",
        message: "Request rejected by CSRF protection.",
      },
    });
  });

  it("rejects unsafe API requests missing the CSRF header", async () => {
    const app = await createCsrfTestApp();

    const response = await app.handle(
      unsafeJsonRequest(
        "/api/auth/setup",
        {
          username: "owner",
          email: "owner@example.local",
          password: "correct-horse-battery-staple",
        },
        { csrfHeader: false },
      ),
    );

    expect(response.status).toBe(403);
  });

  it("rejects unsafe API requests from an unexpected Origin", async () => {
    const app = await createCsrfTestApp();

    const response = await app.handle(
      unsafeJsonRequest(
        "/api/auth/setup",
        {
          username: "owner",
          email: "owner@example.local",
          password: "correct-horse-battery-staple",
        },
        { origin: "https://evil.example", secFetchSite: "same-site" },
      ),
    );

    expect(response.status).toBe(403);
  });

  it("accepts a matching Referer when Origin is absent", async () => {
    const app = await createCsrfTestApp();

    const response = await app.handle(
      unsafeJsonRequest(
        "/api/auth/setup",
        {
          username: "owner",
          email: "owner@example.local",
          password: "correct-horse-battery-staple",
        },
        { origin: null, referer: `${TEST_WEB_ORIGIN}/setup` },
      ),
    );

    expect(response.status).toBe(200);
  });
});

async function createCsrfTestApp(): Promise<TestAppContext["app"]> {
  const { app } = await createServerTestApp(openDatabases);

  return app;
}

function unsafeJsonRequest(
  path: string,
  body: unknown,
  options: {
    origin?: string | null;
    referer?: string;
    secFetchSite?: string;
    csrfHeader?: boolean;
  } = {},
): Request {
  const headers = new Headers({
    "content-type": "application/json",
    "x-forwarded-for": "127.0.0.1",
    "sec-fetch-site": options.secFetchSite ?? "same-site",
  });
  const origin = options.origin === undefined ? TEST_WEB_ORIGIN : options.origin;

  if (origin !== null) {
    headers.set("origin", origin);
  }

  if (options.referer) {
    headers.set("referer", options.referer);
  }

  if (options.csrfHeader !== false) {
    headers.set(CSRF_HEADER_NAME, CSRF_HEADER_VALUE);
  }

  return new Request(`http://localhost${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}
