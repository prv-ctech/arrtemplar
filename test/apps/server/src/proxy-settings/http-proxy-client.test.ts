import { describe, expect, it } from "bun:test";
import { testHttpProxyConnection } from "../../../../../apps/server/src/proxy-settings/http-proxy-client";

describe("http proxy client", () => {
  it("passes Bun per-request proxy config and proxy authorization headers", async () => {
    const calls: Array<{
      input: string | URL;
      init: RequestInit & { proxy?: string | { url: string; headers?: HeadersInit } };
    }> = [];

    const result = await testHttpProxyConnection(
      {
        proxyProfileId: "proxy-http",
        scheme: "http",
        host: "proxy.local",
        port: 8080,
        username: "operator",
        password: "secret",
        timeoutMs: 2_000,
      },
      {
        canaryUrl: "https://example.com/",
        fetch: async (input, init) => {
          calls.push({ input, init });
          return new Response("ok", { status: 200 });
        },
      },
    );

    expect(result).toMatchObject({
      profileId: "proxy-http",
      kind: "http_proxy",
      outcome: "success",
      statusCode: 200,
    });
    expect(calls).toHaveLength(1);
    expect(calls[0]?.input).toBe("https://example.com/");
    expect(calls[0]?.init.proxy).toEqual({
      url: "http://proxy.local:8080",
      headers: {
        "Proxy-Authorization": "Basic b3BlcmF0b3I6c2VjcmV0",
      },
    });
  });

  it("supports HTTPS proxy targets without credentials", async () => {
    const calls: Array<RequestInit & { proxy?: string | { url: string; headers?: HeadersInit } }> =
      [];

    const result = await testHttpProxyConnection(
      {
        proxyProfileId: "proxy-https",
        scheme: "https",
        host: "secure-proxy.local",
        port: 8443,
        username: null,
        password: null,
        timeoutMs: 2_000,
      },
      {
        fetch: async (_input, init) => {
          calls.push(init);
          return new Response("ok", { status: 204 });
        },
      },
    );

    expect(result).toMatchObject({
      profileId: "proxy-https",
      kind: "http_proxy",
      outcome: "success",
      statusCode: 204,
    });
    expect(calls[0]?.proxy).toEqual({ url: "https://secure-proxy.local:8443" });
  });

  it("returns failed for invalid host input", async () => {
    const result = await testHttpProxyConnection({
      proxyProfileId: "proxy-invalid",
      scheme: "http",
      host: "http://bad-host/path",
      port: 8080,
      username: null,
      password: null,
      timeoutMs: 2_000,
    });

    expect(result).toMatchObject({
      profileId: "proxy-invalid",
      kind: "http_proxy",
      outcome: "failed",
      statusCode: null,
    });
    expect(result.message).toContain("host is invalid");
  });

  it("returns failed when the proxy request throws", async () => {
    const result = await testHttpProxyConnection(
      {
        proxyProfileId: "proxy-error",
        scheme: "http",
        host: "proxy.local",
        port: 8080,
        username: null,
        password: null,
        timeoutMs: 2_000,
      },
      {
        fetch: async () => {
          throw new TypeError("connect failure");
        },
      },
    );

    expect(result).toMatchObject({
      profileId: "proxy-error",
      kind: "http_proxy",
      outcome: "failed",
      statusCode: null,
    });
    expect(result.message).toBe("Could not connect to HTTP proxy.");
  });
});
