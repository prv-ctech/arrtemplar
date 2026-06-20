import { describe, expect, it } from "bun:test";
import {
  notify,
  recordNotificationHistory,
  shouldShowNotification,
  TOAST_NOTIFICATION_EVENTS,
  type ToastNotificationEvent,
  type ToastNotificationHistoryWriter,
} from "../../../../../../apps/web/src/features/notifications/notification-gateway";
import type {
  CreateNotificationHistoryRequest,
  NotificationPreferences,
} from "../../../../../../packages/shared/src";

const workspaceRoot = new URL("../../../../../../", import.meta.url);
const migratedToastCallsitePaths = [
  "apps/web/src/components/auth/LoginForm.tsx",
  "apps/web/src/components/layout/AppShell.tsx",
  "apps/web/src/features/account/AccountSettings.tsx",
  "apps/web/src/features/admin/AdminUsersSettings.tsx",
  "apps/web/src/features/admin/change-user-password-dialog.tsx",
  "apps/web/src/features/admin/create-user-dialog.tsx",
  "apps/web/src/features/admin/edit-user-permissions-dialog.tsx",
  "apps/web/src/features/user/UserProfilePage.tsx",
  "apps/web/src/features/user/UserSettings.tsx",
] as const;

const offPreferences: NotificationPreferences = {
  toastsEnabled: false,
  frequency: "all",
};

const allPreferences: NotificationPreferences = {
  toastsEnabled: true,
  frequency: "all",
};

const minimalPreferences: NotificationPreferences = {
  toastsEnabled: true,
  frequency: "minimal",
};

const standardSuccess = createEvent("success", "standard");
const standardInfo = createEvent("info", "standard");
const importantSuccess = createEvent("success", "important");
const standardWarning = createEvent("warning", "standard");
const standardError = createEvent("error", "standard");

function createEvent(
  severity: "success" | "info" | "warning" | "error",
  importance: "standard" | "important",
) {
  return { severity, importance };
}

describe("notification gateway filtering", () => {
  it("suppresses every toast when toast notifications are disabled", () => {
    for (const event of [
      standardSuccess,
      standardInfo,
      importantSuccess,
      standardWarning,
      standardError,
    ]) {
      expect(shouldShowNotification(offPreferences, event)).toBe(false);
    }
  });

  it("shows standard and important notifications when frequency is all", () => {
    expect(shouldShowNotification(allPreferences, standardSuccess)).toBe(true);
    expect(shouldShowNotification(allPreferences, standardInfo)).toBe(true);
    expect(shouldShowNotification(allPreferences, importantSuccess)).toBe(true);
  });

  it("keeps minimal frequency to important, warning, and error notifications", () => {
    expect(shouldShowNotification(minimalPreferences, standardSuccess)).toBe(false);
    expect(shouldShowNotification(minimalPreferences, standardInfo)).toBe(false);
    expect(shouldShowNotification(minimalPreferences, importantSuccess)).toBe(true);
    expect(shouldShowNotification(minimalPreferences, standardWarning)).toBe(true);
    expect(shouldShowNotification(minimalPreferences, standardError)).toBe(true);
  });
});

describe("notification event taxonomy", () => {
  it("classifies every migrated toast-producing action", () => {
    expect(TOAST_NOTIFICATION_EVENTS).toMatchObject({
      "auth.admin.created": { importance: "important", severity: "success" },
      "auth.sign_out.failed": { importance: "important", severity: "error" },
      "auth.signed_in": { importance: "important", severity: "success" },
      "auth.signed_out": { importance: "standard", severity: "success" },
      "managed_user.identity.updated": { importance: "standard", severity: "success" },
      "managed_user.media.updated": { importance: "standard", severity: "success" },
      "managed_user.password.changed": { importance: "important", severity: "success" },
      "managed_user.permissions.updated": { importance: "important", severity: "success" },
      "profile.identity.updated": { importance: "standard", severity: "success" },
      "profile.media.updated": { importance: "standard", severity: "success" },
      "profile.noop": { importance: "standard", severity: "info" },
      "profile.password.changed": { importance: "important", severity: "success" },
      "profile.password.mismatch": { importance: "important", severity: "error" },
      "theme.changed": { importance: "standard", severity: "success" },
      "users.created": { importance: "standard", severity: "success" },
      "users.password.changed": { importance: "important", severity: "success" },
      "users.permissions.updated": { importance: "important", severity: "success" },
      "users.status.disabled": { importance: "important", severity: "success" },
      "users.status.restored": { importance: "important", severity: "success" },
    });
  });

  it("classifies every migrated failure as important error", () => {
    const failureEvents = Object.entries(TOAST_NOTIFICATION_EVENTS).filter(([id]) =>
      id.endsWith(".failed"),
    );

    expect(failureEvents.length).toBeGreaterThan(0);

    for (const [, event] of failureEvents) {
      expect(event).toEqual({ importance: "important", severity: "error" });
    }
  });
});

describe("notification gateway ownership", () => {
  it("keeps direct Sonner toast calls inside the gateway", async () => {
    const sources = await Promise.all(
      migratedToastCallsitePaths.map(async (path) => ({
        path,
        source: await Bun.file(new URL(path, workspaceRoot)).text(),
      })),
    );

    for (const { path, source } of sources) {
      expect(source).toContain("notify(");
      expect(`${path}\n${source}`).not.toContain('import { toast } from "sonner"');
      expect(`${path}\n${source}`).not.toMatch(
        /\btoast\.(success|error|info|warning|message|loading)\b/,
      );
    }
  });

  it("records history for emitted events before visual toast filtering", () => {
    const records: CreateNotificationHistoryRequest[] = [];
    const writeHistory: ToastNotificationHistoryWriter = async (input) => {
      records.push(input);
    };

    notify(
      { id: "profile.noop", title: "No profile changes.", description: "Already current." },
      offPreferences,
      writeHistory,
    );

    expect(records).toEqual([
      {
        eventId: "profile.noop",
        title: "No profile changes.",
        description: "Already current.",
      },
    ]);
  });

  it("skips gateway history writes for sign-out because the server records logout", () => {
    const records: CreateNotificationHistoryRequest[] = [];

    recordNotificationHistory(createHistoryEvent("auth.signed_out"), async (input) => {
      records.push(input);
    });

    expect(records).toEqual([]);
  });
});

function createHistoryEvent(id: ToastNotificationEvent["id"]): ToastNotificationEvent {
  return { id, title: "History event." };
}
