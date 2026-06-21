import { describe, expect, it } from "bun:test";
import {
  createPkcePair,
  decryptOAuthClientSecret,
  encryptOAuthClientSecret,
} from "../../../../../../apps/server/src/security/oauth-crypto";

const masterKey = "hex:000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f";
const wrongMasterKey = "hex:1f1e1d1c1b1a191817161514131211100f0e0d0c0b0a09080706050403020100";

describe("OAuth crypto helpers", () => {
  it("creates a PKCE S256 verifier and matching challenge", async () => {
    const pair = await createPkcePair();
    const digest = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(pair.codeVerifier),
    );
    const expectedChallenge = Buffer.from(digest).toString("base64url");

    expect(pair.codeVerifier).toHaveLength(43);
    expect(pair.codeChallenge).toBe(expectedChallenge);
  });

  it("encrypts client secrets with a fresh IV and decrypts only with the right key", async () => {
    const first = await encryptOAuthClientSecret("super-secret", masterKey);
    const second = await encryptOAuthClientSecret("super-secret", masterKey);

    expect(first.encrypted).not.toBe(second.encrypted);
    expect(first.encrypted).not.toContain("super-secret");
    expect(await decryptOAuthClientSecret(first.encrypted, masterKey)).toBe("super-secret");
    await expect(decryptOAuthClientSecret(first.encrypted, wrongMasterKey)).rejects.toThrow();
  });
});
