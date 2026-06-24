import type {
  ApiErrorResponse,
  DeleteDownloadClientResponse,
  DownloadClientKind,
  DownloadClientListResponse,
  DownloadClientOperationError,
  DownloadClientProbeResponse,
  DownloadClientResponse,
  DownloadClientSavedConfig,
  PublicUser,
  UpsertDownloadClientRequest,
} from "@arrtemplar/shared";
import { and, asc, desc, eq } from "drizzle-orm";
import type { AuthRequestContext } from "../auth/auth.service";
import type { DatabaseClient } from "../db/client";
import { auditLogs, type DownloadClient, downloadClients, users } from "../db/schema";
import { decryptDownloadClientSecret, encryptDownloadClientSecret } from "../security/oauth-crypto";
import { buildDownloadClientBaseUrl } from "./outbound-request-policy";
import {
  probeQbittorrentClient,
  type QbittorrentClientConfig,
  type QbittorrentProbeResult,
} from "./qbittorrent-client";
import {
  probeSabnzbdClient,
  type SabnzbdClientProbeResponse,
  type SabnzbdClientSettings,
} from "./sabnzbd-client";

type ServiceResult<T> =
  | { ok: true; body: T }
  | { ok: false; status: 404 | 422 | 503; body: ApiErrorResponse };

type DownloadClientProbers = {
  qbittorrent: (config: QbittorrentClientConfig) => Promise<QbittorrentProbeResult>;
  sabnzbd: (config: SabnzbdClientSettings) => Promise<SabnzbdClientProbeResponse>;
};

type DownloadClientServiceOptions = {
  secretEncryptionKey: string | null;
  probers?: Partial<DownloadClientProbers>;
};

type ResolvedSecrets = {
  apiKey: string | null;
  password: string | null;
};

const maxDownloadClientInstancesPerKind = 10;
const defaultDownloadClientIdByKind = {
  qbittorrent: "qbittorrent",
  sabnzbd: "sabnzbd",
} satisfies Record<DownloadClientKind, string>;

export class DownloadClientService {
  private readonly probers: DownloadClientProbers;

  constructor(
    private readonly database: DatabaseClient,
    private readonly options: DownloadClientServiceOptions,
  ) {
    this.probers = {
      qbittorrent: options.probers?.qbittorrent ?? probeQbittorrentClient,
      sabnzbd: options.probers?.sabnzbd ?? probeSabnzbdClient,
    };
  }

  listConfigs(): DownloadClientListResponse {
    return {
      clients: this.database.db
        .select()
        .from(downloadClients)
        .orderBy(
          asc(downloadClients.kind),
          desc(downloadClients.isDefault),
          asc(downloadClients.createdAt),
        )
        .all()
        .map(toSavedConfig),
    };
  }

  getConfig(kind: DownloadClientKind): DownloadClientResponse {
    const config = this.readDefaultConfig(kind);
    return { client: config ? toSavedConfig(config) : null };
  }

  async upsertConfig(
    kind: DownloadClientKind,
    input: UpsertDownloadClientRequest,
    actor?: PublicUser,
    context?: AuthRequestContext,
  ): Promise<ServiceResult<DownloadClientResponse>> {
    const id = defaultDownloadClientIdByKind[kind];
    const existing = this.readConfigById(id) ?? this.readDefaultConfig(kind);

    return await this.saveConfig({
      actor,
      context,
      existing,
      id: existing?.id ?? id,
      input,
      isDefault: true,
      kind,
    });
  }

  async createConfig(
    kind: DownloadClientKind,
    input: UpsertDownloadClientRequest,
    actor?: PublicUser,
    context?: AuthRequestContext,
  ): Promise<ServiceResult<DownloadClientResponse>> {
    if (this.countConfigsByKind(kind) >= maxDownloadClientInstancesPerKind) {
      return { ok: false, status: 422, body: tooManyInstancesError(kind) };
    }

    return await this.saveConfig({
      actor,
      context,
      id: Bun.randomUUIDv7(),
      input,
      isDefault: false,
      kind,
    });
  }

