import type {
  AdminUserSummary,
  ApiKeyListResponse,
  ApiKeyMutationResponse,
  ApiKeyReveal,
  ApiKeyStatus,
  ApiKeySummary,
  AuthIdentity,
  AuthMethod,
  AuthProviderKind,
  AuthProviderSlug,
  AuthProviderSummary,
  AuthUnlinkAllIdentitiesResponse,
  ChallengeSolverVariant,
  DeleteProxyProfileResponse,
  DeleteServiceIntegrationResponse,
  HelpTicketDetail,
  HelpTicketDetailResponse,
  HelpTicketListParams,
  HelpTicketListResponse,
  HelpTicketStatus,
  LogoutResponse,
  ManagedUserProfile,
  NotificationHistoryItem,
  NotificationHistoryListResponse,
  NotificationPreferences,
  ProxyProfileListResponse,
  ProxyProfileResponse,
  ProxyProfileSummary,
  ProxyProfileTestResponse,
  PublicUser,
  ServiceIntegrationKind,
  ServiceIntegrationListResponse,
  ServiceIntegrationProbeResponse,
  ServiceIntegrationResponse,
  ServiceIntegrationSavedConfig,
  UserPermission,
} from "@arrtemplar/shared";
import {
  API_KEY_STATUS_VALUES,
  AUTH_PROVIDER_KIND_VALUES,
  AUTH_PROVIDER_SLUGS,
  DEFAULT_NOTIFICATION_PREFERENCES,
  DEFAULT_PROFILE_AVATAR_ID,
  DEFAULT_PROFILE_BANNER_ID,
  HELP_TICKET_ACCEPTED_UPLOAD_MIME_TYPES,
  HELP_TICKET_STATUS_VALUES,
  isChallengeSolverVariant,
  isHelpTicketId,
  isHttpProxyScheme,
  isProfileAvatarId,
  isProfileBannerId,
  isProxyProfileKind,
  isProxyProfileTestOutcome,
  isServiceIntegrationAuthMode,
  isServiceIntegrationKind,
  isServiceIntegrationProbeOutcome,
  isToastNotificationId,
  isToastNotificationImportance,
  isToastNotificationSeverity,
  isUserPermission,
  OIDC_PROFILE_SIGNING_ALGORITHM_VALUES,
  OIDC_SIGNING_ALGORITHM_VALUES,
  TOKEN_ENDPOINT_AUTH_METHOD_VALUES,
} from "@arrtemplar/shared";
import { ApiClientError } from "../api-error";
import type { NotificationHistoryListParams } from "./client";

export function isLogoutResponse(value: unknown): value is LogoutResponse {
  return (
    isRecord(value) &&
    value.status === "ok" &&
    (value.redirectUri === undefined ||
      (typeof value.redirectUri === "string" && value.redirectUri.length > 0))
  );
}

function normalizePermissions(permissions: unknown): UserPermission[] {
  if (!Array.isArray(permissions)) {
    return [];
  }

  return permissions.filter(
    (permission): permission is UserPermission =>
      typeof permission === "string" && isUserPermission(permission),
  );
}

export function normalizeAuthProviderSummary(provider: {
  autoRegister: boolean;
  buttonText: string;
  clientId: string;
  createdAt: string;
  endSessionEndpoint: string | null;
  enabled: boolean;
  hasClientSecret: boolean;
  idTokenSigningAlgorithm: unknown;
  issuer: string;
  label: string;
  mobileRedirectEnabled: boolean;
  mobileRedirectUri: string | null;
  profileSigningAlgorithm: unknown;
  prompt: string | null;
  providerKind: unknown;
  redirectUris: string[];
  scopes: string;
  slug: unknown;
  timeoutMs: number;
  tokenEndpointAuthMethod: unknown;
  updatedAt: string;
}): AuthProviderSummary {
  if (!isAuthProviderSlug(provider.slug)) {
    throw new ApiClientError(
      "Auth provider response was invalid.",
      0,
      "INVALID_AUTH_PROVIDER_RESPONSE",
    );
  }

  return {
    slug: provider.slug,
    providerKind: isAuthProviderKind(provider.providerKind) ? provider.providerKind : "custom",
    label: provider.label,
    issuer: provider.issuer,
    clientId: provider.clientId,
    scopes: provider.scopes,
    redirectUris: Array.isArray(provider.redirectUris) ? provider.redirectUris : [],
    enabled: Boolean(provider.enabled),
    buttonText: provider.buttonText,
    autoRegister: Boolean(provider.autoRegister),
    tokenEndpointAuthMethod: isTokenEndpointAuthMethod(provider.tokenEndpointAuthMethod)
      ? provider.tokenEndpointAuthMethod
      : "client_secret_basic",
    timeoutMs: readPositiveNumberOrDefault(provider.timeoutMs, 10_000),
    prompt: normalizeNullableString(provider.prompt),
    endSessionEndpoint: normalizeNullableString(provider.endSessionEndpoint),
    idTokenSigningAlgorithm: isOidcSigningAlgorithm(provider.idTokenSigningAlgorithm)
      ? provider.idTokenSigningAlgorithm
      : "RS256",
    profileSigningAlgorithm: isOidcProfileSigningAlgorithm(provider.profileSigningAlgorithm)
      ? provider.profileSigningAlgorithm
      : "none",
    mobileRedirectEnabled: Boolean(provider.mobileRedirectEnabled),
    mobileRedirectUri: normalizeNullableString(provider.mobileRedirectUri),
    hasClientSecret: Boolean(provider.hasClientSecret),
    createdAt: provider.createdAt,
    updatedAt: provider.updatedAt,
  };
}

