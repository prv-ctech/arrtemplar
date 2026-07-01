import {
  APP_LOG_CATEGORY,
  type ApiErrorResponse,
  DEFAULT_CHALLENGE_SOLVER_PATH,
  DEFAULT_CHALLENGE_SOLVER_VARIANT,
  DEFAULT_PROXY_REQUEST_TIMEOUT_MS,
  type DeleteProxyProfileResponse,
  type ProxyProfileKind,
  type ProxyProfileListResponse,
  type ProxyProfileResponse,
  type ProxyProfileTestResponse,
  type PublicUser,
  type UpsertProxyProfileRequest,
} from "@arrtemplar/shared";
import { getLogger } from "@logtape/logtape";
import { asc, eq } from "drizzle-orm";
import { readAuditActorUserId } from "../audit/audit-actor";
import { type AuditLogInput, writeAuditLog } from "../audit/audit-log";
import type { AuthRequestContext } from "../auth/auth.service";
import type { DatabaseClient } from "../db/client";
import { type ProxyProfile, proxyProfiles } from "../db/schema";
import {
  buildValidatedBaseUrl,
  normalizePathBase,
  OutboundRequestPolicyError,
} from "../outbound/request-target-policy";
import { decryptProxyProfileSecret, encryptProxyProfileSecret } from "../security/oauth-crypto";
import {
  type ChallengeSolverTestDependencies,
  testChallengeSolverConnection,
} from "./challenge-solver-client";
import { type HttpProxyTestDependencies, testHttpProxyConnection } from "./http-proxy-client";
import { readProxyProfileAuditMetadata, toProxyProfileSummary } from "./proxy-profile-mappers";

type ServiceResult<T> =
  | { ok: true; body: T }
  | { ok: false; status: 404 | 409 | 422 | 503; body: ApiErrorResponse };

type ProxyField =
  | "clearPassword"
  | "description"
  | "enabled"
  | "general"
  | "host"
  | "kind"
  | "name"
  | "password"
  | "path"
  | "port"
  | "requestTimeoutMs"
  | "scheme"
  | "sessionName"
  | "sessionTtlMinutes"
  | "username"
  | "variant";

type NormalizedUpsertProxyProfileInput = {
  kind: ProxyProfileKind;
  variant: ProxyProfile["variant"];
  name: string;
  description: string | null;
  enabled: boolean;
  scheme: ProxyProfile["scheme"];
  host: string;
  port: number;
  path: string | null;
  requestTimeoutMs: number;
  sessionName: string | null;
  sessionTtlMinutes: number | null;
  username: string | null;
  password: string | undefined;
  clearPassword: boolean;
};

type StoredProxyPassword = {
  masterKeyId: string | null;
  passwordEncrypted: string | null;
};

export type ProxyProfileServiceOptions = {
  secretEncryptionKey: string | null;
  challengeSolverDependencies?: ChallengeSolverTestDependencies;
  httpProxyDependencies?: HttpProxyTestDependencies;
};

const logger = getLogger([APP_LOG_CATEGORY, "settings", "proxies"]);
const challengeSolverLogger = getLogger([
  APP_LOG_CATEGORY,
  "settings",
  "proxies",
  "challenge-solver",
]);
const httpProxyLogger = getLogger([APP_LOG_CATEGORY, "settings", "proxies", "http-proxy"]);

export class ProxyProfileService {
  constructor(
    private readonly database: DatabaseClient,
    private readonly options: ProxyProfileServiceOptions,
  ) {}

  listProfiles(): ProxyProfileListResponse {
    return {
      profiles: this.database.db
        .select()
        .from(proxyProfiles)
        .orderBy(asc(proxyProfiles.kind))
        .all()
        .map(toProxyProfileSummary),
    };
  }

