import type { PermissionCatalogEntry, UserPermission } from "./permissions";
import type { ProfileAvatarId, ProfileBannerId } from "./profile-media";

export const AUTH_PROVIDER_SLUGS = ["oidc"] as const;

export type AuthProviderSlug = (typeof AUTH_PROVIDER_SLUGS)[number];

export const AUTH_PROVIDER_KIND_VALUES = [
  "authentik",
  "authelia",
  "google",
  "keycloak",
  "okta",
  "custom",
] as const;

export type AuthProviderKind = (typeof AUTH_PROVIDER_KIND_VALUES)[number];

export const TOKEN_ENDPOINT_AUTH_METHOD_VALUES = [
  "client_secret_basic",
  "client_secret_post",
  "none",
] as const;

export type TokenEndpointAuthMethod = (typeof TOKEN_ENDPOINT_AUTH_METHOD_VALUES)[number];

export const OIDC_SIGNING_ALGORITHM_VALUES = ["RS256", "ES256"] as const;

export type OidcSigningAlgorithm = (typeof OIDC_SIGNING_ALGORITHM_VALUES)[number];

export const OIDC_PROFILE_SIGNING_ALGORITHM_VALUES = [
  "none",
  ...OIDC_SIGNING_ALGORITHM_VALUES,
] as const;

export type OidcProfileSigningAlgorithm = (typeof OIDC_PROFILE_SIGNING_ALGORITHM_VALUES)[number];

export const AUTH_METHOD_VALUES = ["local", "oauth"] as const;

export type AuthMethod = (typeof AUTH_METHOD_VALUES)[number];

export const AUTH_API_ROUTES = {
  oauthStart: "/api/auth/oauth/:provider/start",
  oauthCallback: "/api/auth/callback/:provider",
  providers: "/api/auth/providers",
  provider: "/api/auth/providers/:slug",
  identitiesMe: "/api/auth/identities/me",
  identities: "/api/auth/identities",
} as const;

export type AuthProviderConfig = {
  providerKind: AuthProviderKind;
  label: string;
  issuer: string;
  clientId: string;
  scopes: string;
  redirectUris: string[];
  enabled: boolean;
  buttonText: string;
  autoRegister: boolean;
  tokenEndpointAuthMethod: TokenEndpointAuthMethod;
  timeoutMs: number;
  prompt: string | null;
  endSessionEndpoint: string | null;
  idTokenSigningAlgorithm: OidcSigningAlgorithm;
  profileSigningAlgorithm: OidcProfileSigningAlgorithm;
  mobileRedirectEnabled: boolean;
  mobileRedirectUri: string | null;
};

export type AuthProviderSummary = AuthProviderConfig & {
  slug: AuthProviderSlug;
  hasClientSecret: boolean;
  createdAt: string;
  updatedAt: string;
};

export type AuthProvidersListResponse = {
  providers: AuthProviderSummary[];
};

export type AuthProviderResponse = {
  provider: AuthProviderSummary;
};

export type AuthUpsertProviderRequest = AuthProviderConfig & {
  clientSecret?: string;
  prompt?: string | null;
  endSessionEndpoint?: string | null;
  mobileRedirectUri?: string | null;
};

export type AuthPatchProviderRequest = Partial<AuthUpsertProviderRequest>;

export type AuthIdentity = {
  id: string;
  provider: AuthProviderSlug;
  providerKind: AuthProviderKind;
  issuer: string;
  subjectPreview: string;
  displayName: string;
  preferredUsername: string | null;
  name: string | null;
  email: string | null;
  createdAt: string;
};

export type AuthIdentitiesResponse = {
  identities: AuthIdentity[];
};

export type AuthUnlinkAllIdentitiesResponse = {
  status: "ok";
  deletedIdentityCount: number;
  revokedOAuthSessionCount: number;
};

export const NOTIFICATION_FREQUENCY_VALUES = ["all", "minimal"] as const;

export type NotificationFrequency = (typeof NOTIFICATION_FREQUENCY_VALUES)[number];

export type NotificationPreferences = {
  toastsEnabled: boolean;
  frequency: NotificationFrequency;
};

export type ToastNotificationSeverity = "success" | "info" | "warning" | "error";
export type ToastNotificationImportance = "standard" | "important";

export const TOAST_NOTIFICATION_SEVERITY_VALUES = [
  "success",
  "info",
  "warning",
  "error",
] as const satisfies readonly ToastNotificationSeverity[];

export const TOAST_NOTIFICATION_IMPORTANCE_VALUES = [
  "standard",
  "important",
] as const satisfies readonly ToastNotificationImportance[];

