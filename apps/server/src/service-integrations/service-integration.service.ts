import type {
  ApiErrorResponse,
  DeleteServiceIntegrationResponse,
  PublicUser,
  ServiceIntegrationKind,
  ServiceIntegrationListResponse,
  ServiceIntegrationOperationError,
  ServiceIntegrationProbeResponse,
  ServiceIntegrationResponse,
  ServiceIntegrationSavedConfig,
  UpsertServiceIntegrationRequest,
} from "@arrtemplar/shared";
import { APP_LOG_CATEGORY } from "@arrtemplar/shared";
import { getLogger } from "@logtape/logtape";
import { and, asc, desc, eq } from "drizzle-orm";
import type { AuthRequestContext } from "../auth/auth.service";
import type { DatabaseClient } from "../db/client";
import { auditLogs, type ServiceIntegration, serviceIntegrations, users } from "../db/schema";
import {
  decryptServiceIntegrationSecret,
  encryptServiceIntegrationSecret,
} from "../security/oauth-crypto";
import {
  type JackettClientConfig,
  type JackettProbeResponse,
  probeJackettClient,
} from "./jackett-client";
import {
  type Nzbhydra2ClientConfig,
  type Nzbhydra2ProbeResponse,
  probeNzbhydra2Client,
} from "./nzbhydra2-client";
import { buildServiceIntegrationBaseUrl } from "./outbound-request-policy";
import {
  type ProwlarrClientConfig,
  type ProwlarrProbeResponse,
  probeProwlarrClient,
} from "./prowlarr-client";
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

const logger = getLogger([APP_LOG_CATEGORY, "service-integrations"]);

type ServiceResult<T> =
  | { ok: true; body: T }
  | { ok: false; status: 404 | 422 | 503; body: ApiErrorResponse };

type ServiceIntegrationProbers = {
  qbittorrent: (config: QbittorrentClientConfig) => Promise<QbittorrentProbeResult>;
  sabnzbd: (config: SabnzbdClientSettings) => Promise<SabnzbdClientProbeResponse>;
  prowlarr: (config: ProwlarrClientConfig) => Promise<ProwlarrProbeResponse>;
  jackett: (config: JackettClientConfig) => Promise<JackettProbeResponse>;
  nzbhydra2: (config: Nzbhydra2ClientConfig) => Promise<Nzbhydra2ProbeResponse>;
};

type ServiceIntegrationServiceOptions = {
  secretEncryptionKey: string | null;
  probers?: Partial<ServiceIntegrationProbers>;
};

type ResolvedSecrets = {
  apiKey: string | null;
  password: string | null;
};

type ResolvedProbeConfig =
  | QbittorrentClientConfig
  | SabnzbdClientSettings
  | ProwlarrClientConfig
  | JackettClientConfig
  | Nzbhydra2ClientConfig;

const maxServiceIntegrationInstancesPerKind = 10;
const defaultServiceIntegrationIdByKind = {
  qbittorrent: "qbittorrent",
  sabnzbd: "sabnzbd",
  prowlarr: "prowlarr",
  jackett: "jackett",
  nzbhydra2: "nzbhydra2",
} satisfies Record<ServiceIntegrationKind, string>;

export class ServiceIntegrationService {
  private readonly probers: ServiceIntegrationProbers;

  constructor(
    private readonly database: DatabaseClient,
    private readonly options: ServiceIntegrationServiceOptions,
  ) {
    this.probers = {
      qbittorrent: options.probers?.qbittorrent ?? probeQbittorrentClient,
      sabnzbd: options.probers?.sabnzbd ?? probeSabnzbdClient,
      prowlarr: options.probers?.prowlarr ?? probeProwlarrClient,
      jackett: options.probers?.jackett ?? probeJackettClient,
      nzbhydra2: options.probers?.nzbhydra2 ?? probeNzbhydra2Client,
    };
  }

  listConfigs(): ServiceIntegrationListResponse {
    return {
      integrations: this.database.db
        .select()
        .from(serviceIntegrations)
        .orderBy(
          asc(serviceIntegrations.kind),
          desc(serviceIntegrations.isDefault),
          asc(serviceIntegrations.createdAt),
        )
        .all()
        .map(toSavedConfig),
    };
  }

