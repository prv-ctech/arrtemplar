import { afterEach, describe, expect, it } from "bun:test";
import type { DatabaseClient } from "../../../../../apps/server/src/db/client";
import { serviceIntegrations } from "../../../../../apps/server/src/db/schema";
import type { JackettProbeResponse } from "../../../../../apps/server/src/service-integrations/jackett-client";
import type { JellyfinProbeResponse } from "../../../../../apps/server/src/service-integrations/jellyfin-client";
import type { Nzbhydra2ProbeResponse } from "../../../../../apps/server/src/service-integrations/nzbhydra2-client";
import type { PlexProbeResponse } from "../../../../../apps/server/src/service-integrations/plex-client";
import type { ProwlarrProbeResponse } from "../../../../../apps/server/src/service-integrations/prowlarr-client";
import type { QbittorrentProbeResult } from "../../../../../apps/server/src/service-integrations/qbittorrent-client";
import type { SabnzbdClientProbeResponse } from "../../../../../apps/server/src/service-integrations/sabnzbd-client";
import { ServiceIntegrationService } from "../../../../../apps/server/src/service-integrations/service-integration.service";
import type { SlskdProbeResponse } from "../../../../../apps/server/src/service-integrations/slskd-client";
import { resetAndOpenTestDatabase } from "../../../../helpers/database";

const secretEncryptionKey = "hex:000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f";

