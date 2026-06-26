import { afterEach, describe, expect, it } from "bun:test";
import type { DatabaseClient } from "../../../../../apps/server/src/db/client";
import { serviceIntegrations } from "../../../../../apps/server/src/db/schema";
import type { ProwlarrProbeResponse } from "../../../../../apps/server/src/service-integrations/prowlarr-client";
import type { QbittorrentProbeResult } from "../../../../../apps/server/src/service-integrations/qbittorrent-client";
import type { SabnzbdClientProbeResponse } from "../../../../../apps/server/src/service-integrations/sabnzbd-client";
import { ServiceIntegrationService } from "../../../../../apps/server/src/service-integrations/service-integration.service";
import { resetAndOpenTestDatabase } from "../../../../helpers/database";

const secretEncryptionKey = "hex:000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f";

describe("ServiceIntegrationService", () => {
  afterEach(() => {
    mockState.database?.close();
    mockState.database = null;
    mockState.prowlarrCalls = [];
    mockState.qbittorrentCalls = [];
    mockState.sabnzbdCalls = [];
  });

  it("stores safe metadata and encrypted secrets", async () => {
    const database = await openDatabase();
    const service = createService(database);

    const result = await service.upsertConfig("qbittorrent", {
      displayName: "Main qBittorrent",
      enabled: true,
      useSsl: false,
      host: "qbittorrent.local",
      port: 8080,
      urlBase: "/qbt",
      authMode: "api_key",
      apiKey: "qbt-secret",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("Expected upsert to succeed.");
    }

    expect(result.body.integration).toMatchObject({
      id: "qbittorrent",
      kind: "qbittorrent",
      displayName: "Main qBittorrent",
      isDefault: true,
      enabled: true,
      host: "qbittorrent.local",
      port: 8080,
      urlBase: "/qbt",
      authMode: "api_key",
      hasApiKey: true,
      hasPassword: false,
    });

    const storedRow = database.db.select().from(serviceIntegrations).get();

    expect(storedRow?.apiKeyEncrypted).toEqual(expect.any(String));
    expect(storedRow?.apiKeyEncrypted).not.toContain("qbt-secret");
    expect(storedRow?.passwordEncrypted).toBeNull();
    expect(result.body.integration).not.toHaveProperty("apiKeyEncrypted");
  });

  it("preserves existing secrets when new secret input is omitted", async () => {
    const database = await openDatabase();
    const service = createService(database);

    await service.upsertConfig("qbittorrent", {
      displayName: "Main qBittorrent",
      enabled: true,
      useSsl: false,
      host: "qbittorrent.local",
      port: 8080,
      authMode: "api_key",
      apiKey: "persisted-secret",
    });
    await service.upsertConfig("qbittorrent", {
      displayName: "Renamed qBittorrent",
      enabled: true,
      useSsl: false,
      host: "qbittorrent.local",
      port: 8080,
      urlBase: "/qbt",
      authMode: "api_key",
    });

    const testResult = await service.testConfig("qbittorrent");

    expect(testResult.ok).toBe(true);
    if (!testResult.ok) {
      throw new Error("Expected qBittorrent test to succeed.");
    }

    expect(mockState.qbittorrentCalls[0]?.apiKey).toBe("persisted-secret");
    expect(testResult.body.result.outcome).toBe("success");
  });

  it("creates named additional instances without replacing the default config", async () => {
    const database = await openDatabase();
    const service = createService(database);

    await service.upsertConfig("sabnzbd", {
      displayName: "Main SABnzbd",
      enabled: true,
      useSsl: false,
      host: "sab.local",
      port: 8080,
      authMode: "api_key",
      apiKey: "sab-secret",
    });
    const additional = await service.createConfig("sabnzbd", {
      displayName: "Backup SABnzbd",
      enabled: true,
      useSsl: false,
      host: "sab-backup.local",
      port: 8085,
      authMode: "api_key",
      apiKey: "sab-backup-secret",
    });

    expect(additional.ok).toBe(true);
    if (!additional.ok) {
      throw new Error("Expected additional SABnzbd config to save.");
    }

    const configs = service.listConfigs().integrations;

    expect(configs).toHaveLength(2);
    expect(configs.find((config) => config.isDefault)).toMatchObject({
      id: "sabnzbd",
      displayName: "Main SABnzbd",
    });
    expect(configs.find((config) => !config.isDefault)).toMatchObject({
      displayName: "Backup SABnzbd",
      kind: "sabnzbd",
    });
  });

  it("connects saved configs without a separate enabled switch", async () => {
    const database = await openDatabase();
    const service = createService(database);

    const saveResult = await service.upsertConfig("sabnzbd", {
      displayName: "SABnzbd",
      enabled: false,
      useSsl: false,
      host: "sab.local",
      port: 8080,
      authMode: "api_key",
      apiKey: "sab-secret",
    });

    expect(saveResult.ok).toBe(true);
    if (!saveResult.ok) {
      throw new Error("Expected SABnzbd config to save.");
    }
    expect(saveResult.body.integration?.enabled).toBe(true);

    const result = await service.getStatus("sabnzbd");

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("Expected connected status result.");
    }

    expect(result.body.result).toMatchObject({
      kind: "sabnzbd",
      configured: true,
      enabled: true,
      outcome: "success",
    });
    expect(mockState.sabnzbdCalls).toHaveLength(1);
  });

  it("returns not-configured status for missing configs", async () => {
    const database = await openDatabase();
    const service = createService(database);

    const result = await service.getStatus("sabnzbd");

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("Expected not-configured status result.");
    }

    expect(result.body.result).toMatchObject({
      kind: "sabnzbd",
      enabled: false,
      configured: false,
      outcome: "not_configured",
    });
  });

  it("updates last-test metadata after probes", async () => {
    const database = await openDatabase();
    const service = createService(database);

    await service.upsertConfig("sabnzbd", {
      displayName: "SABnzbd",
      enabled: true,
      useSsl: false,
      host: "sab.local",
      port: 8080,
      authMode: "api_key",
      apiKey: "sab-secret",
    });

    const result = await service.testConfig("sabnzbd");

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("Expected SABnzbd test result.");
    }

    const storedRow = database.db.select().from(serviceIntegrations).all();
    const stored = storedRow.find((entry) => entry.kind === "sabnzbd");

    expect(stored?.lastTestOutcome).toBe("success");
    expect(stored?.lastTestMessage).toBe("SABnzbd connection succeeded.");
    expect(stored?.lastTestedAt).toEqual(expect.any(String));
  });

  it("rejects username/password auth for Prowlarr before probing", async () => {
    const database = await openDatabase();
    const service = createService(database);

    const result = await service.upsertConfig("prowlarr", {
      displayName: "Main Prowlarr",
      enabled: true,
      useSsl: false,
      host: "prowlarr.local",
      port: 9696,
      authMode: "username_password",
      username: "admin",
      password: "secret",
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("Expected Prowlarr validation to fail.");
    }

    expect(result.status).toBe(422);
    expect(result.body.error.fieldErrors).toContainEqual({
      field: "authMode",
      code: "configuration_incomplete",
      message: "Prowlarr only supports API key authentication.",
    });
    expect(mockState.prowlarrCalls).toHaveLength(0);
  });
});

