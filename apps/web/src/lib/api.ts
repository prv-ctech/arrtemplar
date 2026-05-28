import type { App } from "@arrtemplar/server";
import type {
  AdminChangeUserPasswordRequest,
  AdminChangeUserPasswordResponse,
  AdminChangeUserRoleRequest,
  AdminDisableUserRequest,
  AdminPermissionCatalogEntry,
  AdminPermissionCatalogResponse,
  AdminUpdateUserPermissionsRequest,
  AdminUpdateUserStatusRequest,
  AdminUserResponse,
  AdminUserSummary,
  AdminUsersListResponse,
  AuthSetupStatusResponse,
  AuthUserResponse,
  ChangePasswordRequest,
  ChangePasswordResponse,
  CreateAdminRequest,
  CreateAdminResponse,
  CreateLocalUserRequest,
  CreateLocalUserResponse,
  HealthResponse,
  LoginRequest,
  LoginResponse,
  LogoutResponse,
  PublicUser,
  UpdateUserProfileRequest,
  UpdateUserProfileResponse,
  UserProfileResponse,
} from "@arrtemplar/shared";
import { CSRF_HEADER_NAME, CSRF_HEADER_VALUE } from "@arrtemplar/shared";
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
  return unwrapData(await api.api.auth.login.post(input), "Login failed.");
}

export async function getAuthSetupStatus(): Promise<AuthSetupStatusResponse> {
  return unwrapData(await api.api.auth.setup.get(), "Setup status check failed.");
}

export async function createInitialAdmin(input: CreateAdminRequest): Promise<CreateAdminResponse> {
  return unwrapData(await api.api.auth.setup.post(input), "Admin setup failed.");
}

export async function logout(): Promise<LogoutResponse> {
  return unwrapData(await api.api.auth.logout.post(), "Logout failed.");
}

export async function getCurrentUser(): Promise<PublicUser | null> {
  const response = unwrapData<AuthUserResponse>(await api.api.auth.me.get(), "Auth check failed.");

  return response.user;
}

export async function getUserProfile(): Promise<PublicUser> {
  const response = unwrapData<UserProfileResponse>(
    await api.api.user.profile.get(),
    "Profile request failed.",
  );

  return response.user;
}

export async function updateUserProfile(input: UpdateUserProfileRequest): Promise<PublicUser> {
  const response = unwrapData<UpdateUserProfileResponse>(
    await api.api.user.profile.put(input),
    "Profile update failed.",
  );

  return response.user;
}

export async function changePassword(
  input: ChangePasswordRequest,
): Promise<ChangePasswordResponse> {
  return unwrapData(await api.api.user.password.put(input), "Password update failed.");
}

export async function listAdminUsers(): Promise<AdminUserSummary[]> {
  const response = unwrapData<AdminUsersListResponse>(
    await api.api.admin.users.get(),
    "Admin users request failed.",
  );

  return response.users;
}

export async function getAdminPermissionCatalog(): Promise<readonly AdminPermissionCatalogEntry[]> {
  const response = unwrapData<AdminPermissionCatalogResponse>(
    await api.api.admin["permission-catalog"].get(),
    "Admin permission catalog request failed.",
  );

  return response.permissions;
}

export async function createAdminUser(input: CreateLocalUserRequest): Promise<PublicUser> {
  const response = unwrapData<CreateLocalUserResponse>(
    await api.api.admin.users.post(input),
    "Admin user creation failed.",
  );

  return response.user;
}

export async function changeAdminUserPassword(
  userId: string,
  input: AdminChangeUserPasswordRequest,
): Promise<AdminChangeUserPasswordResponse> {
  return unwrapData(
    await api.api.admin.users({ id: userId }).password.patch(input),
    "Admin password update failed.",
  );
}

export async function changeAdminUserRole(
  userId: string,
  input: AdminChangeUserRoleRequest,
): Promise<AdminUserSummary> {
  const response = unwrapData<AdminUserResponse>(
    await api.api.admin.users({ id: userId }).role.patch(input),
    "Admin role update failed.",
  );

  return response.user;
}

export async function updateAdminUserPermissions(
  userId: string,
  input: AdminUpdateUserPermissionsRequest,
): Promise<AdminUserSummary> {
  const response = unwrapData<AdminUserResponse>(
    await api.api.admin.users({ id: userId }).permissions.patch(input),
    "Admin permission update failed.",
  );

  return response.user;
}

export async function disableAdminUser(
  userId: string,
  input: AdminDisableUserRequest,
): Promise<AdminUserSummary> {
  const response = unwrapData<AdminUserResponse>(
    await api.api.admin.users({ id: userId }).delete(input),
    "Admin user removal failed.",
  );

  return response.user;
}

export async function enableAdminUser(
  userId: string,
  input: AdminUpdateUserStatusRequest,
): Promise<AdminUserSummary> {
  const response = unwrapData<AdminUserResponse>(
    await api.api.admin.users({ id: userId }).status.patch(input),
    "Admin user restore failed.",
  );

  return response.user;
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
