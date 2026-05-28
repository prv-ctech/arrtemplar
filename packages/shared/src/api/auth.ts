import type { AdminPermissionCatalogEntry, UserPermission } from "./permissions";

export const USER_ROLES = ["user", "mod", "admin"] as const;

export type UserRole = (typeof USER_ROLES)[number];
export type ManagedUserRole = Extract<UserRole, "user" | "mod">;

export type PublicUser = {
  id: string;
  username: string;
  email: string;
  role: UserRole;
  permissions: UserPermission[];
  createdAt: string;
  lastLoginAt: string | null;
};

export type AdminUserSummary = {
  id: string;
  username: string;
  role: ManagedUserRole;
  disabledAt: string | null;
  createdAt: string;
  updatedAt: string;
  permissions: UserPermission[];
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
  username?: string;
  email?: string;
};

export type ChangePasswordRequest = {
  currentPassword: string;
  newPassword: string;
};

export type AdminChangeUserPasswordRequest = {
  password: string;
  currentAdminPassword: string;
};

export type AdminChangeUserRoleRequest = {
  role: ManagedUserRole;
  currentAdminPassword: string;
};

export type AdminUpdateUserPermissionsRequest = {
  permissions: UserPermission[];
  currentAdminPassword: string;
};

export type AdminDisableUserRequest = {
  currentAdminPassword: string;
};

export type AdminUpdateUserStatusRequest = {
  disabled: false;
  currentAdminPassword: string;
};

export type LoginResponse = {
  user: PublicUser;
};

export type CreateAdminResponse = {
  user: PublicUser;
};

export type CreateLocalUserResponse = {
  user: PublicUser;
};

export type AdminUsersListResponse = {
  users: AdminUserSummary[];
};

export type AdminUserResponse = {
  user: AdminUserSummary;
};

export type AdminPermissionCatalogResponse = {
  permissions: readonly AdminPermissionCatalogEntry[];
};

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

export type UpdateUserProfileResponse = {
  user: PublicUser;
};

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
