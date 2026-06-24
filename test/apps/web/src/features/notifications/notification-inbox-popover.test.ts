import { describe, expect, it } from "bun:test";

const workspaceRoot = new URL("../../../../../../", import.meta.url);
const inboxSourceUrl = new URL(
  "apps/web/src/features/notifications/notification-inbox-popover.tsx",
  workspaceRoot,
);
const notificationSeverityBadgeSourceUrl = new URL(
  "apps/web/src/features/notifications/notification-severity-badge.tsx",
  workspaceRoot,
);
const scrollAreaSourceUrl = new URL("apps/web/src/components/ui/scroll-area.tsx", workspaceRoot);

describe("notification inbox popover", () => {
  it("keeps the history panel compact on mobile while preserving desktop sizing", async () => {
    const source = await Bun.file(inboxSourceUrl).text();

    expect(source).toContain("w-[min(calc(100vw-4rem),20rem)]");
    expect(source).toContain("sm:w-[min(calc(100vw-2rem),24rem)]");
    expect(source).toContain("max-h-[min(22rem,calc(100vh-4rem))]");
    expect(source).toContain("sm:max-h-[min(32rem,calc(100vh-4rem))]");
    expect(source).toContain("flex-col overflow-hidden");
    expect(source).toContain("min-h-0 flex-1");
  });

  it("uses shadcn popover, scroll area, and existing data hooks", async () => {
    const source = await Bun.file(inboxSourceUrl).text();

    expect(source).toContain("Popover");
    expect(source).toContain("PopoverContent");
    expect(source).toContain("PopoverTrigger");
    expect(source).toContain("ScrollArea");
    expect(source).toContain("useNotificationHistoryQuery");
    expect(source).toContain("useMarkNotificationReadMutation");
    expect(source).toContain("useClearNotificationHistoryMutation");
  });

  it("uses a shared notification severity badge instead of local variant branching", async () => {
    const source = await Bun.file(inboxSourceUrl).text();

    expect(source).toContain("NotificationSeverityBadge");
    expect(source).not.toContain("getSeverityBadge(");
    expect(source).not.toContain("variant={getSeverityBadge(notification)}");
  });

  it("keeps the shared scroll area shrinkable inside bounded popovers", async () => {
    const source = await Bun.file(scrollAreaSourceUrl).text();

    expect(source).toContain("flex min-h-0 flex-col overflow-hidden");
    expect(source).toContain("min-h-0 flex-1 rounded-[inherit]");
  });

  it("defines shared muted severity tones for success, warning, error, and info", async () => {
    const source = await Bun.file(notificationSeverityBadgeSourceUrl).text();

    expect(source).toContain("severity: ToastNotificationSeverity");
    expect(source).toContain('case "success"');
    expect(source).toContain('case "warning"');
    expect(source).toContain('case "error"');
    expect(source).toContain('case "info"');
    expect(source).toContain("toastPalette.greenBg");
    expect(source).toContain("toastPalette.redBg");
    expect(source).toContain("toastPalette.yellowBg");
    expect(source).toContain("notificationSeverityBadgeInfoClasses");
  });

  it("covers accessible bell, badge, and panel states", async () => {
    const source = await Bun.file(inboxSourceUrl).text();

    expect(source).toContain("Open notifications");
    expect(source).toContain("formatUnreadCount");
    expect(source).toContain('"99+"');
    expect(source).toContain("Notifications");
    expect(source).toContain("No notifications yet");
    expect(source).toContain("Couldn’t load notifications.");
    expect(source).toContain("Clear all");
    expect(source).toContain("Loading notifications");
    expect(source).toContain("Unread notification");
    expect(source).toContain("Read notification");
    expect(source).toContain("wrap-break-word");
    expect(source).toContain("min-w-0");
  });
});
