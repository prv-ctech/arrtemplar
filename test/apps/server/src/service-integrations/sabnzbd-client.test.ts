import { afterEach, describe, expect, it, mock } from "bun:test";
import {
  probeSabnzbdClient,
  type SabnzbdClientSettings,
} from "../../../../../apps/server/src/service-integrations/sabnzbd-client";

const originalFetch = globalThis.fetch;

describe("probeSabnzbdClient", () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("checks version and authenticated status with API-key auth", async () => {
    const requests = mockFetchResponses([
      jsonResponse({ version: "4.5.3" }),
      jsonResponse({ status: true }),
    ]);

    const result = await probeSabnzbdClient(
      createSettings({ apiKey: "sab-secret", urlBase: "/sabnzbd/" }),
    );

    if (!result.ok) {
      throw new Error(`Expected success, got ${result.error.message}`);
    }

    expect(result.result.outcome).toBe("success");
    expect(result.result.reachable).toBe(true);
    expect(result.result.authenticated).toBe(true);
    expect(result.result.compatible).toBe(true);
    expect(result.result.version).toBe("4.5.3");
    expect(result.result.webApiVersion).toBeNull();
    expect(result.result.connectionState).toBe("connected");
    expect(requests).toHaveLength(2);
    expect(requests[0]?.pathname).toBe("/sabnzbd/api");
    expect(requests[0]?.searchParams.get("mode")).toBe("version");
    expect(requests[0]?.searchParams.get("output")).toBe("json");
    expect(requests[0]?.searchParams.get("apikey")).toBe("sab-secret");
    expect(requests[1]?.pathname).toBe("/sabnzbd/api");
    expect(requests[1]?.searchParams.get("mode")).toBe("status");
    expect(requests[1]?.searchParams.get("output")).toBe("json");
    expect(requests[1]?.searchParams.get("apikey")).toBe("sab-secret");
  });

  it("maps bad API-key response text to a credential error", async () => {
    mockFetchResponses([jsonResponse({ version: "4.5.3" }), textResponse("API Key Incorrect")]);

    const result = await probeSabnzbdClient(createSettings({ apiKey: "bad-key" }));

    if (result.ok) {
      throw new Error("Expected SABnzbd API key failure.");
    }

    expect(result.error.code).toBe("auth_failed");
    expect(result.error.fieldErrors).toContainEqual({
      field: "apiKey",
      code: "auth_failed",
      message: "SABnzbd API key was rejected.",
    });
    expect(result.result.reachable).toBe(true);
    expect(result.result.authenticated).toBe(false);
    expect(result.result.compatible).toBe(false);
    expect(result.result.version).toBe("4.5.3");
  });

  it("maps rejected username/password auth to credential fields", async () => {
    const requests = mockFetchResponses([
      jsonResponse({ version: "4.5.3" }),
      textResponse("Unauthorized", { status: 401 }),
    ]);

    const result = await probeSabnzbdClient(
      createSettings({
        authMode: "username_password",
        apiKey: null,
        username: "admin",
        password: "bad-password",
      }),
    );

    if (result.ok) {
      throw new Error("Expected SABnzbd credential failure.");
    }

    expect(result.error.code).toBe("auth_failed");
    expect(result.error.fieldErrors).toContainEqual({
      field: "username",
      code: "auth_failed",
      message: "SABnzbd username or password was rejected.",
    });
    expect(result.error.fieldErrors).toContainEqual({
      field: "password",
      code: "auth_failed",
      message: "SABnzbd username or password was rejected.",
    });
    expect(requests[1]?.searchParams.get("ma_username")).toBe("admin");
    expect(requests[1]?.searchParams.get("ma_password")).toBe("bad-password");
    expect(requests[1]?.searchParams.has("apikey")).toBe(false);
  });

  it("rejects API-key auth when no API key is configured", async () => {
    const requests = mockFetchResponses([]);

    const result = await probeSabnzbdClient(createSettings({ apiKey: null }));

    if (result.ok) {
      throw new Error("Expected missing API key failure.");
    }

    expect(requests).toHaveLength(0);
    expect(result.error.code).toBe("auth_failed");
    expect(result.error.fieldErrors).toContainEqual({
      field: "apiKey",
      code: "auth_failed",
      message: "SABnzbd API key is required.",
    });
  });

  it("maps request timeouts to timeout errors", async () => {
    mockFetchFailure(new DOMException("Request timed out", "TimeoutError"));

    const result = await probeSabnzbdClient(createSettings({ apiKey: "sab-secret" }));

    if (result.ok) {
      throw new Error("Expected timeout failure.");
    }

    expect(result.error.code).toBe("timeout");
    expect(result.result.reachable).toBe(false);
  });

  it("maps invalid JSON responses to invalid-response errors", async () => {
    mockFetchResponses([textResponse("not json")]);

    const result = await probeSabnzbdClient(createSettings({ apiKey: "sab-secret" }));

    if (result.ok) {
      throw new Error("Expected invalid JSON failure.");
    }

    expect(result.error.code).toBe("invalid_response");
    expect(result.result.reachable).toBe(true);
  });

  it("maps network failures to connection errors", async () => {
    mockFetchFailure(new Error("ECONNREFUSED"));

    const result = await probeSabnzbdClient(createSettings({ apiKey: "sab-secret" }));

    if (result.ok) {
      throw new Error("Expected network failure.");
    }

    expect(result.error.code).toBe("connection_failed");
    expect(result.result.reachable).toBe(false);
  });
});

function createSettings(overrides: Partial<SabnzbdClientSettings> = {}): SabnzbdClientSettings {
  return {
    useSsl: false,
    host: "127.0.0.1",
    port: 8080,
    urlBase: null,
    authMode: "api_key",
    apiKey: "sab-secret",
    username: null,
    password: null,
    timeoutMs: 1_000,
    ...overrides,
  };
}

function mockFetchResponses(responses: Response[]): URL[] {
  const requests: URL[] = [];
  const fetchMock = mock(async (input: RequestInfo | URL) => {
    requests.push(new URL(String(input)));
    const response = responses.shift();

    if (!response) {
      throw new Error("Unexpected SABnzbd request.");
    }

    return response;
  });
  globalThis.fetch = fetchMock as unknown as typeof fetch;

  return requests;
}

function mockFetchFailure(error: Error | DOMException): URL[] {
  const requests: URL[] = [];
  const fetchMock = mock(async (input: RequestInfo | URL) => {
    requests.push(new URL(String(input)));
    throw error;
  });
  globalThis.fetch = fetchMock as unknown as typeof fetch;

  return requests;
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json" },
    status: 200,
  });
}

function textResponse(body: string, init: ResponseInit = {}): Response {
  return new Response(body, init);
}
