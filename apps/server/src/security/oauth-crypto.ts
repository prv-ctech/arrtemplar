import { Buffer } from "node:buffer";

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();
const oauthMasterKeyBytes = 32;
const oauthAesKeyBytes = 32;
const oauthHmacKeyBytes = 64;
const oauthGcmIvBytes = 12;

const OAUTH_CLIENT_SECRET_PURPOSE = "arrtemplar/oauth-client-secret/v1" as const;
const OAUTH_ID_TOKEN_PURPOSE = "arrtemplar/oauth-id-token/v1" as const;
export const OAUTH_STATE_PURPOSE = "arrtemplar/oauth-state/v1" as const;

export type OAuthKeyPurpose =
  | typeof OAUTH_CLIENT_SECRET_PURPOSE
  | typeof OAUTH_ID_TOKEN_PURPOSE
  | typeof OAUTH_STATE_PURPOSE;

export type EncryptedOAuthClientSecret = {
  encrypted: string;
  masterKeyId: string;
};

export type EncryptedOAuthIdToken = {
  encrypted: string;
  masterKeyId: string;
};

export type OAuthPkcePair = {
  codeVerifier: string;
  codeChallenge: string;
};

export function assertOAuthClientSecretEncryptionKey(value: string): void {
  decodeOAuthMasterKey(value);
}

function decodeOAuthMasterKey(value: string): Uint8Array<ArrayBuffer> {
  const normalized = normalizeEncodedKey(value);
  const decoded =
    normalized.kind === "hex" ? decodeHex(normalized.value) : decodeBase64Url(normalized.value);

  if (decoded.byteLength !== oauthMasterKeyBytes) {
    throw new Error(
      `OAUTH_CLIENT_SECRET_ENCRYPTION_KEY must decode to 32 bytes for AES-256-GCM, received ${decoded.byteLength} bytes.`,
    );
  }

  return decoded;
}

export function createOAuthMasterKeyId(value: string): string {
  const hasher = new Bun.CryptoHasher("sha256");
  hasher.update(decodeOAuthMasterKey(value));

  return hasher.digest("hex").slice(0, 16);
}

export async function createPkcePair(): Promise<OAuthPkcePair> {
  const verifierBytes = createRandomBytes(32);
  const codeVerifier = base64UrlEncode(verifierBytes);
  const digest = await crypto.subtle.digest("SHA-256", textEncoder.encode(codeVerifier));

  return {
    codeVerifier,
    codeChallenge: base64UrlEncode(digest),
  };
}

export function createOAuthRandomValue(byteLength = 32): string {
  return base64UrlEncode(createRandomBytes(byteLength));
}

export async function encryptOAuthClientSecret(
  plaintext: string,
  masterKey: string,
): Promise<EncryptedOAuthClientSecret> {
  if (!plaintext) {
    throw new Error("OAuth client secret must not be empty.");
  }

  return encryptWithPurpose(plaintext, masterKey, OAUTH_CLIENT_SECRET_PURPOSE);
}

export async function decryptOAuthClientSecret(
  encrypted: string,
  masterKey: string,
): Promise<string> {
  try {
    const derivedKey = await deriveAesGcmKey(masterKey, OAUTH_CLIENT_SECRET_PURPOSE);
    return await decryptAesGcm(encrypted, derivedKey);
  } catch (error) {
    if (error instanceof OauthCryptoError) {
      throw error;
    }

    // Backwards compatibility: client secrets persisted before HKDF key separation were
    // encrypted directly with the raw master key. Try that legacy key once so existing
    // provider configurations remain usable, then drop the bridge once re-encrypted.
    const legacyKey = await importRawAesGcmKey(masterKey, ["decrypt"]);
    return decryptAesGcm(encrypted, legacyKey);
  }
}

export async function encryptOAuthIdToken(
  plaintext: string,
  masterKey: string,
): Promise<EncryptedOAuthIdToken> {
  if (!plaintext) {
    throw new Error("OAuth ID token must not be empty.");
  }

  return encryptWithPurpose(plaintext, masterKey, OAUTH_ID_TOKEN_PURPOSE);
}

export async function decryptOAuthIdToken(encrypted: string, masterKey: string): Promise<string> {
  const derivedKey = await deriveAesGcmKey(masterKey, OAUTH_ID_TOKEN_PURPOSE);
  return decryptAesGcm(encrypted, derivedKey);
}

export async function importOAuthSigningKey(
  masterKey: string,
  purpose: OAuthKeyPurpose,
  keyUsages: KeyUsage[],
): Promise<CryptoKey> {
  const keyBytes = await deriveKeyBytes(masterKey, purpose, oauthHmacKeyBytes);

  return crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    keyUsages,
  );
}

