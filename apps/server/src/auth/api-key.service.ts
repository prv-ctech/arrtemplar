import {
  API_KEY_PREFIX,
  type ApiErrorResponse,
  type ApiKeyMeResponse,
  type ApiKeyMutationResponse,
  type ApiKeyReveal,
  type ApiKeyStatus,
  type ApiKeySummary,
  type CreateApiKeyRequest,
  hasPermissionGrant,
  isApiKeyEligiblePermission,
  isUserPermission,
  normalizePermissionList,
  type PublicUser,
  type UpdateApiKeyRequest,
  USER_PERMISSION_VALUES,
  type UserPermission,
} from "@arrtemplar/shared";
import { eq, inArray } from "drizzle-orm";
import type { DatabaseClient } from "../db/client";
import {
  type ApiKey,
  apiKeyPermissionGrants,
  apiKeys,
  auditLogs,
  type User,
  userPermissionGrants,
  users,
} from "../db/schema";
import type { AuthRequestContext } from "./auth.service";
import { LoginRateLimiter } from "./rate-limit";
import { generateSessionToken, hashSessionToken } from "./session-token";

type DatabaseTransaction = Parameters<Parameters<DatabaseClient["db"]["transaction"]>[0]>[0];
type DatabaseReader = DatabaseClient["db"] | DatabaseTransaction;
type ApiKeyWithPermissions = { apiKey: ApiKey; permissions: UserPermission[] };

type ApiKeyFailure = {
  ok: false;
  status: 401 | 403 | 404 | 422 | 429;
  body: ApiErrorResponse;
};

type ApiKeySummarySuccess = {
  ok: true;
  apiKey: ApiKeySummary;
};

type ApiKeyListResult =
  | {
      ok: true;
      apiKeys: ApiKeySummary[];
    }
  | ApiKeyFailure;

type ApiKeyRevealResult =
  | {
      ok: true;
      body: ApiKeyReveal;
    }
  | ApiKeyFailure;

type ApiKeyMutationResult =
  | {
      ok: true;
      body: ApiKeyMutationResponse;
    }
  | ApiKeyFailure;

export type ApiKeyPrincipal = {
  kind: "apiKey";
  apiKey: ApiKeySummary;
  permissions: UserPermission[];
};

export type ApiKeyPrincipalResult =
  | {
      ok: true;
      principal: ApiKeyPrincipal;
    }
  | ApiKeyFailure;

const apiKeyUnauthenticatedError: ApiErrorResponse = {
  error: {
    code: "INVALID_API_KEY",
    message: "API key authentication failed.",
  },
};

const apiKeyRateLimitedError: ApiErrorResponse = {
  error: {
    code: "RATE_LIMITED",
    message: "Too many failed API key attempts. Try again later.",
  },
};

const apiKeyNotFoundError: ApiErrorResponse = {
  error: {
    code: "API_KEY_NOT_FOUND",
    message: "API key was not found.",
  },
};

const invalidApiKeyInputError: ApiErrorResponse = {
  error: {
    code: "INVALID_API_KEY_INPUT",
    message: "API key input is invalid.",
  },
};

const forbiddenApiKeyManagementError: ApiErrorResponse = {
  error: {
    code: "FORBIDDEN",
    message: "settings:general permission is required.",
  },
};

export class ApiKeyService {
  constructor(
    private readonly database: DatabaseClient,
    private readonly invalidAttemptLimiter = new LoginRateLimiter(),
  ) {}

