import { afterEach, describe, expect, it } from "bun:test";
import type { DatabaseClient } from "../../../../../apps/server/src/db/client";
import { type ProxyProfile, proxyProfiles } from "../../../../../apps/server/src/db/schema";
import { ProxyProfileService } from "../../../../../apps/server/src/proxy-settings/proxy-profile.service";
import { resetAndOpenTestDatabase } from "../../../../helpers/database";

const secretEncryptionKey = "hex:000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f";

const state: {
  challengeRequests: Array<{ path: string; timeoutMs?: number }>;
  database: DatabaseClient | null;
  httpFetchCalls: Array<{
    input: string | URL;
    init: RequestInit & { proxy?: string | { url: string; headers?: HeadersInit } };
  }>;
} = {
  challengeRequests: [],
  database: null,
  httpFetchCalls: [],
};

afterEach(() => {
  state.database?.close();
  state.database = null;
  state.challengeRequests = [];
  state.httpFetchCalls = [];
});

describe("ProxyProfileService", () => {
  it("stores encrypted HTTP proxy secrets and safe response fields", async () => {
    const database = await openDatabase();
    const service = createService(database);

    const result = await service.createProfile({
      kind: "http_proxy",
      name: "Main proxy",
      enabled: true,
      scheme: "http",
      host: "proxy.local",
      port: 8080,
      username: "operator",
      password: "proxy-secret",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("Expected proxy profile creation to succeed.");
    }

    expect(result.body.profile).toMatchObject({
      kind: "http_proxy",
      name: "Main proxy",
      username: "operator",
      hasPassword: true,
    });

    const stored = readStoredProfile(database, result.body.profile.id);

    expect(stored?.passwordEncrypted).toEqual(expect.any(String));
    expect(stored?.passwordEncrypted).not.toContain("proxy-secret");
    expect(stored?.username).toBe("operator");
  });

  it("rejects duplicate profile kinds", async () => {
    const database = await openDatabase();
    const service = createService(database);

    await service.createProfile({
      kind: "challenge_solver",
      name: "Challenge solver",
      enabled: true,
      scheme: "http",
      host: "solver.local",
      port: 8191,
    });

    const duplicate = await service.createProfile({
      kind: "challenge_solver",
      name: "Another solver",
      enabled: true,
      scheme: "http",
      host: "solver-2.local",
      port: 8191,
    });

    expect(duplicate.ok).toBe(false);
    if (duplicate.ok) {
      throw new Error("Expected duplicate kind creation to fail.");
    }

    expect(duplicate.status).toBe(409);
    expect(duplicate.body.error.code).toBe("PROXY_PROFILE_KIND_ALREADY_CONFIGURED");
  });

  it("preserves existing HTTP proxy password when update omits it", async () => {
    const database = await openDatabase();
    const service = createService(database);

    const created = await service.createProfile({
      kind: "http_proxy",
      name: "Main proxy",
      enabled: true,
      scheme: "http",
      host: "proxy.local",
      port: 8080,
      username: "operator",
      password: "proxy-secret",
    });

    expect(created.ok).toBe(true);
    if (!created.ok) {
      throw new Error("Expected proxy profile creation to succeed.");
    }

    const updated = await service.updateProfile(created.body.profile.id, {
      kind: "http_proxy",
      name: "Renamed proxy",
      enabled: true,
      scheme: "http",
      host: "proxy.local",
      port: 8080,
      username: "operator",
    });

    expect(updated.ok).toBe(true);
    if (!updated.ok) {
      throw new Error("Expected proxy profile update to succeed.");
    }

    const testResult = await service.testProfile(created.body.profile.id);

    expect(testResult.ok).toBe(true);
    if (!testResult.ok) {
      throw new Error("Expected proxy profile test to succeed.");
    }

    expect(state.httpFetchCalls).toHaveLength(1);
    expect(state.httpFetchCalls[0]?.init.proxy).toEqual({
      url: "http://proxy.local:8080",
      headers: {
        "Proxy-Authorization": "Basic b3BlcmF0b3I6cHJveHktc2VjcmV0",
      },
    });
  });

  it("persists challenge solver test metadata", async () => {
    const database = await openDatabase();
    const service = createService(database);

    const created = await service.createProfile({
      kind: "challenge_solver",
      name: "Solver",
      enabled: true,
      scheme: "http",
      host: "solver.local",
      port: 8191,
      variant: "trawl",
    });

    expect(created.ok).toBe(true);
    if (!created.ok) {
      throw new Error("Expected solver creation to succeed.");
    }

    const tested = await service.testProfile(created.body.profile.id);

    expect(tested.ok).toBe(true);
    if (!tested.ok) {
      throw new Error("Expected solver test to succeed.");
    }

    expect(state.challengeRequests).toHaveLength(1);
    expect(state.challengeRequests[0]).toMatchObject({ path: "/health", timeoutMs: 60_000 });

    const stored = readStoredProfile(database, created.body.profile.id);

    expect(stored?.lastTestOutcome).toBe("success");
    expect(stored?.lastTestMessage).toBe("Trawl responded on /health.");
    expect(stored?.lastTestedAt).toEqual(expect.any(String));
  });

  it("skips tests for disabled proxy profiles", async () => {
    const database = await openDatabase();
    const service = createService(database);

    const created = await service.createProfile({
      kind: "http_proxy",
      name: "Disabled proxy",
      enabled: false,
      scheme: "http",
      host: "proxy.local",
      port: 8080,
    });

    expect(created.ok).toBe(true);
    if (!created.ok) {
      throw new Error("Expected proxy profile creation to succeed.");
    }

    const tested = await service.testProfile(created.body.profile.id);

    expect(tested.ok).toBe(true);
    if (!tested.ok) {
      throw new Error("Expected disabled proxy test to return a result.");
    }

    expect(tested.body.result).toMatchObject({
      outcome: "skipped",
      message: "Proxy profile is disabled.",
    });
    expect(state.httpFetchCalls).toHaveLength(0);
  });

  it("rejects non-FlareSolverr session settings", async () => {
    const database = await openDatabase();
    const service = createService(database);

    const result = await service.createProfile({
      kind: "challenge_solver",
      name: "Bad solver",
      enabled: true,
      scheme: "http",
      host: "solver.local",
      port: 8191,
      variant: "trawl",
      sessionName: "session-a",
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("Expected invalid session settings to fail.");
    }

    expect(result.status).toBe(422);
    expect(result.body.error.fieldErrors?.[0]).toEqual({
      field: "sessionName",
      code: "unsupported_session_settings",
      message: "FlareSolverr is required for session settings.",
    });
  });
});

async function openDatabase(): Promise<DatabaseClient> {
  const database = await resetAndOpenTestDatabase();
  state.database = database;
  return database;
}

function createService(database: DatabaseClient) {
  return new ProxyProfileService(database, {
    secretEncryptionKey,
    challengeSolverDependencies: {
      now: () => "2026-06-30T12:00:00.000Z",
      requestText: async (options) => {
        state.challengeRequests.push({
          path: options.path,
          ...(options.timeoutMs !== undefined ? { timeoutMs: options.timeoutMs } : {}),
        });
        return { headers: new Headers(), status: 200, text: "ok" };
      },
    },
    httpProxyDependencies: {
      now: () => "2026-06-30T12:00:00.000Z",
      fetch: async (input, init) => {
        state.httpFetchCalls.push({ input, init });
        return new Response("ok", { status: 200 });
      },
    },
  });
}

function readStoredProfile(database: DatabaseClient, id: string): ProxyProfile | undefined {
  return database.db
    .select()
    .from(proxyProfiles)
    .all()
    .find((profile) => profile.id === id);
}