  getConfig(kind: ServiceIntegrationKind): ServiceIntegrationResponse {
    const config = this.readDefaultConfig(kind);
    return { integration: config ? toSavedConfig(config) : null };
  }

  async upsertConfig(
    kind: ServiceIntegrationKind,
    input: UpsertServiceIntegrationRequest,
    actor?: PublicUser,
    context?: AuthRequestContext,
  ): Promise<ServiceResult<ServiceIntegrationResponse>> {
    const id = defaultServiceIntegrationIdByKind[kind];
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
    kind: ServiceIntegrationKind,
    input: UpsertServiceIntegrationRequest,
    actor?: PublicUser,
    context?: AuthRequestContext,
  ): Promise<ServiceResult<ServiceIntegrationResponse>> {
    if (this.countConfigsByKind(kind) >= maxServiceIntegrationInstancesPerKind) {
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
    input: UpsertServiceIntegrationRequest,
    actor?: PublicUser,
    context?: AuthRequestContext,
  ): Promise<ServiceResult<ServiceIntegrationResponse>> {
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
    existing?: ServiceIntegration | undefined;
    id: string;
    input: UpsertServiceIntegrationRequest;
    isDefault: boolean;
    kind: ServiceIntegrationKind;
  }): Promise<ServiceResult<ServiceIntegrationResponse>> {
    logger.debug("Saving service integration {id} for {kind}.", {
      id,
      kind,
      isDefault,
    });

    const validationError = this.validateUpsertInput(kind, input, existing);

    if (validationError) {
      this.logServiceError("validation", kind, validationError.body);
      return validationError;
    }

    const encryptedSecrets = await this.encryptIncomingSecrets(input, existing);

    if (!encryptedSecrets.ok) {
      this.logServiceError("save", kind, encryptedSecrets.body);
      return encryptedSecrets;
    }

    const values = this.buildServiceIntegrationRecord({
      existing,
      id,
      input,
      isDefault,
      kind,
      secrets: encryptedSecrets.value,
    });

    this.persistServiceIntegrationRecord(values, existing);

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

    logger.info("Saved service integration {id} for {kind}.", {
      id: savedConfig.id,
      kind,
      isDefault: savedConfig.isDefault,
    });

    return { ok: true, body: { integration: toSavedConfig(savedConfig) } };
  }

  deleteConfig(
    kind: ServiceIntegrationKind,
    actor?: PublicUser,
    context?: AuthRequestContext,
  ): ServiceResult<DeleteServiceIntegrationResponse> {
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

    this.database.db.delete(serviceIntegrations).where(eq(serviceIntegrations.id, config.id)).run();

    logger.info("Deleted service integration {id} for {kind}.", {
      id: config.id,
      kind,
      isDefault: true,
    });

    return { ok: true, body: { status: "ok", deletedId: config.id, deletedKind: kind } };
  }

  deleteConfigById(
    id: string,
    actor?: PublicUser,
    context?: AuthRequestContext,
  ): ServiceResult<DeleteServiceIntegrationResponse> {
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

    this.database.db.delete(serviceIntegrations).where(eq(serviceIntegrations.id, id)).run();

    logger.info("Deleted service integration {id} for {kind}.", {
      id,
      kind: config.kind,
      isDefault: false,
    });

    return { ok: true, body: { status: "ok", deletedId: id, deletedKind: config.kind } };
  }

  async testConfig(
    kind: ServiceIntegrationKind,
    actor?: PublicUser,
    context?: AuthRequestContext,
  ): Promise<ServiceResult<ServiceIntegrationProbeResponse>> {
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
  ): Promise<ServiceResult<ServiceIntegrationProbeResponse>> {
    const config = this.readConfigById(id);

    if (!config) {
      return { ok: false, status: 404, body: notFoundByIdError(id) };
    }

    return await this.testExistingConfig(config, actor, context);
  }

  private async testExistingConfig(
    config: ServiceIntegration,
    actor?: PublicUser,
    context?: AuthRequestContext,
  ): Promise<ServiceResult<ServiceIntegrationProbeResponse>> {
    const kind = config.kind;

    logger.debug("Testing service integration {id} for {kind}.", {
      id: config.id,
      kind,
      enabled: config.enabled,
    });

    const probeResult = await this.executeStoredProbe(config, "test");

    if (!probeResult.ok) {
      return probeResult;
    }

    const result = probeResult.body;
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
    this.logProbeResult("test", config.id, kind, result);

    return { ok: true, body: result };
  }

