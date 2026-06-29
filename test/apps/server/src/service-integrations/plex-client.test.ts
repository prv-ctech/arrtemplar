import { afterEach, describe, expect, it, mock } from "bun:test";
import { configure } from "@logtape/logtape";
import { probePlexClient } from "../../../../../apps/server/src/service-integrations/plex-client";
import {
  APP_LOG_CATEGORY,
  type ServiceIntegrationErrorCode,
} from "../../../../../packages/shared/src";
import { createLogBuffer, resetLogTape } from "../../../../helpers/logging";

const originalFetch = globalThis.fetch;
const clientSourceUrl = new URL(
  "../../../../../apps/server/src/service-integrations/plex-client.ts",
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

describe("probePlexClient", () => {
  it("requires an API key before making outbound requests", async () => {
    const fetchMock = setFetchMock(async () => new Response("unexpected"));

    const result = await probePlexClient({
      useSsl: false,
      host: "127.0.0.1",
      port: 32400,
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

    const result = await probePlexClient({
      useSsl: false,
      host: "127.0.0.1",
      port: 32400,
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

  it("probes identity without token and root with required Plex headers", async () => {
    const requestedUrls: string[] = [];
    const fetchMock = setFetchMock(async (input, init) => {
      const url = new URL(String(input));
      requestedUrls.push(url.toString());
      const headers = new Headers(init?.headers);

      expect(url.hostname).toBe("127.0.0.1");
      expect(url.href).not.toContain("plex.tv");
      expect(url.pathname).not.toContain("oauth");
      expect(url.pathname).not.toContain("resources");
      expect(url.pathname).not.toContain("library/sections");
      expect(url.pathname).not.toContain("status/sessions");
      expect(url.search).not.toContain("plex-success-token");
      expect(url.searchParams.get("X-Plex-Token")).toBeNull();

      if (url.pathname === "/plex/identity") {
        expect(headers.get("x-plex-token")).toBeNull();
        return Response.json({
          MediaContainer: {
            machineIdentifier: "machine-alpha",
            version: "1.41.6.9685",
          },
        });
      }

      if (url.pathname === "/plex/") {
        expect(headers.get("x-plex-token")).toBe("plex-success-token");
        expect(headers.get("x-plex-client-identifier")).toBe("arrtemplar");
        expect(headers.get("x-plex-product")).toBe("Arrtemplar");
        expect(headers.get("x-plex-version")).toBeTruthy();
        expect(headers.get("accept")).toBe("application/json");
        return Response.json({
          MediaContainer: {
            friendlyName: "Home Plex",
            machineIdentifier: "machine-alpha",
            version: "1.41.6.9685",
          },
        });
      }

      return new Response("Not found", { status: 404 });
    });

    const result = await probePlexClient({
      useSsl: false,
      host: "127.0.0.1",
      port: 32400,
      urlBase: "/plex",
      authMode: "api_key",
      apiKey: "plex-success-token",
    });

    expect(result.ok).toBe(true);
    expect(result.result).toMatchObject({
      kind: "plex",
      configured: true,
      enabled: true,
      outcome: "success",
      reachable: true,
      authenticated: true,
      compatible: true,
      version: "1.41.6.9685",
      webApiVersion: null,
      connectionState: "connected",
    });
    expect(result.result.summary).toBe("Connected to Home Plex 1.41.6.9685.");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(requestedUrls).toEqual([
      "http://127.0.0.1:32400/plex/identity",
      "http://127.0.0.1:32400/plex/",
    ]);
  });

  it("normalizes XML identity and root responses", async () => {
    setFetchMock(async (input) => {
      const url = new URL(String(input));

      if (url.pathname === "/identity") {
        return new Response(
          '<MediaContainer machineIdentifier="xml-machine" version="1.40.5.8897" />',
          { headers: { "content-type": "application/xml" } },
        );
      }

      return new Response(
        '<MediaContainer friendlyName="XML Plex" machineIdentifier="xml-machine" version="1.40.5.8897"></MediaContainer>',
        { headers: { "content-type": "application/xml" } },
      );
    });

    const result = await probePlexClient({
      useSsl: false,
      host: "127.0.0.1",
      port: 32400,
      urlBase: null,
      authMode: "api_key",
      apiKey: "plex-xml-token",
    });

    expect(result.ok).toBe(true);
    expect(result.result).toMatchObject({
      kind: "plex",
      outcome: "success",
      reachable: true,
      authenticated: true,
      compatible: true,
      version: "1.40.5.8897",
      connectionState: "connected",
    });
    expect(result.result.summary).toBe("Connected to XML Plex 1.40.5.8897.");
  });

  it("maps expected probe failures", async () => {
    const cases: Array<{
      name: string;
      response: (path: string) => Promise<Response>;
      code: ServiceIntegrationErrorCode;
      field?: "apiKey" | "general";
      reachable: boolean;
      authenticated: boolean;
    }> = [
      {
        name: "401",
        response: async (path) =>
          path === "/identity"
            ? Response.json({ MediaContainer: { machineIdentifier: "machine", version: "1.0.0" } })
            : new Response("Unauthorized", { status: 401 }),
        code: "auth_failed",
        field: "apiKey",
        reachable: true,
        authenticated: false,
      },
      {
        name: "403",
        response: async (path) =>
          path === "/identity"
            ? Response.json({ MediaContainer: { machineIdentifier: "machine", version: "1.0.0" } })
            : new Response("Forbidden", { status: 403 }),
        code: "auth_failed",
        field: "apiKey",
        reachable: true,
        authenticated: false,
      },
      {
        name: "redirect",
        response: async () => new Response("Moved", { status: 302, headers: { location: "/web" } }),
        code: "redirect_blocked",
        reachable: true,
        authenticated: false,
      },
      {
        name: "server error",
        response: async (path) =>
          path === "/identity"
            ? Response.json({ MediaContainer: { machineIdentifier: "machine", version: "1.0.0" } })
            : new Response("Bad gateway", { status: 502 }),
        code: "service_unavailable",
        field: "general",
        reachable: true,
        authenticated: true,
      },
      {
        name: "invalid identity",
        response: async (path) =>
          path === "/identity"
            ? Response.json({ MediaContainer: { version: "1.0.0" } })
            : Response.json({ MediaContainer: { machineIdentifier: "machine", version: "1.0.0" } }),
        code: "invalid_response",
        field: "general",
        reachable: true,
        authenticated: true,
      },
      {
        name: "invalid root",
        response: async (path) =>
          path === "/identity"
            ? Response.json({ MediaContainer: { machineIdentifier: "machine", version: "1.0.0" } })
            : new Response("not-json", { headers: { "content-type": "application/json" } }),
        code: "invalid_response",
        field: "general",
        reachable: true,
        authenticated: true,
      },
      {
        name: "oversized identity",
        response: async () => new Response("too large", { headers: { "content-length": "65537" } }),
        code: "response_too_large",
        reachable: false,
        authenticated: false,
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
      setFetchMock(async (input) => await testCase.response(new URL(String(input)).pathname));

      const result = await probePlexClient({
        useSsl: false,
        host: "127.0.0.1",
        port: 32400,
        urlBase: null,
        authMode: "api_key",
        apiKey: "plex-failure-token",
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

  it("keeps Plex tokens, auth header names, query auth, web URLs, and raw bodies out of logs", async () => {
    const { records, sink } = createLogBuffer();
    const token = "plex-log-token";
    const identityBody = '<MediaContainer machineIdentifier="log-machine" version="1.41.6.9685" />';
    const rootBody =
      '<MediaContainer friendlyName="Log Plex" machineIdentifier="log-machine" version="1.41.6.9685"></MediaContainer>';
    const copiedWebUrl = "http://127.0.0.1:32400/web/index.html#!/server/plex-log-token";
    const requestedUrls: string[] = [];

    await configure({
      sinks: { buffer: sink, meta: () => undefined },
      loggers: [
        { category: ["logtape", "meta"], lowestLevel: "warning", sinks: ["meta"] },
        {
          category: [APP_LOG_CATEGORY, "service-integrations", "plex"],
          lowestLevel: "debug",
          sinks: ["buffer"],
        },
      ],
    });

    setFetchMock(async (input) => {
      const url = new URL(String(input));
      requestedUrls.push(url.toString());

      if (url.pathname === "/identity") {
        return new Response(identityBody, { headers: { "content-type": "application/xml" } });
      }

      return new Response(rootBody, { headers: { "content-type": "application/xml" } });
    });

    const result = await probePlexClient({
      useSsl: false,
      host: "127.0.0.1",
      port: 32400,
      urlBase: null,
      authMode: "api_key",
      apiKey: token,
    });

    expect(result.ok).toBe(true);

    const source = await Bun.file(clientSourceUrl).text();
    const serializedLogs = JSON.stringify(records);
    const serializedUrls = JSON.stringify(requestedUrls);
    const combinedSnapshot = `${source}\n${serializedLogs}\n${serializedUrls}`;

    expect(requestedUrls).toEqual(["http://127.0.0.1:32400/identity", "http://127.0.0.1:32400/"]);
    expect(combinedSnapshot).not.toContain(token);
    expect(serializedLogs).not.toContain("X-Plex-Token");
    expect(serializedLogs).not.toContain("x-plex-token");
    expect(serializedLogs).not.toContain("Authorization");
    expect(serializedLogs).not.toContain("X-Plex-Token=");
    expect(serializedLogs).not.toContain(copiedWebUrl);
    expect(serializedLogs).not.toContain(identityBody);
    expect(serializedLogs).not.toContain(rootBody);
    expect(serializedUrls).not.toContain(token);
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
