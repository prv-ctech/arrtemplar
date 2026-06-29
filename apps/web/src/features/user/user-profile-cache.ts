import type { PublicUser } from "@arrtemplar/shared";
import type { QueryClient } from "@tanstack/react-query";
import { authQueryKey } from "../auth/auth-state";

export const userProfileQueryKey = ["user", "profile"] as const;
export function managedUserProfileQueryKey(publicUserId: string) {
  return ["users", "profile", publicUserId] as const;
}

export function syncUpdatedUserProfileCaches(
  queryClient: QueryClient,
  updatedProfile: PublicUser,
): void {
  queryClient.setQueryData(userProfileQueryKey, updatedProfile);
  queryClient.setQueryData(authQueryKey, updatedProfile);
}