  async updateConfigById(
    id: string,
    input: UpsertDownloadClientRequest,
    actor?: PublicUser,
    context?: AuthRequestContext,
  ): Promise<ServiceResult<DownloadClientResponse>> {
    const existing = this.readConfigById(id);

    if (!existing) {
      return { ok: false, status: 404, body: notFoundByIdError(id) };
    }

    return await this.saveConfig({
      actor,
      context,
      existing,
      id: existing.id,
      input,
      isDefault: existing.isDefault,
      kind: existing.kind,
    });
  }

  private async saveConfig({
    actor,
    context,
    existing,
    id,
    input,
    isDefault,
    kind,
  }: {
    actor: PublicUser | undefined;
    context: AuthRequestContext | undefined;
    existing?: DownloadClient | undefined;
    id: string;
    input: UpsertDownloadClientRequest;
    isDefault: boolean;
    kind: DownloadClientKind;
  }): Promise<ServiceResult<DownloadClientResponse>> {
    const validationError = this.validateUpsertInput(kind, input, existing);

    if (validationError) {
      return validationError;
    }

    const encryptedSecrets = await this.encryptIncomingSecrets(input, existing);

    if (!encryptedSecrets.ok) {
      return encryptedSecrets;
    }

    const now = new Date().toISOString();
    const values = {
      id,
      kind,
      displayName: normalizeDisplayName(input.displayName, existing, kind),
      isDefault,
      enabled: input.enabled,
      useSsl: input.useSsl,
      host: input.host.trim(),
      port: input.port,
      urlBase: normalizeOptionalText(input.urlBase),
      authMode: input.authMode,
      username: normalizeOptionalText(input.username),
      apiKeyEncrypted: encryptedSecrets.value.apiKeyEncrypted,
      passwordEncrypted: encryptedSecrets.value.passwordEncrypted,
      masterKeyId: encryptedSecrets.value.masterKeyId,
      lastTestedAt: existing?.lastTestedAt ?? null,
      lastTestOutcome: existing?.lastTestOutcome ?? null,
      lastTestMessage: existing?.lastTestMessage ?? null,
      lastStatusCheckedAt: existing?.lastStatusCheckedAt ?? null,
      lastStatusOutcome: existing?.lastStatusOutcome ?? null,
      lastStatusMessage: existing?.lastStatusMessage ?? null,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    } satisfies DownloadClient;

    if (existing) {
      this.database.db.update(downloadClients).set(values).where(eq(downloadClients.id, id)).run();
    } else {
      this.database.db.insert(downloadClients).values(values).run();
    }

    const savedConfig = this.readConfigById(id);

    if (!savedConfig) {
      return { ok: false, status: 404, body: notFoundByIdError(id) };
    }

    this.writeAuditLog(actor, context, {
      action: "settings.services.saved",
      id: savedConfig.id,
      kind,
      metadata: readAuditMetadata(savedConfig),
    });

    return { ok: true, body: { client: toSavedConfig(savedConfig) } };
  }

  deleteConfig(
    kind: DownloadClientKind,
    actor?: PublicUser,
    context?: AuthRequestContext,
  ): ServiceResult<DeleteDownloadClientResponse> {
    const config = this.readDefaultConfig(kind);

    if (!config) {
      return { ok: false, status: 404, body: notFoundError(kind) };
    }

    this.writeAuditLog(actor, context, {
      action: "settings.services.deleted",
      id: config.id,
      kind,
      metadata: readAuditMetadata(config),
    });

    this.database.db.delete(downloadClients).where(eq(downloadClients.id, config.id)).run();

    return { ok: true, body: { status: "ok", deletedId: config.id, deletedKind: kind } };
  }