export function normalizeAuthIdentity(identity: {
  createdAt: string;
  displayName: string;
  email: string | null;
  id: string;
  issuer: string;
  name: string | null;
  preferredUsername: string | null;
  provider: unknown;
  providerKind: unknown;
  subjectPreview: string;
}): AuthIdentity {
  if (!isAuthProviderSlug(identity.provider)) {
    throw new ApiClientError(
      "Linked auth identity response was invalid.",
      0,
      "INVALID_AUTH_IDENTITY_RESPONSE",
    );
  }

  return {
    id: identity.id,
    provider: identity.provider,
    providerKind: isAuthProviderKind(identity.providerKind) ? identity.providerKind : "custom",
    issuer: identity.issuer,
    subjectPreview: identity.subjectPreview,
    displayName: identity.displayName,
    preferredUsername: identity.preferredUsername,
    name: identity.name,
    email: identity.email,
    createdAt: identity.createdAt,
  };
}

function isAuthProviderSlug(value: unknown): value is AuthProviderSlug {
  return AUTH_PROVIDER_SLUGS.some((slug) => slug === value);
}

function isAuthProviderKind(value: unknown): value is AuthProviderKind {
  return AUTH_PROVIDER_KIND_VALUES.some((providerKind) => providerKind === value);
}

function isTokenEndpointAuthMethod(
  value: unknown,
): value is AuthProviderSummary["tokenEndpointAuthMethod"] {
  return TOKEN_ENDPOINT_AUTH_METHOD_VALUES.some((method) => method === value);
}

function isOidcSigningAlgorithm(
  value: unknown,
): value is AuthProviderSummary["idTokenSigningAlgorithm"] {
  return OIDC_SIGNING_ALGORITHM_VALUES.some((algorithm) => algorithm === value);
}

function isOidcProfileSigningAlgorithm(
  value: unknown,
): value is AuthProviderSummary["profileSigningAlgorithm"] {
  return OIDC_PROFILE_SIGNING_ALGORITHM_VALUES.some((algorithm) => algorithm === value);
}

function normalizeNullableString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function readPositiveNumberOrDefault(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : fallback;
}

export function isAuthUnlinkAllIdentitiesResponse(
  value: unknown,
): value is AuthUnlinkAllIdentitiesResponse {
  return (
    isRecord(value) &&
    value.status === "ok" &&
    typeof value.deletedIdentityCount === "number" &&
    typeof value.revokedOAuthSessionCount === "number"
  );
}

function isAuthMethod(value: unknown): value is AuthMethod {
  return value === "local" || value === "oauth";
}

export function normalizePublicUser(user: {
  avatarId: unknown;
  bannerId: unknown;
  createdAt: string;
  email: string;
  id: string;
  lastLoginAt: string | null;
  notificationPreferences?: unknown;
  permissions: unknown;
  username: string;
}): PublicUser {
  return {
    ...user,
    avatarId: isProfileAvatarId(user.avatarId) ? user.avatarId : DEFAULT_PROFILE_AVATAR_ID,
    bannerId: isProfileBannerId(user.bannerId) ? user.bannerId : DEFAULT_PROFILE_BANNER_ID,
    notificationPreferences: normalizeNotificationPreferences(user.notificationPreferences),
    permissions: normalizePermissions(user.permissions),
  };
}

