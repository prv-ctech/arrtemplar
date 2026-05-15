import type { PublicUser, UserRole } from "@arrweeb-anime/shared";
import { useQuery } from "@tanstack/react-query";
import { getCurrentUser } from "@/lib/api";

export const authQueryKey = ["auth", "me"] as const;

export function useCurrentUserQuery() {
  return useQuery({
    queryKey: authQueryKey,
    queryFn: getCurrentUser,
    staleTime: 60_000,
  });
}

export function hasRequiredRole(user: PublicUser, role?: UserRole): boolean {
  return role ? user.role === role : true;
}
