import type { PublicUser, UserPermission, UserRole } from "@arrtemplar/shared";
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

export function hasRequiredRole(user: PublicUser, role?: UserRole): boolean {
  return role ? user.role === role : true;
}

export function hasRequiredPermission(user: PublicUser, permission: UserPermission): boolean {
  if (user.role === "admin") {
    return true;
  }

  return user.role === "mod" && user.permissions.includes(permission);
}

export function hasDelegatedAccountPermission(
  user: PublicUser,
  permission: UserPermission,
): boolean {
  return user.role === "mod" && user.permissions.includes(permission);
}
