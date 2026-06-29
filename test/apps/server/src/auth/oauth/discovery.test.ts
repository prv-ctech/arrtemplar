import { afterEach, describe, expect, it } from "bun:test";
import { fetchOidcDiscovery } from "../../../../../../apps/server/src/auth/oauth/discovery";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("OIDC discovery", () => {
  it("preserves advertised back-channel logout support", async () => {
    const issuer = "https://auth.example.test/application/o/backchannel-supported/";
    mockDiscoveryFetch({
      issuer,
      backchannel_logout_supported: true,
      backchannel_logout_session_supported: true,
    });

    const discovery = await fetchOidcDiscovery(issuer);

    expect(discovery.backchannelLogoutSupported).toBe(true);
    expect(discovery.backchannelLogoutSessionSupported).toBe(true);
  });

  it("defaults absent back-channel logout flags to false", async () => {
    const issuer = "https://auth.example.test/application/o/backchannel-absent/";
    mockDiscoveryFetch({ issuer });

    const discovery = await fetchOidcDiscovery(issuer);

    expect(discovery.backchannelLogoutSupported).toBe(false);
    expect(discovery.backchannelLogoutSessionSupported).toBe(false);
  });

  it("preserves explicit false back-channel logout flags", async () => {
    const issuer = "https://auth.example.test/application/o/backchannel-disabled/";
    mockDiscoveryFetch({
      issuer,
      backchannel_logout_supported: false,
      backchannel_logout_session_supported: false,
    });

    const discovery = await fetchOidcDiscovery(issuer);

    expect(discovery.backchannelLogoutSupported).toBe(false);
    expect(discovery.backchannelLogoutSessionSupported).toBe(false);
  });

  it("accepts valid HTTPS endpoints on provider origins that differ from the issuer", async () => {
    const issuer = "https://accounts.example.test/";

    mockDiscoveryFetch({
      issuer,
      authorization_endpoint: "https://oauth.example-cdn.test/authorize",
      token_endpoint: "https://oauth.example-cdn.test/token",
      userinfo_endpoint: "https://profile.example-cdn.test/userinfo",
      jwks_uri: "https://keys.example-cdn.test/jwks",
      end_session_endpoint: "https://logout.example-cdn.test/end-session",
    });

    const discovery = await fetchOidcDiscovery(issuer);

    expect(discovery.authorizationEndpoint).toBe("https://oauth.example-cdn.test/authorize");
    expect(discovery.tokenEndpoint).toBe("https://oauth.example-cdn.test/token");
    expect(discovery.userinfoEndpoint).toBe("https://profile.example-cdn.test/userinfo");
    expect(discovery.jwksUri).toBe("https://keys.example-cdn.test/jwks");
    expect(discovery.endSessionEndpoint).toBe("https://logout.example-cdn.test/end-session");
  });
});

function mockDiscoveryFetch(
  input: { issuer: string } & Partial<{
    authorization_endpoint: string;
    backchannel_logout_session_supported: boolean;
    backchannel_logout_supported: boolean;
    end_session_endpoint: string;
    jwks_uri: string;
    token_endpoint: string;
    userinfo_endpoint: string;
  }>,
): void {
  globalThis.fetch = Object.assign(
    async () =>
      Response.json({
        issuer: input.issuer,
        authorization_endpoint: input.authorization_endpoint ?? `${input.issuer}authorize/`,
        token_endpoint: input.token_endpoint ?? `${input.issuer}token/`,
        userinfo_endpoint: input.userinfo_endpoint ?? `${input.issuer}userinfo/`,
        jwks_uri: input.jwks_uri ?? `${input.issuer}jwks/`,
        ...(input.end_session_endpoint === undefined
          ? {}
          : { end_session_endpoint: input.end_session_endpoint }),
        id_token_signing_alg_values_supported: ["RS256"],
        ...(input.backchannel_logout_supported === undefined
          ? {}
          : { backchannel_logout_supported: input.backchannel_logout_supported }),
        ...(input.backchannel_logout_session_supported === undefined
          ? {}
          : { backchannel_logout_session_supported: input.backchannel_logout_session_supported }),
      }),
    { preconnect: originalFetch.preconnect },
  );
}
