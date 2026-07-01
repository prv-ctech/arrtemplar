import {
  APP_LOG_CATEGORY,
  type ApiErrorResponse,
  type DeleteServiceIntegrationResponse,
  type PublicUser,
  readServiceIntegrationAuthPolicy,
  type ServiceIntegrationKind,
  type ServiceIntegrationListResponse,
  type ServiceIntegrationOperationError,
  type ServiceIntegrationProbeResponse,
  type ServiceIntegrationResponse,
  type ServiceIntegrationSavedConfig,
  type UpsertServiceIntegrationRequest,
} from "@arrtemplar/shared";
import { getLogger } from "@logtape/logtape";
import { and, asc, desc, eq } from "drizzle-orm";
import { readAuditActorUserId } from "../audit/audit-actor";
import { type AuditLogInput, writeAuditLog } from "../audit/audit-log";
import type { AuthRequestContext } from "../auth/auth.service";
import type { DatabaseClient } from "../db/client";
import { type ServiceIntegration, serviceIntegrations } from "../db/schema";
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
  type JellyfinClientConfig,
  type JellyfinProbeResponse,
  probeJellyfinClient,
} from "./jellyfin-client";
import {
  type Nzbhydra2ClientConfig,
  type Nzbhydra2ProbeResponse,
  probeNzbhydra2Client,
} from "./nzbhydra2-client";
import { buildServiceIntegrationBaseUrl } from "./outbound-request-policy";
import { type PlexClientConfig, type PlexProbeResponse, probePlexClient } from "./plex-client";
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
import { probeSlskdClient, type SlskdClientConfig, type SlskdProbeResponse } from "./slskd-client";

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
  plex: (config: PlexClientConfig) => Promise<PlexProbeResponse>;
  jellyfin: (config: JellyfinClientConfig) => Promise<JellyfinProbeResponse>;
  slskd: (config: SlskdClientConfig) => Promise<SlskdProbeResponse>;
};

type ServiceIntegrationServiceOptions = {
  secretEncryptionKey: string | null;
  probers?: Partial<ServiceIntegrationProbers>;
};

type ResolvedSecrets = {
  apiKey: string | null;
  password: string | null;
};

type EncryptedServiceSecrets = {
  apiKeyEncrypted: string | null;
  passwordEncrypted: string | null;
  masterKeyId: string | null;
};

type ResolvedProbeConfig =
  | QbittorrentClientConfig
  | SabnzbdClientSettings
  | ProwlarrClientConfig
  | JackettClientConfig
  | Nzbhydra2ClientConfig
  | PlexClientConfig
  | JellyfinClientConfig
  | SlskdClientConfig;