  deleteConfigById(
    id: string,
    actor?: PublicUser,
    context?: AuthRequestContext,
  ): ServiceResult<DeleteDownloadClientResponse> {
    const config = this.readConfigById(id);

    if (!config) {
      return { ok: false, status: 404, body: notFoundByIdError(id) };
    }

    if (config.isDefault) {
      return { ok: false, status: 422, body: defaultInstanceDeleteError(config.kind) };
    }

    this.writeAuditLog(actor, context, {
      action: "settings.services.deleted",
      id: config.id,
      kind: config.kind,
      metadata: readAuditMetadata(config),
    });

    this.database.db.delete(downloadClients).where(eq(downloadClients.id, id)).run();

    return { ok: true, body: { status: "ok", deletedId: id, deletedKind: config.kind } };
  }

  async testConfig(
    kind: DownloadClientKind,
    actor?: PublicUser,
    context?: AuthRequestContext,
  ): Promise<ServiceResult<DownloadClientProbeResponse>> {
    const config = this.readDefaultConfig(kind);

    if (!config) {
      return { ok: false, status: 404, body: notFoundError(kind) };
    }

    return await this.testExistingConfig(config, actor, context);
  }

  async testConfigById(
    id: string,
    actor?: PublicUser,
    context?: AuthRequestContext,
  ): Promise<ServiceResult<DownloadClientProbeResponse>> {
    const config = this.readConfigById(id);

    if (!config) {
      return { ok: false, status: 404, body: notFoundByIdError(id) };
    }

    return await this.testExistingConfig(config, actor, context);
  }

  private async testExistingConfig(
    config: DownloadClient,
    actor?: PublicUser,
    context?: AuthRequestContext,
  ): Promise<ServiceResult<DownloadClientProbeResponse>> {
    const kind = config.kind;

    const resolvedConfig = await this.resolveProbeConfig(config);

    if (!resolvedConfig.ok) {
      return resolvedConfig;
    }

    const result = await this.probe(kind, resolvedConfig.value);

    this.persistProbeMetadata(config.id, "test", result.result);
    this.writeAuditLog(actor, context, {
      action: "settings.services.tested",
      id: config.id,
      kind,
      metadata: {
        displayName: config.displayName,
        isDefault: config.isDefault,
        outcome: result.result.outcome,
        reachable: result.result.reachable,
        authenticated: result.result.authenticated,
        compatible: result.result.compatible,
        version: result.result.version,
        errorCode: result.error?.code ?? null,
      },
    });

    return { ok: true, body: result };
  }

  async getStatus(kind: DownloadClientKind): Promise<ServiceResult<DownloadClientProbeResponse>> {
    const config = this.readDefaultConfig(kind);

    if (!config) {
      return { ok: true, body: { result: createUnavailableProbe(kind, "not_configured", false) } };
    }

    return await this.getExistingStatus(config);
  }

  async getStatusById(id: string): Promise<ServiceResult<DownloadClientProbeResponse>> {
    const config = this.readConfigById(id);

    if (!config) {
      return { ok: false, status: 404, body: notFoundByIdError(id) };
    }

    return await this.getExistingStatus(config);
  }

  private async getExistingStatus(
    config: DownloadClient,
  ): Promise<ServiceResult<DownloadClientProbeResponse>> {
    const kind = config.kind;

    if (!config.enabled) {
      return { ok: true, body: { result: createUnavailableProbe(kind, "disabled", true) } };
    }

    const resolvedConfig = await this.resolveProbeConfig(config);

    if (!resolvedConfig.ok) {
      return resolvedConfig;
    }

    const result = await this.probe(kind, resolvedConfig.value);

    this.persistProbeMetadata(config.id, "status", result.result);

    return { ok: true, body: result };
  }

  private async resolveProbeConfig(
    config: DownloadClient,
  ): Promise<
    | { ok: true; value: QbittorrentClientConfig | SabnzbdClientSettings }
    | { ok: false; status: 422 | 503; body: ApiErrorResponse }
  > {
    const secretValues = await this.decryptSecrets(config);

    if (!secretValues.ok) {
      return secretValues;
    }

    return {
      ok: true,
      value: {
        useSsl: config.useSsl,
        host: config.host,
        port: config.port,
        urlBase: config.urlBase,
        authMode: config.authMode,
        username: config.username,
        apiKey: secretValues.value.apiKey,
        password: secretValues.value.password,
      },
    };
  }