  listApiKeys(actor: PublicUser): ApiKeyListResult {
    const actorResult = this.readManagementActor(actor);

    if (!actorResult.ok) {
      return actorResult;
    }

    const rows = this.database.db.select().from(apiKeys).all();
    const grants = readPermissionGrantsByApiKeyId(
      this.database.db,
      rows.map((row) => row.id),
    );

    return {
      ok: true,
      apiKeys: rows
        .map((row) => this.toApiKeySummary(row, grants.get(row.id) ?? []))
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt)),
    };
  }

  getApiKey(apiKeyId: string, actor: PublicUser): ApiKeySummarySuccess | ApiKeyFailure {
    const actorResult = this.readManagementActor(actor);

    if (!actorResult.ok) {
      return actorResult;
    }

    const apiKey = this.readApiKey(apiKeyId);

    if (!apiKey) {
      return { ok: false, status: 404, body: apiKeyNotFoundError };
    }

    return {
      ok: true,
      apiKey: this.toApiKeySummary(apiKey, readApiKeyPermissions(this.database.db, apiKey.id)),
    };
  }

  createApiKey(
    input: CreateApiKeyRequest,
    actor: PublicUser,
    context: AuthRequestContext,
  ): ApiKeyRevealResult {
    const actorResult = this.readManagementActor(actor);

    if (!actorResult.ok) {
      return actorResult;
    }

    const normalizedInput = normalizeCreateApiKeyInput(input);

    if (!normalizedInput) {
      return { ok: false, status: 422, body: invalidApiKeyInputError };
    }

    const secret = generateApiKeySecret();
    const now = new Date().toISOString();
    const created = this.database.db.transaction((tx) => {
      const apiKey = createApiKeyRow({
        actorUserId: actorResult.actor.id,
        input: normalizedInput,
        now,
        secret,
      });

      tx.insert(apiKeys).values(apiKey).run();
      insertApiKeyPermissionGrants(tx, {
        apiKeyId: apiKey.id,
        grantedByUserId: actorResult.actor.id,
        now,
        permissions: normalizedInput.permissions,
      });
      writeApiKeyAuditLog(tx, {
        action: "api_keys.created",
        actorUserId: actorResult.actor.id,
        context,
        createdAt: now,
        metadata: {
          permissionCount: normalizedInput.permissions.length,
          prefix: apiKey.prefix,
        },
        targetId: apiKey.id,
      });

      return apiKey;
    });

    return {
      ok: true,
      body: {
        apiKey: this.toApiKeySummary(created, normalizedInput.permissions),
        secret,
      },
    };
  }

  updateApiKey(
    apiKeyId: string,
    input: UpdateApiKeyRequest,
    actor: PublicUser,
    context: AuthRequestContext,
  ): ApiKeyMutationResult {
    const actorResult = this.readManagementActor(actor);

    if (!actorResult.ok) {
      return actorResult;
    }
    const normalizedInput = normalizeApiKeyInput(input, { requirePermissions: false });

    if (!normalizedInput) {
      return { ok: false, status: 422, body: invalidApiKeyInputError };
    }

    const result = this.mutateExistingApiKey(apiKeyId, (tx, _existing, now) => {
      tx.update(apiKeys)
        .set({
          ...(normalizedInput.name ? { name: normalizedInput.name } : {}),
          ...(normalizedInput.hasDescription ? { description: normalizedInput.description } : {}),
          ...(normalizedInput.hasExpiresAt ? { expiresAt: normalizedInput.expiresAt } : {}),
          ...(normalizedInput.hasIpAllowlist
            ? { ipAllowlistJson: JSON.stringify(normalizedInput.ipAllowlist) }
            : {}),
          updatedAt: now,
        })
        .where(eq(apiKeys.id, apiKeyId))
        .run();

      if (normalizedInput.permissions) {
        tx.delete(apiKeyPermissionGrants)
          .where(eq(apiKeyPermissionGrants.apiKeyId, apiKeyId))
          .run();
        insertApiKeyPermissionGrants(tx, {
          apiKeyId,
          grantedByUserId: actorResult.actor.id,
          now,
          permissions: normalizedInput.permissions,
        });
      }

      const updated = readApiKeyWithPermissions(tx, apiKeyId);

      if (!updated) {
        return null;
      }

      writeApiKeyAuditLog(tx, {
        action: "api_keys.updated",
        actorUserId: actorResult.actor.id,
        context,
        createdAt: now,
        metadata: {
          permissionCount: updated.permissions.length,
          prefix: updated.apiKey.prefix,
        },
        targetId: updated.apiKey.id,
      });

      return updated;
    });

    return this.toApiKeyMutationResult(result);
  }

  revokeApiKey(
    apiKeyId: string,
    actor: PublicUser,
    context: AuthRequestContext,
  ): ApiKeyMutationResult {
    return this.markApiKeyRevoked(apiKeyId, actor, context, "api_keys.revoked");
  }

  deleteApiKey(
    apiKeyId: string,
    actor: PublicUser,
    context: AuthRequestContext,
  ): ApiKeyMutationResult {
    const actorResult = this.readManagementActor(actor);

    if (!actorResult.ok) {
      return actorResult;
    }

    const result = this.database.db.transaction((tx) => {
      const existing = readApiKeyWithPermissions(tx, apiKeyId);

      if (!existing) {
        return null;
      }

      const now = new Date().toISOString();
      const deletedSummary = this.toApiKeySummary(
        { ...existing.apiKey, revokedAt: existing.apiKey.revokedAt ?? now, updatedAt: now },
        existing.permissions,
      );

      tx.delete(apiKeyPermissionGrants).where(eq(apiKeyPermissionGrants.apiKeyId, apiKeyId)).run();
      tx.delete(apiKeys).where(eq(apiKeys.id, apiKeyId)).run();
      writeApiKeyAuditLog(tx, {
        action: "api_keys.deleted",
        actorUserId: actorResult.actor.id,
        context,
        createdAt: now,
        metadata: {
          permissionCount: existing.permissions.length,
          prefix: existing.apiKey.prefix,
        },
        targetId: existing.apiKey.id,
      });

      return deletedSummary;
    });

    if (!result) {
      return { ok: false, status: 404, body: apiKeyNotFoundError };
    }

    return {
      ok: true,
      body: { status: "ok", apiKey: result },
    };
  }

  refreshApiKey(
    apiKeyId: string,
    actor: PublicUser,
    context: AuthRequestContext,
  ): ApiKeyRevealResult {
    return this.replaceApiKey(apiKeyId, actor, context, "api_keys.refreshed");
  }

  rotateApiKey(
    apiKeyId: string,
    actor: PublicUser,
    context: AuthRequestContext,
  ): ApiKeyRevealResult {
    return this.replaceApiKey(apiKeyId, actor, context, "api_keys.rotated");
  }

  resolveBearerApiKey(secret: string | null, context: AuthRequestContext): ApiKeyPrincipalResult {
    if (!secret) {
      return { ok: false, status: 401, body: apiKeyUnauthenticatedError };
    }

    const rateLimitKey = createInvalidAttemptKey(context);

    if (this.invalidAttemptLimiter.isBlocked(rateLimitKey)) {
      this.writeDeniedApiKeyAuditLog({
        action: "api_keys.auth.rate_limited",
        context,
        prefix: readSecretDisplayPrefix(secret),
      });

      return { ok: false, status: 429, body: apiKeyRateLimitedError };
    }

    const secretHash = hashSessionToken(secret);
    const apiKey = this.database.db
      .select()
      .from(apiKeys)
      .where(eq(apiKeys.secretHash, secretHash))
      .get();

    if (!apiKey) {
      this.invalidAttemptLimiter.recordFailure(rateLimitKey);
      this.writeDeniedApiKeyAuditLog({
        action: "api_keys.auth.invalid",
        context,
        prefix: readSecretDisplayPrefix(secret),
      });

      return { ok: false, status: 401, body: apiKeyUnauthenticatedError };
    }

    const permissions = readApiKeyPermissions(this.database.db, apiKey.id);
    const status = getApiKeyStatus(apiKey);

    if (status !== "active") {
      this.invalidAttemptLimiter.recordFailure(rateLimitKey);
      this.writeDeniedApiKeyAuditLog({
        action: `api_keys.auth.${status}`,
        context,
        prefix: apiKey.prefix,
        targetId: apiKey.id,
      });

      return { ok: false, status: 401, body: apiKeyUnauthenticatedError };
    }

    if (!isIpAllowed(context.ipAddress, readIpAllowlist(apiKey.ipAllowlistJson))) {
      this.invalidAttemptLimiter.recordFailure(rateLimitKey);
      this.writeDeniedApiKeyAuditLog({
        action: "api_keys.auth.ip_denied",
        context,
        prefix: apiKey.prefix,
        targetId: apiKey.id,
      });

      return { ok: false, status: 401, body: apiKeyUnauthenticatedError };
    }

    const now = new Date().toISOString();
    this.database.db
      .update(apiKeys)
      .set({
        lastUsedAt: now,
        lastUsedIpAddress: context.ipAddress,
        lastUsedUserAgent: context.userAgent,
        updatedAt: apiKey.updatedAt,
      })
      .where(eq(apiKeys.id, apiKey.id))
      .run();
    this.invalidAttemptLimiter.clear(rateLimitKey);

    const summary = this.toApiKeySummary(
      {
        ...apiKey,
        lastUsedAt: now,
        lastUsedIpAddress: context.ipAddress,
        lastUsedUserAgent: context.userAgent,
      },
      permissions,
    );

    return {
      ok: true,
      principal: { kind: "apiKey", apiKey: summary, permissions },
    };
  }

  toMeResponse(principal: ApiKeyPrincipal): ApiKeyMeResponse {
    return {
      apiKey: {
        id: principal.apiKey.id,
        name: principal.apiKey.name,
        prefix: principal.apiKey.prefix,
        maskedKey: principal.apiKey.maskedKey,
        status: principal.apiKey.status,
        permissions: principal.permissions,
        expiresAt: principal.apiKey.expiresAt,
        lastUsedAt: principal.apiKey.lastUsedAt,
      },
    };
  }

  private markApiKeyRevoked(
    apiKeyId: string,
    actor: PublicUser,
    context: AuthRequestContext,
    action: string,
  ): ApiKeyMutationResult {
    const actorResult = this.readManagementActor(actor);

    if (!actorResult.ok) {
      return actorResult;
    }

    const result = this.mutateExistingApiKey(apiKeyId, (tx, existing, now) => {
      revokeApiKeyRow(tx, existing, now);

      const updated = readApiKeyWithPermissions(tx, apiKeyId);

      if (!updated) {
        return null;
      }

      writeApiKeyAuditLog(tx, {
        action,
        actorUserId: actorResult.actor.id,
        context,
        createdAt: now,
        metadata: { prefix: updated.apiKey.prefix, permissionCount: updated.permissions.length },
        targetId: updated.apiKey.id,
      });

      return updated;
    });

    return this.toApiKeyMutationResult(result);
  }

  private replaceApiKey(
    apiKeyId: string,
    actor: PublicUser,
    context: AuthRequestContext,
    action: string,
  ): ApiKeyRevealResult {
    const actorResult = this.readManagementActor(actor);

    if (!actorResult.ok) {
      return actorResult;
    }

    const secret = generateApiKeySecret();
    const result = this.mutateExistingApiKey(apiKeyId, (tx, existing, now) => {
      const permissions = readApiKeyPermissions(tx, apiKeyId);

      if (permissions.length === 0) {
        return null;
      }

      revokeApiKeyRow(tx, existing, now);

      const nextApiKey = createApiKeyRow({
        actorUserId: actorResult.actor.id,
        input: {
          name: existing.name,
          description: existing.description,
          hasDescription: true,
          expiresAt: existing.expiresAt,
          hasExpiresAt: true,
          ipAllowlist: readIpAllowlist(existing.ipAllowlistJson),
          hasIpAllowlist: true,
          permissions,
        },
        now,
        secret,
      });

      tx.insert(apiKeys).values(nextApiKey).run();
      insertApiKeyPermissionGrants(tx, {
        apiKeyId: nextApiKey.id,
        grantedByUserId: actorResult.actor.id,
        now,
        permissions,
      });
      writeApiKeyAuditLog(tx, {
        action,
        actorUserId: actorResult.actor.id,
        context,
        createdAt: now,
        metadata: {
          oldApiKeyId: existing.id,
          oldPrefix: existing.prefix,
          permissionCount: permissions.length,
          prefix: nextApiKey.prefix,
        },
        targetId: nextApiKey.id,
      });

      return { apiKey: nextApiKey, permissions };
    });

    if (!result) {
      return { ok: false, status: 404, body: apiKeyNotFoundError };
    }

    return {
      ok: true,
      body: { apiKey: this.toApiKeySummary(result.apiKey, result.permissions), secret },
    };
  }

  private mutateExistingApiKey<TResult>(
    apiKeyId: string,
    callback: (tx: DatabaseTransaction, existing: ApiKey, now: string) => TResult | null,
  ): TResult | null {
    return this.database.db.transaction((tx) => {
      const existing = readApiKeyById(tx, apiKeyId);

      return existing ? callback(tx, existing, new Date().toISOString()) : null;
    });
  }

  private toApiKeyMutationResult(result: ApiKeyWithPermissions | null): ApiKeyMutationResult {
    if (!result) {
      return { ok: false, status: 404, body: apiKeyNotFoundError };
    }

    return {
      ok: true,
      body: { status: "ok", apiKey: this.toApiKeySummary(result.apiKey, result.permissions) },
    };
  }

  private readManagementActor(actor: PublicUser):
    | {
        ok: true;
        actor: User;
      }
    | ApiKeyFailure {
    const actorUser = this.database.db
      .select()
      .from(users)
      .where(eq(users.publicId, actor.id))
      .get();

    if (!actorUser || actorUser.disabledAt) {
      return { ok: false, status: 401, body: apiKeyUnauthenticatedError };
    }

    const permissions = readEffectivePermissions(this.database.db, actorUser);

    if (!hasPermissionGrant(permissions, "settings:general")) {
      return { ok: false, status: 403, body: forbiddenApiKeyManagementError };
    }

    return { ok: true, actor: actorUser };
  }

  private readApiKey(apiKeyId: string): ApiKey | undefined {
    return this.database.db.select().from(apiKeys).where(eq(apiKeys.id, apiKeyId)).get();
  }

  private toApiKeySummary(apiKey: ApiKey, permissions: UserPermission[]): ApiKeySummary {
    const createdBy = apiKey.createdByUserId
      ? this.database.db
          .select({ id: users.publicId, username: users.username })
          .from(users)
          .where(eq(users.id, apiKey.createdByUserId))
          .get()
      : null;

    return {
      id: apiKey.id,
      name: apiKey.name,
      description: apiKey.description,
      prefix: apiKey.prefix,
      maskedKey: apiKey.maskedKey,
      status: getApiKeyStatus(apiKey),
      permissions,
      permissionCount: permissions.length,
      expiresAt: apiKey.expiresAt,
      ipAllowlist: readIpAllowlist(apiKey.ipAllowlistJson),
      lastUsedAt: apiKey.lastUsedAt,
      lastUsedIpAddress: apiKey.lastUsedIpAddress,
      lastUsedUserAgent: apiKey.lastUsedUserAgent,
      createdBy: createdBy ?? null,
      createdAt: apiKey.createdAt,
      updatedAt: apiKey.updatedAt,
      revokedAt: apiKey.revokedAt,
    };
  }

  private writeDeniedApiKeyAuditLog(input: {
    action: string;
    context: AuthRequestContext;
    prefix: string;
    targetId?: string;
  }): void {
    this.database.db
      .insert(auditLogs)
      .values({
        id: Bun.randomUUIDv7(),
        actorUserId: null,
        action: input.action,
        targetType: "api_key",
        targetId: input.targetId ?? null,
        metadataJson: JSON.stringify({ prefix: input.prefix }),
        ipAddress: input.context.ipAddress,
        createdAt: new Date().toISOString(),
      })
      .run();
  }
}