  async getStatus(
    kind: ServiceIntegrationKind,
  ): Promise<ServiceResult<ServiceIntegrationProbeResponse>> {
    const config = this.readDefaultConfig(kind);

    if (!config) {
      return {
        ok: true,
        body: { result: createUnavailableProbe(kind, "not_configured") },
      };
    }

    return await this.getExistingStatus(config);
  }

  async getStatusById(id: string): Promise<ServiceResult<ServiceIntegrationProbeResponse>> {
    const config = this.readConfigById(id);

    if (!config) {
      return { ok: false, status: 404, body: notFoundByIdError(id) };
    }

    return await this.getExistingStatus(config);
  }

  private async getExistingStatus(
    config: ServiceIntegration,
  ): Promise<ServiceResult<ServiceIntegrationProbeResponse>> {
    const kind = config.kind;

    logger.debug("Reading service integration status for {id} and {kind}.", {
      id: config.id,
      kind,
    });

    return await this.executeStoredProbe(config, "status");
  }

  private buildServiceIntegrationRecord({
    existing,
    id,
    input,
    isDefault,
    kind,
    secrets,
  }: {
    existing: ServiceIntegration | undefined;
    id: string;
    input: UpsertServiceIntegrationRequest;
    isDefault: boolean;
    kind: ServiceIntegrationKind;
    secrets: {
      apiKeyEncrypted: string | null;
      passwordEncrypted: string | null;
      masterKeyId: string | null;
    };
  }): ServiceIntegration {
    const now = new Date().toISOString();

    return {
      id,
      kind,
      displayName: normalizeDisplayName(input.displayName, existing, kind),
      isDefault,
      enabled: true,
      useSsl: input.useSsl,
      host: input.host.trim(),
      port: input.port,
      urlBase: normalizeOptionalText(input.urlBase),
      authMode: input.authMode,
      username: normalizeOptionalText(input.username),
      apiKeyEncrypted: secrets.apiKeyEncrypted,
      passwordEncrypted: secrets.passwordEncrypted,
      masterKeyId: secrets.masterKeyId,
      lastTestedAt: existing?.lastTestedAt ?? null,
      lastTestOutcome: existing?.lastTestOutcome ?? null,
      lastTestMessage: existing?.lastTestMessage ?? null,
      lastStatusCheckedAt: existing?.lastStatusCheckedAt ?? null,
      lastStatusOutcome: existing?.lastStatusOutcome ?? null,
      lastStatusMessage: existing?.lastStatusMessage ?? null,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
  }

  private persistServiceIntegrationRecord(
    values: ServiceIntegration,
    existing: ServiceIntegration | undefined,
  ): void {
    if (existing) {
      this.database.db
        .update(serviceIntegrations)
        .set(values)
        .where(eq(serviceIntegrations.id, values.id))
        .run();
      return;
    }

    this.database.db.insert(serviceIntegrations).values(values).run();
  }

  private async executeStoredProbe(
    config: ServiceIntegration,
    action: "status" | "test",
  ): Promise<ServiceResult<ServiceIntegrationProbeResponse>> {
    const kind = config.kind;
    const resolvedConfig = await this.resolveProbeConfig(config);

    if (!resolvedConfig.ok) {
      this.logServiceError(action, kind, resolvedConfig.body);
      return resolvedConfig;
    }

    const result = await this.probe(kind, resolvedConfig.value);

    this.persistProbeMetadata(config.id, action, result.result);
    this.logProbeResult(action, config.id, kind, result);

    return { ok: true, body: result };
  }

  private async resolveProbeConfig(
    config: ServiceIntegration,
  ): Promise<
    | { ok: true; value: ResolvedProbeConfig }
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
    kind: ServiceIntegrationKind,
    input: UpsertServiceIntegrationRequest,
    existing: ServiceIntegration | undefined,
  ): { ok: false; status: 422; body: ApiErrorResponse } | null {
    const baseUrlValidation = buildServiceIntegrationBaseUrl({
      serviceLabel: readServiceLabel(kind),
      useSsl: input.useSsl,
      host: input.host,
      port: input.port,
      urlBase: input.urlBase,
    });

    if (!baseUrlValidation.ok) {
      return { ok: false, status: 422, body: validationError(baseUrlValidation.error) };
    }

    if (isApiKeyOnlyServiceKind(kind) && input.authMode !== "api_key") {
      const serviceLabel = readServiceLabel(kind);
      return {
        ok: false,
        status: 422,
        body: validationError({
          code: "configuration_incomplete",
          message: `${serviceLabel} only supports API key authentication.`,
          fieldErrors: [
            {
              field: "authMode",
              code: "configuration_incomplete",
              message: `${serviceLabel} only supports API key authentication.`,
            },
          ],
        }),
      };
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
    input: UpsertServiceIntegrationRequest,
    existing: ServiceIntegration | undefined,
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
      const encrypted = await encryptServiceIntegrationSecret(
        input.apiKey.trim(),
        secretEncryptionKey,
      );
      apiKeyEncrypted = encrypted.encrypted;
      masterKeyId = encrypted.masterKeyId;
    }

    if (hasConfiguredValue(input.password)) {
      if (!secretEncryptionKey) {
        return { ok: false, status: 503, body: encryptionUnavailableError() };
      }
      const encrypted = await encryptServiceIntegrationSecret(input.password, secretEncryptionKey);
      passwordEncrypted = encrypted.encrypted;
      masterKeyId = encrypted.masterKeyId;
    }

    return { ok: true, value: { apiKeyEncrypted, passwordEncrypted, masterKeyId } };
  }