  private validateUpsertInput(
    kind: DownloadClientKind,
    input: UpsertDownloadClientRequest,
    existing: DownloadClient | undefined,
  ): ServiceResult<DownloadClientResponse> | null {
    const baseUrlValidation = buildDownloadClientBaseUrl({
      serviceLabel: readServiceLabel(kind),
      useSsl: input.useSsl,
      host: input.host,
      port: input.port,
      urlBase: input.urlBase,
    });

    if (!baseUrlValidation.ok) {
      return { ok: false, status: 422, body: validationError(baseUrlValidation.error) };
    }

    if (input.authMode === "api_key" && !hasUsableSecret(input.apiKey, existing?.apiKeyEncrypted)) {
      return {
        ok: false,
        status: 422,
        body: validationError({
          code: "configuration_incomplete",
          message: `${readServiceLabel(kind)} API key is required.`,
          fieldErrors: [
            {
              field: "apiKey",
              code: "configuration_incomplete",
              message: `${readServiceLabel(kind)} API key is required.`,
            },
          ],
        }),
      };
    }

    if (input.authMode === "username_password") {
      if (!normalizeOptionalText(input.username)) {
        return {
          ok: false,
          status: 422,
          body: validationError({
            code: "configuration_incomplete",
            message: `${readServiceLabel(kind)} username is required.`,
            fieldErrors: [
              {
                field: "username",
                code: "configuration_incomplete",
                message: `${readServiceLabel(kind)} username is required.`,
              },
            ],
          }),
        };
      }

      if (!hasUsableSecret(input.password, existing?.passwordEncrypted)) {
        return {
          ok: false,
          status: 422,
          body: validationError({
            code: "configuration_incomplete",
            message: `${readServiceLabel(kind)} password is required.`,
            fieldErrors: [
              {
                field: "password",
                code: "configuration_incomplete",
                message: `${readServiceLabel(kind)} password is required.`,
              },
            ],
          }),
        };
      }
    }

    return null;
  }

  private async encryptIncomingSecrets(
    input: UpsertDownloadClientRequest,
    existing: DownloadClient | undefined,
  ): Promise<
    | {
        ok: true;
        value: {
          apiKeyEncrypted: string | null;
          passwordEncrypted: string | null;
          masterKeyId: string | null;
        };
      }
    | { ok: false; status: 503; body: ApiErrorResponse }
  > {
    let apiKeyEncrypted = existing?.apiKeyEncrypted ?? null;
    let passwordEncrypted = existing?.passwordEncrypted ?? null;
    let masterKeyId = existing?.masterKeyId ?? null;
    const secretEncryptionKey = this.options.secretEncryptionKey;

    if (hasConfiguredValue(input.apiKey) || hasConfiguredValue(input.password)) {
      if (!secretEncryptionKey) {
        return { ok: false, status: 503, body: encryptionUnavailableError() };
      }
    }

    if (hasConfiguredValue(input.apiKey)) {
      if (!secretEncryptionKey) {
        return { ok: false, status: 503, body: encryptionUnavailableError() };
      }
      const encrypted = await encryptDownloadClientSecret(input.apiKey.trim(), secretEncryptionKey);
      apiKeyEncrypted = encrypted.encrypted;
      masterKeyId = encrypted.masterKeyId;
    }

    if (hasConfiguredValue(input.password)) {
      if (!secretEncryptionKey) {
        return { ok: false, status: 503, body: encryptionUnavailableError() };
      }
      const encrypted = await encryptDownloadClientSecret(input.password, secretEncryptionKey);
      passwordEncrypted = encrypted.encrypted;
      masterKeyId = encrypted.masterKeyId;
    }

    return { ok: true, value: { apiKeyEncrypted, passwordEncrypted, masterKeyId } };
  }

