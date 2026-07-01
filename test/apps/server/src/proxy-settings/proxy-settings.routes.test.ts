import { afterEach, describe, expect, it } from "bun:test";
import { createApp } from "../../../../../apps/server/src/app";
import type { DatabaseClient } from "../../../../../apps/server/src/db/client";
import { proxyProfiles } from "../../../../../apps/server/src/db/schema";
import { CSRF_HEADER_NAME, CSRF_HEADER_VALUE } from "../../../../../packages/shared/src";
import { resetAndOpenTestDatabase } from "../../../../helpers/database";
import { TEST_WEB_ORIGIN } from "../../../../helpers/server";

const secretEncryptionKey = "hex:000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f";
const defaultPassword = "correct-horse-battery-staple";

const state: {
  database: DatabaseClient | null;
  servers: Array<{ stop: (closeActiveConnections?: boolean) => void }>;
} = {
  database: null,
  servers: [],
};

afterEach(() => {
  state.database?.close();
  state.database = null;

  while (state.servers.length > 0) {
    state.servers.pop()?.stop(true);
  }
});

describe("proxy settings routes", () => {
  it("allows full-authority API key principals on proxy settings routes", async () => {
    const { app } = await createTestApp();
    const adminCookie = await createInitialAdmin(app);

    const apiKeyResponse = await app.handle(
      jsonRequest("POST", "/api/api-keys", { name: "Proxy routes" }, { cookie: adminCookie }),
    );
    const apiKeyBody = await apiKeyResponse.json();

    const listResponse = await app.handle(
      new Request("http://localhost/api/settings/proxies", {
        headers: { authorization: `Bearer ${apiKeyBody.secret}` },
      }),
    );

    expect(listResponse.status).toBe(200);
  });

  it("creates, lists, tests, updates, and deletes challenge solver profiles", async () => {
    const { app, database } = await createTestApp();
    const adminCookie = await createInitialAdmin(app);
    const solverServer = createServer((request) => {
      if (new URL(request.url).pathname === "/health") {
        return Response.json({ ok: true });
      }

      return new Response("missing", { status: 404 });
    });
    const solverUrl = new URL(solverServer.url);

    const createResponse = await app.handle(
      jsonRequest(
        "POST",
        "/api/settings/proxies",
        {
          kind: "challenge_solver",
          name: "Main solver",
          enabled: true,
          scheme: "http",
          host: solverUrl.hostname,
          port: Number(solverUrl.port),
          variant: "trawl",
          path: "/v1",
        },
        { cookie: adminCookie },
      ),
    );
    const createBody = await createResponse.json();
    const proxyProfileId = createBody.profile.id;

    expect(createResponse.status).toBe(200);
    expect(createBody.profile).toMatchObject({
      kind: "challenge_solver",
      name: "Main solver",
      variant: "trawl",
      hasPassword: false,
    });

    const listResponse = await app.handle(
      new Request("http://localhost/api/settings/proxies", { headers: { cookie: adminCookie } }),
    );
    const listBody = await listResponse.json();

    expect(listResponse.status).toBe(200);
    expect(listBody.profiles).toHaveLength(1);

    const testResponse = await app.handle(
      jsonRequest(
        "POST",
        `/api/settings/proxies/${encodeURIComponent(proxyProfileId)}/test`,
        {},
        { cookie: adminCookie },
      ),
    );
    const testBody = await testResponse.json();

    expect(testResponse.status).toBe(200);
    expect(testBody.result).toMatchObject({
      profileId: proxyProfileId,
      kind: "challenge_solver",
      outcome: "success",
      statusCode: 200,
    });

    const stored = database.db
      .select()
      .from(proxyProfiles)
      .all()
      .find((profile) => profile.id === proxyProfileId);

    expect(stored?.lastTestOutcome).toBe("success");

    const updateResponse = await app.handle(
      jsonRequest(
        "PUT",
        `/api/settings/proxies/${encodeURIComponent(proxyProfileId)}`,
        {
          kind: "challenge_solver",
          name: "Updated solver",
          enabled: true,
          scheme: "http",
          host: solverUrl.hostname,
          port: Number(solverUrl.port),
          variant: "flaresolverr",
          path: "/v1",
          sessionName: "solver-session",
          sessionTtlMinutes: 30,
        },
        { cookie: adminCookie },
      ),
    );
    const updateBody = await updateResponse.json();

    expect(updateResponse.status).toBe(200);
    expect(updateBody.profile).toMatchObject({
      name: "Updated solver",
      variant: "flaresolverr",
      sessionName: "solver-session",
      sessionTtlMinutes: 30,
    });

    const deleteResponse = await app.handle(
      jsonRequest(
        "DELETE",
        `/api/settings/proxies/${encodeURIComponent(proxyProfileId)}`,
        undefined,
        { cookie: adminCookie },
      ),
    );
    const deleteBody = await deleteResponse.json();

    expect(deleteResponse.status).toBe(200);
    expect(deleteBody).toEqual({
      status: "ok",
      deletedId: proxyProfileId,
      deletedKind: "challenge_solver",
    });
  });

  it("returns skipped for disabled HTTP proxy test requests", async () => {
    const { app } = await createTestApp();
    const adminCookie = await createInitialAdmin(app);

    const createResponse = await app.handle(
      jsonRequest(
        "POST",
        "/api/settings/proxies",
        {
          kind: "http_proxy",
          name: "Disabled proxy",
          enabled: false,
          scheme: "http",
          host: "proxy.local",
          port: 8080,
        },
        { cookie: adminCookie },
      ),
    );
    const createBody = await createResponse.json();

    expect(createResponse.status).toBe(200);

    const testResponse = await app.handle(
      jsonRequest(
        "POST",
        `/api/settings/proxies/${encodeURIComponent(createBody.profile.id)}/test`,
        {},
        { cookie: adminCookie },
      ),
    );
    const testBody = await testResponse.json();

    expect(testResponse.status).toBe(200);
    expect(testBody.result).toMatchObject({
      kind: "http_proxy",
      outcome: "skipped",
      message: "Proxy profile is disabled.",
    });
  });

  it("rejects duplicate profile kinds", async () => {
    const { app } = await createTestApp();
    const adminCookie = await createInitialAdmin(app);

    await app.handle(
      jsonRequest(
        "POST",
        "/api/settings/proxies",
        {
          kind: "http_proxy",
          name: "Main proxy",
          enabled: true,
          scheme: "http",
          host: "proxy.local",
          port: 8080,
        },
        { cookie: adminCookie },
      ),
    );

    const duplicateResponse = await app.handle(
      jsonRequest(
        "POST",
        "/api/settings/proxies",
        {
          kind: "http_proxy",
          name: "Second proxy",
          enabled: true,
          scheme: "http",
          host: "proxy-2.local",
          port: 8081,
        },
        { cookie: adminCookie },
      ),
    );
    const duplicateBody = await duplicateResponse.json();

    expect(duplicateResponse.status).toBe(409);
    expect(duplicateBody.error.code).toBe("PROXY_PROFILE_KIND_ALREADY_CONFIGURED");
  });
});

