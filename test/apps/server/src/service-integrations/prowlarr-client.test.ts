import { afterEach, describe, expect, it, mock } from "bun:test";
import { probeProwlarrClient } from "../../../../../apps/server/src/service-integrations/prowlarr-client";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("probeProwlarrClient", () => {
  it("requires an API key before making outbound requests", async () => {
    const fetchMock = setFetchMock(async () => new Response("unexpected"));

    const result = await probeProwlarrClient({
      useSsl: false,
      host: "127.0.0.1",
      port: 9696,
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

    const result = await probeProwlarrClient({
      useSsl: false,
      host: "127.0.0.1",
      port: 9696,
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

  it("probes ping, status, and health with X-Api-Key on authenticated API routes only", async () => {
    const fetchMock = setFetchMock(async (input, init) => {
      const url = String(input);
      const headers = new Headers(init?.headers);

      if (url.endsWith("/prowlarr/ping")) {
        expect(headers.get("x-api-key")).toBeNull();
        return new Response("pong");
      }

      expect(headers.get("origin")).toBe("http://127.0.0.1:9696");
      expect(headers.get("referer")).toBe("http://127.0.0.1:9696/prowlarr/");
      expect(headers.get("x-api-key")).toBe("prowlarr-secret");

      if (url.endsWith("/prowlarr/api/v1/system/status")) {
        return Response.json({ version: "1.30.2" });
      }

      if (url.endsWith("/prowlarr/api/v1/health")) {
        return Response.json([{ type: "warning", message: "Indexer queue lagging" }]);
      }

      return new Response("Not found", { status: 404 });
    });

    const result = await probeProwlarrClient({
      useSsl: false,
      host: "127.0.0.1",
      port: 9696,
      urlBase: "/prowlarr",
      authMode: "api_key",
      apiKey: "prowlarr-secret",
    });

    expect(result.ok).toBe(true);
    expect(result.result).toMatchObject({
      kind: "prowlarr",
      configured: true,
      enabled: true,
      outcome: "success",
      reachable: true,
      authenticated: true,
      compatible: true,
      version: "1.30.2",
      webApiVersion: null,
      connectionState: "warning",
    });
    expect(result.result.summary).toContain("Connected to Prowlarr 1.30.2.");
    expect(result.result.summary).toContain("Health warning");
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("maps 401 responses to API-key auth failures", async () => {
    setFetchMock(async (input) => {
      const url = String(input);

      if (url.endsWith("/ping")) {
        return new Response("pong");
      }

      return new Response("Unauthorized", { status: 401 });
    });

    const result = await probeProwlarrClient({
      useSsl: false,
      host: "127.0.0.1",
      port: 9696,
      urlBase: null,
      authMode: "api_key",
      apiKey: "bad-key",
    });

    if (result.ok) {
      throw new Error("Expected auth failure.");
    }

    expect(result.error).toMatchObject({
      code: "auth_failed",
      fieldErrors: [{ field: "apiKey", code: "auth_failed" }],
    });
    expect(result.result).toMatchObject({ reachable: true, authenticated: false });
  });

  it("maps invalid status JSON to invalid-response errors", async () => {
    setFetchMock(async (input) => {
      const url = String(input);

      if (url.endsWith("/ping")) {
        return new Response("pong");
      }

      return new Response("not-json", {
        headers: { "content-type": "application/json" },
        status: 200,
      });
    });

    const result = await probeProwlarrClient({
      useSsl: false,
      host: "127.0.0.1",
      port: 9696,
      urlBase: null,
      authMode: "api_key",
      apiKey: "prowlarr-secret",
    });

    if (result.ok) {
      throw new Error("Expected invalid-response failure.");
    }

    expect(result.error.code).toBe("invalid_response");
    expect(result.result).toMatchObject({ reachable: true, authenticated: true });
  });
});

type FetchImplementation = (
  input: RequestInfo | URL,
  init?: RequestInit | BunFetchRequestInit,
) => Promise<Response>;

function setFetchMock(implementation: FetchImplementation) {
  const fetchMock = mock(implementation);
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}