export function normalizeNotificationPreferences(value: unknown): NotificationPreferences {
  if (!isRecord(value)) {
    return DEFAULT_NOTIFICATION_PREFERENCES;
  }

  const preferences = value;

  return {
    toastsEnabled:
      typeof preferences.toastsEnabled === "boolean"
        ? preferences.toastsEnabled
        : DEFAULT_NOTIFICATION_PREFERENCES.toastsEnabled,
    frequency:
      preferences.frequency === "minimal" || preferences.frequency === "all"
        ? preferences.frequency
        : DEFAULT_NOTIFICATION_PREFERENCES.frequency,
  };
}

export function normalizeNotificationHistoryQuery(
  input: NotificationHistoryListParams,
): NotificationHistoryListParams {
  return {
    ...(isPositiveInteger(input.page) ? { page: input.page } : {}),
    ...(isPositiveInteger(input.pageSize) ? { pageSize: input.pageSize } : {}),
  };
}

export type NormalizedHelpTicketListParams = {
  page: number;
  pageSize: number;
  scope: "all" | "mine";
  sortBy: "createdAt";
  sortOrder: "asc" | "desc";
  status?: HelpTicketStatus;
};

export function normalizeHelpTicketListParams(
  input: HelpTicketListParams,
): NormalizedHelpTicketListParams {
  return {
    page: isPositiveInteger(input.page) ? input.page : 1,
    pageSize: isPositiveInteger(input.pageSize) ? Math.min(input.pageSize, 50) : 20,
    scope: input.scope === "all" ? "all" : "mine",
    sortBy: "createdAt",
    sortOrder: input.sortOrder === "asc" ? "asc" : "desc",
    ...(isHelpTicketStatus(input.status) ? { status: input.status } : {}),
  };
}

export function normalizeHelpTicketListResponse(value: unknown): HelpTicketListResponse {
  if (!isRecord(value) || !Array.isArray(value.items) || !isRecord(value.pagination)) {
    throwInvalidHelpTicketResponse();
  }

  return {
    items: value.items.map(normalizeHelpTicketSummary),
    pagination: {
      page: readPositiveNumber(value.pagination.page),
      pageSize: readPositiveNumber(value.pagination.pageSize),
      total: readNonNegativeNumber(value.pagination.total),
      totalPages: readNonNegativeNumber(value.pagination.totalPages),
    },
  };
}

export function normalizeHelpTicketDetailResponse(value: unknown): HelpTicketDetailResponse {
  if (!isRecord(value) || !isRecord(value.ticket)) {
    throwInvalidHelpTicketResponse();
  }

  return { ticket: normalizeHelpTicketDetail(value.ticket) };
}

export function normalizeNotificationHistoryListResponse(
  value: unknown,
): NotificationHistoryListResponse {
  if (!isRecord(value) || !Array.isArray(value.notifications) || !isRecord(value.pagination)) {
    throwInvalidNotificationHistoryResponse();
  }

  return {
    notifications: value.notifications.map(normalizeNotificationHistoryItem),
    unreadCount: readNonNegativeNumber(value.unreadCount),
    pagination: {
      page: readPositiveNumber(value.pagination.page),
      pageSize: readPositiveNumber(value.pagination.pageSize),
      totalItems: readNonNegativeNumber(value.pagination.totalItems),
      totalPages: readNonNegativeNumber(value.pagination.totalPages),
    },
  };
}

export function normalizeApiKeyListResponse(value: unknown): ApiKeyListResponse {
  if (!isRecord(value) || !Array.isArray(value.apiKeys)) {
    throwInvalidApiKeyResponse();
  }

  return { apiKeys: value.apiKeys.map(normalizeApiKeySummary) };
}

export function normalizeServiceIntegrationListResponse(
  value: unknown,
): ServiceIntegrationListResponse {
  if (!isRecord(value) || !Array.isArray(value.integrations)) {
    throwInvalidServiceIntegrationResponse();
  }

  return { integrations: value.integrations.map(normalizeServiceIntegrationSavedConfig) };
}

export function normalizeServiceIntegrationResponse(value: unknown): ServiceIntegrationResponse {
  if (!isRecord(value) || !("integration" in value)) {
    throwInvalidServiceIntegrationResponse();
  }

  return {
    integration:
      value.integration === null ? null : normalizeServiceIntegrationSavedConfig(value.integration),
  };
}

export function normalizeProxyProfileListResponse(value: unknown): ProxyProfileListResponse {
  if (!isRecord(value) || !Array.isArray(value.profiles)) {
    throwInvalidProxyProfileResponse();
  }

  return { profiles: value.profiles.map(normalizeProxyProfileSummary) };
}

