import { afterEach, describe, expect, it } from "bun:test";
import { createApp } from "../../../../../apps/server/src/app";
import type { DatabaseClient } from "../../../../../apps/server/src/db/client";
import { CSRF_HEADER_NAME, CSRF_HEADER_VALUE } from "../../../../../packages/shared/src";
import { resetAndOpenTestDatabase } from "../../../../helpers/database";
import { TEST_WEB_ORIGIN } from "../../../../helpers/server";

const secretEncryptionKey = "hex:000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f";
const defaultPassword = "correct-horse-battery-staple";

describe("download client routes", () => {
  afterEach(() => {
    testState.database?.close();
    testState.database = null;
  });

  it("requires an authenticated session and rejects API key principals", async () => {
    const { app } = await createTestApp();
    const adminCookie = await createInitialAdmin(app);

    const unauthorized = await app.handle(new Request("http://localhost/api/settings/services"));

    expect(unauthorized.status).toBe(401);

    const apiKeyResponse = await app.handle(
      jsonRequest(
        "POST",
        "/api/api-keys",
        { name: "Route test", permissions: ["settings:services"] },
        { cookie: adminCookie },
      ),
    );
    const apiKeyBody = await apiKeyResponse.json();
    const apiKeyRequest = new Request("http://localhost/api/settings/services", {
      headers: { authorization: `Bearer ${apiKeyBody.secret}` },
    });

    const apiKeyAttempt = await app.handle(apiKeyRequest);

    expect(apiKeyAttempt.status).toBe(401);
  });

  it("saves, lists, tests, reports status, and deletes service configs", async () => {
    const { app } = await createTestApp();
    const adminCookie = await createInitialAdmin(app);

    const saveResponse = await app.handle(
      jsonRequest(
        "PUT",
        "/api/settings/services/qbittorrent",
        {
          displayName: "Main qBittorrent",
          enabled: true,
          useSsl: false,
          host: "127.0.0.1",
          port: 9,
          urlBase: "/qbt",
          authMode: "api_key",
          apiKey: "qbt-secret",
        },
        { cookie: adminCookie },
      ),
    );
    const saveBody = await saveResponse.json();

    expect(saveResponse.status).toBe(200);
    expect(saveBody.client).toMatchObject({
      id: "qbittorrent",
      kind: "qbittorrent",
      displayName: "Main qBittorrent",
      isDefault: true,
      host: "127.0.0.1",
      hasApiKey: true,
      hasPassword: false,
      urlBase: "/qbt",
    });

    const listResponse = await app.handle(
      new Request("http://localhost/api/settings/services", {
        headers: { cookie: adminCookie },
      }),
    );
    const listBody = await listResponse.json();

    expect(listResponse.status).toBe(200);
    expect(listBody.clients).toHaveLength(1);

    const createInstanceResponse = await app.handle(
      jsonRequest(
        "POST",
        "/api/settings/services/qbittorrent/instances",
        {
          displayName: "Seedbox qBittorrent",
          enabled: true,
          useSsl: false,
          host: "127.0.0.1",
          port: 9,
          authMode: "api_key",
          apiKey: "qbt-secret-2",
        },
        { cookie: adminCookie },
      ),
    );
    const createInstanceBody = await createInstanceResponse.json();
    const instanceId = createInstanceBody.client.id;

    expect(createInstanceResponse.status).toBe(200);
    expect(createInstanceBody.client).toMatchObject({
      kind: "qbittorrent",
      displayName: "Seedbox qBittorrent",
      isDefault: false,
    });

    const instanceTestResponse = await app.handle(
      jsonRequest(
        "POST",
        `/api/settings/services/instances/${encodeURIComponent(instanceId)}/test`,
        {},
        { cookie: adminCookie },
      ),
    );

    expect(instanceTestResponse.status).toBe(200);

    const instanceDeleteResponse = await app.handle(
      jsonRequest(
        "DELETE",
        `/api/settings/services/instances/${encodeURIComponent(instanceId)}`,
        undefined,
        {
          cookie: adminCookie,
        },
      ),
    );
    const instanceDeleteBody = await instanceDeleteResponse.json();

    expect(instanceDeleteResponse.status).toBe(200);
    expect(instanceDeleteBody).toEqual({
      status: "ok",
      deletedId: instanceId,
      deletedKind: "qbittorrent",
    });

    const testResponse = await app.handle(
      jsonRequest("POST", "/api/settings/services/qbittorrent/test", {}, { cookie: adminCookie }),
    );
    const testBody = await testResponse.json();

    expect(testResponse.status).toBe(200);
    expect(testBody.result.kind).toBe("qbittorrent");
    expect(["success", "error"]).toContain(testBody.result.outcome);

    const statusResponse = await app.handle(
      new Request("http://localhost/api/settings/services/qbittorrent/status", {
        headers: { cookie: adminCookie },
      }),
    );
    const statusBody = await statusResponse.json();

    expect(statusResponse.status).toBe(200);
    expect(statusBody.result.kind).toBe("qbittorrent");

    const deleteResponse = await app.handle(
      jsonRequest("DELETE", "/api/settings/services/qbittorrent", undefined, {
        cookie: adminCookie,
      }),
    );
    const deleteBody = await deleteResponse.json();

    expect(deleteResponse.status).toBe(200);
    expect(deleteBody).toEqual({
      status: "ok",
      deletedId: "qbittorrent",
      deletedKind: "qbittorrent",
    });
  });

  it("returns unavailable status for unconfigured or disabled services", async () => {
    const { app } = await createTestApp();
    const adminCookie = await createInitialAdmin(app);

    const emptyStatus = await app.handle(
      new Request("http://localhost/api/settings/services/sabnzbd/status", {
        headers: { cookie: adminCookie },
      }),
    );
    const emptyBody = await emptyStatus.json();

    expect(emptyStatus.status).toBe(200);
    expect(emptyBody.result).toMatchObject({
      kind: "sabnzbd",
      configured: false,
      outcome: "not_configured",
    });

    await app.handle(
      jsonRequest(
        "PUT",
        "/api/settings/services/sabnzbd",
        {
          enabled: false,
          useSsl: false,
          host: "sab.local",
          port: 8080,
          authMode: "api_key",
          apiKey: "sab-secret",
        },
        { cookie: adminCookie },
      ),
    );

    const disabledStatus = await app.handle(
      new Request("http://localhost/api/settings/services/sabnzbd/status", {
        headers: { cookie: adminCookie },
      }),
    );
    const disabledBody = await disabledStatus.json();

    expect(disabledStatus.status).toBe(200);
    expect(disabledBody.result).toMatchObject({
      kind: "sabnzbd",
      configured: true,
      enabled: false,
      outcome: "disabled",
    });
  });
});

const testState: { database: DatabaseClient | null } = { database: null };

async function createTestApp() {
  const database = await resetAndOpenTestDatabase();
  testState.database = database;

  return {
    app: createApp({
      database,
      oauthClientSecretEncryptionKey: secretEncryptionKey,
      sessionCookieSecure: true,
    }),
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
      "x-forwarded-for": "127.0.0.1",
      origin: TEST_WEB_ORIGIN,
      [CSRF_HEADER_NAME]: CSRF_HEADER_VALUE,
      ...headers,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}