export type ToastNotificationClassification = {
  severity: ToastNotificationSeverity;
  importance: ToastNotificationImportance;
};

export const TOAST_NOTIFICATION_EVENTS = {
  "auth.admin.created": { severity: "success", importance: "important" },
  "auth.provider.save.failed": { severity: "error", importance: "important" },
  "auth.provider.saved": { severity: "success", importance: "standard" },
  "auth.sign_out.failed": { severity: "error", importance: "important" },
  "auth.signed_in": { severity: "success", importance: "important" },
  "auth.signed_out": { severity: "success", importance: "standard" },
  "help.ticket.create.failed": { severity: "error", importance: "important" },
  "help.ticket.created": { severity: "success", importance: "important" },
  "help.ticket.delete.failed": { severity: "error", importance: "important" },
  "help.ticket.deleted": { severity: "success", importance: "important" },
  "help.ticket.status.failed": { severity: "error", importance: "important" },
  "help.ticket.status.updated": { severity: "success", importance: "standard" },
  "api_keys.create.failed": { severity: "error", importance: "important" },
  "api_keys.created": { severity: "success", importance: "important" },
  "api_keys.delete.failed": { severity: "error", importance: "important" },
  "api_keys.deleted": { severity: "success", importance: "important" },
  "api_keys.revoke.failed": { severity: "error", importance: "important" },
  "api_keys.revoked": { severity: "success", importance: "important" },
  "api_keys.secret.copy.failed": { severity: "error", importance: "important" },
  "api_keys.secret.copied": { severity: "success", importance: "standard" },
  "api_keys.update.failed": { severity: "error", importance: "important" },
  "api_keys.updated": { severity: "success", importance: "important" },
  "managed_user.identity.failed": { severity: "error", importance: "important" },
  "managed_user.identity.updated": { severity: "success", importance: "standard" },
  "managed_user.media.failed": { severity: "error", importance: "important" },
  "managed_user.media.updated": { severity: "success", importance: "standard" },
  "managed_user.password.changed": { severity: "success", importance: "important" },
  "managed_user.password.failed": { severity: "error", importance: "important" },
  "managed_user.permissions.failed": { severity: "error", importance: "important" },
  "managed_user.permissions.updated": { severity: "success", importance: "important" },
  "profile.identity.update.failed": { severity: "error", importance: "important" },
  "profile.identity.updated": { severity: "success", importance: "standard" },
  "profile.media.failed": { severity: "error", importance: "important" },
  "profile.media.updated": { severity: "success", importance: "standard" },
  "profile.noop": { severity: "info", importance: "standard" },
  "profile.password.changed": { severity: "success", importance: "important" },
  "profile.password.mismatch": { severity: "error", importance: "important" },
  "profile.password.update.failed": { severity: "error", importance: "important" },
  "services.add.failed": { severity: "error", importance: "important" },
  "services.added": { severity: "success", importance: "important" },
  "services.delete.failed": { severity: "error", importance: "important" },
  "services.deleted": { severity: "success", importance: "important" },
  "services.save.failed": { severity: "error", importance: "important" },
  "services.saved": { severity: "success", importance: "important" },
  "services.test.failed": { severity: "error", importance: "important" },
  "services.tested": { severity: "success", importance: "standard" },
  "theme.changed": { severity: "success", importance: "standard" },
  "users.create.failed": { severity: "error", importance: "important" },
  "users.created": { severity: "success", importance: "standard" },
  "users.password.changed": { severity: "success", importance: "important" },
  "users.password.failed": { severity: "error", importance: "important" },
  "users.permissions.failed": { severity: "error", importance: "important" },
  "users.permissions.updated": { severity: "success", importance: "important" },
  "users.status.disabled": { severity: "success", importance: "important" },
  "users.status.failed": { severity: "error", importance: "important" },
  "users.status.restored": { severity: "success", importance: "important" },
  "users.deleted": { severity: "success", importance: "important" },
  "users.delete.failed": { severity: "error", importance: "important" },
} as const satisfies Record<string, ToastNotificationClassification>;

export type ToastNotificationId = keyof typeof TOAST_NOTIFICATION_EVENTS;

export const TOAST_NOTIFICATION_EVENT_IDS = Object.keys(
  TOAST_NOTIFICATION_EVENTS,
) as ToastNotificationId[];

export function isToastNotificationId(value: unknown): value is ToastNotificationId {
  return typeof value === "string" && value in TOAST_NOTIFICATION_EVENTS;
}

export function isToastNotificationSeverity(value: unknown): value is ToastNotificationSeverity {
  return (
    typeof value === "string" &&
    TOAST_NOTIFICATION_SEVERITY_VALUES.some((severity) => severity === value)
  );
}

