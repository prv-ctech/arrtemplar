import type { NotificationPreferences } from "@arrtemplar/shared";
import { DEFAULT_NOTIFICATION_PREFERENCES } from "@arrtemplar/shared";
import { type ExternalToast, toast } from "sonner";

export type ToastNotificationSeverity = "success" | "info" | "warning" | "error";
export type ToastNotificationImportance = "standard" | "important";

export type ToastNotificationClassification = {
  severity: ToastNotificationSeverity;
  importance: ToastNotificationImportance;
};

export const TOAST_NOTIFICATION_EVENTS = {
  "auth.admin.created": { severity: "success", importance: "important" },
  "auth.sign_out.failed": { severity: "error", importance: "important" },
  "auth.signed_in": { severity: "success", importance: "important" },
  "auth.signed_out": { severity: "success", importance: "standard" },
  "managed_user.identity.failed": { severity: "error", importance: "important" },
  "managed_user.identity.updated": { severity: "success", importance: "standard" },
  "managed_user.media.failed": { severity: "error", importance: "important" },
  "managed_user.media.updated": { severity: "success", importance: "standard" },
  "managed_user.password.changed": { severity: "success", importance: "important" },
  "managed_user.password.failed": { severity: "error", importance: "important" },
  "managed_user.permissions.failed": { severity: "error", importance: "important" },
  "managed_user.permissions.updated": { severity: "success", importance: "important" },
  "profile.identity.update.failed": { severity: "error", importance: "important" },
  "profile.identity.updated": { severity: "success", importance: "standard" },
  "profile.media.failed": { severity: "error", importance: "important" },
  "profile.media.updated": { severity: "success", importance: "standard" },
  "profile.noop": { severity: "info", importance: "standard" },
  "profile.password.changed": { severity: "success", importance: "important" },
  "profile.password.mismatch": { severity: "error", importance: "important" },
  "profile.password.update.failed": { severity: "error", importance: "important" },
  "theme.changed": { severity: "success", importance: "standard" },
  "users.create.failed": { severity: "error", importance: "important" },
  "users.created": { severity: "success", importance: "standard" },
  "users.password.changed": { severity: "success", importance: "important" },
  "users.password.failed": { severity: "error", importance: "important" },
  "users.permissions.failed": { severity: "error", importance: "important" },
  "users.permissions.updated": { severity: "success", importance: "important" },
  "users.status.disabled": { severity: "success", importance: "important" },
  "users.status.failed": { severity: "error", importance: "important" },
  "users.status.restored": { severity: "success", importance: "important" },
} as const satisfies Record<string, ToastNotificationClassification>;

export type ToastNotificationId = keyof typeof TOAST_NOTIFICATION_EVENTS;

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
): void {
  const classification: ToastNotificationClassification = TOAST_NOTIFICATION_EVENTS[event.id];

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

function createToastOptions(event: ToastNotificationEvent): ExternalToast | undefined {
  if (!event.description) {
    return event.options;
  }

  return {
    ...event.options,
    description: event.description,
  };
}
