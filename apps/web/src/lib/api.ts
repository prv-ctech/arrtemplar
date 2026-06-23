import type { App } from "@arrtemplar/server";
import type {
  AdminChangeUserPasswordRequest,
  AdminDeleteUserResponse,
  AdminUpdateUserPermissionsRequest,
  AdminUpdateUserStatusRequest,
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
  AuthSetupStatusResponse,
  AuthUnlinkAllIdentitiesResponse,
  AuthUpsertProviderRequest,
  ChangePasswordRequest,
  ChangePasswordResponse,
  ClearNotificationHistoryResponse,
  CreateAdminRequest,
  CreateAdminResponse,
  CreateApiKeyRequest,
  CreateLocalUserRequest,
  CreateNotificationHistoryRequest,
  CreateNotificationHistoryResponse,
  HealthResponse,
  LoginRequest,
  LoginResponse,
  LogoutResponse,
  ManagedUserProfile,
  MarkNotificationReadRequest,
  MarkNotificationReadResponse,
  NotificationHistoryItem,
  NotificationHistoryListResponse,
  NotificationPreferences,
  PermissionCatalogEntry,
  PublicUser,
  UpdateApiKeyRequest,
  UpdateManagedUserProfileRequest,
  UpdateNotificationPreferencesRequest,
  UpdateUserProfileRequest,
  UserPermission,
} from "@arrtemplar/shared";
import {
  API_KEY_STATUS_VALUES,
  AUTH_PROVIDER_KIND_VALUES,
  AUTH_PROVIDER_SLUGS,
  CSRF_HEADER_NAME,
  CSRF_HEADER_VALUE,
  DEFAULT_NOTIFICATION_PREFERENCES,
  DEFAULT_PROFILE_AVATAR_ID,
  DEFAULT_PROFILE_BANNER_ID,
  isProfileAvatarId,
  isProfileBannerId,
  isToastNotificationId,
  isToastNotificationImportance,
  isToastNotificationSeverity,
  isUserPermission,
  OIDC_PROFILE_SIGNING_ALGORITHM_VALUES,
  OIDC_SIGNING_ALGORITHM_VALUES,
  PERMISSION_CATALOG_BY_PERMISSION,
  TOKEN_ENDPOINT_AUTH_METHOD_VALUES,
} from "@arrtemplar/shared";
import { treaty } from "@elysia/eden";
import { resolveApiBaseUrl } from "./api-base-url";
import { ApiClientError, getApiErrorCode, getApiErrorMessage } from "./api-error";

const apiBaseUrl = resolveApiBaseUrl(import.meta.env.VITE_API_BASE_URL);
const unsafeMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);

const api = treaty<App>(apiBaseUrl, {
  fetch: {
    credentials: "include",
  },
  onRequest(_path, options) {
    const headers = createApiRequestHeaders(options.method);

    return headers ? { headers } : undefined;
  },
});

type EdenResult<T> = {
  data: T | null;
  error: unknown;
  status: number;
};

export type LogoutResult =
  | { kind: "local"; response: LogoutResponse }
  | { kind: "sso"; redirectUri: string; response: LogoutResponse };

export type NotificationHistoryListParams = {
  page?: number;
  pageSize?: number;
};

export async function getHealth(): Promise<HealthResponse> {
  return unwrapData(await api.health.get(), "Health request failed.");
}

export async function login(input: LoginRequest): Promise<LoginResponse> {
  const response = unwrapData(await api.api.auth.login.post(input), "Login failed.");

  return { user: normalizePublicUser(response.user) };
}

export async function getAuthSetupStatus(): Promise<AuthSetupStatusResponse> {
  return unwrapData(await api.api.auth.setup.get(), "Setup status check failed.");
}

export async function createInitialAdmin(input: CreateAdminRequest): Promise<CreateAdminResponse> {
  const response = unwrapData(await api.api.auth.setup.post(input), "Admin setup failed.");

  return { user: normalizePublicUser(response.user) };
}