type NormalizedApiKeyInput = {
  name?: string;
  description: string | null;
  hasDescription: boolean;
  expiresAt: string | null;
  hasExpiresAt: boolean;
  ipAllowlist: string[];
  hasIpAllowlist: boolean;
  permissions?: UserPermission[];
};

type NormalizedCreateApiKeyInput = NormalizedApiKeyInput & {
  name: string;
  permissions: UserPermission[];
};

function normalizeCreateApiKeyInput(
  input: CreateApiKeyRequest,
): NormalizedCreateApiKeyInput | null {
  const normalizedInput = normalizeApiKeyInput(input, { requirePermissions: true });

  if (!normalizedInput?.name || !normalizedInput.permissions) {
    return null;
  }

  return {
    ...normalizedInput,
    name: normalizedInput.name,
    permissions: normalizedInput.permissions,
  };
}

function normalizeApiKeyInput(
  input: CreateApiKeyRequest | UpdateApiKeyRequest,
  options: { requirePermissions: boolean },
): NormalizedApiKeyInput | null {
  const fields = normalizeApiKeyMetadataInput(input);
  const permissions = normalizeApiKeyPermissionInput(input.permissions);

  if (!fields || !isApiKeyPermissionInputAllowed(input, permissions, options.requirePermissions)) {
    return null;
  }

  return {
    ...fields,
    ...(permissions ? { permissions } : {}),
  };
}

