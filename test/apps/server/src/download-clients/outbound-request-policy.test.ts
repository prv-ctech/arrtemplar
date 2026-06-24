import { afterEach, describe, expect, it, mock, spyOn } from "bun:test";
import * as dns from "node:dns/promises";
import {
  buildDownloadClientBaseUrl,
  createSameOriginHeaders,
  requestDownloadClientText,
} from "../../../../../apps/server/src/download-clients/outbound-request-policy";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("download client outbound request policy", () => {
  it("builds base URLs for allowed local targets", () => {
    const result = buildDownloadClientBaseUrl({
      serviceLabel: "SABnzbd",
      useSsl: false,
      host: "192.168.1.50",
      port: 8080,
      urlBase: "/sab/",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("Expected an allowed local target.");
    }

    expect(result.baseUrl.toString()).toBe("http://192.168.1.50:8080/sab/");
    expect(createSameOriginHeaders(result.baseUrl).get("Origin")).toBe("http://192.168.1.50:8080");
  });

  it("rejects hosts with schemes, paths, or userinfo", () => {
    for (const host of ["http://sab.local", "sab.local/path", "user@sab.local"]) {
      const result = buildDownloadClientBaseUrl({
        serviceLabel: "SABnzbd",
        useSsl: false,
        host,
        port: 8080,
        urlBase: null,
      });

      expect(result.ok).toBe(false);
      if (result.ok) {
        throw new Error("Expected invalid host rejection.");
      }

      expect(result.error.code).toBe("invalid_host");
    }
  });

  it("rejects metadata and link-local IP literals", () => {
    for (const host of ["169.254.169.254", "[fe80::1]"]) {
      const result = buildDownloadClientBaseUrl({
        serviceLabel: "qBittorrent",
        useSsl: false,
        host,
        port: 8080,
        urlBase: null,
      });

      expect(result.ok).toBe(false);
      if (result.ok) {
        throw new Error("Expected disallowed target rejection.");
      }

      expect(result.error.code).toBe("disallowed_target");
    }
  });

  it("rejects hostnames that resolve to blocked metadata or link-local addresses", async () => {
    const lookupSpy = spyOn(dns, "lookup").mockImplementation((async () => [
      { address: "169.254.169.254", family: 4 },
    ]) as unknown as typeof dns.lookup);
    setFetchMock(async () => new Response("ok"));
    const baseUrl = new URL("http://resolver.test:8080/");

    await expect(
      requestDownloadClientText({
        baseUrl,
        serviceLabel: "SABnzbd",
        path: "api",
      }),
    ).rejects.toMatchObject({ code: "disallowed_target" });

    expect(lookupSpy).toHaveBeenCalled();
    lookupSpy.mockRestore();
  });

  it("rejects unsafe urlBase values", () => {
    for (const urlBase of ["relative", "/bad?query=1", "/bad#hash", "/../escape"]) {
      const result = buildDownloadClientBaseUrl({
        serviceLabel: "qBittorrent",
        useSsl: false,
        host: "qbittorrent.local",
        port: 8080,
        urlBase,
      });

      expect(result.ok).toBe(false);
      if (result.ok) {
        throw new Error("Expected invalid urlBase rejection.");
      }

      expect(result.error.code).toBe("invalid_url_base");
    }
  });

  it("blocks redirects", async () => {
    setFetchMock(async () => new Response("redirect", { status: 302 }));
    const baseUrl = new URL("http://127.0.0.1:8080/");

    await expect(
      requestDownloadClientText({
        baseUrl,
        serviceLabel: "SABnzbd",
        path: "api",
      }),
    ).rejects.toMatchObject({ code: "redirect_blocked" });
  });

  it("enforces response size caps", async () => {
    setFetchMock(async () => new Response("abcdef"));
    const baseUrl = new URL("http://127.0.0.1:8080/");

    await expect(
      requestDownloadClientText({
        baseUrl,
        serviceLabel: "SABnzbd",
        path: "api",
        maxResponseBytes: 3,
      }),
    ).rejects.toMatchObject({ code: "response_too_large" });
  });

  it("enforces request timeouts", async () => {
    setFetchMock(
      async (_input, init) =>
        await new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new DOMException("Aborted", "AbortError"));
          });
        }),
    );
    const baseUrl = new URL("http://127.0.0.1:8080/");

    await expect(
      requestDownloadClientText({
        baseUrl,
        serviceLabel: "SABnzbd",
        path: "api",
        timeoutMs: 1,
      }),
    ).rejects.toMatchObject({ code: "timeout" });
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