  async createProfile(
    input: UpsertProxyProfileRequest,
    actor?: PublicUser,
    context?: AuthRequestContext,
  ): Promise<ServiceResult<ProxyProfileResponse>> {
    const normalizedInput = normalizeUpsertProxyProfileInput(input);

    logger.debug("Proxy profile {action} started for {proxyProfileId}.", {
      event: "settings.proxies.create.started",
      action: "create",
      proxyProfileId: normalizedInput.kind,
      kind: normalizedInput.kind,
      variant: normalizedInput.variant,
      host: normalizedInput.host,
      port: normalizedInput.port,
      scheme: normalizedInput.scheme,
      enabled: normalizedInput.enabled,
    });

    if (this.readProfileByKind(normalizedInput.kind)) {
      return {
        ok: false,
        status: 409,
        body: {
          error: {
            code: "PROXY_PROFILE_KIND_ALREADY_CONFIGURED",
            message: `${readProfileKindLabel(normalizedInput.kind)} is already configured.`,
          },
        },
      };
    }

    const validationError = validateProxyProfileInput(normalizedInput);

    if (validationError) {
      logValidationFailure(normalizedInput, validationError);
      return validationError;
    }

    const storedPassword = await this.resolveStoredPassword(normalizedInput);

    if (!storedPassword.ok) {
      return storedPassword;
    }

    const now = new Date().toISOString();
    const profile = buildProxyProfileRecord({
      id: Bun.randomUUIDv7(),
      input: normalizedInput,
      storedPassword: storedPassword.body,
      now,
    });

    this.database.db.insert(proxyProfiles).values(profile).run();
    this.writeAuditLog("settings.proxies.created", profile, actor, context);

    logSavedProfile(profile);

    return { ok: true, body: { profile: toProxyProfileSummary(profile) } };
  }

  async updateProfile(
    proxyProfileId: string,
    input: UpsertProxyProfileRequest,
    actor?: PublicUser,
    context?: AuthRequestContext,
  ): Promise<ServiceResult<ProxyProfileResponse>> {
    const existing = this.readProfileById(proxyProfileId);

    if (!existing) {
      return notFoundResult();
    }

    const normalizedInput = normalizeUpsertProxyProfileInput({
      ...input,
      enabled: input.enabled ?? existing.enabled,
    });

    logger.debug("Proxy profile {action} started for {proxyProfileId}.", {
      event: "settings.proxies.update.started",
      action: "update",
      proxyProfileId,
      kind: normalizedInput.kind,
      variant: normalizedInput.variant,
      host: normalizedInput.host,
      port: normalizedInput.port,
      scheme: normalizedInput.scheme,
      enabled: normalizedInput.enabled,
    });

    if (normalizedInput.kind !== existing.kind) {
      const result = validationResult(
        "kind",
        "kind_mismatch",
        "Proxy profile kind cannot be changed.",
      );

      logValidationFailure(normalizedInput, result);
      return result;
    }

    const validationError = validateProxyProfileInput(normalizedInput);

    if (validationError) {
      logValidationFailure(normalizedInput, validationError);
      return validationError;
    }

    const storedPassword = await this.resolveStoredPassword(normalizedInput, existing);

    if (!storedPassword.ok) {
      return storedPassword;
    }

    const profile = buildProxyProfileRecord({
      id: existing.id,
      input: normalizedInput,
      storedPassword: storedPassword.body,
      now: new Date().toISOString(),
      existing,
    });

    this.database.db
      .update(proxyProfiles)
      .set(profile)
      .where(eq(proxyProfiles.id, existing.id))
      .run();
    this.writeAuditLog("settings.proxies.updated", profile, actor, context);

    logSavedProfile(profile);

    return { ok: true, body: { profile: toProxyProfileSummary(profile) } };
  }

