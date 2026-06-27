import { Buffer } from "node:buffer";
import {
  API_KEY_HEADER_NAME,
  API_KEY_QUERY_PARAMETER_NAME,
  APP_LOG_CATEGORY,
  type ApiErrorResponse,
  type ApiKeyMutationResponse,
  type ApiKeyReveal,
  type ApiKeyStatus,
  type ApiKeySummary,
  type CreateApiKeyRequest,
  hasPermissionGrant,
  isApiKeySecret,
  type PublicUser,
} from "@arrtemplar/shared";
import { getLogger } from "@logtape/logtape";
import { eq, isNull } from "drizzle-orm";
import { writeAuditLog } from "../audit/audit-log";
import type { DatabaseClient } from "../db/client";
import { type ApiKey, apiKeys, type User, users } from "../db/schema";
import type { AuthRequestContext } from "./auth.service";
import { readEffectivePermissions } from "./permissions";
import { LoginRateLimiter } from "./rate-limit";
import { hashSessionToken } from "./session-token";

type DatabaseTransaction = Parameters<Parameters<DatabaseClient["db"]["transaction"]>[0]>[0];
type DatabaseReader = DatabaseClient["db"] | DatabaseTransaction;
type ApiKeyMutationUpdate = Partial<
  Pick<
    ApiKey,
    | "deletedAt"
    | "fingerprint"
    | "keyPrefix"
    | "maskedKey"
    | "rotatedAt"
    | "secretHash"
    | "updatedAt"
  >
>;
type ApiKeyMutation<T> = {
  apiKey: ApiKey;
  result: T;
  values: ApiKeyMutationUpdate;
};

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
};

export type ResolveRequestApiKeyResult =
  | {
      ok: true;
      principal: ApiKeyPrincipal | null;
    }
  | ApiKeyFailure;