  private async decryptSecrets(
    config: ServiceIntegration,
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
          ? await decryptServiceIntegrationSecret(
              config.apiKeyEncrypted,
              this.options.secretEncryptionKey,
            )
          : null,
        password: config.passwordEncrypted
          ? await decryptServiceIntegrationSecret(
              config.passwordEncrypted,
              this.options.secretEncryptionKey,
            )
          : null,
      },
    };
  }

  private async probe(
    kind: ServiceIntegrationKind,
    config: ResolvedProbeConfig,
  ): Promise<ServiceIntegrationProbeResponse> {
    switch (kind) {
      case "qbittorrent":
        return await this.probers.qbittorrent(config as QbittorrentClientConfig);
      case "sabnzbd":
        return await this.probers.sabnzbd(config as SabnzbdClientSettings);
      case "prowlarr":
        return await this.probers.prowlarr(config as ProwlarrClientConfig);
      case "jackett":
        return await this.probers.jackett(config as JackettClientConfig);
      case "nzbhydra2":
        return await this.probers.nzbhydra2(config as Nzbhydra2ClientConfig);
    }
  }

  private persistProbeMetadata(
    id: string,
    type: "status" | "test",
    result: ServiceIntegrationProbeResponse["result"],
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

    this.database.db
      .update(serviceIntegrations)
      .set(values)
      .where(eq(serviceIntegrations.id, id))
      .run();
  }

  private readDefaultConfig(kind: ServiceIntegrationKind): ServiceIntegration | undefined {
    return this.database.db
      .select()
      .from(serviceIntegrations)
      .where(and(eq(serviceIntegrations.kind, kind), eq(serviceIntegrations.isDefault, true)))
      .get();
  }

  private readConfigById(id: string): ServiceIntegration | undefined {
    return this.database.db
      .select()
      .from(serviceIntegrations)
      .where(eq(serviceIntegrations.id, id))
      .get();
  }

  private countConfigsByKind(kind: ServiceIntegrationKind): number {
    return this.database.db
      .select({ id: serviceIntegrations.id })
      .from(serviceIntegrations)
      .where(eq(serviceIntegrations.kind, kind))
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
        targetType: "service_integration",
        targetId: payload.id,
        metadataJson: JSON.stringify(payload.metadata),
        ipAddress: context.ipAddress,
        createdAt: new Date().toISOString(),
      })
      .run();
  }

  private logProbeResult(
    action: "status" | "test",
    id: string,
    kind: ServiceIntegrationKind,
    result: ServiceIntegrationProbeResponse,
  ): void {
    if (result.error) {
      logger.warn("Service integration {action} failed with {code}.", {
        action,
        id,
        kind,
        code: result.error.code,
        field: result.error.fieldErrors?.[0]?.field ?? null,
      });
      return;
    }

    logger.info("Service integration {action} succeeded for {kind}.", {
      action,
      id,
      kind,
      outcome: result.result.outcome,
      version: result.result.version,
    });
  }

  private logServiceError(
    action: "save" | "status" | "test" | "validation",
    kind: ServiceIntegrationKind,
    body: ApiErrorResponse,
  ): void {
    logger.warn("Service integration {action} failed with {code}.", {
      action,
      kind,
      code: body.error.code,
      field: body.error.fieldErrors?.[0]?.field ?? null,
    });
  }
}

