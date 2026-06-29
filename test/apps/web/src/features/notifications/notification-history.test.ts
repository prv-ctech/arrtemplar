import { describe, expect, it } from "bun:test";
import type { NotificationHistoryItem, NotificationHistoryListResponse } from "@arrtemplar/shared";
import {
  clearNotificationHistoryList,
  markNotificationReadInList,
  notificationHistoryQueryOptions,
  useClearNotificationHistoryMutation,
  useMarkNotificationReadMutation,
  useNotificationHistoryQuery,
} from "../../../../../../apps/web/src/features/notifications/notification-history";

const baseNotification = {
  eventId: "profile.identity.updated",
  title: "Profile updated.",
  description: null,
  severity: "success",
  importance: "standard",
  createdAt: "2026-06-19T12:00:00.000Z",
} satisfies Omit<NotificationHistoryItem, "id" | "readAt">;

const unreadNotification = {
  ...baseNotification,
  id: "unread-notification",
  readAt: null,
} satisfies NotificationHistoryItem;

const readNotification = {
  ...baseNotification,
  id: "read-notification",
  readAt: "2026-06-19T12:01:00.000Z",
} satisfies NotificationHistoryItem;

const historyList = {
  notifications: [unreadNotification, readNotification],
  unreadCount: 1,
  pagination: { page: 1, pageSize: 25, totalItems: 2, totalPages: 1 },
} satisfies NotificationHistoryListResponse;

const workspaceRoot = new URL("../../../../../../", import.meta.url);
const notificationHistorySourceUrl = new URL(
  "apps/web/src/features/notifications/notification-history.ts",
  workspaceRoot,
);

describe("notification history query hooks", () => {
  it("exports the query and mutation hooks used by the inbox UI", () => {
    const queryKey = Array.from(
      notificationHistoryQueryOptions({ page: 2, pageSize: 10 }).queryKey,
    );

    expect(queryKey).toEqual(["notification-history", "list", { page: 2, pageSize: 10 }]);
    expect(typeof useNotificationHistoryQuery).toBe("function");
    expect(typeof useMarkNotificationReadMutation).toBe("function");
    expect(typeof useClearNotificationHistoryMutation).toBe("function");
  });

  it("keeps history query keys separate from preference keys", async () => {
    const source = await Bun.file(notificationHistorySourceUrl).text();

    expect(source).toContain("notificationHistoryKeys");
    expect(source).toContain('["notification-history"]');
    expect(source).not.toContain('["notification-preferences"]');
  });

  it("uses TanStack Query with optimistic read and clear mutations", async () => {
    const source = await Bun.file(notificationHistorySourceUrl).text();

    expect(source).toContain("useNotificationHistoryQuery");
    expect(source).toContain("useMarkNotificationReadMutation");
    expect(source).toContain("useClearNotificationHistoryMutation");
    expect(source).toContain("queryClient.cancelQueries");
    expect(source).toContain("queryClient.setQueriesData");
    expect(source).toContain("queryClient.invalidateQueries");
    expect(source).toContain("previousHistoryLists");
  });

  it("marks only unread cached notifications as read", () => {
    const updated = markNotificationReadInList(
      historyList,
      unreadNotification.id,
      "2026-06-19T12:02:00.000Z",
    );

    expect(updated.unreadCount).toBe(0);
    expect(updated.notifications[0]?.readAt).toBe("2026-06-19T12:02:00.000Z");
    expect(updated.notifications[1]).toBe(readNotification);
  });

  it("does not decrement unread count for already-read cached notifications", () => {
    const updated = markNotificationReadInList(
      historyList,
      readNotification.id,
      "2026-06-19T12:03:00.000Z",
    );

    expect(updated.unreadCount).toBe(1);
    expect(updated.notifications[1]).toBe(readNotification);
  });

  it("clears cached notification history pages", () => {
    const cleared = clearNotificationHistoryList(historyList);

    expect(cleared?.notifications).toEqual([]);
    expect(cleared?.unreadCount).toBe(0);
    expect(cleared?.pagination).toEqual({ page: 1, pageSize: 25, totalItems: 0, totalPages: 0 });
  });
});