  deleteProfile(
    proxyProfileId: string,
    actor?: PublicUser,
    context?: AuthRequestContext,
  ): ServiceResult<DeleteProxyProfileResponse> {
    const existing = this.readProfileById(proxyProfileId);

    if (!existing) {
      return notFoundResult();
    }

    logger.debug("Proxy profile {action} started for {proxyProfileId}.", {
      event: "settings.proxies.delete.started",
      action: "delete",
      proxyProfileId,
      kind: existing.kind,
      variant: existing.variant,
      host: existing.host,
      port: existing.port,
      scheme: existing.scheme,
      enabled: existing.enabled,
    });

    this.writeAuditLog("settings.proxies.deleted", existing, actor, context);
    this.database.db.delete(proxyProfiles).where(eq(proxyProfiles.id, proxyProfileId)).run();

    logger.info("Proxy profile {proxyProfileId} deleted for {kind}.", {
      event: "settings.proxies.deleted",
      proxyProfileId: existing.id,
      kind: existing.kind,
    });

    return {
      ok: true,
      body: {
        status: "ok",
        deletedId: existing.id,
        deletedKind: existing.kind,
      },
    };
  }

  async testProfile(
    proxyProfileId: string,
    actor?: PublicUser,
    context?: AuthRequestContext,
  ): Promise<ServiceResult<ProxyProfileTestResponse>> {
    const existing = this.readProfileById(proxyProfileId);

    if (!existing) {
      return notFoundResult();
    }

    try {
      const result = existing.enabled
        ? await this.runEnabledProfileTest(existing)
        : createSkippedResult(existing.id, existing.kind);

      this.database.db
        .update(proxyProfiles)
        .set({
          lastTestedAt: result.testedAt,
          lastTestOutcome: result.outcome,
          lastTestMessage: result.message,
          updatedAt: result.testedAt,
        })
        .where(eq(proxyProfiles.id, existing.id))
        .run();

      const updated = this.readProfileById(existing.id) ?? existing;
      this.writeAuditLog("settings.proxies.tested", updated, actor, context, {
        testMessage: result.message,
        testOutcome: result.outcome,
        testResponseTimeMs: result.responseTimeMs,
        testStatusCode: result.statusCode,
      });

      return { ok: true, body: { result } };
    } catch (error) {
      const testLogger =
        existing.kind === "challenge_solver" ? challengeSolverLogger : httpProxyLogger;

      testLogger.error("Proxy profile test crashed for {proxyProfileId}.", {
        event: "settings.proxies.test.crashed",
        proxyProfileId: existing.id,
        kind: existing.kind,
        step: "execute",
        error,
      });

      return {
        ok: false,
        status: 503,
        body: {
          error: {
            code: "PROXY_PROFILE_TEST_FAILED",
            message: "Proxy profile test failed.",
          },
        },
      };
    }
  }

  private async resolveStoredPassword(
    input: NormalizedUpsertProxyProfileInput,
    existing?: ProxyProfile | undefined,
  ): Promise<ServiceResult<StoredProxyPassword>> {
    if (input.kind !== "http_proxy") {
      return { ok: true, body: { passwordEncrypted: null, masterKeyId: null } };
    }

    if (input.clearPassword) {
      return { ok: true, body: { passwordEncrypted: null, masterKeyId: null } };
    }

    if (!hasConfiguredValue(input.password)) {
      return {
        ok: true,
        body: {
          passwordEncrypted: existing?.kind === "http_proxy" ? existing.passwordEncrypted : null,
          masterKeyId: existing?.kind === "http_proxy" ? existing.masterKeyId : null,
        },
      };
    }

    if (!this.options.secretEncryptionKey) {
      return {
        ok: false,
        status: 503,
        body: {
          error: {
            code: "PROXY_PROFILE_SECRET_ENCRYPTION_UNAVAILABLE",
            message: "Proxy profile secret encryption is not configured.",
          },
        },
      };
    }

    const encrypted = await encryptProxyProfileSecret(
      input.password.trim(),
      this.options.secretEncryptionKey,
    );

    return {
      ok: true,
      body: {
        passwordEncrypted: encrypted.encrypted,
        masterKeyId: encrypted.masterKeyId,
      },
    };
  }