const logger = getLogger([APP_LOG_CATEGORY, "auth", "api-key"]);

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

    const rows = this.database.db.select().from(apiKeys).where(isNull(apiKeys.deletedAt)).all();

    return {
      ok: true,
      apiKeys: rows
        .map((row) => this.toApiKeySummary(row))
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt)),
    };
  }

  getApiKey(apiKeyId: string, actor: PublicUser): ApiKeySummarySuccess | ApiKeyFailure {
    const actorResult = this.readManagementActor(actor);

    if (!actorResult.ok) {
      return actorResult;
    }

    const apiKey = this.readApiKey(apiKeyId);

    if (!apiKey || apiKey.deletedAt) {
      return { ok: false, status: 404, body: apiKeyNotFoundError };
    }

    return {
      ok: true,
      apiKey: this.toApiKeySummary(apiKey),
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

    try {
      const created = this.database.db.transaction((tx) => {
        const apiKey = createApiKeyRow({
          actorUserId: actorResult.actor.id,
          input: normalizedInput,
          now,
          secret,
        });

        tx.insert(apiKeys).values(apiKey).run();
        writeApiKeyMutationAuditLog(tx, {
          action: "api_keys.created",
          actorUserId: actorResult.actor.id,
          apiKey,
          context,
          createdAt: now,
        });

        return apiKey;
      });

      logger.info("API key {apiKeyId} created.", {
        actorUserId: actorResult.actor.id,
        apiKeyId: created.id,
        fingerprint: created.fingerprint,
        keyPrefix: created.keyPrefix,
      });

      return {
        ok: true,
        body: {
          apiKey: this.toApiKeySummary(created),
          secret,
        },
      };
    } catch (error) {
      logger.error(error instanceof Error ? error : new Error("API key creation failed."), {
        actorUserId: actorResult.actor.id,
      });
      throw error;
    }
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

    try {
      const result = this.mutateExistingApiKey({
        action: "api_keys.deleted",
        actorUserId: actorResult.actor.id,
        apiKeyId,
        context,
        createMutation: (existing, now) => {
          const deletedKey: ApiKey = { ...existing, deletedAt: now, updatedAt: now };

          return {
            apiKey: deletedKey,
            result: this.toApiKeySummary(deletedKey),
            values: { deletedAt: now, updatedAt: now },
          };
        },
      });

      if (!result) {
        return { ok: false, status: 404, body: apiKeyNotFoundError };
      }

      logger.info("API key {apiKeyId} deleted.", {
        actorUserId: actorResult.actor.id,
        apiKeyId: result.id,
        fingerprint: result.fingerprint,
        keyPrefix: result.keyPrefix,
      });

      return {
        ok: true,
        body: { status: "ok", apiKey: result },
      };
    } catch (error) {
      logger.error(error instanceof Error ? error : new Error("API key deletion failed."), {
        actorUserId: actorResult.actor.id,
        apiKeyId,
      });
      throw error;
    }
  }

  rotateApiKey(
    apiKeyId: string,
    actor: PublicUser,
    context: AuthRequestContext,
  ): ApiKeyRevealResult {
    const actorResult = this.readManagementActor(actor);

    if (!actorResult.ok) {
      return actorResult;
    }

    const secret = generateApiKeySecret();
    const secretFields = buildApiKeySecretFields(secret);

    try {
      const result = this.mutateExistingApiKey({
        action: "api_keys.rotated",
        actorUserId: actorResult.actor.id,
        apiKeyId,
        context,
        createMutation: (existing, now) => {
          const rotatedKey: ApiKey = {
            ...existing,
            ...secretFields,
            rotatedAt: now,
            updatedAt: now,
          };

          return {
            apiKey: rotatedKey,
            result: rotatedKey,
            values: {
              secretHash: rotatedKey.secretHash,
              keyPrefix: rotatedKey.keyPrefix,
              fingerprint: rotatedKey.fingerprint,
              maskedKey: rotatedKey.maskedKey,
              rotatedAt: now,
              updatedAt: now,
            },
          };
        },
      });

      if (!result) {
        return { ok: false, status: 404, body: apiKeyNotFoundError };
      }

      logger.info("API key {apiKeyId} rotated.", {
        actorUserId: actorResult.actor.id,
        apiKeyId: result.id,
        fingerprint: result.fingerprint,
        keyPrefix: result.keyPrefix,
      });

      return {
        ok: true,
        body: {
          apiKey: this.toApiKeySummary(result),
          secret,
        },
      };
    } catch (error) {
      logger.error(error instanceof Error ? error : new Error("API key rotation failed."), {
        actorUserId: actorResult.actor.id,
        apiKeyId,
      });
      throw error;
    }
  }

  resolveRequestApiKey(request: Request, context: AuthRequestContext): ResolveRequestApiKeyResult {
    const requestUrl = new URL(request.url);

    if (requestUrl.searchParams.has(API_KEY_QUERY_PARAMETER_NAME)) {
      const rejectedQuerySecret = requestUrl.searchParams.get(API_KEY_QUERY_PARAMETER_NAME) ?? "";
      const keyPrefix = readSecretDisplayPrefix(rejectedQuerySecret);

      this.invalidAttemptLimiter.recordFailure(createInvalidAttemptKey(context));
      writeAuditLog(this.database.db, {
        action: "api_keys.auth.query_transport_rejected",
        actorUserId: null,
        targetType: "api_key",
        targetId: null,
        metadata: { keyPrefix, path: context.path },
        ipAddress: context.ipAddress,
      });
      logger.warn("Rejected API key query transport.", {
        ipAddress: context.ipAddress,
        keyPrefix,
        path: context.path,
        userAgent: context.userAgent,
      });

      return { ok: false, status: 401, body: apiKeyUnauthenticatedError };
    }

    const secret = readRequestApiKeySecret(request.headers);

    if (!secret) {
      return { ok: true, principal: null };
    }

    const rateLimitKey = createInvalidAttemptKey(context);

    if (this.invalidAttemptLimiter.isBlocked(rateLimitKey)) {
      const keyPrefix = readSecretDisplayPrefix(secret);

      writeAuditLog(this.database.db, {
        action: "api_keys.auth.rate_limited",
        actorUserId: null,
        targetType: "api_key",
        targetId: null,
        metadata: { keyPrefix, path: context.path },
        ipAddress: context.ipAddress,
      });
      logger.warn("API key authentication rate limited.", {
        ipAddress: context.ipAddress,
        keyPrefix,
        path: context.path,
        userAgent: context.userAgent,
      });

      return { ok: false, status: 429, body: apiKeyRateLimitedError };
    }

    if (!isApiKeySecret(secret)) {
      return this.rejectInvalidApiKeyAttempt(secret, context, "api_keys.auth.invalid");
    }

    const apiKey = this.database.db
      .select()
      .from(apiKeys)
      .where(eq(apiKeys.secretHash, hashSessionToken(secret)))
      .get();

    if (!apiKey) {
      return this.rejectInvalidApiKeyAttempt(secret, context, "api_keys.auth.invalid");
    }

    if (apiKey.deletedAt) {
      this.invalidAttemptLimiter.recordFailure(rateLimitKey);
      writeAuditLog(this.database.db, {
        action: "api_keys.auth.deleted",
        actorUserId: null,
        targetType: "api_key",
        targetId: apiKey.id,
        metadata: { keyPrefix: apiKey.keyPrefix, path: context.path },
        ipAddress: context.ipAddress,
      });
      logger.warn("Deleted API key used for authentication.", {
        apiKeyId: apiKey.id,
        ipAddress: context.ipAddress,
        keyPrefix: apiKey.keyPrefix,
        path: context.path,
        userAgent: context.userAgent,
      });

      return { ok: false, status: 401, body: apiKeyUnauthenticatedError };
    }

    const now = new Date().toISOString();
    const shouldLogFirstSuccess =
      !apiKey.lastUsedAt || Boolean(apiKey.rotatedAt && apiKey.rotatedAt > apiKey.lastUsedAt);

    this.database.db
      .update(apiKeys)
      .set({
        lastUsedAt: now,
        lastUsedIpAddress: context.ipAddress,
        lastUsedUserAgent: context.userAgent,
      })
      .where(eq(apiKeys.id, apiKey.id))
      .run();
    this.invalidAttemptLimiter.clear(rateLimitKey);

    const summary = this.toApiKeySummary({
      ...apiKey,
      lastUsedAt: now,
      lastUsedIpAddress: context.ipAddress,
      lastUsedUserAgent: context.userAgent,
    });

    if (shouldLogFirstSuccess) {
      logger.info("API key {apiKeyId} authenticated.", {
        apiKeyId: apiKey.id,
        keyPrefix: apiKey.keyPrefix,
        path: context.path,
      });
    }

    return {
      ok: true,
      principal: {
        kind: "apiKey",
        apiKey: summary,
      },
    };
  }

  private rejectInvalidApiKeyAttempt(
    secret: string,
    context: AuthRequestContext,
    action: string,
  ): ResolveRequestApiKeyResult {
    const keyPrefix = readSecretDisplayPrefix(secret);

    this.invalidAttemptLimiter.recordFailure(createInvalidAttemptKey(context));
    writeAuditLog(this.database.db, {
      action,
      actorUserId: null,
      targetType: "api_key",
      targetId: null,
      metadata: { keyPrefix, path: context.path },
      ipAddress: context.ipAddress,
    });
    logger.warn("Invalid API key attempt.", {
      ipAddress: context.ipAddress,
      keyPrefix,
      path: context.path,
      userAgent: context.userAgent,
    });

    return { ok: false, status: 401, body: apiKeyUnauthenticatedError };
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

  private mutateExistingApiKey<T>(input: {
    action: string;
    actorUserId: string;
    apiKeyId: string;
    context: AuthRequestContext;
    createMutation: (existing: ApiKey, now: string) => ApiKeyMutation<T>;
  }): T | null {
    return this.database.db.transaction((tx) => {
      const existing = readApiKeyById(tx, input.apiKeyId);

      if (!existing || existing.deletedAt) {
        return null;
      }

      const now = new Date().toISOString();
      const mutation = input.createMutation(existing, now);

      updateApiKeyAndWriteMutationAuditLog(tx, {
        action: input.action,
        actorUserId: input.actorUserId,
        apiKey: mutation.apiKey,
        context: input.context,
        createdAt: now,
        values: mutation.values,
      });

      return mutation.result;
    });
  }

  private toApiKeySummary(apiKey: ApiKey): ApiKeySummary {
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
      keyPrefix: apiKey.keyPrefix,
      fingerprint: apiKey.fingerprint,
      maskedKey: apiKey.maskedKey,
      status: getApiKeyStatus(apiKey),
      lastUsedAt: apiKey.lastUsedAt,
      lastUsedIpAddress: apiKey.lastUsedIpAddress,
      lastUsedUserAgent: apiKey.lastUsedUserAgent,
      createdBy: createdBy ?? null,
      createdAt: apiKey.createdAt,
      updatedAt: apiKey.updatedAt,
      rotatedAt: apiKey.rotatedAt,
      deletedAt: apiKey.deletedAt,
    };
  }
}