export function normalizeProxyProfileResponse(value: unknown): ProxyProfileResponse {
  if (!isRecord(value) || !isRecord(value.profile)) {
    throwInvalidProxyProfileResponse();
  }

  return { profile: normalizeProxyProfileSummary(value.profile) };
}

export function normalizeDeleteProxyProfileResponse(
  value: unknown,
  expectedKind?: ProxyProfileSummary["kind"],
  expectedId?: string,
): DeleteProxyProfileResponse {
  if (
    !isRecord(value) ||
    value.status !== "ok" ||
    typeof value.deletedId !== "string" ||
    !isProxyProfileKind(value.deletedKind) ||
    (expectedKind && value.deletedKind !== expectedKind) ||
    (expectedId && value.deletedId !== expectedId)
  ) {
    throwInvalidProxyProfileResponse();
  }

  return {
    status: "ok",
    deletedId: value.deletedId,
    deletedKind: value.deletedKind,
  };
}

export function normalizeProxyProfileTestResponse(
  value: unknown,
  expectedId?: string,
): ProxyProfileTestResponse {
  if (!isRecord(value) || !isRecord(value.result)) {
    throwInvalidProxyProfileResponse();
  }

  const result = value.result;

  if (
    typeof result.profileId !== "string" ||
    (expectedId && result.profileId !== expectedId) ||
    !isProxyProfileKind(result.kind) ||
    !isProxyProfileTestOutcome(result.outcome) ||
    typeof result.message !== "string" ||
    !isDateTime(result.testedAt) ||
    !(typeof result.statusCode === "number" || result.statusCode === null) ||
    !(typeof result.responseTimeMs === "number" || result.responseTimeMs === null)
  ) {
    throwInvalidProxyProfileResponse();
  }

  return {
    result: {
      profileId: result.profileId,
      kind: result.kind,
      outcome: result.outcome,
      message: result.message,
      testedAt: normalizeDateTime(result.testedAt),
      statusCode: result.statusCode,
      responseTimeMs: result.responseTimeMs,
    },
  };
}

export function normalizeServiceIntegrationProbeResponse(
  value: unknown,
  expectedKind?: ServiceIntegrationKind,
): ServiceIntegrationProbeResponse {
  if (!isRecord(value) || !isRecord(value.result)) {
    throwInvalidServiceIntegrationResponse();
  }

  const result = value.result;

  if (
    !isServiceIntegrationKind(result.kind) ||
    (expectedKind && result.kind !== expectedKind) ||
    typeof result.configured !== "boolean" ||
    typeof result.enabled !== "boolean" ||
    !isServiceIntegrationProbeOutcome(result.outcome) ||
    typeof result.summary !== "string" ||
    !isDateTime(result.checkedAt) ||
    typeof result.reachable !== "boolean" ||
    typeof result.authenticated !== "boolean" ||
    typeof result.compatible !== "boolean" ||
    !isNullableString(result.version) ||
    !isNullableString(result.webApiVersion) ||
    !isNullableString(result.connectionState)
  ) {
    throwInvalidServiceIntegrationResponse();
  }

  return {
    ...(isServiceIntegrationOperationError(value.error) ? { error: value.error } : {}),
    result: {
      kind: result.kind,
      configured: result.configured,
      enabled: result.enabled,
      outcome: result.outcome,
      summary: result.summary,
      checkedAt: normalizeDateTime(result.checkedAt),
      reachable: result.reachable,
      authenticated: result.authenticated,
      compatible: result.compatible,
      version: result.version,
      webApiVersion: result.webApiVersion,
      connectionState: result.connectionState,
    },
  };
}

export function normalizeApiKeyReveal(value: unknown): ApiKeyReveal {
  if (!isRecord(value) || typeof value.secret !== "string") {
    throwInvalidApiKeyResponse();
  }

  return { apiKey: normalizeApiKeySummary(value.apiKey), secret: value.secret };
}

export function normalizeApiKeyMutationResponse(value: unknown): ApiKeyMutationResponse {
  if (!isRecord(value) || value.status !== "ok") {
    throwInvalidApiKeyResponse();
  }

  return { status: "ok", apiKey: normalizeApiKeySummary(value.apiKey) };
}

