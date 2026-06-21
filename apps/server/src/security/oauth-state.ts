import type { AuthProviderSlug } from "@arrtemplar/shared";
import { AUTH_PROVIDER_SLUGS } from "@arrtemplar/shared";
import {
  base64UrlEncode,
  decodeBase64Url,
  decodeOAuthClientSecretEncryptionKey,
} from "./oauth-crypto";

export const OAUTH_STATE_COOKIE_NAME = "arrtemplar_oauth_state" as const;
export const OAUTH_STATE_COOKIE_MAX_AGE_SECONDS = 10 * 60;

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

export type OAuthStateMode = "login" | "link";

export type OAuthStatePayload = {
  provider: AuthProviderSlug;
  state: string;
  nonce: string;
  codeVerifier: string;
  mode: OAuthStateMode;
  linkToUserId?: string;
  returnTo: string;
  redirectUri: string;
  expiresAt: number;
};

export async function createOAuthStateCookieValue(
  payload: Omit<OAuthStatePayload, "expiresAt">,
  signingKey: string,
): Promise<string> {
  const payloadJson = JSON.stringify({
    ...payload,
    expiresAt: Math.floor(Date.now() / 1000) + OAUTH_STATE_COOKIE_MAX_AGE_SECONDS,
  } satisfies OAuthStatePayload);
  const encodedPayload = base64UrlEncode(textEncoder.encode(payloadJson));
  const signature = await signOAuthState(encodedPayload, signingKey);

  return `${encodedPayload}.${signature}`;
}

export async function verifyOAuthStateCookieValue(
  value: string | undefined,
  signingKey: string,
): Promise<OAuthStatePayload | null> {
  if (!value) {
    return null;
  }

  const [encodedPayload, encodedSignature, extra] = value.split(".");

  if (!encodedPayload || !encodedSignature || extra !== undefined) {
    return null;
  }

  const verified = await verifyOAuthStateSignature(encodedPayload, encodedSignature, signingKey);

  if (!verified) {
    return null;
  }

  const payload = parseOAuthStatePayload(encodedPayload);

  if (!payload || payload.expiresAt <= Math.floor(Date.now() / 1000)) {
    return null;
  }

  return payload;
}

async function signOAuthState(payload: string, signingKey: string): Promise<string> {
  const key = await importOAuthStateSigningKey(signingKey, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, textEncoder.encode(payload));

  return base64UrlEncode(signature);
}

async function verifyOAuthStateSignature(
  payload: string,
  signature: string,
  signingKey: string,
): Promise<boolean> {
  const key = await importOAuthStateSigningKey(signingKey, ["verify"]);

  try {
    return await crypto.subtle.verify(
      "HMAC",
      key,
      decodeBase64Url(signature),
      textEncoder.encode(payload),
    );
  } catch {
    return false;
  }
}

async function importOAuthStateSigningKey(
  value: string,
  keyUsages: KeyUsage[],
): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    decodeOAuthClientSecretEncryptionKey(value),
    { name: "HMAC", hash: "SHA-256" },
    false,
    keyUsages,
  );
}

function parseOAuthStatePayload(encodedPayload: string): OAuthStatePayload | null {
  try {
    const payload = JSON.parse(textDecoder.decode(decodeBase64Url(encodedPayload)));

    return isOAuthStatePayload(payload) ? payload : null;
  } catch {
    return null;
  }
}

function isOAuthStatePayload(value: unknown): value is OAuthStatePayload {
  if (!value || typeof value !== "object") {
    return false;
  }

  const payload = value as Partial<Record<keyof OAuthStatePayload, unknown>>;
  const mode = payload.mode;
  const provider = payload.provider;

  return (
    typeof provider === "string" &&
    AUTH_PROVIDER_SLUGS.some((slug) => slug === provider) &&
    typeof payload.state === "string" &&
    payload.state.length > 0 &&
    typeof payload.nonce === "string" &&
    payload.nonce.length > 0 &&
    typeof payload.codeVerifier === "string" &&
    payload.codeVerifier.length > 0 &&
    (mode === "login" || mode === "link") &&
    (payload.linkToUserId === undefined || typeof payload.linkToUserId === "string") &&
    typeof payload.returnTo === "string" &&
    payload.returnTo.length > 0 &&
    typeof payload.redirectUri === "string" &&
    payload.redirectUri.length > 0 &&
    typeof payload.expiresAt === "number" &&
    Number.isInteger(payload.expiresAt)
  );
}
