import type { AuthProviderSlug } from "@arrtemplar/shared";
import { AUTH_PROVIDER_SLUGS } from "@arrtemplar/shared";
import {
  base64UrlEncode,
  decodeBase64Url,
  importOAuthSigningKey,
  OAUTH_STATE_PURPOSE,
  type OAuthKeyPurpose,
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
  const signature = await signStateValue(encodedPayload, signingKey, OAUTH_STATE_PURPOSE);

  return `${encodedPayload}.${signature}`;
}

export async function verifyOAuthStateCookieValue(
  value: string | undefined,
  signingKey: string,
): Promise<OAuthStatePayload | null> {
  const payload = await verifyStateCookieValue<OAuthStatePayload>(
    value,
    signingKey,
    OAUTH_STATE_PURPOSE,
    parseOAuthStatePayload,
  );

  return payload && payload.expiresAt > Math.floor(Date.now() / 1000) ? payload : null;
}

async function signStateValue(
  payload: string,
  signingKey: string,
  purpose: OAuthKeyPurpose,
): Promise<string> {
  const key = await importOAuthSigningKey(signingKey, purpose, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, textEncoder.encode(payload));

  return base64UrlEncode(signature);
}

async function verifyStateCookieValue<T>(
  value: string | undefined,
  signingKey: string,
  purpose: OAuthKeyPurpose,
  parsePayload: (encodedPayload: string) => T | null,
): Promise<T | null> {
  if (!value) {
    return null;
  }

  const [encodedPayload, encodedSignature, extra] = value.split(".");

  if (!encodedPayload || !encodedSignature || extra !== undefined) {
    return null;
  }

  const key = await importOAuthSigningKey(signingKey, purpose, ["verify"]);

  try {
    const verified = await crypto.subtle.verify(
      "HMAC",
      key,
      decodeBase64Url(encodedSignature),
      textEncoder.encode(encodedPayload),
    );

    if (!verified) {
      return null;
    }
  } catch {
    return null;
  }

  return parsePayload(encodedPayload);
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