type NormalizedCreateApiKeyInput = {
  description: string | null;
  name: string;
};

function normalizeCreateApiKeyInput(
  input: CreateApiKeyRequest,
): NormalizedCreateApiKeyInput | null {
  const name = typeof input.name === "string" ? input.name.trim() : "";
  const description = normalizeNullableText(input.description, 500);

  if (!name || name.length > 80 || description === undefined) {
    return null;
  }

  return { description, name };
}

function normalizeNullableText(value: unknown, maxLength: number): string | null | undefined {
  if (value === undefined) {
    return null;
  }

  if (value === null) {
    return null;
  }

  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();

  return trimmed ? trimmed.slice(0, maxLength) : null;
}

function createApiKeyRow(input: {
  actorUserId: string;
  input: NormalizedCreateApiKeyInput;
  now: string;
  secret: string;
}): ApiKey {
  return {
    id: Bun.randomUUIDv7(),
    name: input.input.name,
    description: input.input.description,
    ...buildApiKeySecretFields(input.secret),
    createdByUserId: input.actorUserId,
    lastUsedAt: null,
    lastUsedIpAddress: null,
    lastUsedUserAgent: null,
    rotatedAt: null,
    deletedAt: null,
    createdAt: input.now,
    updatedAt: input.now,
  };
}