const mockState: {
  database: DatabaseClient | null;
  prowlarrCalls: Array<Record<string, unknown>>;
  qbittorrentCalls: Array<Record<string, unknown>>;
  sabnzbdCalls: Array<Record<string, unknown>>;
} = {
  database: null,
  prowlarrCalls: [],
  qbittorrentCalls: [],
  sabnzbdCalls: [],
};

async function openDatabase(): Promise<DatabaseClient> {
  const database = await resetAndOpenTestDatabase();
  mockState.database = database;
  return database;
}

function createService(database: DatabaseClient): ServiceIntegrationService {
  return new ServiceIntegrationService(database, {
    secretEncryptionKey,
    probers: {
      prowlarr: async (config) => {
        mockState.prowlarrCalls.push(config as Record<string, unknown>);
        return successProwlarrProbe();
      },
      qbittorrent: async (config) => {
        mockState.qbittorrentCalls.push(config as Record<string, unknown>);
        return successQbittorrentProbe();
      },
      sabnzbd: async (config) => {
        mockState.sabnzbdCalls.push(config as Record<string, unknown>);
        return successSabnzbdProbe();
      },
    },
  });
}

function successQbittorrentProbe(): QbittorrentProbeResult {
  return {
    ok: true,
    result: {
      kind: "qbittorrent",
      configured: true,
      enabled: true,
      outcome: "success",
      summary: "Connected to qBittorrent 5.2.2.",
      checkedAt: new Date().toISOString(),
      reachable: true,
      authenticated: true,
      compatible: true,
      version: "5.2.2",
      webApiVersion: "2.11.4",
      connectionState: "connected",
    },
  };
}

function successSabnzbdProbe(): SabnzbdClientProbeResponse {
  return {
    ok: true,
    result: {
      kind: "sabnzbd",
      configured: true,
      enabled: true,
      outcome: "success",
      summary: "SABnzbd connection succeeded.",
      checkedAt: new Date().toISOString(),
      reachable: true,
      authenticated: true,
      compatible: true,
      version: "4.5.3",
      webApiVersion: null,
      connectionState: "connected",
    },
  };
}

function successProwlarrProbe(): ProwlarrProbeResponse {
  return {
    ok: true,
    result: {
      kind: "prowlarr",
      configured: true,
      enabled: true,
      outcome: "success",
      summary: "Connected to Prowlarr 1.30.2.",
      checkedAt: new Date().toISOString(),
      reachable: true,
      authenticated: true,
      compatible: true,
      version: "1.30.2",
      webApiVersion: null,
      connectionState: "connected",
    },
  };
}