  private async decryptSecrets(
    config: DownloadClient,
  ): Promise<
    { ok: true; value: ResolvedSecrets } | { ok: false; status: 503; body: ApiErrorResponse }
  > {
    if (!config.apiKeyEncrypted && !config.passwordEncrypted) {
      return { ok: true, value: { apiKey: null, password: null } };
    }

    if (!this.options.secretEncryptionKey) {
      return { ok: false, status: 503, body: encryptionUnavailableError() };
    }

    return {
      ok: true,
      value: {
        apiKey: config.apiKeyEncrypted
          ? await decryptDownloadClientSecret(
              config.apiKeyEncrypted,
              this.options.secretEncryptionKey,
            )
          : null,
        password: config.passwordEncrypted
          ? await decryptDownloadClientSecret(
              config.passwordEncrypted,
              this.options.secretEncryptionKey,
            )
          : null,
      },
    };
  }

  private async probe(
    kind: DownloadClientKind,
    config: QbittorrentClientConfig | SabnzbdClientSettings,
  ): Promise<DownloadClientProbeResponse> {
    if (kind === "qbittorrent") {
      return await this.probers.qbittorrent(config as QbittorrentClientConfig);
    }

    return await this.probers.sabnzbd(config as SabnzbdClientSettings);
  }

  private persistProbeMetadata(
    id: string,
    type: "status" | "test",
    result: DownloadClientProbeResponse["result"],
  ): void {
    const updatedAt = new Date().toISOString();
    const values =
      type === "test"
        ? {
            lastTestedAt: result.checkedAt,
            lastTestOutcome: result.outcome,
            lastTestMessage: result.summary,
            updatedAt,
          }
        : {
            lastStatusCheckedAt: result.checkedAt,
            lastStatusOutcome: result.outcome,
            lastStatusMessage: result.summary,
            updatedAt,
          };

    this.database.db.update(downloadClients).set(values).where(eq(downloadClients.id, id)).run();
  }

  private readDefaultConfig(kind: DownloadClientKind): DownloadClient | undefined {
    return this.database.db
      .select()
      .from(downloadClients)
      .where(and(eq(downloadClients.kind, kind), eq(downloadClients.isDefault, true)))
      .get();
  }

  private readConfigById(id: string): DownloadClient | undefined {
    return this.database.db.select().from(downloadClients).where(eq(downloadClients.id, id)).get();
  }

  private countConfigsByKind(kind: DownloadClientKind): number {
    return this.database.db
      .select({ id: downloadClients.id })
      .from(downloadClients)
      .where(eq(downloadClients.kind, kind))
      .all().length;
  }

  private writeAuditLog(
    actor: PublicUser | undefined,
    context: AuthRequestContext | undefined,
    payload: AuditPayload,
  ): void {
    if (!actor || !context) {
      return;
    }
    const actorRow = this.database.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.publicId, actor.id))
      .get();

    if (!actorRow) {
      return;
    }

    this.database.db
      .insert(auditLogs)
      .values({
        id: Bun.randomUUIDv7(),
        actorUserId: actorRow.id,
        action: payload.action,
        targetType: "download_client",
        targetId: payload.id,
        metadataJson: JSON.stringify(payload.metadata),
        ipAddress: context.ipAddress,
        createdAt: new Date().toISOString(),
      })
      .run();
  }
}