describe("ServiceIntegrationService", () => {
  afterEach(() => {
    mockState.database?.close();
    mockState.database = null;
    mockState.jackettCalls = [];
    mockState.jellyfinCalls = [];
    mockState.nzbhydra2Calls = [];
    mockState.plexCalls = [];
    mockState.prowlarrCalls = [];
    mockState.qbittorrentCalls = [];
    mockState.sabnzbdCalls = [];
    mockState.slskdCalls = [];
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

  it("dispatches API-key-only probes with decrypted API keys only", async () => {
    const database = await openDatabase();
    const service = createService(database);

    const cases = [
      {
        kind: "jackett" as const,
        displayName: "Main Jackett",
        host: "jackett.local",
        port: 9117,
        apiKey: "jackett-secret",
        calls: mockState.jackettCalls,
      },
      {
        kind: "nzbhydra2" as const,
        displayName: "Main NZBHydra2",
        host: "nzbhydra.local",
        port: 5076,
        apiKey: "nzbhydra-secret",
        calls: mockState.nzbhydra2Calls,
      },
      {
        kind: "plex" as const,
        displayName: "Main Plex",
        host: "plex.local",
        port: 32400,
        apiKey: "plex-secret",
        calls: mockState.plexCalls,
      },
      {
        kind: "jellyfin" as const,
        displayName: "Main Jellyfin",
        host: "jellyfin.local",
        port: 8096,
        apiKey: "jellyfin-secret",
        calls: mockState.jellyfinCalls,
      },
    ];

    for (const testCase of cases) {
      const saveResult = await service.upsertConfig(testCase.kind, {
        displayName: testCase.displayName,
        enabled: true,
        useSsl: false,
        host: testCase.host,
        port: testCase.port,
        authMode: "api_key",
        apiKey: testCase.apiKey,
      });

      expect(saveResult.ok).toBe(true);
      if (!saveResult.ok) {
        throw new Error(`Expected ${testCase.kind} config to save.`);
      }

      expect(saveResult.body.integration).toMatchObject({
        id: testCase.kind,
        kind: testCase.kind,
        displayName: testCase.displayName,
        hasApiKey: true,
        hasPassword: false,
      });
      expect(JSON.stringify(saveResult.body)).not.toContain(testCase.apiKey);

      const testResult = await service.testConfig(testCase.kind);

      expect(testResult.ok).toBe(true);
      if (!testResult.ok) {
        throw new Error(`Expected ${testCase.kind} probe to succeed.`);
      }

      expect(testCase.calls).toHaveLength(1);
      expect(testCase.calls[0]?.apiKey).toBe(testCase.apiKey);
      expect(testResult.body.result).toMatchObject({
        kind: testCase.kind,
        outcome: "success",
        reachable: true,
        authenticated: true,
        compatible: true,
      });
    }
  });

  it("creates named API-key-only instances without replacing defaults", async () => {
    const database = await openDatabase();
    const service = createService(database);

    for (const kind of ["jackett", "nzbhydra2", "plex", "jellyfin"] as const) {
      await service.upsertConfig(kind, {
        displayName: `Main ${kind}`,
        enabled: true,
        useSsl: false,
        host: `${kind}.local`,
        port: readDefaultPort(kind),
        authMode: "api_key",
        apiKey: `${kind}-secret`,
      });

      const additional = await service.createConfig(kind, {
        displayName: `Backup ${kind}`,
        enabled: true,
        useSsl: false,
        host: `${kind}-backup.local`,
        port: readDefaultPort(kind) + 1,
        authMode: "api_key",
        apiKey: `${kind}-backup-secret`,
      });

      expect(additional.ok).toBe(true);
      if (!additional.ok) {
        throw new Error(`Expected additional ${kind} config to save.`);
      }
    }

    const configs = service.listConfigs().integrations;

    for (const kind of ["jackett", "nzbhydra2", "plex", "jellyfin"] as const) {
      const kindConfigs = configs.filter((config) => config.kind === kind);

      expect(kindConfigs).toHaveLength(2);
      expect(kindConfigs.find((config) => config.isDefault)).toMatchObject({
        id: kind,
        displayName: `Main ${kind}`,
      });
      expect(kindConfigs.find((config) => !config.isDefault)).toMatchObject({
        displayName: `Backup ${kind}`,
      });
    }
  });

  it("persists test and status metadata for Jackett and NZBHydra2", async () => {
    const database = await openDatabase();
    const service = createService(database);

    await service.upsertConfig("jackett", {
      displayName: "Jackett",
      enabled: true,
      useSsl: false,
      host: "jackett.local",
      port: 9117,
      authMode: "api_key",
      apiKey: "jackett-secret",
    });
    await service.upsertConfig("nzbhydra2", {
      displayName: "NZBHydra2",
      enabled: true,
      useSsl: false,
      host: "nzbhydra.local",
      port: 5076,
      authMode: "api_key",
      apiKey: "nzbhydra-secret",
    });

    const jackettTest = await service.testConfig("jackett");
    const nzbhydraStatus = await service.getStatus("nzbhydra2");

    expect(jackettTest.ok).toBe(true);
    expect(nzbhydraStatus.ok).toBe(true);

    const storedRows = database.db.select().from(serviceIntegrations).all();
    const jackett = storedRows.find((entry) => entry.kind === "jackett");
    const nzbhydra2 = storedRows.find((entry) => entry.kind === "nzbhydra2");

    expect(jackett?.lastTestOutcome).toBe("success");
    expect(jackett?.lastTestMessage).toBe("Connected to Jackett. Configured indexers: 2.");
    expect(jackett?.lastTestedAt).toEqual(expect.any(String));
    expect(nzbhydra2?.lastStatusOutcome).toBe("success");
    expect(nzbhydra2?.lastStatusMessage).toBe("Connected to NZBHydra2 7.13.0.");
    expect(nzbhydra2?.lastStatusCheckedAt).toEqual(expect.any(String));
  });

  it("persists test and status metadata for Plex and Jellyfin", async () => {
    const database = await openDatabase();
    const service = createService(database);

    await service.upsertConfig("plex", {
      displayName: "Plex",
      enabled: true,
      useSsl: false,
      host: "plex.local",
      port: 32400,
      authMode: "api_key",
      apiKey: "plex-secret",
    });
    await service.upsertConfig("jellyfin", {
      displayName: "Jellyfin",
      enabled: true,
      useSsl: false,
      host: "jellyfin.local",
      port: 8096,
      authMode: "api_key",
      apiKey: "jellyfin-secret",
    });

    const plexTest = await service.testConfig("plex");
    const jellyfinStatus = await service.getStatus("jellyfin");

    expect(plexTest.ok).toBe(true);
    expect(jellyfinStatus.ok).toBe(true);

    const storedRows = database.db.select().from(serviceIntegrations).all();
    const plex = storedRows.find((entry) => entry.kind === "plex");
    const jellyfin = storedRows.find((entry) => entry.kind === "jellyfin");

    expect(plex?.lastTestOutcome).toBe("success");
    expect(plex?.lastTestMessage).toBe("Connected to Plex 1.41.6.9685.");
    expect(plex?.lastTestedAt).toEqual(expect.any(String));
    expect(jellyfin?.lastStatusOutcome).toBe("success");
    expect(jellyfin?.lastStatusMessage).toBe("Connected to Jellyfin 10.10.7.");
    expect(jellyfin?.lastStatusCheckedAt).toEqual(expect.any(String));
  });

  it("supports slskd api_key and clears secrets when auth switches to none", async () => {
    const database = await openDatabase();
    const service = createService(database);

    const saveResult = await service.upsertConfig("slskd", {
      displayName: "Main slskd",
      enabled: true,
      useSsl: false,
      host: "slskd.local",
      port: 5030,
      authMode: "api_key",
      apiKey: "slskd-secret",
    });

    expect(saveResult.ok).toBe(true);
    if (!saveResult.ok) {
      throw new Error("Expected slskd api_key config to save.");
    }

    const apiKeyProbe = await service.testConfig("slskd");

    expect(apiKeyProbe.ok).toBe(true);
    if (!apiKeyProbe.ok) {
      throw new Error("Expected slskd api_key probe to succeed.");
    }

    expect(mockState.slskdCalls[0]).toMatchObject({
      apiKey: "slskd-secret",
      authMode: "api_key",
    });

    const noneResult = await service.upsertConfig("slskd", {
      displayName: "Main slskd",
      enabled: true,
      useSsl: false,
      host: "slskd.local",
      port: 5030,
      authMode: "none",
      apiKey: "discard-me",
      username: "discard-me",
      password: "discard-me",
    });

    expect(noneResult.ok).toBe(true);
    if (!noneResult.ok) {
      throw new Error("Expected slskd none config to save.");
    }

    expect(noneResult.body.integration).toMatchObject({
      authMode: "none",
      hasApiKey: false,
      hasPassword: false,
      username: null,
    });

    const storedRow = database.db.select().from(serviceIntegrations).all();
    const stored = storedRow.find((entry) => entry.kind === "slskd");

    expect(stored?.authMode).toBe("none");
    expect(stored?.apiKeyEncrypted).toBeNull();
    expect(stored?.passwordEncrypted).toBeNull();
    expect(stored?.username).toBeNull();

    const statusResult = await service.getStatus("slskd");

    expect(statusResult.ok).toBe(true);
    if (!statusResult.ok) {
      throw new Error("Expected slskd none status to succeed.");
    }

    expect(mockState.slskdCalls.at(-1)).toMatchObject({
      apiKey: null,
      authMode: "none",
      password: null,
      username: null,
    });
  });

  it("clears stale API keys when switching qBittorrent to username/password", async () => {
    const database = await openDatabase();
    const service = createService(database);

    await service.upsertConfig("qbittorrent", {
      displayName: "Main qBittorrent",
      enabled: true,
      useSsl: false,
      host: "qbittorrent.local",
      port: 8080,
      authMode: "api_key",
      apiKey: "qbt-secret",
    });

    const switched = await service.upsertConfig("qbittorrent", {
      displayName: "Main qBittorrent",
      enabled: true,
      useSsl: false,
      host: "qbittorrent.local",
      port: 8080,
      authMode: "username_password",
      username: "admin",
      password: "qbt-password",
    });

    expect(switched.ok).toBe(true);
    if (!switched.ok) {
      throw new Error("Expected qBittorrent auth mode switch to save.");
    }

    expect(switched.body.integration).toMatchObject({
      authMode: "username_password",
      hasApiKey: false,
      hasPassword: true,
      username: "admin",
    });

    const storedRow = database.db.select().from(serviceIntegrations).all();
    const stored = storedRow.find((entry) => entry.kind === "qbittorrent");

    expect(stored?.apiKeyEncrypted).toBeNull();
    expect(stored?.passwordEncrypted).toEqual(expect.any(String));

    const testResult = await service.testConfig("qbittorrent");

    expect(testResult.ok).toBe(true);
    if (!testResult.ok) {
      throw new Error("Expected qBittorrent username/password probe to succeed.");
    }

    expect(mockState.qbittorrentCalls.at(-1)).toMatchObject({
      apiKey: null,
      authMode: "username_password",
      password: "qbt-password",
      username: "admin",
    });
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

  it("rejects username/password auth for API-key-only services before probing", async () => {
    const database = await openDatabase();
    const service = createService(database);

    for (const kind of ["jackett", "nzbhydra2", "plex", "jellyfin"] as const) {
      const result = await service.upsertConfig(kind, {
        displayName: kind,
        enabled: true,
        useSsl: false,
        host: `${kind}.local`,
        port: readDefaultPort(kind),
        authMode: "username_password",
        username: "admin",
        password: "secret",
      });

      expect(result.ok).toBe(false);
      if (result.ok) {
        throw new Error(`Expected ${kind} validation to fail.`);
      }

      expect(result.status).toBe(422);
      expect(result.body.error.fieldErrors).toContainEqual({
        field: "authMode",
        code: "configuration_incomplete",
        message: `${readServiceName(kind)} only supports API key authentication.`,
      });
    }

    expect(mockState.jackettCalls).toHaveLength(0);
    expect(mockState.jellyfinCalls).toHaveLength(0);
    expect(mockState.nzbhydra2Calls).toHaveLength(0);
    expect(mockState.plexCalls).toHaveLength(0);
  });

  it("rejects none auth for services that do not allow it", async () => {
    const database = await openDatabase();
    const service = createService(database);

    for (const kind of [
      "qbittorrent",
      "sabnzbd",
      "prowlarr",
      "jackett",
      "nzbhydra2",
      "plex",
      "jellyfin",
    ] as const) {
      const result = await service.upsertConfig(kind, {
        displayName: kind,
        enabled: true,
        useSsl: false,
        host: `${kind}.local`,
        port: readUnsupportedNonePort(kind),
        authMode: "none",
      });

      expect(result.ok).toBe(false);
      if (result.ok) {
        throw new Error(`Expected ${kind} none auth validation to fail.`);
      }

      expect(result.status).toBe(422);
      expect(result.body.error.fieldErrors?.[0]?.field).toBe("authMode");
    }

    expect(mockState.jackettCalls).toHaveLength(0);
    expect(mockState.jellyfinCalls).toHaveLength(0);
    expect(mockState.nzbhydra2Calls).toHaveLength(0);
    expect(mockState.plexCalls).toHaveLength(0);
    expect(mockState.prowlarrCalls).toHaveLength(0);
    expect(mockState.qbittorrentCalls).toHaveLength(0);
    expect(mockState.sabnzbdCalls).toHaveLength(0);
  });
});

const mockState: {
  database: DatabaseClient | null;
  jackettCalls: Array<Record<string, unknown>>;
  jellyfinCalls: Array<Record<string, unknown>>;
  nzbhydra2Calls: Array<Record<string, unknown>>;
  plexCalls: Array<Record<string, unknown>>;
  prowlarrCalls: Array<Record<string, unknown>>;
  qbittorrentCalls: Array<Record<string, unknown>>;
  sabnzbdCalls: Array<Record<string, unknown>>;
  slskdCalls: Array<Record<string, unknown>>;
} = {
  database: null,
  jackettCalls: [],
  jellyfinCalls: [],
  nzbhydra2Calls: [],
  plexCalls: [],
  prowlarrCalls: [],
  qbittorrentCalls: [],
  sabnzbdCalls: [],
  slskdCalls: [],
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
      jackett: async (config) => {
        mockState.jackettCalls.push(config as Record<string, unknown>);
        return successJackettProbe();
      },
      jellyfin: async (config) => {
        mockState.jellyfinCalls.push(config as Record<string, unknown>);
        return successJellyfinProbe();
      },
      nzbhydra2: async (config) => {
        mockState.nzbhydra2Calls.push(config as Record<string, unknown>);
        return successNzbhydra2Probe();
      },
      plex: async (config) => {
        mockState.plexCalls.push(config as Record<string, unknown>);
        return successPlexProbe();
      },
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
      slskd: async (config) => {
        mockState.slskdCalls.push(config as Record<string, unknown>);
        return successSlskdProbe();
      },
    },
  });
}

function successJellyfinProbe(): JellyfinProbeResponse {
  return {
    ok: true,
    result: {
      kind: "jellyfin",
      configured: true,
      enabled: true,
      outcome: "success",
      summary: "Connected to Jellyfin 10.10.7.",
      checkedAt: new Date().toISOString(),
      reachable: true,
      authenticated: true,
      compatible: true,
      version: "10.10.7",
      webApiVersion: null,
      connectionState: "connected",
    },
  };
}

function successJackettProbe(): JackettProbeResponse {
  return {
    ok: true,
    result: {
      kind: "jackett",
      configured: true,
      enabled: true,
      outcome: "success",
      summary: "Connected to Jackett. Configured indexers: 2.",
      checkedAt: new Date().toISOString(),
      reachable: true,
      authenticated: true,
      compatible: true,
      version: null,
      webApiVersion: null,
      connectionState: "connected",
    },
  };
}

function successNzbhydra2Probe(): Nzbhydra2ProbeResponse {
  return {
    ok: true,
    result: {
      kind: "nzbhydra2",
      configured: true,
      enabled: true,
      outcome: "success",
      summary: "Connected to NZBHydra2 7.13.0.",
      checkedAt: new Date().toISOString(),
      reachable: true,
      authenticated: true,
      compatible: true,
      version: "7.13.0",
      webApiVersion: null,
      connectionState: "connected",
    },
  };
}

function successPlexProbe(): PlexProbeResponse {
  return {
    ok: true,
    result: {
      kind: "plex",
      configured: true,
      enabled: true,
      outcome: "success",
      summary: "Connected to Plex 1.41.6.9685.",
      checkedAt: new Date().toISOString(),
      reachable: true,
      authenticated: true,
      compatible: true,
      version: "1.41.6.9685",
      webApiVersion: null,
      connectionState: "connected",
    },
  };
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

function successSlskdProbe(): SlskdProbeResponse {
  return {
    ok: true,
    result: {
      kind: "slskd",
      configured: true,
      enabled: true,
      outcome: "success",
      summary: "Connected to slskd 0.22.1. State: connected.",
      checkedAt: new Date().toISOString(),
      reachable: true,
      authenticated: true,
      compatible: true,
      version: "0.22.1",
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

function readDefaultPort(kind: "jackett" | "nzbhydra2" | "plex" | "jellyfin"): number {
  switch (kind) {
    case "jackett":
      return 9117;
    case "nzbhydra2":
      return 5076;
    case "plex":
      return 32400;
    case "jellyfin":
      return 8096;
  }
}

function readServiceName(kind: "jackett" | "nzbhydra2" | "plex" | "jellyfin"): string {
  switch (kind) {
    case "jackett":
      return "Jackett";
    case "nzbhydra2":
      return "NZBHydra2";
    case "plex":
      return "Plex";
    case "jellyfin":
      return "Jellyfin";
  }
}

function readUnsupportedNonePort(
  kind: "qbittorrent" | "sabnzbd" | "prowlarr" | "jackett" | "nzbhydra2" | "plex" | "jellyfin",
): number {
  switch (kind) {
    case "qbittorrent":
      return 8080;
    case "sabnzbd":
      return 8081;
    case "prowlarr":
      return 9696;
    case "jackett":
      return 9117;
    case "nzbhydra2":
      return 5076;
    case "plex":
      return 32400;
    case "jellyfin":
      return 8096;
  }
}