function normalizeApiKeySummary(value: unknown): ApiKeySummary {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    typeof value.name !== "string" ||
    !isNullableString(value.description) ||
    typeof value.keyPrefix !== "string" ||
    typeof value.fingerprint !== "string" ||
    typeof value.maskedKey !== "string" ||
    !isApiKeyStatus(value.status) ||
    !isNullableDateTime(value.lastUsedAt) ||
    !isNullableString(value.lastUsedIpAddress) ||
    !isNullableString(value.lastUsedUserAgent) ||
    !isApiKeyCreatedBy(value.createdBy) ||
    !isDateTime(value.createdAt) ||
    !isDateTime(value.updatedAt) ||
    !isNullableDateTime(value.rotatedAt) ||
    !isNullableDateTime(value.deletedAt)
  ) {
    throwInvalidApiKeyResponse();
  }

  return {
    id: value.id,
    name: value.name,
    description: value.description,
    keyPrefix: value.keyPrefix,
    fingerprint: value.fingerprint,
    maskedKey: value.maskedKey,
    status: value.status,
    lastUsedAt: normalizeNullableDateTime(value.lastUsedAt),
    lastUsedIpAddress: value.lastUsedIpAddress,
    lastUsedUserAgent: value.lastUsedUserAgent,
    createdBy: value.createdBy,
    createdAt: normalizeDateTime(value.createdAt),
    updatedAt: normalizeDateTime(value.updatedAt),
    rotatedAt: normalizeNullableDateTime(value.rotatedAt),
    deletedAt: normalizeNullableDateTime(value.deletedAt),
  };
}

function normalizeHelpTicketSummary(value: unknown): HelpTicketListResponse["items"][number] {
  if (
    !isRecord(value) ||
    !isHelpTicketId(value.id) ||
    typeof value.title !== "string" ||
    !isHelpTicketStatus(value.status) ||
    typeof value.attachmentCount !== "number" ||
    !isDateTime(value.createdAt) ||
    !isDateTime(value.updatedAt) ||
    !isRecord(value.createdBy) ||
    typeof value.createdBy.id !== "string" ||
    typeof value.createdBy.username !== "string"
  ) {
    throwInvalidHelpTicketResponse();
  }

  return {
    id: value.id,
    title: value.title,
    status: value.status,
    attachmentCount: readNonNegativeNumber(value.attachmentCount),
    createdAt: normalizeDateTime(value.createdAt),
    updatedAt: normalizeDateTime(value.updatedAt),
    createdBy: {
      id: value.createdBy.id,
      username: value.createdBy.username,
    },
  };
}

function normalizeHelpTicketDetail(value: unknown): HelpTicketDetail {
  if (
    !isRecord(value) ||
    typeof value.description !== "string" ||
    !Array.isArray(value.attachments) ||
    !isDateTime(value.statusUpdatedAt) ||
    !isNullableString(value.statusUpdatedByUserId)
  ) {
    throwInvalidHelpTicketResponse();
  }

  const summary = normalizeHelpTicketSummary(value);

  return {
    ...summary,
    description: value.description,
    attachments: value.attachments.map(normalizeHelpTicketAttachment),
    statusUpdatedAt: normalizeDateTime(value.statusUpdatedAt),
    statusUpdatedByUserId: value.statusUpdatedByUserId,
  };
}

function normalizeHelpTicketAttachment(value: unknown): HelpTicketDetail["attachments"][number] {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    typeof value.originalFileName !== "string" ||
    (value.mediaKind !== "image" && value.mediaKind !== "video") ||
    !isHelpTicketAttachmentMimeType(value.mimeType) ||
    typeof value.sizeBytes !== "number" ||
    typeof value.storedSizeBytes !== "number" ||
    !(value.width === null || typeof value.width === "number") ||
    !(value.height === null || typeof value.height === "number") ||
    !isDateTime(value.createdAt)
  ) {
    throwInvalidHelpTicketResponse();
  }

  return {
    id: value.id,
    originalFileName: value.originalFileName,
    mediaKind: value.mediaKind,
    mimeType: value.mimeType,
    sizeBytes: readNonNegativeNumber(value.sizeBytes),
    storedSizeBytes: readNonNegativeNumber(value.storedSizeBytes),
    width: typeof value.width === "number" ? value.width : null,
    height: typeof value.height === "number" ? value.height : null,
    createdAt: normalizeDateTime(value.createdAt),
  };
}

function normalizeServiceIntegrationSavedConfig(value: unknown): ServiceIntegrationSavedConfig {
  if (!isServiceIntegrationSavedConfigResponse(value)) {
    throwInvalidServiceIntegrationResponse();
  }

  return {
    id: value.id,
    kind: value.kind,
    displayName: value.displayName,
    isDefault: value.isDefault,
    enabled: value.enabled,
    useSsl: value.useSsl,
    host: value.host,
    port: value.port,
    urlBase: value.urlBase,
    authMode: value.authMode,
    username: value.username,
    hasApiKey: value.hasApiKey,
    hasPassword: value.hasPassword,
    lastTestedAt: normalizeNullableDateTime(value.lastTestedAt),
    lastTestOutcome: value.lastTestOutcome,
    lastTestMessage: value.lastTestMessage,
    lastStatusCheckedAt: normalizeNullableDateTime(value.lastStatusCheckedAt),
    lastStatusOutcome: value.lastStatusOutcome,
    lastStatusMessage: value.lastStatusMessage,
    createdAt: normalizeDateTime(value.createdAt),
    updatedAt: normalizeDateTime(value.updatedAt),
  };
}

