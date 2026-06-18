import { afterEach, describe, expect, it } from "bun:test";
import { createApp } from "../../../../../apps/server/src/app";
import { SESSION_COOKIE_NAME } from "../../../../../apps/server/src/auth/session-token";
import type { DatabaseClient } from "../../../../../apps/server/src/db/client";
import { resetAndOpenTestDatabase } from "../../../../helpers/database";
import {
  closeServerTestDatabases,
  createServerTestApp,
  csrfJsonRequest,
  TEST_WEB_ORIGIN,
  type TestAppContext,
} from "../../../../helpers/server";

const openDatabases: DatabaseClient[] = [];

afterEach(() => {
  closeServerTestDatabases(openDatabases);
});

describe("security headers", () => {
  it("applies the baseline headers to public routes with report-only CSP", async () => {
    const app = await createSecurityTestApp();

    const response = await app.handle(new Request("http://localhost/health"));
    const cspReportOnly = response.headers.get("content-security-policy-report-only") ?? "";
    const permissionsPolicy = response.headers.get("permissions-policy") ?? "";

    expect(response.status).toBe(200);
    expect(response.headers.get("x-frame-options")).toBe("DENY");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("x-xss-protection")).toBe("0");
    expect(response.headers.get("referrer-policy")).toBe("strict-origin-when-cross-origin");
    expect(response.headers.get("cross-origin-resource-policy")).toBe("same-origin");
    expect(response.headers.get("cross-origin-opener-policy")).toBe("same-origin");
    expect(response.headers.has("content-security-policy")).toBe(false);
    expect(cspReportOnly).toContain("default-src 'self'");
    expect(cspReportOnly).toContain("script-src 'self'");
    expect(cspReportOnly).toContain("style-src 'self'");
    expect(cspReportOnly).toContain("img-src 'self' data: blob: https:");
    expect(cspReportOnly).toContain("frame-ancestors 'none'");
    expect(cspReportOnly).toContain("form-action 'self'");
    expect(cspReportOnly).not.toContain("unsafe-inline");
    expect(permissionsPolicy).toContain("camera=()");
    expect(permissionsPolicy).toContain("microphone=()");
    expect(permissionsPolicy).toContain("geolocation=()");
    expect(permissionsPolicy).toContain("interest-cohort=()");
    expect(response.headers.has("strict-transport-security")).toBe(false);
  });

  it("emits HSTS only when the app is created in production mode", async () => {
    const database = await resetAndOpenTestDatabase();
    openDatabases.push(database);
    const originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";

    try {
      const app = createApp({ database, sessionCookieSecure: true });
      const response = await app.handle(new Request("http://localhost/health"));

      expect(response.headers.get("strict-transport-security")).toBe(
        "max-age=63072000; includeSubDomains; preload",
      );
    } finally {
      if (originalNodeEnv === undefined) {
        delete process.env.NODE_ENV;
      } else {
        process.env.NODE_ENV = originalNodeEnv;
      }
    }
  });

  it("keeps login session cookies and credentialed CORS behavior intact", async () => {
    const app = await createSecurityTestApp();

    const setupResponse = await app.handle(
      csrfJsonRequest("/api/auth/setup", {
        username: "owner",
        email: "owner@example.local",
        password: "correct-horse-battery-staple",
      }),
    );
    expect(setupResponse.status).toBe(200);

    const loginResponse = await app.handle(
      csrfJsonRequest("/api/auth/login", {
        email: "owner@example.local",
        password: "correct-horse-battery-staple",
      }),
    );
    const setCookie = loginResponse.headers.get("set-cookie") ?? "";

    expect(loginResponse.status).toBe(200);
    expect(setCookie).toContain(`${SESSION_COOKIE_NAME}=`);
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("Secure");
    expect(setCookie).toContain("SameSite=Lax");

    const preflightResponse = await app.handle(
      new Request("http://localhost/api/auth/login", {
        method: "OPTIONS",
        headers: {
          origin: TEST_WEB_ORIGIN,
          "access-control-request-method": "POST",
          "access-control-request-headers": "content-type",
        },
      }),
    );

    expect(preflightResponse.headers.get("access-control-allow-origin")).toBe(TEST_WEB_ORIGIN);
    expect(preflightResponse.headers.get("access-control-allow-credentials")).toBe("true");
  });
});

async function createSecurityTestApp(): Promise<TestAppContext["app"]> {
  const { app } = await createServerTestApp(openDatabases);

  return app;
}
