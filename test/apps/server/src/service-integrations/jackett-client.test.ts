import { afterEach, describe, expect, it, mock } from "bun:test";
import { configure } from "@logtape/logtape";
import { probeJackettClient } from "../../../../../apps/server/src/service-integrations/jackett-client";
import { APP_LOG_CATEGORY } from "../../../../../packages/shared/src";
import { createLogBuffer, resetLogTape } from "../../../../helpers/logging";

const originalFetch = globalThis.fetch;

afterEach(async () => {
  globalThis.fetch = originalFetch;
  await resetLogTape();
});

describe("probeJackettClient", () => {
  it("requires an API key before making outbound requests", async () => {
    const fetchMock = setFetchMock(async () => new Response("unexpected"));

    const result = await probeJackettClient({
      useSsl: false,
      host: "127.0.0.1",
      port: 9117,
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

    const result = await probeJackettClient({
      useSsl: false,
      host: "127.0.0.1",
      port: 9117,
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

  it("requests the configured-indexers endpoint with query-param API key", async () => {
    const requestedUrls: string[] = [];

    const fetchMock = setFetchMock(async (input, init) => {
      requestedUrls.push(String(input));
      const headers = new Headers(init?.headers);

      expect(headers.get("origin")).toBe("http://127.0.0.1:9117");
      expect(headers.get("referer")).toBe("http://127.0.0.1:9117/jackett/");

      return new Response(
        '<?xml version="1.0"?><indexers><indexer id="alpha"><title>Alpha</title></indexer><indexer id="beta"><title>Beta</title></indexer></indexers>',
        { headers: { "content-type": "application/xml" } },
      );
    });

    const result = await probeJackettClient({
      useSsl: false,
      host: "127.0.0.1",
      port: 9117,
      urlBase: "/jackett",
      authMode: "api_key",
      apiKey: "jackett-request-secret",
    });

    const requestedUrl = readSingleRequestedUrl(requestedUrls);

    expect(requestedUrl.pathname).toBe("/jackett/api/v2.0/indexers/all/results/torznab/api");
    expect(requestedUrl.searchParams.get("t")).toBe("indexers");
    expect(requestedUrl.searchParams.get("configured")).toBe("true");
    expect(requestedUrl.searchParams.get("apikey")).toBe("jackett-request-secret");
    expect(result.ok).toBe(true);
    expect(result.result).toMatchObject({
      kind: "jackett",
      configured: true,
      enabled: true,
      outcome: "success",
      reachable: true,
      authenticated: true,
      compatible: true,
      version: null,
      webApiVersion: null,
      connectionState: "connected",
    });
    expect(result.result.summary).toBe("Connected to Jackett. Configured indexers: 2.");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("maps invalid XML responses to invalid-response errors", async () => {
    setFetchMock(async () => new Response("not xml", { status: 200 }));

    const result = await probeJackettClient({
      useSsl: false,
      host: "127.0.0.1",
      port: 9117,
      urlBase: null,
      authMode: "api_key",
      apiKey: "jackett-invalid-secret",
    });

    if (result.ok) {
      throw new Error("Expected invalid-response failure.");
    }

    expect(result.error.code).toBe("invalid_response");
    expect(result.result).toMatchObject({ reachable: true, authenticated: true });
  });

  it("maps expected request failures", async () => {
    const cases = [
      { status: 401, expectedCode: "auth_failed", authenticated: false },
      { status: 403, expectedCode: "auth_failed", authenticated: false },
      { status: 302, expectedCode: "redirect_blocked", authenticated: false },
      { status: 503, expectedCode: "service_unavailable", authenticated: true },
      { status: 404, expectedCode: "connection_failed", authenticated: false },
    ] as const;

    for (const failureCase of cases) {
      setFetchMock(async () => new Response("failure", { status: failureCase.status }));

      const result = await probeJackettClient({
        useSsl: false,
        host: "127.0.0.1",
        port: 9117,
        urlBase: null,
        authMode: "api_key",
        apiKey: "jackett-status-secret",
      });

      if (result.ok) {
        throw new Error(`Expected ${failureCase.expectedCode} failure.`);
      }

      expect(result.error.code).toBe(failureCase.expectedCode);
      expect(result.result.authenticated).toBe(failureCase.authenticated);
    }
  });

  it("maps timeout, oversized-response, and connection failures", async () => {
    const timeoutError = new DOMException("The operation was aborted.", "AbortError");
    const cases = [
      { error: timeoutError, expectedCode: "timeout" },
      { error: new TypeError("connect failed"), expectedCode: "connection_failed" },
    ] as const;

    for (const failureCase of cases) {
      setFetchMock(async () => {
        throw failureCase.error;
      });

      const result = await probeJackettClient({
        useSsl: false,
        host: "127.0.0.1",
        port: 9117,
        urlBase: null,
        authMode: "api_key",
        apiKey: "jackett-request-failure-secret",
      });

      if (result.ok) {
        throw new Error(`Expected ${failureCase.expectedCode} failure.`);
      }

      expect(result.error.code).toBe(failureCase.expectedCode);
    }

    setFetchMock(
      async () =>
        new Response("too large", {
          status: 200,
          headers: { "content-length": "65537" },
        }),
    );

    const oversizedResult = await probeJackettClient({
      useSsl: false,
      host: "127.0.0.1",
      port: 9117,
      urlBase: null,
      authMode: "api_key",
      apiKey: "jackett-oversized-secret",
    });

    if (oversizedResult.ok) {
      throw new Error("Expected response-too-large failure.");
    }

    expect(oversizedResult.error.code).toBe("response_too_large");
  });

  it("does not emit raw API keys, query secret names, feed URLs, or XML bodies in logs", async () => {
    const apiKey = "jackett-log-secret";
    const xmlBody =
      '<?xml version="1.0"?><indexers><indexer id="alpha"><title>Alpha</title></indexer></indexers>';
    const copiedFeedUrl =
      "http://127.0.0.1:9117/api/v2.0/indexers/all/results/torznab/api?apikey=jackett-log-secret&t=search";
    const logBuffer = createLogBuffer();

    await configure({
      sinks: { buffer: logBuffer.sink, meta: () => undefined },
      loggers: [
        { category: ["logtape", "meta"], lowestLevel: "warning", sinks: ["meta"] },
        { category: [APP_LOG_CATEGORY], lowestLevel: "debug", sinks: ["buffer"] },
      ],
    });

    setFetchMock(async () => new Response(xmlBody, { status: 200 }));

    const result = await probeJackettClient({
      useSsl: false,
      host: "127.0.0.1",
      port: 9117,
      urlBase: null,
      authMode: "api_key",
      apiKey,
    });

    expect(result.ok).toBe(true);

    const sourceSnapshot = await Bun.file(
      "apps/server/src/service-integrations/jackett-client.ts",
    ).text();
    const logSnapshot = JSON.stringify(logBuffer.records);
    const combinedSnapshot = `${sourceSnapshot}\n${logSnapshot}`;

    expect(combinedSnapshot).not.toContain(apiKey);
    expect(logSnapshot).not.toContain("apikey");
    expect(logSnapshot).not.toContain("passkey");
    expect(logSnapshot).not.toContain(copiedFeedUrl);
    expect(logSnapshot).not.toContain(xmlBody);
    expect(logSnapshot).toContain(
      "http://127.0.0.1:9117/api/v2.0/indexers/all/results/torznab/api?t=indexers&configured=true",
    );
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

function readSingleRequestedUrl(requestedUrls: string[]): URL {
  expect(requestedUrls).toHaveLength(1);

  const requestedUrl = requestedUrls.at(0);

  if (!requestedUrl) {
    throw new Error("Expected a requested URL.");
  }

  return new URL(requestedUrl);
}
