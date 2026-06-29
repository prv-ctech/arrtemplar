import { afterEach, describe, expect, it, mock } from "bun:test";
import { configure } from "@logtape/logtape";
import { probeJellyfinClient } from "../../../../../apps/server/src/service-integrations/jellyfin-client";
import {
  APP_LOG_CATEGORY,
  type ServiceIntegrationErrorCode,
} from "../../../../../packages/shared/src";
import { createLogBuffer, resetLogTape } from "../../../../helpers/logging";

const originalFetch = globalThis.fetch;
const clientSourceUrl = new URL(
  "../../../../../apps/server/src/service-integrations/jellyfin-client.ts",
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

describe("probeJellyfinClient", () => {
  it("requires an API key before making outbound requests", async () => {
    const fetchMock = setFetchMock(async () => new Response("unexpected"));

    const result = await probeJellyfinClient({
      useSsl: false,
      host: "127.0.0.1",
      port: 8096,
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

    const result = await probeJellyfinClient({
      useSsl: false,
      host: "127.0.0.1",
      port: 8096,
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

  it("probes public info without a token before authenticated system info", async () => {
    const requestedUrls: string[] = [];

    const fetchMock = setFetchMock(async (input, init) => {
      const url = new URL(String(input));
      const headers = new Headers(init?.headers);

      requestedUrls.push(url.toString());
      expect(url.pathname).not.toBe("/jellyfin/Users/Me");
      expect(headers.get("x-emby-authorization")).toBeNull();
      expect(headers.get("x-emby-token")).toBeNull();
      expect(headers.get("x-mediabrowser-token")).toBeNull();

      if (url.pathname === "/jellyfin/System/Info/Public") {
        expect(headers.get("authorization")).toBeNull();
        expect(headers.get("origin")).toBe("http://127.0.0.1:8096");
        expect(headers.get("referer")).toBe("http://127.0.0.1:8096/jellyfin/");

        return Response.json({
          ServerName: "Living Room Jellyfin",
          Version: "10.10.7",
          Id: "server-public-id",
          StartupWizardCompleted: true,
        });
      }

      if (url.pathname === "/jellyfin/System/Info") {
        expect(headers.get("authorization")).toBe(
          'MediaBrowser Client="Arrtemplar", Device="Arrtemplar", DeviceId="arrtemplar", Version="0.1.0", Token="jellyfin-secret"',
        );

        return Response.json({
          ServerName: "Living Room Jellyfin",
          Version: "10.10.7",
          Id: "server-auth-id",
          StartupWizardCompleted: true,
        });
      }

      return new Response("Not found", { status: 404 });
    });

    const result = await probeJellyfinClient({
      useSsl: false,
      host: "127.0.0.1",
      port: 8096,
      urlBase: "/jellyfin",
      authMode: "api_key",
      apiKey: "jellyfin-secret",
    });

    expect(result.ok).toBe(true);
    expect(result.result).toMatchObject({
      kind: "jellyfin",
      configured: true,
      enabled: true,
      outcome: "success",
      reachable: true,
      authenticated: true,
      compatible: true,
      version: "10.10.7",
      webApiVersion: null,
      connectionState: "connected",
    });
    expect(result.result.summary).toBe("Connected to Living Room Jellyfin 10.10.7.");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(requestedUrls.map((url) => new URL(url).pathname)).toEqual([
      "/jellyfin/System/Info/Public",
      "/jellyfin/System/Info",
    ]);
    expect(requestedUrls.join("\n")).not.toContain("jellyfin-secret");
  });

  it("reports startup-wizard incomplete as setup-required without authenticating", async () => {
    const fetchMock = setFetchMock(async () => {
      return Response.json({
        ServerName: "New Jellyfin",
        Version: "10.10.7",
        Id: "setup-server-id",
        StartupWizardCompleted: false,
      });
    });

    const result = await probeJellyfinClient({
      useSsl: false,
      host: "127.0.0.1",
      port: 8096,
      urlBase: null,
      authMode: "api_key",
      apiKey: "jellyfin-setup-secret",
    });

    if (result.ok) {
      throw new Error("Expected setup-required failure.");
    }

    expect(result.error).toMatchObject({
      code: "unsupported_version",
      fieldErrors: [{ field: "general", code: "unsupported_version" }],
    });
    expect(result.result).toMatchObject({
      kind: "jellyfin",
      outcome: "error",
      reachable: true,
      authenticated: false,
      compatible: false,
      version: "10.10.7",
      connectionState: "setup_required",
    });
    expect(result.result.summary).toBe(
      "Jellyfin setup is not complete. Complete the startup wizard first.",
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("maps invalid public and authenticated JSON responses to invalid-response errors", async () => {
    setFetchMock(async () => new Response("not-json", { status: 200 }));

    const invalidPublicResult = await probeJellyfinClient({
      useSsl: false,
      host: "127.0.0.1",
      port: 8096,
      urlBase: null,
      authMode: "api_key",
      apiKey: "jellyfin-invalid-public-secret",
    });

    if (invalidPublicResult.ok) {
      throw new Error("Expected invalid public response failure.");
    }

    expect(invalidPublicResult.error.code).toBe("invalid_response");
    expect(invalidPublicResult.result).toMatchObject({
      reachable: true,
      authenticated: false,
    });

    setFetchMock(async (input) => {
      const url = String(input);

      if (url.endsWith("/System/Info/Public")) {
        return Response.json({
          ServerName: "Jellyfin",
          Version: "10.10.7",
          Id: "server-public-id",
          StartupWizardCompleted: true,
        });
      }

      return Response.json({ Version: "" });
    });

    const invalidAuthenticatedResult = await probeJellyfinClient({
      useSsl: false,
      host: "127.0.0.1",
      port: 8096,
      urlBase: null,
      authMode: "api_key",
      apiKey: "jellyfin-invalid-auth-secret",
    });

    if (invalidAuthenticatedResult.ok) {
      throw new Error("Expected invalid authenticated response failure.");
    }

    expect(invalidAuthenticatedResult.error.code).toBe("invalid_response");
    expect(invalidAuthenticatedResult.result).toMatchObject({
      reachable: true,
      authenticated: true,
    });
  });

  it("maps expected status and request failures", async () => {
    const cases: Array<{
      name: string;
      response: (input: RequestInfo | URL) => Promise<Response>;
      code: ServiceIntegrationErrorCode;
      reachable: boolean;
      authenticated: boolean;
    }> = [
      {
        name: "401",
        response: createAuthenticatedStatusResponse(401),
        code: "auth_failed",
        reachable: true,
        authenticated: false,
      },
      {
        name: "403",
        response: createAuthenticatedStatusResponse(403),
        code: "auth_failed",
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
        response: createAuthenticatedStatusResponse(503),
        code: "service_unavailable",
        reachable: true,
        authenticated: true,
      },
      {
        name: "timeout",
        response: async () => {
          throw new DOMException("Aborted", "AbortError");
        },
        code: "timeout",
        reachable: false,
        authenticated: false,
      },
    ];

    for (const testCase of cases) {
      setFetchMock(testCase.response);

      const result = await probeJellyfinClient({
        useSsl: false,
        host: "127.0.0.1",
        port: 8096,
        urlBase: null,
        authMode: "api_key",
        apiKey: "jellyfin-failure-secret",
      });

      if (result.ok) {
        throw new Error(`Expected ${testCase.name} failure.`);
      }

      expect(result.error.code).toBe(testCase.code);
      expect(result.result).toMatchObject({
        reachable: testCase.reachable,
        authenticated: testCase.authenticated,
      });
    }
  });

  it("does not emit API keys, auth header names, token labels, URLs with secrets, or bodies in logs", async () => {
    const { records, sink } = createLogBuffer();
    const apiKey = "jellyfin-log-secret";
    const publicBody = {
      ServerName: "Log Jellyfin",
      Version: "10.10.8",
      Id: "log-public-id",
      StartupWizardCompleted: true,
    };
    const authenticatedBody = {
      ServerName: "Log Jellyfin",
      Version: "10.10.8",
      Id: "log-auth-id",
      StartupWizardCompleted: true,
    };
    const copiedSecretUrl = `http://127.0.0.1:8096/web/#/dashboard?api_key=${apiKey}`;

    await configure({
      sinks: { buffer: sink, meta: () => undefined },
      loggers: [
        { category: ["logtape", "meta"], lowestLevel: "warning", sinks: ["meta"] },
        {
          category: [APP_LOG_CATEGORY, "service-integrations", "jellyfin"],
          lowestLevel: "debug",
          sinks: ["buffer"],
        },
      ],
    });

    setFetchMock(async (input) => {
      const url = String(input);

      expect(url).not.toContain(apiKey);
      if (url.endsWith("/System/Info/Public")) {
        return Response.json(publicBody);
      }

      return Response.json(authenticatedBody);
    });

    const result = await probeJellyfinClient({
      useSsl: false,
      host: "127.0.0.1",
      port: 8096,
      urlBase: null,
      authMode: "api_key",
      apiKey,
    });

    expect(result.ok).toBe(true);

    const sourceSnapshot = await Bun.file(clientSourceUrl).text();
    const serializedLogs = JSON.stringify(records);

    expect(sourceSnapshot).not.toContain(apiKey);
    expect(serializedLogs).not.toContain(apiKey);
    expect(serializedLogs).not.toContain("Authorization");
    expect(serializedLogs).not.toContain("Token");
    expect(serializedLogs).not.toContain("X-Emby");
    expect(serializedLogs).not.toContain("X-MediaBrowser");
    expect(serializedLogs).not.toContain(copiedSecretUrl);
    expect(serializedLogs).not.toContain(JSON.stringify(publicBody));
    expect(serializedLogs).not.toContain(JSON.stringify(authenticatedBody));
    expect(serializedLogs).toContain("System/Info/Public");
    expect(serializedLogs).toContain("System/Info");
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

function createAuthenticatedStatusResponse(status: number): FetchImplementation {
  return async (input) => {
    const url = String(input);

    if (url.endsWith("/System/Info/Public")) {
      return Response.json({
        ServerName: "Jellyfin",
        Version: "10.10.7",
        Id: "server-public-id",
        StartupWizardCompleted: true,
      });
    }

    return new Response("Failure", { status });
  };
}
