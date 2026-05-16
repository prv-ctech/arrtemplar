import type { PublicUser, UserRole } from "@arrweeb-anime/shared";
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
    staleTime: 5_000,
  });
}

export function hasRequiredRole(user: PublicUser, role?: UserRole): boolean {
  return role ? user.role === role : true;
}