const maxServiceIntegrationInstancesPerKind = 10;

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
      plex: options.probers?.plex ?? probePlexClient,
      jellyfin: options.probers?.jellyfin ?? probeJellyfinClient,
      slskd: options.probers?.slskd ?? probeSlskdClient,
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
    const id = readDefaultServiceIntegrationId(kind);
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

    const normalizedInput = normalizeUpsertInput(kind, input);

    const validationError = this.validateUpsertInput(kind, normalizedInput, existing);

    if (validationError) {
      this.logServiceError("validation", kind, validationError.body);
      return validationError;
    }

    const encryptedSecrets = await this.encryptIncomingSecrets(normalizedInput, existing);

    if (!encryptedSecrets.ok) {
      this.logServiceError("save", kind, encryptedSecrets.body);
      return encryptedSecrets;
    }

    const values = this.buildServiceIntegrationRecord({
      existing,
      id,
      input: normalizedInput,
      isDefault,
      kind,
      secrets: encryptedSecrets.value,
    });

    this.persistServiceIntegrationRecord(values, existing);

    const savedConfig = this.readConfigById(id);

    if (!savedConfig) {
      return { ok: false, status: 404, body: notFoundByIdError(id) };
    }

    const auditLog = this.createAuditLogInput({
      action: "settings.services.saved",
      actor,
      context,
      metadata: readAuditMetadata(savedConfig),
      targetId: savedConfig.id,
    });

    if (auditLog) {
      writeAuditLog(this.database.db, auditLog);
    }

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

    return {
      ok: true,
      body: this.deleteExistingConfig(config, { actor, context, isDefault: true }),
    };
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

    return {
      ok: true,
      body: this.deleteExistingConfig(config, { actor, context, isDefault: false }),
    };
  }

  private deleteExistingConfig(
    config: ServiceIntegration,
    input: {
      actor: PublicUser | undefined;
      context: AuthRequestContext | undefined;
      isDefault: boolean;
    },
  ): DeleteServiceIntegrationResponse {
    const auditLog = this.createAuditLogInput({
      action: "settings.services.deleted",
      actor: input.actor,
      context: input.context,
      metadata: readAuditMetadata(config),
      targetId: config.id,
    });

    if (auditLog) {
      writeAuditLog(this.database.db, auditLog);
    }

    this.database.db.delete(serviceIntegrations).where(eq(serviceIntegrations.id, config.id)).run();

    logger.info("Deleted service integration {id} for {kind}.", {
      id: config.id,
      kind: config.kind,
      isDefault: input.isDefault,
    });

    return { status: "ok", deletedId: config.id, deletedKind: config.kind };
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
    const auditLog = this.createAuditLogInput({
      action: "settings.services.tested",
      actor,
      context,
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
      targetId: config.id,
    });

    if (auditLog) {
      writeAuditLog(this.database.db, auditLog);
    }
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
        integrationId: config.id,
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
    const authPolicy = readServiceIntegrationAuthPolicy(kind);
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

    if (!authPolicy.supportedModes.some((mode) => mode === input.authMode)) {
      const message = buildUnsupportedAuthModeMessage(readServiceLabel(kind), authPolicy);

      return {
        ok: false,
        status: 422,
        body: validationError({
          code: "configuration_incomplete",
          message,
          fieldErrors: [
            {
              field: "authMode",
              code: "configuration_incomplete",
              message,
            },
          ],
        }),
      };
    }

    if (
      input.authMode === "api_key" &&
      !hasUsableSecret(
        input.apiKey,
        existing?.authMode === "api_key" ? existing.apiKeyEncrypted : null,
      )
    ) {
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

      if (
        !hasUsableSecret(
          input.password,
          existing?.authMode === "username_password" ? existing.passwordEncrypted : null,
        )
      ) {
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
    | { ok: true; value: EncryptedServiceSecrets }
    | { ok: false; status: 503; body: ApiErrorResponse }
  > {
    switch (input.authMode) {
      case "none":
        return { ok: true, value: emptyEncryptedServiceSecrets() };
      case "api_key":
        return await this.resolveApiKeySecrets(input.apiKey, existing);
      case "username_password":
        return await this.resolvePasswordSecrets(input.password, existing);
    }
  }

  private async resolveApiKeySecrets(
    apiKey: string | undefined,
    existing: ServiceIntegration | undefined,
  ): Promise<
    | { ok: true; value: EncryptedServiceSecrets }
    | { ok: false; status: 503; body: ApiErrorResponse }
  > {
    if (!hasConfiguredValue(apiKey)) {
      return {
        ok: true,
        value: {
          ...emptyEncryptedServiceSecrets(),
          apiKeyEncrypted: existing?.authMode === "api_key" ? existing.apiKeyEncrypted : null,
          masterKeyId:
            existing?.authMode === "api_key" && existing.apiKeyEncrypted
              ? existing.masterKeyId
              : null,
        },
      };
    }

    const encrypted = await this.encryptSecretValue(apiKey.trim());

    if (!encrypted.ok) {
      return encrypted;
    }

    return {
      ok: true,
      value: {
        ...emptyEncryptedServiceSecrets(),
        apiKeyEncrypted: encrypted.value.encrypted,
        masterKeyId: encrypted.value.masterKeyId,
      },
    };
  }

  private async resolvePasswordSecrets(
    password: string | undefined,
    existing: ServiceIntegration | undefined,
  ): Promise<
    | { ok: true; value: EncryptedServiceSecrets }
    | { ok: false; status: 503; body: ApiErrorResponse }
  > {
    if (!hasConfiguredValue(password)) {
      return {
        ok: true,
        value: {
          ...emptyEncryptedServiceSecrets(),
          passwordEncrypted:
            existing?.authMode === "username_password" ? existing.passwordEncrypted : null,
          masterKeyId:
            existing?.authMode === "username_password" && existing.passwordEncrypted
              ? existing.masterKeyId
              : null,
        },
      };
    }

    const encrypted = await this.encryptSecretValue(password);

    if (!encrypted.ok) {
      return encrypted;
    }

    return {
      ok: true,
      value: {
        ...emptyEncryptedServiceSecrets(),
        passwordEncrypted: encrypted.value.encrypted,
        masterKeyId: encrypted.value.masterKeyId,
      },
    };
  }

  private async encryptSecretValue(
    value: string,
  ): Promise<
    | { ok: true; value: { encrypted: string; masterKeyId: string } }
    | { ok: false; status: 503; body: ApiErrorResponse }
  > {
    const secretEncryptionKey = this.options.secretEncryptionKey;

    if (!secretEncryptionKey) {
      return { ok: false, status: 503, body: encryptionUnavailableError() };
    }

    return {
      ok: true,
      value: await encryptServiceIntegrationSecret(value, secretEncryptionKey),
    };
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
      case "plex":
        return await this.probers.plex(config as PlexClientConfig);
      case "jellyfin":
        return await this.probers.jellyfin(config as JellyfinClientConfig);
      case "slskd":
        return await this.probers.slskd(config as SlskdClientConfig);
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

  private createAuditLogInput(input: {
    action: string;
    actor: PublicUser | undefined;
    context: AuthRequestContext | undefined;
    metadata: Record<string, unknown>;
    targetId: string;
  }): AuditLogInput | null {
    const actorUserId = readAuditActorUserId(this.database, input.actor);

    if (!actorUserId || !input.context) {
      return null;
    }

    return {
      action: input.action,
      actorUserId,
      targetType: "service_integration",
      targetId: input.targetId,
      metadata: input.metadata,
      ipAddress: input.context.ipAddress,
    };
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

function readDefaultServiceIntegrationId(kind: ServiceIntegrationKind): string {
  return kind;
}

function emptyEncryptedServiceSecrets(): EncryptedServiceSecrets {
  return {
    apiKeyEncrypted: null,
    passwordEncrypted: null,
    masterKeyId: null,
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
    case "plex":
      return "Plex";
    case "jellyfin":
      return "Jellyfin";
    case "slskd":
      return "slskd";
  }
}

function normalizeUpsertInput(
  kind: ServiceIntegrationKind,
  input: UpsertServiceIntegrationRequest,
): UpsertServiceIntegrationRequest {
  const authPolicy = readServiceIntegrationAuthPolicy(kind);
  const authMode = authPolicy.selector === "hidden" ? authPolicy.defaultMode : input.authMode;

  if (authMode === "none") {
    const { apiKey: _apiKey, password: _password, ...rest } = input;

    return {
      ...rest,
      authMode,
      username: null,
    };
  }

  if (authMode === "api_key") {
    const { password: _password, ...rest } = input;

    return {
      ...rest,
      authMode,
      username: null,
    };
  }

  const { apiKey: _apiKey, ...rest } = input;

  return {
    ...rest,
    authMode,
  };
}

function buildUnsupportedAuthModeMessage(
  serviceLabel: string,
  authPolicy: ReturnType<typeof readServiceIntegrationAuthPolicy>,
): string {
  const labels = authPolicy.supportedModes.map((mode) => {
    switch (mode) {
      case "api_key":
        return "API key authentication";
      case "username_password":
        return "username and password authentication";
      case "none":
        return "no authentication";
      default:
        return mode;
    }
  });

  if (labels.length === 1) {
    return `${serviceLabel} only supports ${labels[0]}.`;
  }

  if (labels.length === 2) {
    return `${serviceLabel} supports ${labels[0]} or ${labels[1]}.`;
  }

  return `${serviceLabel} supports ${labels.slice(0, -1).join(", ")}, or ${labels.at(-1)}.`;
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
