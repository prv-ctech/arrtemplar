import { describe, expect, it } from "bun:test";

const workspaceRoot = new URL("../../../../../../", import.meta.url);
const inboxSourceUrl = new URL(
  "apps/web/src/features/notifications/notification-inbox-popover.tsx",
  workspaceRoot,
);

describe("notification inbox popover", () => {
  it("keeps the history panel compact on mobile while preserving desktop sizing", async () => {
    const source = await Bun.file(inboxSourceUrl).text();

    expect(source).toContain("w-[min(calc(100vw-4rem),20rem)]");
    expect(source).toContain("sm:w-[min(calc(100vw-2rem),24rem)]");
    expect(source).toContain("max-h-[min(18rem,calc(100vh-14rem))]");
    expect(source).toContain("sm:max-h-[min(28rem,calc(100vh-12rem))]");
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
