import { afterEach, describe, expect, it, mock } from "bun:test";
import { configure } from "@logtape/logtape";
import { probeNzbhydra2Client } from "../../../../../apps/server/src/service-integrations/nzbhydra2-client";
import {
  APP_LOG_CATEGORY,
  type ServiceIntegrationErrorCode,
} from "../../../../../packages/shared/src";
import { createLogBuffer, resetLogTape } from "../../../../helpers/logging";

const originalFetch = globalThis.fetch;
const clientSourceUrl = new URL(
  "../../../../../apps/server/src/service-integrations/nzbhydra2-client.ts",
  import.meta.url,
);

afterEach(async () => {
  Object.defineProperty(globalThis, "fetch", {
    configurable: true,
    writable: true,
    value: originalFetch,
  });
  await resetLogTape();
});

describe("probeNzbhydra2Client", () => {
  it("requires an API key before making outbound requests", async () => {
    const fetchMock = setFetchMock(async () => new Response("unexpected"));

    const result = await probeNzbhydra2Client({
      useSsl: false,
      host: "127.0.0.1",
      port: 5076,
      urlBase: null,
      authMode: "api_key",
      apiKey: null,
    });

    if (result.ok) {
      throw new Error("Expected missing API key failure.");
    }

    expect(result.error).toMatchObject({
      code: "configuration_incomplete",
      fieldErrors: [{ field: "apiKey", code: "configuration_incomplete" }],
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects username/password auth before making outbound requests", async () => {
    const fetchMock = setFetchMock(async () => new Response("unexpected"));

    const result = await probeNzbhydra2Client({
      useSsl: false,
      host: "127.0.0.1",
      port: 5076,
      urlBase: null,
      authMode: "username_password",
      username: "admin",
      password: "secret",
    });

    if (result.ok) {
      throw new Error("Expected unsupported auth-mode failure.");
    }

    expect(result.error).toMatchObject({
      code: "configuration_incomplete",
      fieldErrors: [{ field: "authMode", code: "configuration_incomplete" }],
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("calls the external torznab caps endpoint with query-param API key", async () => {
    const fetchMock = setFetchMock(async (input, init) => {
      const url = String(input);
      const headers = new Headers(init?.headers);

      expect(url).toBe("http://127.0.0.1:5076/nzbhydra/torznab/api?t=caps&apikey=nzb-hydra-secret");
      expect(url).not.toContain("internalapi");
      expect(url).not.toContain("internalApiKey");
      expect(headers.get("origin")).toBe("http://127.0.0.1:5076");
      expect(headers.get("referer")).toBe("http://127.0.0.1:5076/nzbhydra/");
      expect(headers.get("accept")).toBe("application/xml, application/json;q=0.9");

      return new Response('<caps><server title="NZBHydra2" version="7.13.0" /></caps>', {
        headers: { "content-type": "application/xml" },
      });
    });

    const result = await probeNzbhydra2Client({
      useSsl: false,
      host: "127.0.0.1",
      port: 5076,
      urlBase: "/nzbhydra",
      authMode: "api_key",
      apiKey: "nzb-hydra-secret",
    });

    expect(result.ok).toBe(true);
    expect(result.result).toMatchObject({
      kind: "nzbhydra2",
      configured: true,
      enabled: true,
      outcome: "success",
      reachable: true,
      authenticated: true,
      compatible: true,
      version: "7.13.0",
      webApiVersion: null,
      connectionState: "connected",
    });
    expect(result.result.summary).toBe("Connected to NZBHydra2 7.13.0.");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("normalizes minimal JSON caps responses", async () => {
    setFetchMock(async () => {
      return Response.json({
        caps: {},
        server: { title: "NZBHydra2", version: "7.14.1" },
      });
    });

    const result = await probeNzbhydra2Client({
      useSsl: false,
      host: "127.0.0.1",
      port: 5076,
      urlBase: null,
      authMode: "api_key",
      apiKey: "json-secret",
    });

    expect(result.ok).toBe(true);
    expect(result.result).toMatchObject({
      kind: "nzbhydra2",
      outcome: "success",
      reachable: true,
      authenticated: true,
      compatible: true,
      version: "7.14.1",
      connectionState: "connected",
    });
    expect(result.result.summary).toBe("Connected to NZBHydra2 7.14.1.");
  });

  it("maps expected probe failures", async () => {
    const cases: Array<{
      name: string;
      response: () => Promise<Response>;
      code: ServiceIntegrationErrorCode;
      field?: "apiKey" | "general";
      reachable: boolean;
      authenticated: boolean;
    }> = [
      {
        name: "401",
        response: async () => new Response("Unauthorized", { status: 401 }),
        code: "auth_failed",
        field: "apiKey",
        reachable: true,
        authenticated: false,
      },
      {
        name: "403",
        response: async () => new Response("Forbidden", { status: 403 }),
        code: "auth_failed",
        field: "apiKey",
        reachable: true,
        authenticated: false,
      },
      {
        name: "redirect",
        response: async () =>
          new Response("Moved", { status: 302, headers: { location: "/login" } }),
        code: "redirect_blocked",
        reachable: true,
        authenticated: false,
      },
      {
        name: "server error",
        response: async () => new Response("Bad gateway", { status: 502 }),
        code: "service_unavailable",
        field: "general",
        reachable: true,
        authenticated: true,
      },
      {
        name: "oversized response",
        response: async () => {
          return new Response("too large", { headers: { "content-length": "65537" } });
        },
        code: "response_too_large",
        reachable: true,
        authenticated: true,
      },
      {
        name: "invalid caps",
        response: async () => new Response("<not-caps></not-caps>"),
        code: "invalid_response",
        field: "general",
        reachable: true,
        authenticated: true,
      },
      {
        name: "aborted request",
        response: async () => {
          throw new DOMException("Aborted", "AbortError");
        },
        code: "timeout",
        reachable: false,
        authenticated: false,
      },
      {
        name: "network failure",
        response: async () => {
          throw new TypeError("fetch failed");
        },
        code: "connection_failed",
        reachable: false,
        authenticated: false,
      },
    ];

    for (const testCase of cases) {
      setFetchMock(testCase.response);

      const result = await probeNzbhydra2Client({
        useSsl: false,
        host: "127.0.0.1",
        port: 5076,
        urlBase: null,
        authMode: "api_key",
        apiKey: "failure-secret",
      });

      if (result.ok) {
        throw new Error(`Expected ${testCase.name} failure.`);
      }

      expect(result.error.code).toBe(testCase.code);
      expect(result.result).toMatchObject({
        reachable: testCase.reachable,
        authenticated: testCase.authenticated,
      });

      if (testCase.field) {
        expect(result.error.fieldErrors).toEqual([
          { field: testCase.field, code: testCase.code, message: result.error.message },
        ]);
      }
    }
  });

  it("maps XML and JSON API-key error bodies to auth failures without logging secrets", async () => {
    const { records, sink } = createLogBuffer();
    const apiKey = "nzb-hydra-body-error-secret";
    const responses = [
      {
        body: '<error code="100" description="Invalid API key" />',
        headers: { "content-type": "application/xml" },
      },
      {
        body: JSON.stringify({ error: { code: 100, description: "Invalid API key" } }),
        headers: { "content-type": "application/json" },
      },
    ];

    await configure({
      sinks: { buffer: sink, meta: () => undefined },
      loggers: [
        { category: ["logtape", "meta"], sinks: ["meta"] },
        {
          category: [APP_LOG_CATEGORY, "service-integrations", "nzbhydra2"],
          lowestLevel: "debug",
          sinks: ["buffer"],
        },
      ],
    });

    for (const response of responses) {
      setFetchMock(async () => new Response(response.body, { headers: response.headers }));

      const result = await probeNzbhydra2Client({
        useSsl: false,
        host: "127.0.0.1",
        port: 5076,
        urlBase: null,
        authMode: "api_key",
        apiKey,
      });

      if (result.ok) {
        throw new Error("Expected NZBHydra2 auth failure.");
      }

      expect(result.error).toMatchObject({
        code: "auth_failed",
        fieldErrors: [{ field: "apiKey", code: "auth_failed" }],
      });
      expect(result.result).toMatchObject({ reachable: true, authenticated: false });
    }

    const serializedLogs = JSON.stringify(records);

    expect(serializedLogs).not.toContain(apiKey);
    expect(serializedLogs).not.toContain("apikey");
    for (const response of responses) {
      expect(serializedLogs).not.toContain(response.body);
    }
  });

  it("logs only redacted probe URLs and never raw caps bodies", async () => {
    const { records, sink } = createLogBuffer();

    await configure({
      sinks: { buffer: sink, meta: () => undefined },
      loggers: [
        { category: ["logtape", "meta"], sinks: ["meta"] },
        {
          category: [APP_LOG_CATEGORY, "service-integrations", "nzbhydra2"],
          lowestLevel: "debug",
          sinks: ["buffer"],
        },
      ],
    });

    setFetchMock(async () => {
      return new Response('<caps><server title="NZBHydra2" version="7.15.0" /></caps>');
    });

    const result = await probeNzbhydra2Client({
      useSsl: false,
      host: "127.0.0.1",
      port: 5076,
      urlBase: null,
      authMode: "api_key",
      apiKey: "nzb-hydra-log-secret",
    });
    const serializedLogs = JSON.stringify(records);

    expect(result.ok).toBe(true);
    expect(records.map((record) => record.level)).toEqual(["debug", "info"]);
    expect(serializedLogs).toContain("torznab/api?t=caps");
    expect(serializedLogs).not.toContain("nzb-hydra-log-secret");
    expect(serializedLogs).not.toContain("apikey");
    expect(serializedLogs).not.toContain("internalApiKey");
    expect(serializedLogs).not.toContain("<caps>");
    expect(serializedLogs).not.toContain('7.15.0" /></caps>');
  });

  it("keeps internal API references out of the adapter source", async () => {
    const source = await Bun.file(clientSourceUrl).text();

    expect(source).not.toContain("internalapi");
    expect(source).not.toContain("internalApiKey");
    expect(source).not.toContain("nzb-hydra-log-secret");
  });
});

type FetchImplementation = (
  input: RequestInfo | URL,
  init?: RequestInit | BunFetchRequestInit,
) => Promise<Response>;

function setFetchMock(implementation: FetchImplementation) {
  const fetchMock = mock(implementation);

  Object.defineProperty(globalThis, "fetch", {
    configurable: true,
    writable: true,
    value: fetchMock,
  });

  return fetchMock;
}