async function createTestApp() {
  const database = await resetAndOpenTestDatabase();
  state.database = database;

  return {
    app: createApp({
      database,
      oauthClientSecretEncryptionKey: secretEncryptionKey,
      sessionCookieSecure: true,
    }),
    database,
  };
}

async function createInitialAdmin(app: ReturnType<typeof createApp>): Promise<string> {
  const response = await app.handle(
    jsonRequest("POST", "/api/auth/setup", {
      username: "owner",
      email: "owner@example.local",
      password: defaultPassword,
    }),
  );
  const setCookie = response.headers.get("set-cookie") ?? "";
  const [cookie] = setCookie.split(";", 1);

  if (!cookie) {
    throw new Error("Expected setup route to set a session cookie.");
  }

  return cookie;
}

function jsonRequest(
  method: "DELETE" | "POST" | "PUT",
  path: string,
  body?: unknown,
  headers: Record<string, string> = {},
): Request {
  return new Request(`http://localhost${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      origin: TEST_WEB_ORIGIN,
      [CSRF_HEADER_NAME]: CSRF_HEADER_VALUE,
      ...headers,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

function createServer(fetchHandler: (request: Request) => Response | Promise<Response>) {
  const server = Bun.serve({ port: 0, fetch: fetchHandler });

  state.servers.push(server);

  return server;
}