export async function logout(): Promise<LogoutResult> {
  const headers = createApiRequestHeaders("POST");
  const response = await fetch(resolveApiRequestUrl("/api/auth/logout"), {
    method: "POST",
    credentials: "include",
    ...(headers ? { headers } : {}),
  });

  if (!response.ok) {
    throw await createApiClientErrorFromResponse(response, "Logout failed.");
  }

  const body = await readJsonResponse(response);

  if (!isLogoutResponse(body)) {
    throw new ApiClientError("Logout failed.", response.status);
  }

  if (body.redirectUri) {
    return { kind: "sso", redirectUri: body.redirectUri, response: body };
  }

  return { kind: "local", response: body };
}

export async function getCurrentUser(): Promise<PublicUser | null> {
  const response = unwrapData(await api.api.auth.me.get(), "Auth check failed.");

  return response.user ? normalizePublicUser(response.user) : null;
}

export async function listAuthProviders(): Promise<AuthProviderSummary[]> {
  const response = unwrapData(await api.api.auth.providers.get(), "Auth providers request failed.");

  return response.providers.map(normalizeAuthProviderSummary);
}

export async function upsertAuthProvider(
  slug: AuthProviderSlug,
  input: AuthUpsertProviderRequest,
): Promise<AuthProviderSummary> {
  const response = unwrapData(
    await api.api.auth.providers({ slug }).put(input),
    "Auth provider save failed.",
  );

  return normalizeAuthProviderSummary(response.provider);
}

export async function listAuthIdentities(): Promise<AuthIdentity[]> {
  const response = unwrapData(
    await api.api.auth.identities.me.get(),
    "Linked auth identities request failed.",
  );

  return response.identities.map(normalizeAuthIdentity);
}

export async function unlinkAllAuthIdentities(): Promise<AuthUnlinkAllIdentitiesResponse> {
  const headers = createApiRequestHeaders("DELETE");
  const response = await fetch(resolveApiRequestUrl("/api/auth/identities"), {
    method: "DELETE",
    credentials: "include",
    ...(headers ? { headers } : {}),
  });

  if (!response.ok) {
    throw await createApiClientErrorFromResponse(response, "OAuth unlink-all failed.");
  }

  const body = await readJsonResponse(response);

  if (!isAuthUnlinkAllIdentitiesResponse(body)) {
    throw new ApiClientError("OAuth unlink-all failed.", response.status);
  }

  return body;
}

export async function getUserProfile(): Promise<PublicUser> {
  const response = unwrapData(await api.api.profile.get(), "Profile request failed.");

  return normalizePublicUser(response.user);
}

export async function updateUserProfile(input: UpdateUserProfileRequest): Promise<PublicUser> {
  const response = unwrapData(await api.api.profile.put(input), "Profile update failed.");

  return normalizePublicUser(response.user);
}

export async function getNotificationPreferences(): Promise<NotificationPreferences> {
  const response = unwrapData(
    await api.api.profile.notifications.get(),
    "Notification preferences request failed.",
  );

  return normalizeNotificationPreferences(response.notificationPreferences);
}

export async function updateNotificationPreferences(
  input: UpdateNotificationPreferencesRequest,
): Promise<NotificationPreferences> {
  const response = unwrapData(
    await api.api.profile.notifications.put(input),
    "Notification preferences update failed.",
  );

  return normalizeNotificationPreferences(response.notificationPreferences);
}

export async function listNotificationHistory(
  input: NotificationHistoryListParams = {},
): Promise<NotificationHistoryListResponse> {
  const response = unwrapData(
    await api.api.profile.notifications.history.get({
      query: normalizeNotificationHistoryQuery(input),
    }),
    "Notification history request failed.",
  );

  return normalizeNotificationHistoryListResponse(response);
}

export async function createNotificationHistory(
  input: CreateNotificationHistoryRequest,
): Promise<CreateNotificationHistoryResponse> {
  const response = unwrapData(
    await api.api.profile.notifications.history.post(input),
    "Notification history creation failed.",
  );

  return { notification: normalizeNotificationHistoryItem(response.notification) };
}

