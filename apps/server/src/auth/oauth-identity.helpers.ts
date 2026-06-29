import {
  type ApiErrorResponse,
  type AuthProviderSlug,
  hasPermissionGrant,
  OAUTH_LOCAL_EMAIL_DOMAIN,
  type PublicUser,
  SYSTEM_ADMIN_PERMISSION,
  type UserPermission,
} from "@arrtemplar/shared";
import { and, eq, isNotNull, or, sql } from "drizzle-orm";
import type { DatabaseClient } from "../db/client";
import {
  authIdentities,
  type AuthIdentity as StoredAuthIdentity,
  sessions,
  type User,
  users,
} from "../db/schema";
import { readCountResult, readEffectivePermissions } from "./permissions";

export type OAuthIdentityInput = {
  provider: AuthProviderSlug;
  issuer: string;
  subject: string;
  preferredUsername?: string;
  name?: string;
  email?: string;
};

type DatabaseTransaction = Parameters<Parameters<DatabaseClient["db"]["transaction"]>[0]>[0];
type DatabaseReader = DatabaseClient["db"] | DatabaseTransaction;
type ActiveSystemAdminActorResult =
  | { ok: true; user: User }
  | { ok: false; status: 401 | 403; body: ApiErrorResponse };

const unauthenticatedError: ApiErrorResponse = {
  error: {
    code: "UNAUTHENTICATED",
    message: "Authentication is required.",
  },
};

export function findOAuthIdentity(
  tx: DatabaseReader,
  input: Pick<OAuthIdentityInput, "issuer" | "provider" | "subject">,
): StoredAuthIdentity | undefined {
  return tx
    .select()
    .from(authIdentities)
    .where(
      and(
        eq(authIdentities.provider, input.provider),
        eq(authIdentities.issuer, input.issuer),
        eq(authIdentities.subject, input.subject),
      ),
    )
    .get();
}

export function createStoredOAuthIdentity(
  input: OAuthIdentityInput,
  userId: string,
  createdAt: string,
): StoredAuthIdentity {
  return {
    id: Bun.randomUUIDv7(),
    userId,
    provider: input.provider,
    issuer: input.issuer,
    subject: input.subject,
    preferredUsername: normalizeOptionalIdentityClaim(input.preferredUsername),
    name: normalizeOptionalIdentityClaim(input.name),
    email: normalizeOptionalIdentityClaim(input.email),
    createdAt,
  };
}

export function updateOAuthIdentityDisplayMetadata(
  tx: DatabaseTransaction,
  identityId: string,
  input: OAuthIdentityInput,
): void {
  tx.update(authIdentities)
    .set({
      preferredUsername: normalizeOptionalIdentityClaim(input.preferredUsername),
      name: normalizeOptionalIdentityClaim(input.name),
      email: normalizeOptionalIdentityClaim(input.email),
    })
    .where(eq(authIdentities.id, identityId))
    .run();
}

export function readOAuthIdentityUserIds(
  tx: DatabaseTransaction,
  input: { issuer: string; provider: AuthProviderSlug; subject: string },
): string[] {
  return tx
    .select({ userId: authIdentities.userId })
    .from(authIdentities)
    .where(
      and(
        eq(authIdentities.provider, input.provider),
        eq(authIdentities.issuer, input.issuer),
        eq(authIdentities.subject, input.subject),
      ),
    )
    .all()
    .map((identity) => identity.userId);
}

export function countOAuthIdentityRows(tx: DatabaseTransaction): number {
  return readCountResult(
    tx
      .select({ count: sql<number>`count(*)`.mapWith(Number) })
      .from(authIdentities)
      .get(),
  );
}

export function countOAuthSessionRows(tx: DatabaseTransaction): number {
  return readCountResult(
    tx
      .select({ count: sql<number>`count(*)`.mapWith(Number) })
      .from(sessions)
      .where(isNotNull(sessions.oauthProvider))
      .get(),
  );
}