function normalizeProxyProfileSummary(value: unknown): ProxyProfileSummary {
  if (!isProxyProfileSummaryResponse(value)) {
    throwInvalidProxyProfileResponse();
  }

  return {
    id: value.id,
    kind: value.kind,
    variant: value.variant,
    name: value.name,
    description: value.description,
    enabled: value.enabled,
    scheme: value.scheme,
    host: value.host,
    port: value.port,
    path: value.path,
    requestTimeoutMs: value.requestTimeoutMs,
    sessionName: value.sessionName,
    sessionTtlMinutes: value.sessionTtlMinutes,
    username: value.username,
    hasPassword: value.hasPassword,
    lastTestedAt: normalizeNullableDateTime(value.lastTestedAt),
    lastTestOutcome: value.lastTestOutcome,
    lastTestMessage: value.lastTestMessage,
    createdAt: normalizeDateTime(value.createdAt),
    updatedAt: normalizeDateTime(value.updatedAt),
  };
}

type ServiceIntegrationSavedConfigResponse = {
  authMode: ServiceIntegrationSavedConfig["authMode"];
  createdAt: string | Date;
  displayName: string;
  enabled: boolean;
  hasApiKey: boolean;
  hasPassword: boolean;
  host: string;
  id: string;
  isDefault: boolean;
  kind: ServiceIntegrationKind;
  lastStatusCheckedAt: string | Date | null;
  lastStatusMessage: string | null;
  lastStatusOutcome: ServiceIntegrationSavedConfig["lastStatusOutcome"];
  lastTestedAt: string | Date | null;
  lastTestMessage: string | null;
  lastTestOutcome: ServiceIntegrationSavedConfig["lastTestOutcome"];
  port: number;
  updatedAt: string | Date;
  urlBase: string | null;
  username: string | null;
  useSsl: boolean;
};

function isServiceIntegrationSavedConfigResponse(
  value: unknown,
): value is ServiceIntegrationSavedConfigResponse {
  return (
    isRecord(value) &&
    hasServiceIntegrationIdentityFields(value) &&
    hasServiceIntegrationConnectionFields(value) &&
    hasServiceIntegrationAuthFields(value) &&
    hasServiceIntegrationProbeMetadataFields(value) &&
    isDateTime(value.createdAt) &&
    isDateTime(value.updatedAt)
  );
}

function hasServiceIntegrationIdentityFields(value: Record<string, unknown>): boolean {
  return (
    typeof value.id === "string" &&
    isServiceIntegrationKind(value.kind) &&
    typeof value.displayName === "string" &&
    typeof value.isDefault === "boolean"
  );
}

function hasServiceIntegrationConnectionFields(value: Record<string, unknown>): boolean {
  return (
    typeof value.enabled === "boolean" &&
    typeof value.useSsl === "boolean" &&
    typeof value.host === "string" &&
    typeof value.port === "number" &&
    isNullableString(value.urlBase)
  );
}

function hasServiceIntegrationAuthFields(value: Record<string, unknown>): boolean {
  return (
    isServiceIntegrationAuthMode(value.authMode) &&
    isNullableString(value.username) &&
    typeof value.hasApiKey === "boolean" &&
    typeof value.hasPassword === "boolean"
  );
}

function hasServiceIntegrationProbeMetadataFields(value: Record<string, unknown>): boolean {
  return (
    isNullableDateTime(value.lastTestedAt) &&
    isNullableServiceIntegrationProbeOutcome(value.lastTestOutcome) &&
    isNullableString(value.lastTestMessage) &&
    isNullableDateTime(value.lastStatusCheckedAt) &&
    isNullableServiceIntegrationProbeOutcome(value.lastStatusOutcome) &&
    isNullableString(value.lastStatusMessage)
  );
}

function isApiKeyCreatedBy(value: unknown): value is ApiKeySummary["createdBy"] {
  return (
    value === null ||
    (isRecord(value) && typeof value.id === "string" && typeof value.username === "string")
  );
}