export async function markNotificationRead(
  notificationId: string,
): Promise<MarkNotificationReadResponse> {
  const request: MarkNotificationReadRequest = { read: true };
  const response = unwrapData(
    await api.api.profile.notifications.history({ notificationId }).patch(request),
    "Notification history read update failed.",
  );

  return { notification: normalizeNotificationHistoryItem(response.notification) };
}

export async function clearNotificationHistory(): Promise<ClearNotificationHistoryResponse> {
  return unwrapData(
    await api.api.profile.notifications.history.delete(),
    "Notification history clear failed.",
  );
}

export async function changePassword(
  input: ChangePasswordRequest,
): Promise<ChangePasswordResponse> {
  return unwrapData(await api.api.profile.password.put(input), "Password update failed.");
}

export async function listUsers(): Promise<AdminUserSummary[]> {
  const response = unwrapData(await api.api.users.get(), "Users request failed.");

  return response.users.map(normalizeManagedUserSummary);
}

export async function getPermissionCatalog(): Promise<readonly PermissionCatalogEntry[]> {
  const response = unwrapData(
    await api.api.permissions.catalog.get(),
    "Permission catalog request failed.",
  );

  return response.permissions
    .map((entry) => {
      if (typeof entry.permission !== "string" || !isUserPermission(entry.permission)) {
        return undefined;
      }

      return PERMISSION_CATALOG_BY_PERMISSION.get(entry.permission);
    })
    .filter((entry): entry is PermissionCatalogEntry => Boolean(entry));
}

export async function listApiKeys(): Promise<ApiKeySummary[]> {
  const response = await requestApiJson({
    fallback: "API keys request failed.",
    method: "GET",
    path: "/api/api-keys",
  });

  return normalizeApiKeyListResponse(response).apiKeys;
}

export async function createApiKey(input: CreateApiKeyRequest): Promise<ApiKeyReveal> {
  const response = await requestApiJson({
    body: input,
    fallback: "API key creation failed.",
    method: "POST",
    path: "/api/api-keys",
  });

  return normalizeApiKeyReveal(response);
}

export async function updateApiKey(
  apiKeyId: string,
  input: UpdateApiKeyRequest,
): Promise<ApiKeySummary> {
  const response = await requestApiJson({
    body: input,
    fallback: "API key update failed.",
    method: "PUT",
    path: `/api/api-keys/${encodeURIComponent(apiKeyId)}`,
  });

  return normalizeApiKeyMutationResponse(response).apiKey;
}

export async function revokeApiKey(apiKeyId: string): Promise<ApiKeySummary> {
  const response = await requestApiJson({
    body: {},
    fallback: "API key revoke failed.",
    method: "POST",
    path: `/api/api-keys/${encodeURIComponent(apiKeyId)}/revoke`,
  });

  return normalizeApiKeyMutationResponse(response).apiKey;
}

export async function deleteApiKey(apiKeyId: string): Promise<ApiKeySummary> {
  const response = await requestApiJson({
    fallback: "API key delete failed.",
    method: "DELETE",
    path: `/api/api-keys/${encodeURIComponent(apiKeyId)}`,
  });

  return normalizeApiKeyMutationResponse(response).apiKey;
}

export async function createUser(input: CreateLocalUserRequest): Promise<AdminUserSummary> {
  const response = unwrapData(await api.api.users.post(input), "User creation failed.");

  return normalizeManagedUserSummary(response.user);
}

export async function getManagedUserProfile(userId: string): Promise<ManagedUserProfile> {
  const response = unwrapData(
    await api.api.users({ publicUserId: userId }).get(),
    "Managed user profile request failed.",
  );

  return normalizeManagedUserProfile(response.user);
}

export async function updateManagedUserProfile(
  userId: string,
  input: UpdateManagedUserProfileRequest,
): Promise<ManagedUserProfile> {
  const response = unwrapData(
    await api.api.users({ publicUserId: userId }).settings.main.put(input),
    "Managed user profile update failed.",
  );

  return normalizeManagedUserProfile(response.user);
}

