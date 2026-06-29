import { describe, expect, it } from "bun:test";
import {
  createOAuthMasterKeyId,
  decryptOAuthClientSecret,
  decryptServiceIntegrationSecret,
  encryptOAuthClientSecret,
  encryptServiceIntegrationSecret,
} from "../../../../../apps/server/src/security/oauth-crypto";

const masterKey = "hex:000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f";

describe("oauth crypto", () => {
  it("round-trips OAuth client secrets", async () => {
    const encrypted = await encryptOAuthClientSecret("oidc-secret", masterKey);

    expect(encrypted.masterKeyId).toBe(createOAuthMasterKeyId(masterKey));
    expect(await decryptOAuthClientSecret(encrypted.encrypted, masterKey)).toBe("oidc-secret");
  });

  it("round-trips service integration secrets with a distinct HKDF purpose", async () => {
    const encrypted = await encryptServiceIntegrationSecret("sab-secret", masterKey);
    const oauthEncrypted = await encryptOAuthClientSecret("sab-secret", masterKey);

    expect(encrypted.masterKeyId).toBe(createOAuthMasterKeyId(masterKey));
    expect(encrypted.encrypted).not.toBe(oauthEncrypted.encrypted);
    expect(await decryptServiceIntegrationSecret(encrypted.encrypted, masterKey)).toBe(
      "sab-secret",
    );
  });
});
