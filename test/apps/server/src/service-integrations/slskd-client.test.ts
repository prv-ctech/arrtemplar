import { afterEach, describe, expect, it, mock } from "bun:test";
import { configure } from "@logtape/logtape";
import {
  probeSlskdClient,
  type SlskdClientConfig,
} from "../../../../../apps/server/src/service-integrations/slskd-client";
import { APP_LOG_CATEGORY } from "../../../../../packages/shared/src";
import { createLogBuffer, resetLogTape } from "../../../../helpers/logging";

const originalFetch = globalThis.fetch;

afterEach(async () => {
  globalThis.fetch = originalFetch;
  await resetLogTape();
});

describe("probeSlskdClient", () => {
  it("probes slskd with only X-API-Key for api_key auth", async () => {
    const fetchMock = setFetchMock(async (input, init) => {
      const headers = new Headers(init?.headers);

      expect(String(input)).toBe("http://127.0.0.1:5030/api/v0/application");
      expect(headers.get("origin")).toBe("http://127.0.0.1:5030");
      expect(headers.get("referer")).toBe("http://127.0.0.1:5030/");
      expect(headers.get("accept")).toBe("application/json");
      expect(headers.get("x-api-key")).toBe("fake-slskd-api-key");
      expect(headers.has("authorization")).toBe(false);
      expect(headers.has("cookie")).toBe(false);
      expect(init?.body).toBeUndefined();

      return Response.json(createApplicationBody());
    });

    const result = await probeSlskdClient(
      createConfig({ authMode: "api_key", apiKey: "fake-slskd-api-key" }),
    );

    expect(result.ok).toBe(true);
    expect(result.result).toMatchObject({
      kind: "slskd",
      configured: true,
      enabled: true,
      outcome: "success",
      reachable: true,
      authenticated: true,
      compatible: true,
      version: "0.25.1.0",
      webApiVersion: null,
      connectionState: "Connected, LoggedIn",
    });
    expect(result.result.summary).toBe("Connected to slskd 0.25.1.0. State: Connected, LoggedIn.");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("probes slskd without credential headers for none auth", async () => {
    const fetchMock = setFetchMock(async (_input, init) => {
      const headers = new Headers(init?.headers);

      expect(headers.get("accept")).toBe("application/json");
      expect(headers.has("x-api-key")).toBe(false);
      expect(headers.has("authorization")).toBe(false);
      expect(headers.has("cookie")).toBe(false);
      expect(init?.body).toBeUndefined();

      return Response.json(
        createApplicationBody({
          version: { current: "0.25.2.0" },
          server: { state: "Connected", isConnected: true, isLoggedIn: false },
        }),
      );
    });

    const result = await probeSlskdClient(createConfig({ authMode: "none", apiKey: null }));

    expect(result.ok).toBe(true);
    expect(result.result).toMatchObject({
      outcome: "success",
      version: "0.25.2.0",
      connectionState: "Connected",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("rejects unsupported auth modes before making network calls", async () => {
    const fetchMock = setFetchMock(async () => new Response("unexpected"));

    const result = await probeSlskdClient(
      createConfig({ authMode: "username_password", apiKey: null }),
    );

    if (result.ok) {
      throw new Error("Expected unsupported slskd auth-mode failure.");
    }

    expect(result.error).toMatchObject({
      code: "configuration_incomplete",
      fieldErrors: [{ field: "authMode", code: "configuration_incomplete" }],
    });
    expect(result.result).toMatchObject({
      configured: false,
      reachable: false,
      authenticated: false,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("maps 401 responses to auth failures for api_key auth", async () => {
    setFetchMock(async () => new Response("Unauthorized", { status: 401 }));

    const result = await probeSlskdClient(
      createConfig({ authMode: "api_key", apiKey: "fake-slskd-api-key" }),
    );

    if (result.ok) {
      throw new Error("Expected slskd auth failure.");
    }

    expect(result.error).toMatchObject({
      code: "auth_failed",
      fieldErrors: [{ field: "apiKey", code: "auth_failed" }],
    });
    expect(result.result).toMatchObject({ reachable: true, authenticated: false });
  });

  it("maps HTTP 404 responses to connection_failed", async () => {
    setFetchMock(async () => new Response("Not found", { status: 404 }));

    const result = await probeSlskdClient(createConfig());

    if (result.ok) {
      throw new Error("Expected slskd HTTP error failure.");
    }

    expect(result.error).toMatchObject({ code: "connection_failed" });
    expect(result.result).toMatchObject({ reachable: false, authenticated: false });
  });

  it("maps malformed JSON to invalid_response", async () => {
    setFetchMock(
      async () =>
        new Response("not json", {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    );

    const result = await probeSlskdClient(createConfig());

    if (result.ok) {
      throw new Error("Expected slskd invalid-response failure.");
    }

    expect(result.error).toMatchObject({ code: "invalid_response" });
    expect(result.result).toMatchObject({ reachable: true, authenticated: true });
  });

  it("maps timeout aborts to timeout errors", async () => {
    setFetchMock(
      async (_input, init) =>
        await new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new DOMException("The operation was aborted.", "AbortError"));
          });
        }),
    );

    const result = await probeSlskdClient(createConfig({ timeoutMs: 1 }));

    if (result.ok) {
      throw new Error("Expected slskd timeout failure.");
    }

    expect(result.error).toMatchObject({ code: "timeout" });
    expect(result.result).toMatchObject({ reachable: false, authenticated: false });
  });

  it("maps DNS and network failures to connection_failed", async () => {
    for (const message of ["fetch failed", "getaddrinfo ENOTFOUND slskd.local"]) {
      setFetchMock(async () => {
        throw new TypeError(message);
      });

      const result = await probeSlskdClient(createConfig());

      if (result.ok) {
        throw new Error("Expected slskd network failure.");
      }

      expect(result.error).toMatchObject({ code: "connection_failed" });
      expect(result.result).toMatchObject({ reachable: false, authenticated: false });
    }
  });

  it("does not log API keys or response bodies", async () => {
    const { records, sink } = createLogBuffer();
    const apiKey = "fake-slskd-api-key";
    const applicationBody = createApplicationBody({
      user: { username: "fake-slskd-user" },
    });

    await configure({
      sinks: { buffer: sink, meta: () => undefined },
      loggers: [
        { category: ["logtape", "meta"], lowestLevel: "warning", sinks: ["meta"] },
        {
          category: [APP_LOG_CATEGORY, "service-integrations", "slskd"],
          lowestLevel: "debug",
          sinks: ["buffer"],
        },
      ],
    });

    setFetchMock(async () => Response.json(applicationBody));

    const result = await probeSlskdClient(createConfig({ apiKey }));
    const serializedLogs = JSON.stringify(records);

    expect(result.ok).toBe(true);
    expect(records.map((record) => record.level)).toEqual(["debug", "info", "info"]);
    expect(serializedLogs).not.toContain(apiKey);
    expect(serializedLogs).not.toContain("fake-slskd-user");
    expect(serializedLogs).not.toContain('"user":');
    expect(serializedLogs).not.toContain('"version":{"current":"0.25.1.0"}');
    expect(serializedLogs).toContain("Connected, LoggedIn");
  });

  it("logs real HTTP failure status codes for failed probes", async () => {
    const { recorder, sink } = createLogBuffer();

    await configure({
      sinks: { buffer: sink, meta: () => undefined },
      loggers: [
        { category: ["logtape", "meta"], lowestLevel: "warning", sinks: ["meta"] },
        {
          category: [APP_LOG_CATEGORY, "service-integrations", "slskd"],
          lowestLevel: "debug",
          sinks: ["buffer"],
        },
      ],
    });

    setFetchMock(async () => new Response("Not found", { status: 404 }));

    const result = await probeSlskdClient(createConfig());

    expect(result.ok).toBe(false);
    recorder.assertLogged({
      category: [APP_LOG_CATEGORY, "service-integrations", "slskd"],
      level: "warning",
      message: /slskd probe failed at .*application.* with .*connection_failed.*\./,
      properties: {
        serviceKind: "slskd",
        integrationId: "integration-slskd-test",
        step: "application",
        statusCode: 404,
        reason: "connection_failed",
      },
    });
  });
});

type FetchImplementation = (
  input: RequestInfo | URL,
  init?: RequestInit | BunFetchRequestInit,
) => Promise<Response>;

function createConfig(overrides: Partial<SlskdClientConfig> = {}): SlskdClientConfig {
  return {
    integrationId: "integration-slskd-test",
    useSsl: false,
    host: "127.0.0.1",
    port: 5030,
    urlBase: null,
    authMode: "api_key",
    apiKey: "fake-slskd-api-key",
    username: null,
    password: null,
    timeoutMs: 1_000,
    ...overrides,
  };
}

function createApplicationBody(
  overrides: Partial<Record<string, unknown>> = {},
): Record<string, unknown> {
  return {
    version: {
      full: "0.25.1.0 (fake-build)",
      current: "0.25.1.0",
      latest: "0.25.1.0",
      isUpdateAvailable: false,
    },
    server: {
      state: "Connected, LoggedIn",
      isConnected: true,
      isConnecting: false,
      isLoggedIn: true,
      isLoggingIn: false,
    },
    pendingReconnect: false,
    ...overrides,
  };
}

function setFetchMock(implementation: FetchImplementation) {
  const fetchMock = mock(implementation);

  Object.defineProperty(globalThis, "fetch", {
    configurable: true,
    writable: true,
    value: fetchMock,
  });

  return fetchMock;
}
