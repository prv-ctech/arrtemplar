import { Buffer } from "node:buffer";

export const SESSION_COOKIE_NAME = "arrtemplar_session" as const;
export const SESSION_DURATION_SECONDS = 60 * 60 * 24 * 30;

export function createSessionExpiresAt(now = new Date()): Date {
  return new Date(now.getTime() + SESSION_DURATION_SECONDS * 1000);
}

export function generateSessionToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));

  return Buffer.from(bytes).toString("base64url");
}

export function hashSessionToken(token: string): string {
  const hasher = new Bun.CryptoHasher("sha256");
  hasher.update(token);

  return hasher.digest("hex");
}
