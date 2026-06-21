import { afterEach, describe, expect, it } from "bun:test";
import { Buffer } from "node:buffer";
import type { OidcDiscoveryDocument } from "../../../../../../apps/server/src/auth/oauth/discovery";
import { verifyOidcIdToken } from "../../../../../../apps/server/src/auth/oauth/jwks";
import { base64UrlEncode } from "../../../../../../apps/server/src/security/oauth-crypto";

const originalFetch = globalThis.fetch;
const issuer = "https://auth.example.test/application/o/template-app/";
const clientId = "template-client";
const nonce = "nonce-value";

type TestJwk = JsonWebKey & { kid: string };

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("OIDC JWKS ID-token verification", () => {
  it("verifies a valid RS256 token and rejects tampered, none, and wrong-claim tokens", async () => {
    const keys = await createRsaFixture();
    const discovery = createDiscovery(keys.jwk);
    globalThis.fetch = Object.assign(async () => jsonResponse({ keys: [keys.jwk] }), {
      preconnect: originalFetch.preconnect,
    });

    const validToken = await signJwt(keys.privateKey, keys.jwk.kid, {
      iss: issuer,
      sub: "stable-subject",
      aud: clientId,
      exp: nowSeconds() + 300,
      iat: nowSeconds(),
      nonce,
      preferred_username: "cnonajulca",
      email: "plex-user@example.test",
      email_verified: false,
    });
    const claims = await verifyOidcIdToken({
      clientId,
      discovery,
      expectedNonce: nonce,
      idToken: validToken,
    });

    expect(claims.sub).toBe("stable-subject");
    expect(claims.preferred_username).toBe("cnonajulca");
    expect(claims.email_verified).toBe(false);

    await expect(
      verifyOidcIdToken({
        clientId,
        discovery,
        expectedNonce: nonce,
        idToken: replaceJwtSignature(validToken),
      }),
    ).rejects.toThrow("signature");

    await expect(
      verifyOidcIdToken({
        clientId,
        discovery,
        expectedNonce: nonce,
        idToken: createUnsignedJwt({
          iss: issuer,
          sub: "sub",
          aud: clientId,
          exp: nowSeconds() + 300,
          iat: nowSeconds(),
          nonce,
        }),
      }),
    ).rejects.toThrow("RS256 or ES256");

    await expect(
      verifyOidcIdToken({
        clientId,
        discovery,
        expectedNonce: nonce,
        idToken: await signJwt(keys.privateKey, keys.jwk.kid, {
          iss: "https://evil.example.test/",
          sub: "stable-subject",
          aud: clientId,
          exp: nowSeconds() + 300,
          iat: nowSeconds(),
          nonce,
        }),
      }),
    ).rejects.toThrow("issuer");

    await expect(
      verifyOidcIdToken({
        clientId,
        discovery,
        expectedNonce: "wrong-nonce",
        idToken: validToken,
      }),
    ).rejects.toThrow("nonce");
  });
});

async function createRsaFixture(): Promise<{ jwk: TestJwk; privateKey: CryptoKey }> {
  const pair = await crypto.subtle.generateKey(
    {
      name: "RSASSA-PKCS1-v1_5",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["sign", "verify"],
  );
  const jwk = await crypto.subtle.exportKey("jwk", pair.publicKey);

  return {
    privateKey: pair.privateKey,
    jwk: {
      ...jwk,
      alg: "RS256",
      kid: `kid-${crypto.randomUUID()}`,
      use: "sig",
    },
  };
}

function createDiscovery(jwk: TestJwk): OidcDiscoveryDocument {
  return {
    issuer,
    authorizationEndpoint: `${issuer}authorize/`,
    tokenEndpoint: `${issuer}token/`,
    userinfoEndpoint: `${issuer}userinfo/`,
    jwksUri: `${issuer}jwks/${jwk.kid}`,
    endSessionEndpoint: null,
    idTokenSigningAlgValuesSupported: ["RS256"],
    tokenEndpointAuthMethodsSupported: ["client_secret_basic"],
  };
}

async function signJwt(
  privateKey: CryptoKey,
  kid: string | undefined,
  claims: Record<string, unknown>,
): Promise<string> {
  const encodedHeader = encodeJson({ alg: "RS256", kid, typ: "JWT" });
  const encodedPayload = encodeJson(claims);
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    privateKey,
    new TextEncoder().encode(signingInput),
  );

  return `${signingInput}.${base64UrlEncode(signature)}`;
}

function createUnsignedJwt(claims: Record<string, unknown>): string {
  return `${encodeJson({ alg: "none", typ: "JWT" })}.${encodeJson(claims)}.${Buffer.from("none").toString("base64url")}`;
}

function replaceJwtSignature(token: string): string {
  const [header, payload] = token.split(".");

  return `${header}.${payload}.${Buffer.from("bad-signature").toString("base64url")}`;
}

function encodeJson(value: unknown): string {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

function jsonResponse(value: unknown): Response {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}