  private async runEnabledProfileTest(profile: ProxyProfile) {
    if (profile.kind === "challenge_solver") {
      return await testChallengeSolverConnection(
        {
          proxyProfileId: profile.id,
          variant: profile.variant ?? DEFAULT_CHALLENGE_SOLVER_VARIANT,
          scheme: profile.scheme,
          host: profile.host,
          port: profile.port,
          timeoutMs: profile.requestTimeoutMs,
        },
        this.options.challengeSolverDependencies,
      );
    }

    const password = await this.readProxyPassword(profile);

    return await testHttpProxyConnection(
      {
        proxyProfileId: profile.id,
        scheme: profile.scheme,
        host: profile.host,
        port: profile.port,
        username: profile.username,
        password,
        timeoutMs: profile.requestTimeoutMs,
      },
      this.options.httpProxyDependencies,
    );
  }

  private async readProxyPassword(profile: ProxyProfile): Promise<string | null> {
    if (!profile.passwordEncrypted) {
      return null;
    }

    if (!this.options.secretEncryptionKey) {
      throw new Error("Proxy profile secret encryption is not configured.");
    }

    return await decryptProxyProfileSecret(
      profile.passwordEncrypted,
      this.options.secretEncryptionKey,
    );
  }

  private readProfileById(proxyProfileId: string): ProxyProfile | undefined {
    return this.database.db
      .select()
      .from(proxyProfiles)
      .where(eq(proxyProfiles.id, proxyProfileId))
      .get();
  }

  private readProfileByKind(kind: ProxyProfileKind): ProxyProfile | undefined {
    return this.database.db.select().from(proxyProfiles).where(eq(proxyProfiles.kind, kind)).get();
  }

  private writeAuditLog(
    action: string,
    profile: ProxyProfile,
    actor?: PublicUser,
    context?: AuthRequestContext,
    metadata: Record<string, unknown> = {},
  ) {
    const auditLog = this.createAuditLogInput(action, profile, actor, context, metadata);

    if (auditLog) {
      writeAuditLog(this.database.db, auditLog);
    }
  }

  private createAuditLogInput(
    action: string,
    profile: ProxyProfile,
    actor: PublicUser | undefined,
    context: AuthRequestContext | undefined,
    metadata: Record<string, unknown>,
  ): AuditLogInput | null {
    const actorUserId = readAuditActorUserId(this.database, actor);

    if (!actorUserId || !context) {
      return null;
    }

    return {
      action,
      actorUserId,
      targetType: "proxy_profile",
      targetId: profile.id,
      metadata: {
        ...readProxyProfileAuditMetadata(profile),
        ...metadata,
      },
      ipAddress: context.ipAddress,
    };
  }
}

function buildProxyProfileRecord(input: {
  id: string;
  input: NormalizedUpsertProxyProfileInput;
  storedPassword: StoredProxyPassword;
  now: string;
  existing?: ProxyProfile | undefined;
}): ProxyProfile {
  return {
    id: input.id,
    kind: input.input.kind,
    variant: input.input.kind === "challenge_solver" ? input.input.variant : null,
    name: input.input.name,
    description: input.input.description,
    enabled: input.input.enabled,
    scheme: input.input.scheme,
    host: input.input.host,
    port: input.input.port,
    path: input.input.kind === "challenge_solver" ? input.input.path : null,
    requestTimeoutMs: input.input.requestTimeoutMs,
    sessionName:
      input.input.kind === "challenge_solver" && input.input.variant === "flaresolverr"
        ? input.input.sessionName
        : null,
    sessionTtlMinutes:
      input.input.kind === "challenge_solver" && input.input.variant === "flaresolverr"
        ? input.input.sessionTtlMinutes
        : null,
    username: input.input.kind === "http_proxy" ? input.input.username : null,
    passwordEncrypted: input.storedPassword.passwordEncrypted,
    masterKeyId: input.storedPassword.masterKeyId,
    lastTestedAt: input.existing?.lastTestedAt ?? null,
    lastTestOutcome: input.existing?.lastTestOutcome ?? null,
    lastTestMessage: input.existing?.lastTestMessage ?? null,
    createdAt: input.existing?.createdAt ?? input.now,
    updatedAt: input.now,
  };
}

