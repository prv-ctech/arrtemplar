import type { App } from "@arrtemplar/server";
import type {
  AdminChangeUserPasswordRequest,
  AdminUpdateUserPermissionsRequest,
  AdminUpdateUserStatusRequest,
  AdminUserSummary,
  AuthSetupStatusResponse,
  ChangePasswordRequest,
  ChangePasswordResponse,
  CreateAdminRequest,
  CreateAdminResponse,
  CreateLocalUserRequest,
  HealthResponse,
  LoginRequest,
  LoginResponse,
  LogoutResponse,
  ManagedUserProfile,
  PermissionCatalogEntry,
  PublicUser,
  UpdateManagedUserProfileRequest,
  UpdateUserProfileRequest,
  UserPermission,
} from "@arrtemplar/shared";
import {
  CSRF_HEADER_NAME,
  CSRF_HEADER_VALUE,
  DEFAULT_PROFILE_AVATAR_ID,
  DEFAULT_PROFILE_BANNER_ID,
  isProfileAvatarId,
  isProfileBannerId,
  isUserPermission,
  PERMISSION_CATALOG_BY_PERMISSION,
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

export async function logout(): Promise<LogoutResponse> {
  return unwrapData(await api.api.auth.logout.post(), "Logout failed.");
}

export async function getCurrentUser(): Promise<PublicUser | null> {
  const response = unwrapData(await api.api.auth.me.get(), "Auth check failed.");

  return response.user ? normalizePublicUser(response.user) : null;
}

export async function getUserProfile(): Promise<PublicUser> {
  const response = unwrapData(await api.api.profile.get(), "Profile request failed.");

  return normalizePublicUser(response.user);
}

export async function updateUserProfile(input: UpdateUserProfileRequest): Promise<PublicUser> {
  const response = unwrapData(await api.api.profile.put(input), "Profile update failed.");

  return normalizePublicUser(response.user);
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

export function createApiRequestHeaders(
  method: string | undefined,
): Record<string, string> | undefined {
  if (!method || !unsafeMethods.has(method.toUpperCase())) {
    return undefined;
  }

  return { [CSRF_HEADER_NAME]: CSRF_HEADER_VALUE };
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

function normalizePublicUser(user: {
  id: string;
  username: string;
  email: string;
  avatarId: unknown;
  bannerId: unknown;
  createdAt: string;
  lastLoginAt: string | null;
  permissions: unknown;
}): PublicUser {
  return {
    ...user,
    avatarId: isProfileAvatarId(user.avatarId) ? user.avatarId : DEFAULT_PROFILE_AVATAR_ID,
    bannerId: isProfileBannerId(user.bannerId) ? user.bannerId : DEFAULT_PROFILE_BANNER_ID,
    permissions: normalizePermissions(user.permissions),
  };
}

function normalizeManagedUserSummary(user: {
  id: string;
  username: string;
  disabledAt: string | null;
  createdAt: string;
  updatedAt: string;
  permissions: unknown;
}): AdminUserSummary {
  return {
    ...user,
    permissions: normalizePermissions(user.permissions),
  };
}

function normalizeManagedUserProfile(user: {
  id: string;
  username: string;
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
    avatarId: isProfileAvatarId(user.avatarId) ? user.avatarId : DEFAULT_PROFILE_AVATAR_ID,
    bannerId: isProfileBannerId(user.bannerId) ? user.bannerId : DEFAULT_PROFILE_BANNER_ID,
    permissions: normalizePermissions(user.permissions),
  };
}
