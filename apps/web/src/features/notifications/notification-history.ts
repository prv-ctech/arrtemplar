import type { NotificationHistoryItem, NotificationHistoryListResponse } from "@arrtemplar/shared";
import type { QueryClient, QueryKey } from "@tanstack/react-query";
import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  clearNotificationHistory,
  listNotificationHistory,
  markNotificationRead,
  type NotificationHistoryListParams,
} from "@/lib/api";

export const notificationHistoryKeys = {
  all: ["notification-history"] as const,
  lists: () => [...notificationHistoryKeys.all, "list"] as const,
  list: (params: NotificationHistoryListParams = {}) =>
    [...notificationHistoryKeys.lists(), normalizeHistoryListParams(params)] as const,
};

export function notificationHistoryQueryOptions(params: NotificationHistoryListParams = {}) {
  const normalizedParams = normalizeHistoryListParams(params);

  return queryOptions({
    queryKey: notificationHistoryKeys.list(normalizedParams),
    queryFn: () => listNotificationHistory(normalizedParams),
    staleTime: 30_000,
  });
}

export function useNotificationHistoryQuery(params: NotificationHistoryListParams = {}) {
  return useQuery(notificationHistoryQueryOptions(params));
}

export function useMarkNotificationReadMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (notificationId: string) => markNotificationRead(notificationId),
    async onMutate(notificationId) {
      await queryClient.cancelQueries({ queryKey: notificationHistoryKeys.lists() });
      const previousHistoryLists = readNotificationHistoryListSnapshots(queryClient);
      const readAt = new Date().toISOString();

      queryClient.setQueriesData<NotificationHistoryListResponse>(
        { queryKey: notificationHistoryKeys.lists() },
        (current) =>
          current ? markNotificationReadInList(current, notificationId, readAt) : current,
      );

      return { previousHistoryLists };
    },
    onError(_error, _notificationId, context) {
      restoreNotificationHistoryListSnapshots(queryClient, context?.previousHistoryLists ?? []);
    },
    onSuccess(response) {
      queryClient.setQueriesData<NotificationHistoryListResponse>(
        { queryKey: notificationHistoryKeys.lists() },
        (current) =>
          current ? replaceNotificationInList(current, response.notification) : current,
      );
    },
    onSettled() {
      void queryClient.invalidateQueries({ queryKey: notificationHistoryKeys.lists() });
    },
  });
}

export function useClearNotificationHistoryMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: clearNotificationHistory,
    async onMutate() {
      await queryClient.cancelQueries({ queryKey: notificationHistoryKeys.lists() });
      const previousHistoryLists = readNotificationHistoryListSnapshots(queryClient);

      queryClient.setQueriesData<NotificationHistoryListResponse>(
        { queryKey: notificationHistoryKeys.lists() },
        clearNotificationHistoryList,
      );

      return { previousHistoryLists };
    },
    onError(_error, _variables, context) {
      restoreNotificationHistoryListSnapshots(queryClient, context?.previousHistoryLists ?? []);
    },
    onSettled() {
      void queryClient.invalidateQueries({ queryKey: notificationHistoryKeys.lists() });
    },
  });
}

function normalizeHistoryListParams(
  params: NotificationHistoryListParams,
): Required<NotificationHistoryListParams> {
  return {
    page: isPositiveInteger(params.page) ? params.page : 1,
    pageSize: isPositiveInteger(params.pageSize) ? Math.min(params.pageSize, 50) : 25,
  };
}

export function markNotificationReadInList(
  current: NotificationHistoryListResponse,
  notificationId: string,
  readAt: string,
): NotificationHistoryListResponse {
  let changedUnreadItem = false;
  const notifications = current.notifications.map((notification) => {
    if (notification.id !== notificationId || notification.readAt) {
      return notification;
    }

    changedUnreadItem = true;
    return { ...notification, readAt };
  });

  return {
    ...current,
    notifications,
    unreadCount: changedUnreadItem ? Math.max(0, current.unreadCount - 1) : current.unreadCount,
  };
}

function replaceNotificationInList(
  current: NotificationHistoryListResponse,
  nextNotification: NotificationHistoryItem,
): NotificationHistoryListResponse {
  return {
    ...current,
    notifications: current.notifications.map((notification) =>
      notification.id === nextNotification.id ? nextNotification : notification,
    ),
  };
}

export function clearNotificationHistoryList(
  current: NotificationHistoryListResponse | undefined,
): NotificationHistoryListResponse | undefined {
  if (!current) {
    return current;
  }

  return {
    notifications: [],
    unreadCount: 0,
    pagination: {
      ...current.pagination,
      totalItems: 0,
      totalPages: 0,
    },
  };
}

function readNotificationHistoryListSnapshots(queryClient: QueryClient) {
  return queryClient.getQueriesData<NotificationHistoryListResponse>({
    queryKey: notificationHistoryKeys.lists(),
  });
}

function restoreNotificationHistoryListSnapshots(
  queryClient: QueryClient,
  previousHistoryLists: Array<[QueryKey, NotificationHistoryListResponse | undefined]>,
): void {
  for (const [queryKey, data] of previousHistoryLists) {
    queryClient.setQueryData(queryKey, data);
  }
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}