export async function changeManagedUserPassword(
  userId: string,
  input: AdminChangeUserPasswordRequest,
): Promise<ChangePasswordResponse> {
  return unwrapData(
    await api.api.users({ publicUserId: userId }).settings.password.put(input),
    "Managed user password update failed.",
  );
}

export async function updateManagedUserPermissions(
  userId: string,
  input: AdminUpdateUserPermissionsRequest,
): Promise<AdminUserSummary> {
  const response = unwrapData(
    await api.api.users({ publicUserId: userId }).settings.permissions.put(input),
    "Managed user permission update failed.",
  );

  return normalizeManagedUserSummary(response.user);
}

export async function updateManagedUserStatus(
  userId: string,
  input: AdminUpdateUserStatusRequest,
): Promise<AdminUserSummary> {
  const response = unwrapData(
    await api.api.users({ publicUserId: userId }).status.patch(input),
    "Managed user status update failed.",
  );

  return normalizeManagedUserSummary(response.user);
}

export async function deleteManagedUser(userId: string): Promise<AdminDeleteUserResponse> {
  return unwrapData(
    await api.api.users({ publicUserId: userId }).delete(),
    "Managed user delete failed.",
  );
}

export function createApiRequestHeaders(
  method: string | undefined,
): Record<string, string> | undefined {
  if (!method || !unsafeMethods.has(method.toUpperCase())) {
    return undefined;
  }

  return { [CSRF_HEADER_NAME]: CSRF_HEADER_VALUE };
}

type ApiJsonRequest = {
  body?: unknown;
  fallback: string;
  method: "DELETE" | "GET" | "POST" | "PUT";
  path: string;
};