function normalizeUpsertProxyProfileInput(
  input: UpsertProxyProfileRequest,
): NormalizedUpsertProxyProfileInput {
  return {
    kind: input.kind,
    variant:
      input.kind === "challenge_solver"
        ? (input.variant ?? DEFAULT_CHALLENGE_SOLVER_VARIANT)
        : null,
    name: input.name.trim(),
    description: normalizeOptionalText(input.description, 200),
    enabled: input.enabled ?? true,
    scheme: input.scheme,
    host: input.host.trim(),
    port: input.port,
    path: input.kind === "challenge_solver" ? normalizeChallengeSolverPath(input.path) : null,
    requestTimeoutMs: normalizeRequestTimeoutMs(input.requestTimeoutMs),
    sessionName: normalizeOptionalText(input.sessionName, 120),
    sessionTtlMinutes: normalizeOptionalInteger(input.sessionTtlMinutes),
    username: normalizeOptionalText(input.username, 120),
    password: typeof input.password === "string" ? input.password : undefined,
    clearPassword: input.clearPassword === true,
  };
}

function validateProxyProfileInput(
  input: NormalizedUpsertProxyProfileInput,
): ServiceResult<never> | null {
  const commonValidationError = validateCommonProxyProfileInput(input);

  if (commonValidationError) {
    return commonValidationError;
  }

  return input.kind === "challenge_solver"
    ? validateChallengeSolverInput(input)
    : validateHttpProxyInput(input);
}

function validateCommonProxyProfileInput(
  input: NormalizedUpsertProxyProfileInput,
): ServiceResult<never> | null {
  if (!input.name || input.name.length > 80) {
    return validationResult("name", "invalid_name", "Proxy profile name is required.");
  }

  if (input.requestTimeoutMs < 1_000 || input.requestTimeoutMs > 300_000) {
    return validationResult(
      "requestTimeoutMs",
      "invalid_timeout",
      "Request timeout must be between 1000 and 300000 ms.",
    );
  }

  try {
    buildValidatedBaseUrl({
      label: readProfileKindLabel(input.kind),
      scheme: input.scheme,
      host: input.host,
      port: input.port,
    });
  } catch (error) {
    if (error instanceof OutboundRequestPolicyError) {
      return mapOutboundValidationError(error);
    }

    throw error;
  }

  return null;
}

function validateChallengeSolverInput(
  input: NormalizedUpsertProxyProfileInput,
): ServiceResult<never> | null {
  const credentialValidationError = validateUnsupportedSolverCredentials(input);

  if (credentialValidationError) {
    return credentialValidationError;
  }

  if (
    input.variant !== "flaresolverr" &&
    (input.sessionName !== null || input.sessionTtlMinutes !== null)
  ) {
    return validationResult(
      input.sessionName !== null ? "sessionName" : "sessionTtlMinutes",
      "unsupported_session_settings",
      "FlareSolverr is required for session settings.",
    );
  }

  if (
    input.sessionTtlMinutes !== null &&
    (input.sessionTtlMinutes < 1 || input.sessionTtlMinutes > 1_440)
  ) {
    return validationResult(
      "sessionTtlMinutes",
      "invalid_session_ttl",
      "Session TTL must be between 1 and 1440 minutes.",
    );
  }

  if (input.sessionTtlMinutes !== null && input.sessionName === null) {
    return validationResult(
      "sessionName",
      "session_name_required",
      "Session name is required when session TTL is set.",
    );
  }

  return null;
}

function validateUnsupportedSolverCredentials(
  input: NormalizedUpsertProxyProfileInput,
): ServiceResult<never> | null {
  if (input.username !== null) {
    return validationResult(
      "username",
      "unsupported_username",
      "Challenge solver profiles do not use proxy credentials.",
    );
  }

  if (hasConfiguredValue(input.password)) {
    return validationResult(
      "password",
      "unsupported_password",
      "Challenge solver profiles do not use proxy credentials.",
    );
  }

  if (input.clearPassword) {
    return validationResult(
      "clearPassword",
      "unsupported_clear_password",
      "Challenge solver profiles do not use proxy credentials.",
    );
  }

  return null;
}