type ProxyProfileSummaryResponse = {
  [K in Exclude<
    keyof ProxyProfileSummary,
    "createdAt" | "lastTestedAt" | "updatedAt"
  >]: ProxyProfileSummary[K];
} & {
  lastTestedAt: string | Date | null;
  createdAt: string | Date;
  updatedAt: string | Date;
};

function isProxyProfileSummaryResponse(value: unknown): value is ProxyProfileSummaryResponse {
  return (
    isRecord(value) &&
    hasProxyProfileIdentityFields(value) &&
    hasProxyProfileConnectionFields(value) &&
    hasProxyProfileSecretFields(value) &&
    hasProxyProfileTestFields(value) &&
    isDateTime(value.createdAt) &&
    isDateTime(value.updatedAt)
  );
}

function hasProxyProfileIdentityFields(value: Record<string, unknown>): boolean {
  return (
    typeof value.id === "string" &&
    isProxyProfileKind(value.kind) &&
    isNullableChallengeSolverVariant(value.variant) &&
    typeof value.name === "string" &&
    isNullableString(value.description) &&
    typeof value.enabled === "boolean"
  );
}

function hasProxyProfileConnectionFields(value: Record<string, unknown>): boolean {
  return (
    isHttpProxyScheme(value.scheme) &&
    typeof value.host === "string" &&
    typeof value.port === "number" &&
    isNullableString(value.path) &&
    typeof value.requestTimeoutMs === "number" &&
    isNullableString(value.sessionName) &&
    !(value.sessionTtlMinutes !== null && typeof value.sessionTtlMinutes !== "number")
  );
}

function hasProxyProfileSecretFields(value: Record<string, unknown>): boolean {
  return isNullableString(value.username) && typeof value.hasPassword === "boolean";
}

function hasProxyProfileTestFields(value: Record<string, unknown>): boolean {
  return (
    isNullableDateTime(value.lastTestedAt) &&
    isNullableProxyProfileTestOutcome(value.lastTestOutcome) &&
    isNullableString(value.lastTestMessage)
  );
}

function isNullableChallengeSolverVariant(value: unknown): value is ChallengeSolverVariant | null {
  return value === null || isChallengeSolverVariant(value);
}

function isNullableProxyProfileTestOutcome(
  value: unknown,
): value is ProxyProfileSummary["lastTestOutcome"] {
  return value === null || isProxyProfileTestOutcome(value);
}

function isNullableServiceIntegrationProbeOutcome(
  value: unknown,
): value is ServiceIntegrationSavedConfig["lastTestOutcome"] {
  return value === null || isServiceIntegrationProbeOutcome(value);
}

function isServiceIntegrationOperationError(
  value: unknown,
): value is NonNullable<ServiceIntegrationProbeResponse["error"]> {
  if (!isRecord(value) || typeof value.code !== "string" || typeof value.message !== "string") {
    return false;
  }

  if (value.fieldErrors === undefined) {
    return true;
  }

  return (
    Array.isArray(value.fieldErrors) &&
    value.fieldErrors.every(
      (entry) =>
        isRecord(entry) &&
        typeof entry.field === "string" &&
        typeof entry.code === "string" &&
        typeof entry.message === "string",
    )
  );
}

function isApiKeyStatus(value: unknown): value is ApiKeyStatus {
  return API_KEY_STATUS_VALUES.some((status) => status === value);
}

function isHelpTicketStatus(value: unknown): value is HelpTicketStatus {
  return HELP_TICKET_STATUS_VALUES.some((status) => status === value);
}

function isHelpTicketAttachmentMimeType(
  value: unknown,
): value is HelpTicketDetail["attachments"][number]["mimeType"] {
  return (
    typeof value === "string" &&
    HELP_TICKET_ACCEPTED_UPLOAD_MIME_TYPES.some((mimeType) => mimeType === value)
  );
}

function throwInvalidApiKeyResponse(): never {
  throw new ApiClientError("API key response was invalid.", 0, "INVALID_API_KEY_RESPONSE");
}

function throwInvalidHelpTicketResponse(): never {
  throw new ApiClientError("Help ticket response was invalid.", 0, "INVALID_HELP_TICKET_RESPONSE");
}

function throwInvalidServiceIntegrationResponse(): never {
  throw new ApiClientError(
    "Service integration response was invalid.",
    0,
    "INVALID_SERVICE_INTEGRATION_RESPONSE",
  );
}

function throwInvalidProxyProfileResponse(): never {
  throw new ApiClientError(
    "Proxy profile response was invalid.",
    0,
    "INVALID_PROXY_PROFILE_RESPONSE",
  );
}

