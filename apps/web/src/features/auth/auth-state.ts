import { hasPermissionGrant, type PublicUser, type UserPermission } from "@arrtemplar/shared";
import { useQuery } from "@tanstack/react-query";
import { getAuthSetupStatus, getCurrentUser } from "@/lib/api";

export const authQueryKey = ["auth", "me"] as const;
export const authSetupQueryKey = ["auth", "setup"] as const;

export function useCurrentUserQuery() {
  return useQuery({
    queryKey: authQueryKey,
    queryFn: getCurrentUser,
    staleTime: 60_000,
  });
}

export function useAuthSetupQuery() {
  return useQuery({
    queryKey: authSetupQueryKey,
    queryFn: getAuthSetupStatus,
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: "always",
  });
}

export function hasRequiredPermission(user: PublicUser, permission: UserPermission): boolean {
  return hasPermissionGrant(user.permissions, permission);
}

export function hasAnyRequiredPermission(
  user: PublicUser,
  permissions: readonly UserPermission[],
): boolean {
  return permissions.some((permission) => hasRequiredPermission(user, permission));
}

export function canManageUsers(user: PublicUser): boolean {
  return hasRequiredPermission(user, "users:manage");
}

export function canAccessSettings(user: PublicUser): boolean {
  return hasRequiredPermission(user, "settings:view");
}

export function canAccessHelp(user: PublicUser): boolean {
  return hasRequiredPermission(user, "help:view");
}

export function canManageHelpTickets(user: PublicUser): boolean {
  return hasRequiredPermission(user, "help:manage");
}
