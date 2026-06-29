import type {
  CreateNotificationHistoryRequest,
  NotificationPreferences,
  ToastNotificationClassification,
  ToastNotificationId,
} from "@arrtemplar/shared";
import { DEFAULT_NOTIFICATION_PREFERENCES, TOAST_NOTIFICATION_EVENTS } from "@arrtemplar/shared";
import { type ExternalToast, toast } from "sonner";
import { notificationHistoryKeys } from "@/features/notifications/notification-history";
import { createNotificationHistory } from "@/lib/api";
import { queryClient } from "@/lib/query-client";

export type { ToastNotificationClassification, ToastNotificationId };
export { TOAST_NOTIFICATION_EVENTS };

export type ToastNotificationHistoryWriter = (
  input: CreateNotificationHistoryRequest,
) => Promise<unknown>;

export type ToastNotificationEvent = {
  id: ToastNotificationId;
  title: string;
  description?: string;
  options?: ExternalToast;
};

export function shouldShowNotification(
  preferences: NotificationPreferences,
  event: ToastNotificationClassification,
): boolean {
  if (!preferences.toastsEnabled) {
    return false;
  }

  if (preferences.frequency === "all") {
    return true;
  }

  return (
    event.importance === "important" || event.severity === "warning" || event.severity === "error"
  );
}

export function notify(
  event: ToastNotificationEvent,
  preferences: NotificationPreferences = DEFAULT_NOTIFICATION_PREFERENCES,
  writeHistory: ToastNotificationHistoryWriter = createNotificationHistory,
): void {
  const classification: ToastNotificationClassification = TOAST_NOTIFICATION_EVENTS[event.id];

  recordNotificationHistory(event, writeHistory);

  if (!shouldShowNotification(preferences, classification)) {
    return;
  }

  const options = createToastOptions(event);

  switch (classification.severity) {
    case "success":
      toast.success(event.title, options);
      return;
    case "warning":
      toast.warning(event.title, options);
      return;
    case "error":
      toast.error(event.title, options);
      return;
    case "info":
      toast.info(event.title, options);
      return;
  }
}

export function recordNotificationHistory(
  event: ToastNotificationEvent,
  writeHistory: ToastNotificationHistoryWriter = createNotificationHistory,
): void {
  if (event.id === "auth.signed_out") {
    return;
  }

  const input: CreateNotificationHistoryRequest = {
    eventId: event.id,
    title: event.title,
    ...(event.description ? { description: event.description } : {}),
  };

  void writeHistory(input)
    .then(() => queryClient.invalidateQueries({ queryKey: notificationHistoryKeys.lists() }))
    .catch(() => undefined);
}

function createToastOptions(event: ToastNotificationEvent): ExternalToast | undefined {
  if (!event.description) {
    return event.options;
  }

  return {
    ...event.options,
    description: event.description,
  };
}
