import { afterEach, describe, expect, it } from "bun:test";
import type { DatabaseClient } from "../../../../../apps/server/src/db/client";
import { CSRF_HEADER_NAME } from "../../../../../packages/shared/src";
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

describe("credentialed CORS policy", () => {
  it("allows credentialed requests only from the configured web origin", async () => {
    const app = await createCorsTestApp();

    const allowedResponse = await app.handle(
      new Request("http://localhost/health", { headers: { origin: TEST_WEB_ORIGIN } }),
    );
    const unknownOriginResponse = await app.handle(
      new Request("http://localhost/health", { headers: { origin: "https://evil.example" } }),
    );

    expect(allowedResponse.headers.get("access-control-allow-origin")).toBe(TEST_WEB_ORIGIN);
    expect(allowedResponse.headers.get("access-control-allow-credentials")).toBe("true");
    expect(unknownOriginResponse.headers.get("access-control-allow-origin")).toBeNull();
    expect(unknownOriginResponse.headers.get("access-control-allow-credentials")).toBeNull();
  });

  it("preflights only the current API methods and explicit request headers", async () => {
    const app = await createCorsTestApp();

    const response = await app.handle(
      new Request("http://localhost/api/auth/login", {
        method: "OPTIONS",
        headers: {
          origin: TEST_WEB_ORIGIN,
          "access-control-request-method": "POST",
          "access-control-request-headers": `content-type, ${CSRF_HEADER_NAME}`,
        },
      }),
    );
    const allowedMethods = parseHeaderList(response.headers.get("access-control-allow-methods"));
    const allowedHeaders = parseHeaderList(response.headers.get("access-control-allow-headers"));

    expect(response.headers.get("access-control-allow-origin")).toBe(TEST_WEB_ORIGIN);
    expect(allowedMethods).toContain("get");
    expect(allowedMethods).toContain("post");
    expect(allowedMethods).toContain("options");
    expect(allowedMethods).not.toContain("delete");
    expect(allowedMethods).not.toContain("patch");
    expect(allowedHeaders).toContain("content-type");
    expect(allowedHeaders).toContain(CSRF_HEADER_NAME.toLowerCase());
    expect(allowedHeaders).not.toContain("authorization");
  });
});

async function createCorsTestApp(): Promise<TestAppContext["app"]> {
  const { app } = await createServerTestApp(openDatabases);

  return app;
}

function parseHeaderList(value: string | null): string[] {
  return (value ?? "")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
}