function normalizeApiKeyMetadataInput(
  input: CreateApiKeyRequest | UpdateApiKeyRequest,
): Omit<NormalizedApiKeyInput, "permissions"> | null {
  const name = typeof input.name === "string" ? input.name.trim() : undefined;
  const description = normalizeNullableText(input.description, 500);
  const expiresAt = normalizeExpiresAt(input.expiresAt);
  const ipAllowlist = normalizeIpAllowlist(input.ipAllowlist);

  if (input.name !== undefined && (!name || name.length > 80)) {
    return null;
  }

  if (expiresAt === undefined || ipAllowlist === null) {
    return null;
  }

  return {
    ...(name ? { name } : {}),
    description: description ?? null,
    hasDescription: "description" in input,
    expiresAt,
    hasExpiresAt: "expiresAt" in input,
    ipAllowlist: ipAllowlist ?? [],
    hasIpAllowlist: "ipAllowlist" in input,
  };
}

function normalizeApiKeyPermissionInput(
  permissions: CreateApiKeyRequest["permissions"] | undefined,
): UserPermission[] | undefined {
  return permissions ? normalizeApiKeyPermissions(permissions.filter(isUserPermission)) : undefined;
}

function isApiKeyPermissionInputAllowed(
  input: CreateApiKeyRequest | UpdateApiKeyRequest,
  permissions: UserPermission[] | undefined,
  requirePermissions: boolean,
): boolean {
  if (requirePermissions && !permissions?.length) {
    return false;
  }

  return !(input.permissions && !permissions?.length);
}