function toSavedConfig(config: DownloadClient): DownloadClientSavedConfig {
  return {
    id: config.id,
    kind: config.kind,
    displayName: config.displayName,
    isDefault: config.isDefault,
    enabled: config.enabled,
    useSsl: config.useSsl,
    host: config.host,
    port: config.port,
    urlBase: config.urlBase,
    authMode: config.authMode,
    username: config.username,
    hasApiKey: Boolean(config.apiKeyEncrypted),
    hasPassword: Boolean(config.passwordEncrypted),
    lastTestedAt: config.lastTestedAt,
    lastTestOutcome: config.lastTestOutcome,
    lastTestMessage: config.lastTestMessage,
    lastStatusCheckedAt: config.lastStatusCheckedAt,
    lastStatusOutcome: config.lastStatusOutcome,
    lastStatusMessage: config.lastStatusMessage,
    createdAt: config.createdAt,
    updatedAt: config.updatedAt,
  };
}

function readAuditMetadata(config: DownloadClient): Record<string, unknown> {
  return {
    displayName: config.displayName,
    enabled: config.enabled,
    host: config.host,
    isDefault: config.isDefault,
    port: config.port,
    urlBase: config.urlBase,
    authMode: config.authMode,
    hasApiKey: Boolean(config.apiKeyEncrypted),
    hasPassword: Boolean(config.passwordEncrypted),
  };
}

function createUnavailableProbe(
  kind: DownloadClientKind,
  outcome: "disabled" | "not_configured",
  configured: boolean,
): DownloadClientProbeResponse["result"] {
  return {
    kind,
    configured,
    enabled: false,
    outcome,
    summary:
      outcome === "disabled"
        ? `${readServiceLabel(kind)} is saved but disabled.`
        : `${readServiceLabel(kind)} is not configured.`,
    checkedAt: new Date().toISOString(),
    reachable: false,
    authenticated: false,
    compatible: false,
    version: null,
    webApiVersion: null,
    connectionState: null,
  };
}

function readServiceLabel(kind: DownloadClientKind): string {
  return kind === "qbittorrent" ? "qBittorrent" : "SABnzbd";
}

function normalizeDisplayName(
  value: string | null | undefined,
  existing: DownloadClient | undefined,
  kind: DownloadClientKind,
): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : (existing?.displayName ?? readServiceLabel(kind));
}

function normalizeOptionalText(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function hasConfiguredValue(value: string | null | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function hasUsableSecret(
  value: string | null | undefined,
  encryptedValue: string | null | undefined,
): boolean {
  return hasConfiguredValue(value) || Boolean(encryptedValue);
}

function validationError(error: DownloadClientOperationError): ApiErrorResponse {
  return {
    error: {
      code: error.code.toUpperCase(),
      message: error.message,
      ...(error.fieldErrors ? { fieldErrors: error.fieldErrors } : {}),
    },
  };
}

function notFoundError(kind: DownloadClientKind): ApiErrorResponse {
  return {
    error: {
      code: "DOWNLOAD_CLIENT_NOT_FOUND",
      message: `${readServiceLabel(kind)} is not configured.`,
    },
  };
}

function notFoundByIdError(id: string): ApiErrorResponse {
  return {
    error: {
      code: "DOWNLOAD_CLIENT_NOT_FOUND",
      message: `Download client ${id} is not configured.`,
    },
  };
}

function tooManyInstancesError(kind: DownloadClientKind): ApiErrorResponse {
  return {
    error: {
      code: "DOWNLOAD_CLIENT_INSTANCE_LIMIT_REACHED",
      message: `${readServiceLabel(kind)} already has ${maxDownloadClientInstancesPerKind} instances.`,
    },
  };
}

function defaultInstanceDeleteError(kind: DownloadClientKind): ApiErrorResponse {
  return {
    error: {
      code: "DOWNLOAD_CLIENT_DEFAULT_INSTANCE_REQUIRED",
      message: `${readServiceLabel(kind)} default service cannot be deleted.`,
    },
  };
}

function encryptionUnavailableError(): ApiErrorResponse {
  return {
    error: {
      code: "DOWNLOAD_CLIENT_SECRET_ENCRYPTION_UNAVAILABLE",
      message: "Download client secret encryption is not configured.",
    },
  };
}

type AuditPayload = {
  action: string;
  id: string;
  kind: DownloadClientKind;
  metadata: Record<string, unknown>;
};
