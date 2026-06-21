import { Buffer } from "node:buffer";

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();
const oauthEncryptionKeyBytes = 32;
const oauthGcmIvBytes = 12;

type ImportedOAuthEncryptionKey = {
  cryptoKey: CryptoKey;
  masterKeyId: string;
};

export type EncryptedOAuthClientSecret = {
  encrypted: string;
  masterKeyId: string;
};

export type OAuthPkcePair = {
  codeVerifier: string;
  codeChallenge: string;
};

export function assertOAuthClientSecretEncryptionKey(value: string): void {
  decodeOAuthClientSecretEncryptionKey(value);
}

export function decodeOAuthClientSecretEncryptionKey(value: string): Uint8Array<ArrayBuffer> {
  const normalized = normalizeEncodedKey(value);
  const decoded =
    normalized.kind === "hex" ? decodeHex(normalized.value) : decodeBase64Url(normalized.value);

  if (decoded.byteLength !== oauthEncryptionKeyBytes) {
    throw new Error(
      `OAUTH_CLIENT_SECRET_ENCRYPTION_KEY must decode to 32 bytes for AES-256-GCM, received ${decoded.byteLength} bytes.`,
    );
  }

  return decoded;
}

function createOAuthMasterKeyId(value: string): string {
  const hasher = new Bun.CryptoHasher("sha256");
  hasher.update(decodeOAuthClientSecretEncryptionKey(value));

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

  const key = await importOAuthEncryptionKey(masterKey, ["encrypt"]);
  const iv = createRandomBytes(oauthGcmIvBytes);
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key.cryptoKey,
    textEncoder.encode(plaintext),
  );

  return {
    encrypted: `${base64UrlEncode(iv)}:${base64UrlEncode(ciphertext)}`,
    masterKeyId: key.masterKeyId,
  };
}

export async function decryptOAuthClientSecret(
  encrypted: string,
  masterKey: string,
): Promise<string> {
  const [encodedIv, encodedCiphertext, extra] = encrypted.split(":");

  if (!encodedIv || !encodedCiphertext || extra !== undefined) {
    throw new Error("Encrypted OAuth client secret has an invalid format.");
  }

  const iv = decodeBase64Url(encodedIv);

  if (iv.byteLength !== oauthGcmIvBytes) {
    throw new Error("Encrypted OAuth client secret IV has an invalid length.");
  }

  const key = await importOAuthEncryptionKey(masterKey, ["decrypt"]);
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key.cryptoKey,
    decodeBase64Url(encodedCiphertext),
  );

  return textDecoder.decode(plaintext);
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

async function importOAuthEncryptionKey(
  value: string,
  keyUsages: KeyUsage[],
): Promise<ImportedOAuthEncryptionKey> {
  const keyBytes = decodeOAuthClientSecretEncryptionKey(value);
  const cryptoKey = await crypto.subtle.importKey("raw", keyBytes, "AES-GCM", false, keyUsages);

  return {
    cryptoKey,
    masterKeyId: createOAuthMasterKeyId(value),
  };
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