async function encryptWithPurpose(
  plaintext: string,
  masterKey: string,
  purpose: OAuthKeyPurpose,
): Promise<{ encrypted: string; masterKeyId: string }> {
  const derivedKey = await deriveAesGcmKey(masterKey, purpose);
  const iv = createRandomBytes(oauthGcmIvBytes);
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    derivedKey,
    textEncoder.encode(plaintext),
  );

  return {
    encrypted: `${base64UrlEncode(iv)}:${base64UrlEncode(ciphertext)}`,
    masterKeyId: createOAuthMasterKeyId(masterKey),
  };
}

async function deriveAesGcmKey(masterKey: string, purpose: OAuthKeyPurpose): Promise<CryptoKey> {
  const keyBytes = await deriveKeyBytes(masterKey, purpose, oauthAesKeyBytes);

  return crypto.subtle.importKey("raw", keyBytes, "AES-GCM", false, ["encrypt", "decrypt"]);
}

async function importRawAesGcmKey(masterKey: string, keyUsages: KeyUsage[]): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    decodeOAuthMasterKey(masterKey),
    "AES-GCM",
    false,
    keyUsages,
  );
}

async function decryptAesGcm(encrypted: string, key: CryptoKey): Promise<string> {
  const [encodedIv, encodedCiphertext, extra] = encrypted.split(":");

  if (!encodedIv || !encodedCiphertext || extra !== undefined) {
    throw new OauthCryptoError("Encrypted OAuth value has an invalid format.");
  }

  const iv = decodeBase64Url(encodedIv);

  if (iv.byteLength !== oauthGcmIvBytes) {
    throw new OauthCryptoError("Encrypted OAuth value IV has an invalid length.");
  }

  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    decodeBase64Url(encodedCiphertext),
  );

  return textDecoder.decode(plaintext);
}

async function deriveKeyBytes(
  masterKey: string,
  purpose: OAuthKeyPurpose,
  length: number,
): Promise<Uint8Array<ArrayBuffer>> {
  const baseKey = await crypto.subtle.importKey(
    "raw",
    decodeOAuthMasterKey(masterKey),
    "HKDF",
    false,
    ["deriveBits"],
  );
  const derived = await crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt: new Uint8Array(0), info: textEncoder.encode(purpose) },
    baseKey,
    length * 8,
  );

  return copyToArrayBufferView(new Uint8Array(derived));
}

export function base64UrlEncode(value: ArrayBuffer | Uint8Array): string {
  const bytes = value instanceof Uint8Array ? value : new Uint8Array(value);

  return Buffer.from(bytes).toString("base64url");
}

export function decodeBase64Url(value: string): Uint8Array<ArrayBuffer> {
  const normalized = value.trim();

  if (!normalized || /[^A-Za-z0-9_-]/u.test(normalized)) {
    throw new Error("Expected a non-empty base64url value.");
  }

  return copyToArrayBufferView(Buffer.from(normalized, "base64url"));
}

class OauthCryptoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OauthCryptoError";
  }
}

function normalizeEncodedKey(value: string): { kind: "base64url" | "hex"; value: string } {
  const trimmed = value.trim();

  if (!trimmed) {
    throw new Error("OAUTH_CLIENT_SECRET_ENCRYPTION_KEY must not be empty when configured.");
  }

  if (trimmed.startsWith("hex:")) {
    return { kind: "hex", value: trimmed.slice("hex:".length) };
  }

  if (trimmed.startsWith("base64:")) {
    return { kind: "base64url", value: normalizeBase64(trimmed.slice("base64:".length)) };
  }

  if (trimmed.startsWith("base64url:")) {
    return { kind: "base64url", value: trimmed.slice("base64url:".length) };
  }

  return /^[0-9a-f]{64}$/iu.test(trimmed)
    ? { kind: "hex", value: trimmed }
    : { kind: "base64url", value: normalizeBase64(trimmed) };
}

function normalizeBase64(value: string): string {
  return value.trim().replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}

function decodeHex(value: string): Uint8Array<ArrayBuffer> {
  if (!/^[0-9a-f]+$/iu.test(value) || value.length % 2 !== 0) {
    throw new Error("Expected a valid hex-encoded OAuth encryption key.");
  }

  return copyToArrayBufferView(Buffer.from(value, "hex"));
}

function createRandomBytes(byteLength: number): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(new ArrayBuffer(byteLength));
  crypto.getRandomValues(bytes);

  return bytes;
}

function copyToArrayBufferView(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
  const copy = new Uint8Array(new ArrayBuffer(bytes.byteLength));
  copy.set(bytes);

  return copy;
}