function buildApiKeySecretFields(
  secret: string,
): Pick<ApiKey, "secretHash" | "keyPrefix" | "fingerprint" | "maskedKey"> {
  const secretHash = hashSessionToken(secret);
  const keyPrefix = readSecretDisplayPrefix(secret);

  return {
    secretHash,
    keyPrefix,
    fingerprint: secretHash.slice(0, 12),
    maskedKey: `${keyPrefix}••••${secret.slice(-4)}`,
  };
}

function generateApiKeySecret(): string {
  return Buffer.from(crypto.getRandomValues(new Uint8Array(16))).toString("hex");
}

function readSecretDisplayPrefix(secret: string): string {
  return secret.slice(0, 8);
}

function getApiKeyStatus(apiKey: ApiKey): ApiKeyStatus {
  return apiKey.deletedAt ? "deleted" : "active";
}

function readRequestApiKeySecret(headers: Headers): string | null {
  const headerSecret = headers.get(API_KEY_HEADER_NAME);

  if (headerSecret?.trim()) {
    return headerSecret.trim();
  }

  const authorization = headers.get("authorization");

  if (!authorization) {
    return null;
  }

  const match = /^Bearer\s+(\S+)$/i.exec(authorization.trim());

  return match?.[1] ?? null;
}

function readApiKeyById(tx: DatabaseReader, apiKeyId: string): ApiKey | undefined {
  return tx.select().from(apiKeys).where(eq(apiKeys.id, apiKeyId)).get();
}

function createInvalidAttemptKey(context: AuthRequestContext): string {
  return ["api-key", context.ipAddress ?? "unknown"].join(":");
}

function buildAuditMetadata(apiKey: ApiKey, context: AuthRequestContext) {
  return {
    fingerprint: apiKey.fingerprint,
    keyPrefix: apiKey.keyPrefix,
    path: context.path,
  };
}

function writeApiKeyMutationAuditLog(
  tx: DatabaseTransaction,
  input: {
    action: string;
    actorUserId: string;
    apiKey: ApiKey;
    context: AuthRequestContext;
    createdAt: string;
  },
): void {
  writeAuditLog(tx, {
    action: input.action,
    actorUserId: input.actorUserId,
    targetType: "api_key",
    targetId: input.apiKey.id,
    metadata: buildAuditMetadata(input.apiKey, input.context),
    ipAddress: input.context.ipAddress,
    createdAt: input.createdAt,
  });
}

function updateApiKeyAndWriteMutationAuditLog(
  tx: DatabaseTransaction,
  input: {
    action: string;
    actorUserId: string;
    apiKey: ApiKey;
    context: AuthRequestContext;
    createdAt: string;
    values: ApiKeyMutationUpdate;
  },
): void {
  tx.update(apiKeys).set(input.values).where(eq(apiKeys.id, input.apiKey.id)).run();
  writeApiKeyMutationAuditLog(tx, input);
}
