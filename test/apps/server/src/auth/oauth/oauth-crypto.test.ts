import { describe, expect, it } from "bun:test";
import {
  createOAuthMasterKeyId,
  createPkcePair,
  decryptOAuthClientSecret,
  decryptOAuthIdToken,
  encryptOAuthClientSecret,
  encryptOAuthIdToken,
  importOAuthSigningKey,
  OAUTH_STATE_PURPOSE,
} from "../../../../../../apps/server/src/security/oauth-crypto";

const masterKey = "hex:000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f";
const wrongMasterKey = "hex:1f1e1d1c1b1a191817161514131211100f0e0d0c0b0a09080706050403020100";
const textEncoder = new TextEncoder();

describe("OAuth crypto helpers", () => {
  it("creates a PKCE S256 verifier and matching challenge", async () => {
    const pair = await createPkcePair();
    const digest = await crypto.subtle.digest("SHA-256", textEncoder.encode(pair.codeVerifier));
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

  it("separates encryption purposes and derives an OAuth state signing key", async () => {
    const clientSecret = await encryptOAuthClientSecret("payload", masterKey);
    const idToken = await encryptOAuthIdToken("payload", masterKey);

    expect(clientSecret.encrypted).not.toBe(idToken.encrypted);
    await expect(decryptOAuthIdToken(clientSecret.encrypted, masterKey)).rejects.toThrow();
    await expect(decryptOAuthClientSecret(idToken.encrypted, masterKey)).rejects.toThrow();

    const stateKey = await importOAuthSigningKey(masterKey, OAUTH_STATE_PURPOSE, ["sign"]);
    const message = textEncoder.encode("separation");
    const stateSignature = Buffer.from(
      await crypto.subtle.sign("HMAC", stateKey, message),
    ).toString("base64url");

    expect(stateSignature.length).toBeGreaterThan(0);
  });

  it("encrypts and decrypts ID tokens with a stable master key id", async () => {
    const encrypted = await encryptOAuthIdToken("header.payload.signature", masterKey);

    expect(encrypted.encrypted).not.toContain("header.payload.signature");
    expect(encrypted.masterKeyId).toBe(createOAuthMasterKeyId(masterKey));
    expect(await decryptOAuthIdToken(encrypted.encrypted, masterKey)).toBe(
      "header.payload.signature",
    );
    await expect(decryptOAuthIdToken(encrypted.encrypted, wrongMasterKey)).rejects.toThrow();
  });

  it("still decrypts client secrets encrypted with the legacy raw master key", async () => {
    const legacyEncrypted = await encryptLegacyRawAesGcm("legacy-secret", masterKey);

    expect(await decryptOAuthClientSecret(legacyEncrypted, masterKey)).toBe("legacy-secret");
  });
});

async function encryptLegacyRawAesGcm(plaintext: string, masterKeyHex: string): Promise<string> {
  const keyBytes = Buffer.from(masterKeyHex.replace(/^hex:/u, ""), "hex");
  const key = await crypto.subtle.importKey("raw", keyBytes, "AES-GCM", false, ["encrypt"]);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    textEncoder.encode(plaintext),
  );

  return `${Buffer.from(iv).toString("base64url")}:${Buffer.from(ciphertext).toString("base64url")}`;
}
