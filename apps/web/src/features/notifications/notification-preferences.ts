import type {
  NotificationPreferences,
  PublicUser,
  UpdateNotificationPreferencesRequest,
} from "@arrtemplar/shared";
import type { QueryClient } from "@tanstack/react-query";
import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { authQueryKey } from "@/features/auth/auth-state";
import { userProfileQueryKey } from "@/features/user/user-profile-cache";
import { getNotificationPreferences, updateNotificationPreferences } from "@/lib/api";

const notificationPreferenceKeys = {
  all: ["notification-preferences"] as const,
  current: () => [...notificationPreferenceKeys.all, "current"] as const,
};

function notificationPreferencesQueryOptions(initialData?: NotificationPreferences) {
  const baseOptions = {
    queryKey: notificationPreferenceKeys.current(),
    queryFn: getNotificationPreferences,
    staleTime: 60_000,
  };

  return initialData ? queryOptions({ ...baseOptions, initialData }) : queryOptions(baseOptions);
}

export function useNotificationPreferencesQuery(initialData: NotificationPreferences) {
  return useQuery(notificationPreferencesQueryOptions(initialData));
}

export function useUpdateNotificationPreferencesMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateNotificationPreferencesRequest) =>
      updateNotificationPreferences(input),
    async onSuccess(notificationPreferences) {
      syncNotificationPreferenceCaches(queryClient, notificationPreferences);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: authQueryKey }),
        queryClient.invalidateQueries({ queryKey: userProfileQueryKey }),
      ]);
    },
  });
}

function syncNotificationPreferenceCaches(
  queryClient: QueryClient,
  notificationPreferences: NotificationPreferences,
): void {
  queryClient.setQueryData(notificationPreferenceKeys.current(), notificationPreferences);
  queryClient.setQueryData<PublicUser | null>(authQueryKey, (currentUser) =>
    mergeNotificationPreferences(currentUser, notificationPreferences),
  );
  queryClient.setQueryData<PublicUser>(userProfileQueryKey, (currentUser) =>
    mergeNotificationPreferences(currentUser, notificationPreferences),
  );
}

function mergeNotificationPreferences<TUser extends PublicUser | null | undefined>(
  user: TUser,
  notificationPreferences: NotificationPreferences,
): TUser {
  if (!user) {
    return user;
  }

  return { ...user, notificationPreferences };
}
