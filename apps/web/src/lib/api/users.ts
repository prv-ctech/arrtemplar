import type { App } from "@arrtemplar/server";
import type {
  AdminChangeUserPasswordRequest,
  AdminDeleteUserResponse,
  AdminUpdateUserPermissionsRequest,
  AdminUpdateUserStatusRequest,
  AdminUserSummary,
  ChangePasswordResponse,
  CreateLocalUserRequest,
  ManagedUserProfile,
  PermissionCatalogEntry,
  UpdateManagedUserProfileRequest,
} from "@arrtemplar/shared";
import { isUserPermission, PERMISSION_CATALOG_BY_PERMISSION } from "@arrtemplar/shared";
import type { Treaty } from "@elysia/eden/treaty2";
import { getApiClient, unwrapData } from "./client";
import { normalizeManagedUserProfile, normalizeManagedUserSummary } from "./normalizers";

const api = getApiClient<Treaty.Create<App>>();

export async function listUsers(): Promise<AdminUserSummary[]> {
  const response = unwrapData(await api.api.users.get(), "Users request failed.");

  return response.users.map(normalizeManagedUserSummary);
}

export async function getPermissionCatalog(): Promise<readonly PermissionCatalogEntry[]> {
  const response = unwrapData(
    await api.api.permissions.catalog.get(),
    "Permission catalog request failed.",
  );

  return response.permissions.flatMap((entry) => {
    if (typeof entry.permission !== "string" || !isUserPermission(entry.permission)) {
      return [];
    }

    const catalogEntry = PERMISSION_CATALOG_BY_PERMISSION.get(entry.permission);

    return catalogEntry ? [catalogEntry] : [];
  });
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