function normalizeNullableText(value: unknown, maxLength: number): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();

  return trimmed ? trimmed.slice(0, maxLength) : null;
}

function normalizeExpiresAt(value: unknown): string | null | undefined {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  if (typeof value !== "string") {
    return undefined;
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function normalizeIpAllowlist(value: unknown): string[] | null | undefined {
  if (value === undefined || value === null) {
    return [];
  }

  if (!Array.isArray(value)) {
    return null;
  }

  const entries = [...new Set(value.map((entry) => String(entry).trim()).filter(Boolean))];

  return entries.every(isValidIpAllowlistEntry) ? entries : null;
}

function normalizeApiKeyPermissions(permissions: readonly UserPermission[]): UserPermission[] {
  if (!permissions.every(isApiKeyEligiblePermission)) {
    return [];
  }

  return normalizePermissionList(permissions);
}

function createApiKeyRow(input: {
  actorUserId: string;
  input: NormalizedApiKeyInput & { name: string; permissions: UserPermission[] };
  now: string;
  secret: string;
}): ApiKey {
  const prefix = readSecretDisplayPrefix(input.secret);

  return {
    id: Bun.randomUUIDv7(),
    name: input.input.name,
    description: input.input.description,
    secretHash: hashSessionToken(input.secret),
    prefix,
    maskedKey: `${prefix}••••${input.secret.slice(-4)}`,
    createdByUserId: input.actorUserId,
    expiresAt: input.input.expiresAt,
    ipAllowlistJson: JSON.stringify(input.input.ipAllowlist),
    lastUsedAt: null,
    lastUsedIpAddress: null,
    lastUsedUserAgent: null,
    revokedAt: null,
    createdAt: input.now,
    updatedAt: input.now,
  };
}

function insertApiKeyPermissionGrants(
  tx: DatabaseTransaction,
  input: {
    apiKeyId: string;
    grantedByUserId: string;
    now: string;
    permissions: readonly UserPermission[];
  },
): void {
  if (input.permissions.length === 0) {
    return;
  }

  tx.insert(apiKeyPermissionGrants)
    .values(
      input.permissions.map((permission) => ({
        id: Bun.randomUUIDv7(),
        apiKeyId: input.apiKeyId,
        permission,
        grantedByUserId: input.grantedByUserId,
        createdAt: input.now,
        updatedAt: input.now,
      })),
    )
    .run();
}

function generateApiKeySecret(): string {
  return `${API_KEY_PREFIX}${generateSessionToken()}`;
}

function readSecretDisplayPrefix(secret: string): string {
  return secret.startsWith(API_KEY_PREFIX) ? secret.slice(0, API_KEY_PREFIX.length + 8) : "unknown";
}

function getApiKeyStatus(apiKey: ApiKey): ApiKeyStatus {
  if (apiKey.revokedAt) {
    return "revoked";
  }

  if (apiKey.expiresAt && new Date(apiKey.expiresAt).getTime() <= Date.now()) {
    return "expired";
  }

  return "active";
}

function readIpAllowlist(value: string | null): string[] {
  if (!value) {
    return [];
  }

  try {
    const parsed: unknown = JSON.parse(value);

    return Array.isArray(parsed)
      ? parsed.filter((entry): entry is string => typeof entry === "string")
      : [];
  } catch {
    return [];
  }
}

function isIpAllowed(ipAddress: string | null, allowlist: readonly string[]): boolean {
  if (allowlist.length === 0) {
    return true;
  }

  if (!ipAddress) {
    return false;
  }

  return allowlist.some((entry) => ipMatchesAllowlistEntry(ipAddress, entry));
}

function ipMatchesAllowlistEntry(ipAddress: string, entry: string): boolean {
  if (!entry.includes("/")) {
    return ipAddress === entry;
  }

  const [network, prefixLengthValue] = entry.split("/");
  const prefixLength = Number(prefixLengthValue);

  if (!network || !Number.isInteger(prefixLength)) {
    return false;
  }

  const ipNumber = readIpv4Number(ipAddress);
  const networkNumber = readIpv4Number(network);

  if (ipNumber === null || networkNumber === null || prefixLength < 0 || prefixLength > 32) {
    return false;
  }

  const mask = prefixLength === 0 ? 0 : (0xffffffff << (32 - prefixLength)) >>> 0;

  return (ipNumber & mask) === (networkNumber & mask);
}

function isValidIpAllowlistEntry(entry: string): boolean {
  if (!entry.includes("/")) {
    return readIpv4Number(entry) !== null || isLikelyIpv6Address(entry);
  }

  const [network, prefixLengthValue] = entry.split("/");
  const prefixLength = Number(prefixLengthValue);

  return Boolean(
    network &&
      Number.isInteger(prefixLength) &&
      prefixLength >= 0 &&
      prefixLength <= 32 &&
      readIpv4Number(network) !== null,
  );
}

function readIpv4Number(value: string): number | null {
  const parts = value.split(".");

  if (parts.length !== 4) {
    return null;
  }

  let result = 0;

  for (const part of parts) {
    if (!/^\d+$/.test(part)) {
      return null;
    }

    const octet = Number(part);

    if (!Number.isInteger(octet) || octet < 0 || octet > 255) {
      return null;
    }

    result = (result << 8) + octet;
  }

  return result >>> 0;
}

function isLikelyIpv6Address(value: string): boolean {
  return /^[0-9a-f:]+$/i.test(value) && value.includes(":") && value.length <= 45;
}

function readPermissionGrantsByApiKeyId(
  tx: DatabaseReader,
  apiKeyIds: readonly string[],
): Map<string, UserPermission[]> {
  const grantsByApiKeyId = new Map<string, UserPermission[]>();

  if (apiKeyIds.length === 0) {
    return grantsByApiKeyId;
  }

  for (const grant of tx
    .select({
      apiKeyId: apiKeyPermissionGrants.apiKeyId,
      permission: apiKeyPermissionGrants.permission,
    })
    .from(apiKeyPermissionGrants)
    .where(inArray(apiKeyPermissionGrants.apiKeyId, [...apiKeyIds]))
    .all()) {
    if (!isUserPermission(grant.permission)) {
      continue;
    }

    grantsByApiKeyId.set(grant.apiKeyId, [
      ...(grantsByApiKeyId.get(grant.apiKeyId) ?? []),
      grant.permission,
    ]);
  }

  for (const [apiKeyId, permissions] of grantsByApiKeyId) {
    grantsByApiKeyId.set(apiKeyId, normalizeApiKeyPermissions(permissions));
  }

  return grantsByApiKeyId;
}

function readApiKeyPermissions(tx: DatabaseReader, apiKeyId: string): UserPermission[] {
  return normalizeApiKeyPermissions(
    tx
      .select({ permission: apiKeyPermissionGrants.permission })
      .from(apiKeyPermissionGrants)
      .where(eq(apiKeyPermissionGrants.apiKeyId, apiKeyId))
      .all()
      .map((grant) => grant.permission)
      .filter(isUserPermission),
  );
}

function readApiKeyById(tx: DatabaseReader, apiKeyId: string): ApiKey | undefined {
  return tx.select().from(apiKeys).where(eq(apiKeys.id, apiKeyId)).get();
}

function readApiKeyWithPermissions(
  tx: DatabaseReader,
  apiKeyId: string,
): ApiKeyWithPermissions | null {
  const apiKey = readApiKeyById(tx, apiKeyId);

  if (!apiKey) {
    return null;
  }

  return { apiKey, permissions: readApiKeyPermissions(tx, apiKeyId) };
}

function revokeApiKeyRow(tx: DatabaseTransaction, apiKey: ApiKey, now: string): void {
  tx.update(apiKeys)
    .set({ revokedAt: apiKey.revokedAt ?? now, updatedAt: now })
    .where(eq(apiKeys.id, apiKey.id))
    .run();
}

function readEffectivePermissions(tx: DatabaseReader, user: User): UserPermission[] {
  const explicitPermissions: UserPermission[] = [];

  for (const grant of tx
    .select({ permission: userPermissionGrants.permission })
    .from(userPermissionGrants)
    .where(eq(userPermissionGrants.userId, user.id))
    .all()) {
    if (isUserPermission(grant.permission)) {
      explicitPermissions.push(grant.permission);
    }
  }

  const normalizedPermissions = normalizePermissionList(explicitPermissions);

  if (normalizedPermissions.includes("system:admin")) {
    return [...USER_PERMISSION_VALUES];
  }

  return normalizedPermissions;
}

function createInvalidAttemptKey(context: AuthRequestContext): string {
  return ["api-key", context.ipAddress ?? "unknown"].join(":");
}

function writeApiKeyAuditLog(
  tx: DatabaseTransaction,
  input: {
    action: string;
    actorUserId: string;
    context: AuthRequestContext;
    createdAt: string;
    metadata: Record<string, unknown>;
    targetId: string;
  },
): void {
  tx.insert(auditLogs)
    .values({
      id: Bun.randomUUIDv7(),
      actorUserId: input.actorUserId,
      action: input.action,
      targetType: "api_key",
      targetId: input.targetId,
      metadataJson: JSON.stringify(input.metadata),
      ipAddress: input.context.ipAddress,
      createdAt: input.createdAt,
    })
    .run();
}
