import type { PermissionCatalogEntry, UserPermission } from "./permissions";
import type { ProfileAvatarId, ProfileBannerId } from "./profile-media";

export const AUTH_PROVIDER_SLUGS = ["authentik"] as const;

export type AuthProviderSlug = (typeof AUTH_PROVIDER_SLUGS)[number];

export const AUTH_METHOD_VALUES = ["local", "oauth"] as const;

export type AuthMethod = (typeof AUTH_METHOD_VALUES)[number];

export const AUTH_API_ROUTES = {
  oauthStart: "/api/auth/oauth/:provider/start",
  oauthCallback: "/api/auth/callback/:provider",
  providers: "/api/auth/providers",
  provider: "/api/auth/providers/:slug",
  identitiesMe: "/api/auth/identities/me",
} as const;

export type AuthProviderSummary = {
  slug: AuthProviderSlug;
  label: string;
  issuer: string;
  clientId: string;
  scopes: string;
  redirectUris: string[];
  enabled: boolean;
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

export type AuthUpsertProviderRequest = {
  label: string;
  issuer: string;
  clientId: string;
  clientSecret?: string;
  scopes: string;
  redirectUris: string[];
  enabled: boolean;
};

export type AuthPatchProviderRequest = Partial<AuthUpsertProviderRequest>;

export type AuthIdentity = {
  id: string;
  provider: AuthProviderSlug;
  issuer: string;
  subject: string;
  createdAt: string;
};

export type AuthIdentitiesResponse = {
  identities: AuthIdentity[];
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
  "auth.sign_out.failed": { severity: "error", importance: "important" },
  "auth.signed_in": { severity: "success", importance: "important" },
  "auth.signed_out": { severity: "success", importance: "standard" },
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

export type CreateUserRequest = CreateLocalUserRequest;

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

export type UpdateManagedUserPasswordRequest = AdminChangeUserPasswordRequest;

export type AdminUpdateUserPermissionsRequest = {
  permissions: UserPermission[];
};

export type UpdateUserPermissionsRequest = AdminUpdateUserPermissionsRequest;

export type AdminDisableUserRequest = Record<string, never>;

export type AdminUpdateUserStatusRequest = {
  disabled: boolean;
};

export type UpdateManagedUserProfileRequest = UpdateUserProfileRequest;
export type UpdateManagedUserStatusRequest = AdminUpdateUserStatusRequest;

export type LoginResponse = {
  user: PublicUser;
};

export type CreateAdminResponse = {
  user: PublicUser;
};

export type CreateLocalUserResponse = {
  user: ManagedUserSummary;
};

export type CreateUserResponse = CreateLocalUserResponse;

export type AdminUsersListResponse = {
  users: AdminUserSummary[];
};

export type ManagedUsersListResponse = {
  users: ManagedUserSummary[];
};

export type AdminUserResponse = {
  user: AdminUserSummary;
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

export type AdminPermissionCatalogResponse = PermissionCatalogResponse;

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

export type ProfileResponse = UserProfileResponse;

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

export type UpdateManagedUserProfileResponse = ManagedUserProfileResponse;

export type LogoutResponse = {
  status: "ok";
};

export type ChangePasswordResponse = {
  status: "ok";
};

export type ApiErrorResponse = {
  error: {
    code: string;
    message: string;
  };
};