async function requestApiJson({ body, fallback, method, path }: ApiJsonRequest): Promise<unknown> {
  const csrfHeaders = createApiRequestHeaders(method);
  const headers = new Headers(csrfHeaders);

  if (body !== undefined) {
    headers.set("content-type", "application/json");
  }

  const response = await fetch(resolveApiRequestUrl(path), {
    method,
    credentials: "include",
    headers,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

  if (!response.ok) {
    throw await createApiClientErrorFromResponse(response, fallback);
  }

  return readJsonResponse(response);
}

function resolveApiRequestUrl(path: string): string {
  return apiBaseUrl ? new URL(path, apiBaseUrl).toString() : path;
}

async function createApiClientErrorFromResponse(
  response: Response,
  fallback: string,
): Promise<ApiClientError> {
  const body = await readJsonResponse(response);

  return new ApiClientError(
    getApiErrorMessage(body, fallback),
    response.status,
    getApiErrorCode(body),
  );
}

async function readJsonResponse(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function isLogoutResponse(value: unknown): value is LogoutResponse {
  return (
    isRecord(value) &&
    value.status === "ok" &&
    (value.redirectUri === undefined ||
      (typeof value.redirectUri === "string" && value.redirectUri.length > 0))
  );
}

function unwrapData<T>({ data, error, status }: EdenResult<T>, fallback: string): T {
  if (error) {
    throw new ApiClientError(getApiErrorMessage(error, fallback), status, getApiErrorCode(error));
  }

  if (data === null) {
    throw new ApiClientError(fallback, status);
  }

  return data;
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

function normalizeAuthProviderSummary(provider: {
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

function normalizeAuthIdentity(identity: {
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

function isAuthUnlinkAllIdentitiesResponse(
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

function normalizePublicUser(user: {
  id: string;
  username: string;
  email: string;
  avatarId: unknown;
  bannerId: unknown;
  notificationPreferences?: unknown;
  createdAt: string;
  lastLoginAt: string | null;
  permissions: unknown;
}): PublicUser {
  return {
    ...user,
    avatarId: isProfileAvatarId(user.avatarId) ? user.avatarId : DEFAULT_PROFILE_AVATAR_ID,
    bannerId: isProfileBannerId(user.bannerId) ? user.bannerId : DEFAULT_PROFILE_BANNER_ID,
    notificationPreferences: normalizeNotificationPreferences(user.notificationPreferences),
    permissions: normalizePermissions(user.permissions),
  };
}

function normalizeNotificationPreferences(value: unknown): NotificationPreferences {
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

function normalizeNotificationHistoryQuery(
  input: NotificationHistoryListParams,
): NotificationHistoryListParams {
  return {
    ...(isPositiveInteger(input.page) ? { page: input.page } : {}),
    ...(isPositiveInteger(input.pageSize) ? { pageSize: input.pageSize } : {}),
  };
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

function normalizeApiKeyReveal(value: unknown): ApiKeyReveal {
  if (!isRecord(value) || typeof value.secret !== "string") {
    throwInvalidApiKeyResponse();
  }

  return { apiKey: normalizeApiKeySummary(value.apiKey), secret: value.secret };
}

function normalizeApiKeyMutationResponse(value: unknown): ApiKeyMutationResponse {
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
    typeof value.prefix !== "string" ||
    typeof value.maskedKey !== "string" ||
    !isApiKeyStatus(value.status) ||
    !Array.isArray(value.permissions) ||
    typeof value.permissionCount !== "number" ||
    !isNullableDateTime(value.expiresAt) ||
    !isStringArray(value.ipAllowlist) ||
    !isNullableDateTime(value.lastUsedAt) ||
    !isNullableString(value.lastUsedIpAddress) ||
    !isNullableString(value.lastUsedUserAgent) ||
    !isApiKeyCreatedBy(value.createdBy) ||
    !isDateTime(value.createdAt) ||
    !isDateTime(value.updatedAt) ||
    !isNullableDateTime(value.revokedAt)
  ) {
    throwInvalidApiKeyResponse();
  }

  return {
    id: value.id,
    name: value.name,
    description: value.description,
    prefix: value.prefix,
    maskedKey: value.maskedKey,
    status: value.status,
    permissions: normalizePermissions(value.permissions),
    permissionCount: value.permissionCount,
    expiresAt: normalizeNullableDateTime(value.expiresAt),
    ipAllowlist: value.ipAllowlist,
    lastUsedAt: normalizeNullableDateTime(value.lastUsedAt),
    lastUsedIpAddress: value.lastUsedIpAddress,
    lastUsedUserAgent: value.lastUsedUserAgent,
    createdBy: value.createdBy,
    createdAt: normalizeDateTime(value.createdAt),
    updatedAt: normalizeDateTime(value.updatedAt),
    revokedAt: normalizeNullableDateTime(value.revokedAt),
  };
}

function isApiKeyCreatedBy(value: unknown): value is ApiKeySummary["createdBy"] {
  return (
    value === null ||
    (isRecord(value) && typeof value.id === "string" && typeof value.username === "string")
  );
}

function isApiKeyStatus(value: unknown): value is ApiKeyStatus {
  return API_KEY_STATUS_VALUES.some((status) => status === value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string");
}

function throwInvalidApiKeyResponse(): never {
  throw new ApiClientError("API key response was invalid.", 0, "INVALID_API_KEY_RESPONSE");
}

function normalizeNotificationHistoryItem(value: unknown): NotificationHistoryItem {
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

function normalizeManagedUserSummary(user: {
  id: string;
  username: string;
  authMethod?: unknown;
  disabledAt: string | null;
  createdAt: string;
  updatedAt: string;
  permissions: unknown;
}): AdminUserSummary {
  return {
    ...user,
    authMethod: isAuthMethod(user.authMethod) ? user.authMethod : "local",
    permissions: normalizePermissions(user.permissions),
  };
}

function normalizeManagedUserProfile(user: {
  id: string;
  username: string;
  authMethod?: unknown;
  email: string;
  avatarId: unknown;
  bannerId: unknown;
  disabledAt: string | null;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
  permissions: unknown;
}): ManagedUserProfile {
  return {
    ...user,
    authMethod: isAuthMethod(user.authMethod) ? user.authMethod : "local",
    avatarId: isProfileAvatarId(user.avatarId) ? user.avatarId : DEFAULT_PROFILE_AVATAR_ID,
    bannerId: isProfileBannerId(user.bannerId) ? user.bannerId : DEFAULT_PROFILE_BANNER_ID,
    permissions: normalizePermissions(user.permissions),
  };
}