function toSavedConfig(config: ServiceIntegration): ServiceIntegrationSavedConfig {
  return {
    id: config.id,
    kind: config.kind,
    displayName: config.displayName,
    isDefault: config.isDefault,
    enabled: true,
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

function readAuditMetadata(config: ServiceIntegration): Record<string, unknown> {
  return {
    displayName: config.displayName,
    enabled: true,
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
  kind: ServiceIntegrationKind,
  outcome: "not_configured",
): ServiceIntegrationProbeResponse["result"] {
  return {
    kind,
    configured: false,
    enabled: false,
    outcome,
    summary: `${readServiceLabel(kind)} is not configured.`,
    checkedAt: new Date().toISOString(),
    reachable: false,
    authenticated: false,
    compatible: false,
    version: null,
    webApiVersion: null,
    connectionState: null,
  };
}

function readServiceLabel(kind: ServiceIntegrationKind): string {
  switch (kind) {
    case "qbittorrent":
      return "qBittorrent";
    case "sabnzbd":
      return "SABnzbd";
    case "prowlarr":
      return "Prowlarr";
    case "jackett":
      return "Jackett";
    case "nzbhydra2":
      return "NZBHydra2";
  }
}

function isApiKeyOnlyServiceKind(kind: ServiceIntegrationKind): boolean {
  return kind === "prowlarr" || kind === "jackett" || kind === "nzbhydra2";
}

function normalizeDisplayName(
  value: string | null | undefined,
  existing: ServiceIntegration | undefined,
  kind: ServiceIntegrationKind,
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

function validationError(error: ServiceIntegrationOperationError): ApiErrorResponse {
  return {
    error: {
      code: error.code.toUpperCase(),
      message: error.message,
      ...(error.fieldErrors ? { fieldErrors: error.fieldErrors } : {}),
    },
  };
}

function notFoundError(kind: ServiceIntegrationKind): ApiErrorResponse {
  return {
    error: {
      code: "SERVICE_INTEGRATION_NOT_FOUND",
      message: `${readServiceLabel(kind)} is not configured.`,
    },
  };
}

function notFoundByIdError(id: string): ApiErrorResponse {
  return {
    error: {
      code: "SERVICE_INTEGRATION_NOT_FOUND",
      message: `Service integration ${id} is not configured.`,
    },
  };
}

function tooManyInstancesError(kind: ServiceIntegrationKind): ApiErrorResponse {
  return {
    error: {
      code: "SERVICE_INTEGRATION_INSTANCE_LIMIT_REACHED",
      message: `${readServiceLabel(kind)} already has ${maxServiceIntegrationInstancesPerKind} instances.`,
    },
  };
}

function defaultInstanceDeleteError(kind: ServiceIntegrationKind): ApiErrorResponse {
  return {
    error: {
      code: "SERVICE_INTEGRATION_DEFAULT_INSTANCE_REQUIRED",
      message: `${readServiceLabel(kind)} default service cannot be deleted.`,
    },
  };
}

function encryptionUnavailableError(): ApiErrorResponse {
  return {
    error: {
      code: "SERVICE_INTEGRATION_SECRET_ENCRYPTION_UNAVAILABLE",
      message: "Service integration secret encryption is not configured.",
    },
  };
}

type AuditPayload = {
  action: string;
  id: string;
  kind: ServiceIntegrationKind;
  metadata: Record<string, unknown>;
};
