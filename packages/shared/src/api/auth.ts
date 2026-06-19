import type { PermissionCatalogEntry, UserPermission } from "./permissions";
import type { ProfileAvatarId, ProfileBannerId } from "./profile-media";

export const NOTIFICATION_FREQUENCY_VALUES = ["all", "minimal"] as const;

export type NotificationFrequency = (typeof NOTIFICATION_FREQUENCY_VALUES)[number];

export type NotificationPreferences = {
  toastsEnabled: boolean;
  frequency: NotificationFrequency;
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