export function withActiveSystemAdminActor<TResult>(
  tx: DatabaseTransaction,
  actor: PublicUser,
  callback: (actorUser: User) => TResult,
): TResult | Extract<ActiveSystemAdminActorResult, { ok: false }> {
  const actorResult = readActiveSystemAdminActor(tx, actor);

  return actorResult.ok ? callback(actorResult.user) : actorResult;
}

export function createOAuthUsername(tx: DatabaseReader, input: OAuthIdentityInput): string {
  const subjectHash = createSubjectHash(input.subject);
  const baseUsername = normalizeOAuthUsername(input.preferredUsername ?? input.name) ?? "oidc";
  const baseCandidate = baseUsername.slice(0, 80);

  if (!findUserByUsername(tx, baseCandidate)) {
    return baseCandidate;
  }

  const suffix = `-${subjectHash.slice(0, 8)}`;
  const suffixedCandidate = `${baseUsername.slice(0, 80 - suffix.length)}${suffix}`;

  if (!findUserByUsername(tx, suffixedCandidate)) {
    return suffixedCandidate;
  }

  const fallbackBase = `oidc-${subjectHash.slice(0, 16)}`;

  for (let attempt = 0; attempt < 20; attempt += 1) {
    const candidate = attempt === 0 ? fallbackBase : `${fallbackBase}-${attempt}`;

    if (!findUserByUsername(tx, candidate)) {
      return candidate;
    }
  }

  throw new Error("Unable to create a unique OAuth username.");
}

export function createOAuthEmail(
  tx: DatabaseReader,
  email: string | undefined,
  publicId: string,
): string {
  const normalizedEmail = email ? normalizeEmail(email) : null;

  if (normalizedEmail && isUsableEmail(normalizedEmail) && !findUserByEmail(tx, normalizedEmail)) {
    return normalizedEmail;
  }

  return `${publicId.toLowerCase()}@${OAUTH_LOCAL_EMAIL_DOMAIN}`;
}

function normalizeOptionalIdentityClaim(value: string | undefined): string | null {
  const normalized = value?.trim();

  return normalized || null;
}

function normalizeOAuthUsername(value: string | undefined): string | null {
  const normalized = value?.trim().replace(/\s+/gu, "-");

  return normalized || null;
}

function createSubjectHash(subject: string): string {
  const hasher = new Bun.CryptoHasher("sha256");
  hasher.update(subject);

  return hasher.digest("hex");
}

function isUsableEmail(value: string): boolean {
  return value.length <= 320 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(value);
}

function findUserByUsername(tx: DatabaseReader, username: string): Pick<User, "id"> | undefined {
  return tx.select({ id: users.id }).from(users).where(eq(users.username, username)).get();
}

function findUserByEmail(tx: DatabaseReader, email: string): Pick<User, "id"> | undefined {
  return tx.select({ id: users.id }).from(users).where(eq(users.email, email)).get();
}

export function findUserByUsernameOrEmail(
  tx: DatabaseReader,
  username: string | undefined,
  email: string | undefined,
): User | undefined {
  if (username && email) {
    return tx
      .select()
      .from(users)
      .where(or(eq(users.username, username), eq(users.email, email)))
      .get();
  }

  if (username) {
    return tx.select().from(users).where(eq(users.username, username)).get();
  }

  if (email) {
    return tx.select().from(users).where(eq(users.email, email)).get();
  }

  return undefined;
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function readActiveSystemAdminActor(
  tx: DatabaseTransaction,
  actor: PublicUser,
): ActiveSystemAdminActorResult {
  const user = tx.select().from(users).where(eq(users.publicId, actor.id)).get();

  if (!user || user.disabledAt) {
    return { ok: false, status: 401, body: unauthenticatedError };
  }

  if (!hasPermissionGrant(readEffectivePermissions(tx, user), SYSTEM_ADMIN_PERMISSION)) {
    return { ok: false, status: 403, body: forbiddenError(SYSTEM_ADMIN_PERMISSION) };
  }

  return { ok: true, user };
}

function forbiddenError(permission: UserPermission): ApiErrorResponse {
  return {
    error: {
      code: "FORBIDDEN",
      message: `${permission} permission is required.`,
    },
  };
}
