import { afterEach, describe, expect, it, mock } from "bun:test";
import { probeQbittorrentClient } from "../../../../../apps/server/src/download-clients/qbittorrent-client";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("probeQbittorrentClient", () => {
  it("rejects host values that contain schemes or paths", async () => {
    const fetchMock = setFetchMock(async () => new Response("unexpected"));

    const schemeProbe = await probeQbittorrentClient({
      useSsl: false,
      host: "http://qbittorrent.local",
      port: 8080,
      urlBase: null,
      authMode: "api_key",
      apiKey: "qbt_test_api_key",
    });
    const pathProbe = await probeQbittorrentClient({
      useSsl: false,
      host: "qbittorrent.local/path",
      port: 8080,
      urlBase: null,
      authMode: "api_key",
      apiKey: "qbt_test_api_key",
    });
    const syntaxProbe = await probeQbittorrentClient({
      useSsl: false,
      host: "bad host",
      port: 8080,
      urlBase: null,
      authMode: "api_key",
      apiKey: "qbt_test_api_key",
    });

    if (schemeProbe.ok || pathProbe.ok || syntaxProbe.ok) {
      throw new Error("Expected invalid-host probe failures.");
    }

    expect(schemeProbe.error).toMatchObject({
      code: "invalid_host",
      fieldErrors: [{ field: "host", code: "invalid_host" }],
    });
    expect(pathProbe.error).toMatchObject({
      code: "invalid_host",
      fieldErrors: [{ field: "host", code: "invalid_host" }],
    });
    expect(syntaxProbe.error).toMatchObject({
      code: "invalid_host",
      fieldErrors: [{ field: "host", code: "invalid_host" }],
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("probes qBittorrent with bearer auth and same-origin headers", async () => {
    const fetchMock = setFetchMock(async (input, init) => {
      const url = String(input);
      const headers = new Headers(init?.headers);

      expect(headers.get("origin")).toBe("http://127.0.0.1:8080");
      expect(headers.get("referer")).toBe("http://127.0.0.1:8080/qbt/");
      expect(headers.get("authorization")).toBe("Bearer qbt_test_api_key");

      if (url.endsWith("/qbt/api/v2/app/version")) {
        return new Response("v5.2.2");
      }

      if (url.endsWith("/qbt/api/v2/app/webapiVersion")) {
        return new Response("2.11.4");
      }

      if (url.endsWith("/qbt/api/v2/transfer/info")) {
        return Response.json({ connection_status: "connected" });
      }

      return new Response("Not found", { status: 404 });
    });

    const probe = await probeQbittorrentClient({
      useSsl: false,
      host: "127.0.0.1",
      port: 8080,
      urlBase: "/qbt",
      authMode: "api_key",
      apiKey: "qbt_test_api_key",
    });

    expect(probe.ok).toBe(true);
    expect(probe.result).toMatchObject({
      kind: "qbittorrent",
      configured: true,
      enabled: true,
      outcome: "success",
      reachable: true,
      authenticated: true,
      compatible: true,
      version: "v5.2.2",
      webApiVersion: "2.11.4",
      connectionState: "connected",
    });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("treats a Fails. login body as bad credentials even with HTTP 200", async () => {
    const fetchMock = setFetchMock(async (input, init) => {
      const headers = new Headers(init?.headers);
      const body = init?.body;

      expect(String(input)).toBe("http://127.0.0.1:8080/api/v2/auth/login");
      expect(headers.get("origin")).toBe("http://127.0.0.1:8080");
      expect(headers.get("referer")).toBe("http://127.0.0.1:8080/");
      expect(headers.has("authorization")).toBe(false);
      expect(body).toBeInstanceOf(URLSearchParams);

      if (!(body instanceof URLSearchParams)) {
        throw new Error("Expected qBittorrent login body to use form data.");
      }

      expect(body.get("username")).toBe("admin");
      expect(body.get("password")).toBe("wrong-password");

      return new Response("Fails.");
    });

    const probe = await probeQbittorrentClient({
      useSsl: false,
      host: "127.0.0.1",
      port: 8080,
      urlBase: null,
      authMode: "username_password",
      username: "admin",
      password: "wrong-password",
    });

    if (probe.ok) {
      throw new Error("Expected qBittorrent auth failure.");
    }

    expect(probe.error).toMatchObject({
      code: "auth_failed",
      fieldErrors: [{ field: "password", code: "auth_failed" }],
    });
    expect(probe.result).toMatchObject({ reachable: true, authenticated: false });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("uses an in-memory login cookie for cookie-auth probes", async () => {
    const fetchMock = setFetchMock(async (input, init) => {
      const url = String(input);
      const headers = new Headers(init?.headers);

      if (url.endsWith("/api/v2/auth/login")) {
        return new Response("Ok.", { headers: { "set-cookie": "SID=abc123; HttpOnly" } });
      }

      expect(headers.get("cookie")).toBe("SID=abc123");
      expect(headers.has("authorization")).toBe(false);

      if (url.endsWith("/api/v2/app/version")) {
        return new Response("v5.2.2");
      }

      if (url.endsWith("/api/v2/app/webapiVersion")) {
        return new Response("2.11.4");
      }

      if (url.endsWith("/api/v2/transfer/info")) {
        return Response.json({ connection_status: "firewalled" });
      }

      return new Response("Not found", { status: 404 });
    });

    const probe = await probeQbittorrentClient({
      useSsl: false,
      host: "127.0.0.1",
      port: 8080,
      urlBase: null,
      authMode: "username_password",
      username: "admin",
      password: "correct-password",
    });

    expect(probe.ok).toBe(true);
    expect(probe.result.connectionState).toBe("firewalled");
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it("accepts an empty login body when qBittorrent still sets a valid session cookie", async () => {
    const fetchMock = setFetchMock(async (input, init) => {
      const url = String(input);
      const headers = new Headers(init?.headers);

      if (url.endsWith("/api/v2/auth/login")) {
        return new Response("", { headers: { "set-cookie": "SID=emptybody; HttpOnly" } });
      }

      expect(headers.get("cookie")).toBe("SID=emptybody");

      if (url.endsWith("/api/v2/app/version")) {
        return new Response("v5.2.2");
      }

      if (url.endsWith("/api/v2/app/webapiVersion")) {
        return new Response("2.15.1");
      }

      if (url.endsWith("/api/v2/transfer/info")) {
        return Response.json({ connection_status: "connected" });
      }

      return new Response("Not found", { status: 404 });
    });

    const probe = await probeQbittorrentClient({
      useSsl: false,
      host: "127.0.0.1",
      port: 8080,
      urlBase: null,
      authMode: "username_password",
      username: "admin",
      password: "correct-password",
    });

    expect(probe.ok).toBe(true);
    expect(probe.result.connectionState).toBe("connected");
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it("maps 403 responses to credential field errors", async () => {
    setFetchMock(async () => new Response("Forbidden", { status: 403 }));

    const probe = await probeQbittorrentClient({
      useSsl: false,
      host: "127.0.0.1",
      port: 8080,
      urlBase: null,
      authMode: "api_key",
      apiKey: "qbt_rejected_key",
    });

    if (probe.ok) {
      throw new Error("Expected qBittorrent credential rejection.");
    }

    expect(probe.error).toMatchObject({
      code: "auth_failed",
      fieldErrors: [{ field: "apiKey", code: "auth_failed" }],
    });
    expect(probe.result).toMatchObject({ reachable: true, authenticated: false });
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

    const probe = await probeQbittorrentClient({
      useSsl: false,
      host: "127.0.0.1",
      port: 8080,
      urlBase: null,
      authMode: "api_key",
      apiKey: "qbt_test_api_key",
      timeoutMs: 1,
    });

    if (probe.ok) {
      throw new Error("Expected qBittorrent timeout failure.");
    }

    expect(probe.error).toMatchObject({ code: "timeout" });
  });

  it("applies timeouts while reading response bodies", async () => {
    setFetchMock(async (_input, init) => {
      expect(init?.signal).toBeInstanceOf(AbortSignal);

      return new Response(
        new ReadableStream<Uint8Array>({
          start() {},
        }),
      );
    });

    const probe = await probeQbittorrentClient({
      useSsl: false,
      host: "127.0.0.1",
      port: 8080,
      urlBase: null,
      authMode: "api_key",
      apiKey: "qbt_test_api_key",
      timeoutMs: 1,
    });

    if (probe.ok) {
      throw new Error("Expected qBittorrent body timeout failure.");
    }

    expect(probe.error).toMatchObject({ code: "timeout" });
  });

  it("maps invalid transfer JSON to invalid response errors", async () => {
    setFetchMock(async (input) => {
      const url = String(input);

      if (url.endsWith("/api/v2/app/version")) {
        return new Response("v5.2.2");
      }

      if (url.endsWith("/api/v2/app/webapiVersion")) {
        return new Response("2.11.4");
      }

      return new Response("not json", { headers: { "content-type": "application/json" } });
    });

    const probe = await probeQbittorrentClient({
      useSsl: false,
      host: "127.0.0.1",
      port: 8080,
      urlBase: null,
      authMode: "api_key",
      apiKey: "qbt_test_api_key",
    });

    if (probe.ok) {
      throw new Error("Expected qBittorrent invalid-response failure.");
    }

    expect(probe.error).toMatchObject({ code: "invalid_response" });
    expect(probe.result).toMatchObject({
      reachable: true,
      authenticated: true,
      compatible: false,
      version: "v5.2.2",
      webApiVersion: "2.11.4",
    });
  });

  it("maps network failures to connection errors", async () => {
    setFetchMock(async () => {
      throw new TypeError("fetch failed");
    });

    const probe = await probeQbittorrentClient({
      useSsl: false,
      host: "127.0.0.1",
      port: 8080,
      urlBase: null,
      authMode: "api_key",
      apiKey: "qbt_test_api_key",
    });

    if (probe.ok) {
      throw new Error("Expected qBittorrent connection failure.");
    }

    expect(probe.error).toMatchObject({ code: "connection_failed" });
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