export function normalizeDeleteServiceIntegrationResponse(
  value: unknown,
  expectedKind?: ServiceIntegrationKind,
  expectedId?: string,
): DeleteServiceIntegrationResponse {
  if (
    !isRecord(value) ||
    value.status !== "ok" ||
    typeof value.deletedId !== "string" ||
    !isServiceIntegrationKind(value.deletedKind) ||
    (expectedKind && value.deletedKind !== expectedKind) ||
    (expectedId && value.deletedId !== expectedId)
  ) {
    throwInvalidServiceIntegrationResponse();
  }

  return { status: "ok", deletedId: value.deletedId, deletedKind: value.deletedKind };
}

export function requireServiceIntegrationConfig(
  response: ServiceIntegrationResponse,
  kind: ServiceIntegrationKind,
): ServiceIntegrationSavedConfig {
  if (!response.integration || response.integration.kind !== kind) {
    throwInvalidServiceIntegrationResponse();
  }

  return response.integration;
}

export function requireServiceIntegrationConfigById(
  response: ServiceIntegrationResponse,
  integrationId: string,
): ServiceIntegrationSavedConfig {
  if (!response.integration || response.integration.id !== integrationId) {
    throwInvalidServiceIntegrationResponse();
  }

  return response.integration;
}

export function normalizeNotificationHistoryItem(value: unknown): NotificationHistoryItem {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    !isToastNotificationId(value.eventId) ||
    typeof value.title !== "string" ||
    !isNullableString(value.description) ||
    !isToastNotificationSeverity(value.severity) ||
    !isToastNotificationImportance(value.importance) ||
    !isNullableDateTime(value.readAt) ||
    !isDateTime(value.createdAt)
  ) {
    throwInvalidNotificationHistoryResponse();
  }

  return {
    id: value.id,
    eventId: value.eventId,
    title: value.title,
    description: value.description,
    severity: value.severity,
    importance: value.importance,
    readAt: normalizeNullableDateTime(value.readAt),
    createdAt: normalizeDateTime(value.createdAt),
  };
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function readPositiveNumber(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 1) {
    throwInvalidNotificationHistoryResponse();
  }

  return value;
}

function readNonNegativeNumber(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throwInvalidNotificationHistoryResponse();
  }

  return value;
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

const isoDateTimePattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;

function isDateTime(value: unknown): value is string | Date {
  return (
    (typeof value === "string" && isIsoDateTimeString(value)) ||
    (value instanceof Date && !Number.isNaN(value.getTime()))
  );
}

function isIsoDateTimeString(value: string): boolean {
  if (!isoDateTimePattern.test(value)) {
    return false;
  }

  const parsedDate = new Date(value);
  const normalizedValue = value.includes(".") ? value : value.replace("Z", ".000Z");

  return !Number.isNaN(parsedDate.getTime()) && parsedDate.toISOString() === normalizedValue;
}

function isNullableDateTime(value: unknown): value is string | Date | null {
  return value === null || isDateTime(value);
}

function normalizeDateTime(value: string | Date): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function normalizeNullableDateTime(value: string | Date | null): string | null {
  return value === null ? null : normalizeDateTime(value);
}

function throwInvalidNotificationHistoryResponse(): never {
  throw new ApiClientError(
    "Notification history response was invalid.",
    0,
    "INVALID_NOTIFICATION_HISTORY_RESPONSE",
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function normalizeManagedUserSummary(user: {
  authMethod?: unknown;
  createdAt: string;
  disabledAt: string | null;
  id: string;
  permissions: unknown;
  updatedAt: string;
  username: string;
}): AdminUserSummary {
  return {
    ...user,
    authMethod: isAuthMethod(user.authMethod) ? user.authMethod : "local",
    permissions: normalizePermissions(user.permissions),
  };
}

export function normalizeManagedUserProfile(user: {
  authMethod?: unknown;
  avatarId: unknown;
  bannerId: unknown;
  createdAt: string;
  disabledAt: string | null;
  email: string;
  id: string;
  lastLoginAt: string | null;
  permissions: unknown;
  updatedAt: string;
  username: string;
}): ManagedUserProfile {
  return {
    ...user,
    authMethod: isAuthMethod(user.authMethod) ? user.authMethod : "local",
    avatarId: isProfileAvatarId(user.avatarId) ? user.avatarId : DEFAULT_PROFILE_AVATAR_ID,
    bannerId: isProfileBannerId(user.bannerId) ? user.bannerId : DEFAULT_PROFILE_BANNER_ID,
    permissions: normalizePermissions(user.permissions),
  };
}