function validateHttpProxyInput(
  input: NormalizedUpsertProxyProfileInput,
): ServiceResult<never> | null {
  if (input.variant !== null) {
    return validationResult(
      "variant",
      "unsupported_variant",
      "HTTP proxy profiles do not use challenge-solver variants.",
    );
  }

  if (input.path !== null) {
    return validationResult("path", "unsupported_path", "HTTP proxy profiles do not use a path.");
  }

  if (input.sessionName !== null || input.sessionTtlMinutes !== null) {
    return validationResult(
      input.sessionName !== null ? "sessionName" : "sessionTtlMinutes",
      "unsupported_session_settings",
      "HTTP proxy profiles do not use challenge-solver session settings.",
    );
  }

  if (input.clearPassword && hasConfiguredValue(input.password)) {
    return validationResult(
      "password",
      "password_conflict",
      "Set a new password or clear the saved password, not both.",
    );
  }

  return null;
}

function normalizeChallengeSolverPath(path: string | null | undefined): string {
  const trimmed = path?.trim() ?? "";

  if (!trimmed) {
    return DEFAULT_CHALLENGE_SOLVER_PATH;
  }

  return normalizePathBase(trimmed, "Challenge solver") || "/";
}

function normalizeRequestTimeoutMs(value: number | undefined): number {
  if (value === undefined) {
    return DEFAULT_PROXY_REQUEST_TIMEOUT_MS;
  }

  return Math.floor(value);
}

function normalizeOptionalInteger(value: number | null | undefined): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  return Math.floor(value);
}

function normalizeOptionalText(value: string | null | undefined, maxLength: number): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed.slice(0, maxLength) : null;
}

function hasConfiguredValue(value: string | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function readProfileKindLabel(kind: ProxyProfileKind): string {
  switch (kind) {
    case "challenge_solver":
      return "Challenge solver";
    case "http_proxy":
      return "HTTP proxy";
  }
}

function mapOutboundValidationError(error: OutboundRequestPolicyError): ServiceResult<never> {
  switch (error.code) {
    case "invalid_host":
      return validationResult("host", error.code, error.message);
    case "invalid_port":
      return validationResult("port", error.code, error.message);
    case "disallowed_target":
      return validationResult("host", error.code, error.message);
    case "invalid_path_base":
      return validationResult("path", error.code, error.message);
    default:
      return validationResult("general", error.code, error.message);
  }
}

function validationResult(field: ProxyField, code: string, message: string): ServiceResult<never> {
  return {
    ok: false,
    status: 422,
    body: {
      error: {
        code: "PROXY_PROFILE_VALIDATION_FAILED",
        message,
        fieldErrors: [{ field, code, message }],
      },
    },
  };
}

function logValidationFailure(
  input: NormalizedUpsertProxyProfileInput,
  result: ServiceResult<never>,
) {
  if (result.ok) {
    return;
  }

  const fieldError = result.body.error.fieldErrors?.[0];

  logger.warn("Proxy profile validation failed at {field}.", {
    event: "settings.proxies.validation_failed",
    field: fieldError?.field ?? "general",
    reason: fieldError?.code ?? result.body.error.code,
    kind: input.kind,
    variant: input.variant,
  });
}

function logSavedProfile(profile: ProxyProfile) {
  logger.info("Proxy profile {proxyProfileId} saved for {kind}.", {
    event: "settings.proxies.saved",
    proxyProfileId: profile.id,
    kind: profile.kind,
    variant: profile.variant,
    host: profile.host,
    port: profile.port,
    scheme: profile.scheme,
    enabled: profile.enabled,
  });
}

function createSkippedResult(proxyProfileId: string, kind: ProxyProfileKind) {
  return {
    profileId: proxyProfileId,
    kind,
    outcome: "skipped" as const,
    message: "Proxy profile is disabled.",
    testedAt: new Date().toISOString(),
    statusCode: null,
    responseTimeMs: null,
  };
}

function notFoundResult<T>(): ServiceResult<T> {
  return {
    ok: false,
    status: 404,
    body: {
      error: {
        code: "PROXY_PROFILE_NOT_FOUND",
        message: "Proxy profile was not found.",
      },
    },
  };
}
