import { afterEach, describe, expect, it } from "bun:test";
import { createApp } from "../../../../../apps/server/src/app";
import type { DatabaseClient } from "../../../../../apps/server/src/db/client";
import { CSRF_HEADER_NAME, CSRF_HEADER_VALUE } from "../../../../../packages/shared/src";
import { resetAndOpenTestDatabase } from "../../../../helpers/database";
import { TEST_WEB_ORIGIN } from "../../../../helpers/server";

const secretEncryptionKey = "hex:000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f";
const defaultPassword = "correct-horse-battery-staple";

describe("service integration routes", () => {
  afterEach(() => {
    testState.database?.close();
    testState.database = null;
  });

  it("allows full-authority API key principals on service routes", async () => {
    const { app } = await createTestApp();
    const adminCookie = await createInitialAdmin(app);

    const unauthorized = await app.handle(new Request("http://localhost/api/settings/services"));

    expect(unauthorized.status).toBe(401);

    const apiKeyResponse = await app.handle(
      jsonRequest("POST", "/api/api-keys", { name: "Route test" }, { cookie: adminCookie }),
    );
    const apiKeyBody = await apiKeyResponse.json();
    const apiKeyRequest = new Request("http://localhost/api/settings/services", {
      headers: { authorization: `Bearer ${apiKeyBody.secret}` },
    });

    const apiKeyAttempt = await app.handle(apiKeyRequest);

    expect(apiKeyAttempt.status).toBe(200);
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
    expect(saveBody.integration).toMatchObject({
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
    expect(listBody.integrations).toHaveLength(1);

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
    const instanceId = createInstanceBody.integration.id;

    expect(createInstanceResponse.status).toBe(200);
    expect(createInstanceBody.integration).toMatchObject({
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

  it("saves, tests, and reports status for Prowlarr configs", async () => {
    const { app } = await createTestApp();
    const adminCookie = await createInitialAdmin(app);

    const saveResponse = await app.handle(
      jsonRequest(
        "PUT",
        "/api/settings/services/prowlarr",
        {
          displayName: "Main Prowlarr",
          enabled: true,
          useSsl: false,
          host: "127.0.0.1",
          port: 9,
          authMode: "api_key",
          apiKey: "prowlarr-secret",
        },
        { cookie: adminCookie },
      ),
    );
    const saveBody = await saveResponse.json();

    expect(saveResponse.status).toBe(200);
    expect(saveBody.integration).toMatchObject({
      id: "prowlarr",
      kind: "prowlarr",
      displayName: "Main Prowlarr",
      isDefault: true,
      hasApiKey: true,
    });

    const testResponse = await app.handle(
      jsonRequest("POST", "/api/settings/services/prowlarr/test", {}, { cookie: adminCookie }),
    );
    const testBody = await testResponse.json();

    expect(testResponse.status).toBe(200);
    expect(testBody.result.kind).toBe("prowlarr");
    expect(["success", "error"]).toContain(testBody.result.outcome);

    const statusResponse = await app.handle(
      new Request("http://localhost/api/settings/services/prowlarr/status", {
        headers: { cookie: adminCookie },
      }),
    );
    const statusBody = await statusResponse.json();

    expect(statusResponse.status).toBe(200);
    expect(statusBody.result.kind).toBe("prowlarr");
  });

  it("saves, tests, reports status, and lists Jackett and NZBHydra2 configs without secrets", async () => {
    const { app } = await createTestApp();
    const adminCookie = await createInitialAdmin(app);
    const cases = [
      {
        kind: "jackett",
        displayName: "Main Jackett",
        port: 9,
        apiKey: "jackett-route-secret",
      },
      {
        kind: "nzbhydra2",
        displayName: "Main NZBHydra2",
        port: 9,
        apiKey: "nzbhydra-route-secret",
      },
    ] as const;

    for (const testCase of cases) {
      const saveResponse = await app.handle(
        jsonRequest(
          "PUT",
          `/api/settings/services/${testCase.kind}`,
          {
            displayName: testCase.displayName,
            enabled: true,
            useSsl: false,
            host: "127.0.0.1",
            port: testCase.port,
            authMode: "api_key",
            apiKey: testCase.apiKey,
          },
          { cookie: adminCookie },
        ),
      );
      const saveBody = await saveResponse.json();
      const saveSnapshot = JSON.stringify(saveBody);

      expect(saveResponse.status).toBe(200);
      expect(saveBody.integration).toMatchObject({
        id: testCase.kind,
        kind: testCase.kind,
        displayName: testCase.displayName,
        isDefault: true,
        hasApiKey: true,
        hasPassword: false,
      });
      expect(saveSnapshot).not.toContain(testCase.apiKey);

      const testResponse = await app.handle(
        jsonRequest(
          "POST",
          `/api/settings/services/${testCase.kind}/test`,
          {},
          { cookie: adminCookie },
        ),
      );
      const testBody = await testResponse.json();

      expect(testResponse.status).toBe(200);
      expect(testBody.result.kind).toBe(testCase.kind);
      expect(["success", "error"]).toContain(testBody.result.outcome);
      expect(JSON.stringify(testBody)).not.toContain(testCase.apiKey);

      const statusResponse = await app.handle(
        new Request(`http://localhost/api/settings/services/${testCase.kind}/status`, {
          headers: { cookie: adminCookie },
        }),
      );
      const statusBody = await statusResponse.json();

      expect(statusResponse.status).toBe(200);
      expect(statusBody.result.kind).toBe(testCase.kind);
      expect(["success", "error"]).toContain(statusBody.result.outcome);
      expect(JSON.stringify(statusBody)).not.toContain(testCase.apiKey);
    }

    const listResponse = await app.handle(
      new Request("http://localhost/api/settings/services", {
        headers: { cookie: adminCookie },
      }),
    );
    const listBody = await listResponse.json();
    const listSnapshot = JSON.stringify(listBody);

    expect(listResponse.status).toBe(200);
    expect(listBody.integrations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "jackett", hasApiKey: true }),
        expect.objectContaining({ kind: "nzbhydra2", hasApiKey: true }),
      ]),
    );
    expect(listSnapshot).not.toContain("jackett-route-secret");
    expect(listSnapshot).not.toContain("nzbhydra-route-secret");
  });

  it("rejects unsupported Prowlarr auth modes before outbound requests", async () => {
    const { app } = await createTestApp();
    const adminCookie = await createInitialAdmin(app);

    const saveResponse = await app.handle(
      jsonRequest(
        "PUT",
        "/api/settings/services/prowlarr",
        {
          displayName: "Main Prowlarr",
          enabled: true,
          useSsl: false,
          host: "127.0.0.1",
          port: 9696,
          authMode: "username_password",
          username: "admin",
          password: "secret",
        },
        { cookie: adminCookie },
      ),
    );
    const saveBody = await saveResponse.json();

    expect(saveResponse.status).toBe(422);
    expect(saveBody.error.fieldErrors).toContainEqual({
      field: "authMode",
      code: "configuration_incomplete",
      message: "Prowlarr only supports API key authentication.",
    });
  });

  it("rejects unsupported Jackett and NZBHydra2 auth modes", async () => {
    const { app } = await createTestApp();
    const adminCookie = await createInitialAdmin(app);

    for (const kind of ["jackett", "nzbhydra2"] as const) {
      const saveResponse = await app.handle(
        jsonRequest(
          "PUT",
          `/api/settings/services/${kind}`,
          {
            displayName: kind,
            enabled: true,
            useSsl: false,
            host: "127.0.0.1",
            port: kind === "jackett" ? 9117 : 5076,
            authMode: "username_password",
            username: "admin",
            password: "secret",
          },
          { cookie: adminCookie },
        ),
      );
      const saveBody = await saveResponse.json();

      expect(saveResponse.status).toBe(422);
      expect(saveBody.error.fieldErrors).toContainEqual({
        field: "authMode",
        code: "configuration_incomplete",
        message: `${kind === "jackett" ? "Jackett" : "NZBHydra2"} only supports API key authentication.`,
      });
    }
  });

  it("returns unavailable status for unconfigured services and checks saved services", async () => {
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
          host: "127.0.0.1",
          port: 9,
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
      enabled: true,
    });
    expect(["success", "error"]).toContain(disabledBody.result.outcome);
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