export function isToastNotificationImportance(
  value: unknown,
): value is ToastNotificationImportance {
  return (
    typeof value === "string" &&
    TOAST_NOTIFICATION_IMPORTANCE_VALUES.some((importance) => importance === value)
  );
}

export type NotificationHistoryItem = {
  id: string;
  eventId: ToastNotificationId;
  title: string;
  description: string | null;
  severity: ToastNotificationSeverity;
  importance: ToastNotificationImportance;
  readAt: string | null;
  createdAt: string;
};

export type NotificationHistoryPagination = {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
};

export type NotificationHistoryListResponse = {
  notifications: NotificationHistoryItem[];
  unreadCount: number;
  pagination: NotificationHistoryPagination;
};

export type CreateNotificationHistoryRequest = {
  eventId: ToastNotificationId;
  title: string;
  description?: string;
};

export type MarkNotificationReadRequest = {
  read: true;
};

export type ClearNotificationHistoryResponse = {
  status: "ok";
  deletedCount: number;
};

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  toastsEnabled: true,
  frequency: "all",
};

export type PublicUser = {
  id: string;
  username: string;
  email: string;
  avatarId: ProfileAvatarId;
  bannerId: ProfileBannerId;
  notificationPreferences: NotificationPreferences;
  permissions: UserPermission[];
  createdAt: string;
  lastLoginAt: string | null;
};

export type ManagedUserSummary = {
  id: string;
  username: string;
  authMethod?: AuthMethod;
  disabledAt: string | null;
  createdAt: string;
  updatedAt: string;
  permissions: UserPermission[];
};

export type AdminUserSummary = ManagedUserSummary;

export type ManagedUserProfile = ManagedUserSummary & {
  email: string;
  avatarId: ProfileAvatarId;
  bannerId: ProfileBannerId;
  lastLoginAt: string | null;
};

export type LoginRequest = {
  email: string;
  password: string;
};

export type CreateAdminRequest = {
  username: string;
  email: string;
  password: string;
};

export type CreateLocalUserRequest = {
  username: string;
  email: string;
  password: string;
};

export type UpdateUserProfileRequest = {
  avatarId?: ProfileAvatarId;
  bannerId?: ProfileBannerId;
  username?: string;
  email?: string;
};

export type ChangePasswordRequest = {
  currentPassword: string;
  newPassword: string;
};

export type UpdateNotificationPreferencesRequest = NotificationPreferences;

export type AdminChangeUserPasswordRequest = {
  password: string;
};

export type AdminUpdateUserPermissionsRequest = {
  permissions: UserPermission[];
};

export type AdminDisableUserRequest = Record<string, never>;

export type AdminUpdateUserStatusRequest = {
  disabled: boolean;
};

export type UpdateManagedUserProfileRequest = UpdateUserProfileRequest;

export type LoginResponse = {
  user: PublicUser;
};

export type CreateAdminResponse = {
  user: PublicUser;
};

export type CreateLocalUserResponse = {
  user: ManagedUserSummary;
};

export type ManagedUsersListResponse = {
  users: ManagedUserSummary[];
};

export type ManagedUserResponse = {
  user: ManagedUserSummary;
};

export type ManagedUserProfileResponse = {
  user: ManagedUserProfile;
};

export type PermissionCatalogResponse = {
  permissions: readonly PermissionCatalogEntry[];
};

export type AdminChangeUserPasswordResponse = {
  status: "ok";
};

export type AdminDeleteUserResponse = {
  status: "ok";
  deletedUserId: string;
};

export type DeleteManagedUserResponse = AdminDeleteUserResponse;

export type AuthSetupStatusResponse = {
  required: boolean;
};

export type AuthUserResponse = {
  user: PublicUser | null;
};

export type UserProfileResponse = {
  user: PublicUser;
};

export type UpdateUserProfileResponse = {
  user: PublicUser;
};

export type NotificationPreferencesResponse = {
  notificationPreferences: NotificationPreferences;
};

export type CreateNotificationHistoryResponse = {
  notification: NotificationHistoryItem;
};

export type MarkNotificationReadResponse = {
  notification: NotificationHistoryItem;
};

export type UpdateNotificationPreferencesResponse = NotificationPreferencesResponse;

export type LogoutResponse = {
  status: "ok";
  redirectUri?: string;
};

export type ChangePasswordResponse = {
  status: "ok";
};

export type ApiErrorResponse = {
  error: {
    code: string;
    message: string;
    fieldErrors?: Array<{
      field: string;
      code: string;
      message: string;
    }>;
  };
};
