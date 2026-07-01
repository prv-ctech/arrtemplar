import { afterEach, describe, expect, it } from "bun:test";
import { testChallengeSolverConnection } from "../../../../../apps/server/src/proxy-settings/challenge-solver-client";

const openServers: Array<{ stop: (closeActiveConnections?: boolean) => void }> = [];

afterEach(() => {
  while (openServers.length > 0) {
    openServers.pop()?.stop(true);
  }
});

describe("challenge solver client", () => {
  it("tests Trawl with /health", async () => {
    const server = createServer((request) => {
      if (new URL(request.url).pathname === "/health") {
        return Response.json({ ok: true });
      }

      return new Response("missing", { status: 404 });
    });
    const url = new URL(server.url);

    const result = await testChallengeSolverConnection({
      proxyProfileId: "profile-trawl",
      variant: "trawl",
      scheme: "http",
      host: url.hostname,
      port: Number(url.port),
      timeoutMs: 2_000,
    });

    expect(result).toMatchObject({
      profileId: "profile-trawl",
      kind: "challenge_solver",
      outcome: "success",
      statusCode: 200,
    });
  });

  it("falls back to root for FlareSolverr", async () => {
    const server = createServer((request) => {
      const pathname = new URL(request.url).pathname;

      if (pathname === "/health") {
        return new Response("missing", { status: 404 });
      }

      if (pathname === "/") {
        return new Response("ready", { status: 200 });
      }

      return new Response("missing", { status: 404 });
    });
    const url = new URL(server.url);

    const result = await testChallengeSolverConnection({
      proxyProfileId: "profile-flaresolverr",
      variant: "flaresolverr",
      scheme: "http",
      host: url.hostname,
      port: Number(url.port),
      timeoutMs: 2_000,
    });

    expect(result).toMatchObject({
      profileId: "profile-flaresolverr",
      kind: "challenge_solver",
      outcome: "success",
      statusCode: 200,
    });
  });

  it("falls back to /docs for Byparr", async () => {
    const server = createServer((request) => {
      const pathname = new URL(request.url).pathname;

      if (pathname === "/") {
        return new Response("missing", { status: 404 });
      }

      if (pathname === "/docs") {
        return new Response("docs", { status: 200 });
      }

      return new Response("missing", { status: 404 });
    });
    const url = new URL(server.url);

    const result = await testChallengeSolverConnection({
      proxyProfileId: "profile-byparr",
      variant: "byparr",
      scheme: "http",
      host: url.hostname,
      port: Number(url.port),
      timeoutMs: 2_000,
    });

    expect(result).toMatchObject({
      profileId: "profile-byparr",
      kind: "challenge_solver",
      outcome: "success",
      statusCode: 200,
    });
  });

  it("returns a failed result for invalid host input", async () => {
    const result = await testChallengeSolverConnection({
      proxyProfileId: "profile-invalid",
      variant: "trawl",
      scheme: "http",
      host: "http://bad-host/path",
      port: 8191,
      timeoutMs: 2_000,
    });

    expect(result).toMatchObject({
      profileId: "profile-invalid",
      kind: "challenge_solver",
      outcome: "failed",
      statusCode: null,
    });
    expect(result.message).toContain("host is invalid");
  });
});

function createServer(fetchHandler: (request: Request) => Response | Promise<Response>) {
  const server = Bun.serve({ port: 0, fetch: fetchHandler });

  openServers.push(server);

  return server;
}
