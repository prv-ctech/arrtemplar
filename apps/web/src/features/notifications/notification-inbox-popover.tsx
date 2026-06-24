import type { NotificationHistoryItem } from "@arrtemplar/shared";
import {
  BellIcon,
  CheckCircleIcon,
  InfoIcon,
  TrashIcon,
  WarningCircleIcon,
  XCircleIcon,
} from "@phosphor-icons/react";
import type { ComponentProps } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useClearNotificationHistoryMutation,
  useMarkNotificationReadMutation,
  useNotificationHistoryQuery,
} from "@/features/notifications/notification-history";
import { NotificationSeverityBadge } from "@/features/notifications/notification-severity-badge";
import { cn } from "@/lib/utils";

type NotificationInboxPopoverProps = {
  className?: string;
  side?: PopoverSide;
};

type PopoverSide = NonNullable<ComponentProps<typeof PopoverContent>["side"]>;

const bellButtonClasses = [
  "relative size-9 rounded-full border border-border bg-card/62 text-muted-foreground",
  "shadow-(--shadow-soft) hover:border-primary/50 hover:bg-accent hover:text-foreground",
].join(" ");

const panelClasses = [
  "flex w-[min(calc(100vw-4rem),20rem)] max-h-[min(22rem,calc(100vh-4rem))] flex-col overflow-hidden p-0",
  "sm:w-[min(calc(100vw-2rem),24rem)] sm:max-h-[min(32rem,calc(100vh-4rem))]",
  "rounded-2xl border-border bg-popover text-popover-foreground shadow-(--shadow-panel)",
].join(" ");

const notificationInboxSkeletonRows = [
  "notification-skeleton-row-1",
  "notification-skeleton-row-2",
  "notification-skeleton-row-3",
] as const;

const notificationTimeFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

type NotificationInboxControls = ReturnType<typeof useNotificationInboxControls>;

export function NotificationInboxPopover({
  className,
  side = "bottom",
}: NotificationInboxPopoverProps) {
  const controls = useNotificationInboxControls();

  return (
    <Popover>
      <NotificationInboxTrigger
        className={className}
        unreadCount={controls.unreadCount}
        unreadLabel={controls.unreadLabel}
      />
      <NotificationInboxPanel controls={controls} side={side} />
    </Popover>
  );
}

function useNotificationInboxControls() {
  const historyQuery = useNotificationHistoryQuery({ page: 1, pageSize: 25 });
  const markReadMutation = useMarkNotificationReadMutation();
  const clearMutation = useClearNotificationHistoryMutation();
  const history = historyQuery.data;
  const notifications = history?.notifications ?? [];
  const unreadCount = history?.unreadCount ?? 0;
  const hasNotifications = notifications.length > 0;
  const unreadLabel = formatUnreadCount(unreadCount);

  function handleClearAll() {
    if (hasNotifications && !clearMutation.isPending) {
      clearMutation.mutate();
    }
  }

  function handleMarkRead(notification: NotificationHistoryItem) {
    if (!notification.readAt && !markReadMutation.isPending) {
      markReadMutation.mutate(notification.id);
    }
  }

  function handleRetry() {
    historyQuery.refetch();
  }

  return {
    clearMutation,
    handleClearAll,
    handleMarkRead,
    handleRetry,
    hasNotifications,
    historyError: historyQuery.error,
    isHistoryLoading: historyQuery.isPending,
    markReadMutation,
    notifications,
    totalItems: history?.pagination.totalItems ?? 0,
    unreadCount,
    unreadLabel,
  };
}

function NotificationInboxTrigger({
  className,
  unreadCount,
  unreadLabel,
}: {
  className?: string | undefined;
  unreadCount: number;
  unreadLabel: string;
}) {
  return (
    <PopoverTrigger asChild>
      <Button
        aria-label={getNotificationInboxTriggerLabel(unreadCount, unreadLabel)}
        className={cn(bellButtonClasses, className)}
        size="icon"
        variant="ghost"
      >
        <BellIcon aria-hidden="true" className="size-4" />
        <NotificationUnreadBadge unreadCount={unreadCount} unreadLabel={unreadLabel} />
      </Button>
    </PopoverTrigger>
  );
}

function NotificationUnreadBadge({
  unreadCount,
  unreadLabel,
}: {
  unreadCount: number;
  unreadLabel: string;
}) {
  if (unreadCount === 0) {
    return null;
  }

  return (
    <Badge className="absolute -top-1 -right-1 h-5 min-w-5 px-1 text-[10px] leading-none">
      {unreadLabel}
    </Badge>
  );
}

function NotificationInboxPanel({
  controls,
  side,
}: {
  controls: NotificationInboxControls;
  side: PopoverSide;
}) {
  return (
    <PopoverContent align="end" className={panelClasses} side={side} sideOffset={10}>
      <NotificationInboxHeader
        hasNotifications={controls.hasNotifications}
        isClearing={controls.clearMutation.isPending}
        onClearAll={controls.handleClearAll}
        unreadCount={controls.unreadCount}
      />
      <Separator />
      <ScrollArea className="min-h-0 flex-1">
        <div className="min-w-0 p-2">
          <NotificationInboxContent
            error={controls.historyError}
            isLoading={controls.isHistoryLoading}
            markReadMutation={controls.markReadMutation}
            notifications={controls.notifications}
            onMarkRead={controls.handleMarkRead}
            onRetry={controls.handleRetry}
          />
        </div>
      </ScrollArea>
      <NotificationInboxFooter
        loadedCount={controls.notifications.length}
        totalItems={controls.totalItems}
      />
    </PopoverContent>
  );
}

function getNotificationInboxTriggerLabel(unreadCount: number, unreadLabel: string) {
  return unreadCount > 0 ? `Open notifications, ${unreadLabel} unread` : "Open notifications";
}

function NotificationInboxHeader({
  hasNotifications,
  isClearing,
  onClearAll,
  unreadCount,
}: {
  hasNotifications: boolean;
  isClearing: boolean;
  onClearAll: () => void;
  unreadCount: number;
}) {
  return (
    <div className="flex min-w-0 items-start justify-between gap-3 p-4">
      <div className="min-w-0 space-y-1">
        <h2 className="text-sm font-semibold tracking-tight text-foreground">Notifications</h2>
        <p className="text-xs text-muted-foreground">
          {unreadCount > 0 ? `${formatUnreadCount(unreadCount)} unread` : "All caught up"}
        </p>
      </div>
      <Button
        className="h-8 shrink-0 px-2.5 text-xs"
        disabled={!hasNotifications || isClearing}
        onClick={onClearAll}
        type="button"
        variant="ghost"
      >
        <TrashIcon aria-hidden="true" className="size-3.5" />
        {isClearing ? "Clearing" : "Clear all"}
      </Button>
    </div>
  );
}

function NotificationInboxContent({
  error,
  isLoading,
  markReadMutation,
  notifications,
  onMarkRead,
  onRetry,
}: {
  error: unknown;
  isLoading: boolean;
  markReadMutation: ReturnType<typeof useMarkNotificationReadMutation>;
  notifications: NotificationHistoryItem[];
  onMarkRead: (notification: NotificationHistoryItem) => void;
  onRetry: () => void;
}) {
  if (isLoading) {
    return <NotificationInboxSkeleton />;
  }

  if (error) {
    return <NotificationInboxError onRetry={onRetry} />;
  }

  if (notifications.length === 0) {
    return <NotificationInboxEmpty />;
  }

  return (
    <ul className="space-y-1" aria-label="Notification history">
      {notifications.map((notification) => (
        <li key={notification.id}>
          <NotificationHistoryRow
            isPending={markReadMutation.isPending && markReadMutation.variables === notification.id}
            notification={notification}
            onMarkRead={onMarkRead}
          />
        </li>
      ))}
    </ul>
  );
}

function NotificationHistoryRow({
  isPending,
  notification,
  onMarkRead,
}: {
  isPending: boolean;
  notification: NotificationHistoryItem;
  onMarkRead: (notification: NotificationHistoryItem) => void;
}) {
  const isUnread = !notification.readAt;

  return (
    <button
      className={cn(
        "flex w-full min-w-0 items-start gap-3 rounded-xl border border-transparent p-2.5 text-left outline-none transition-colors hover:border-border hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60",
        isUnread && "bg-primary/6",
      )}
      disabled={isPending}
      onClick={() => onMarkRead(notification)}
      type="button"
    >
      <NotificationSeverityIcon notification={notification} />
      <NotificationHistoryRowBody isUnread={isUnread} notification={notification} />
    </button>
  );
}

function NotificationHistoryRowBody({
  isUnread,
  notification,
}: {
  isUnread: boolean;
  notification: NotificationHistoryItem;
}) {
  return (
    <span className="min-w-0 flex-1 space-y-1">
      <span className="sr-only">{isUnread ? "Unread notification" : "Read notification"}</span>
      <NotificationHistoryTitle isUnread={isUnread} title={notification.title} />
      <NotificationHistoryDescription description={notification.description} />
      <NotificationHistoryMeta notification={notification} />
    </span>
  );
}

function NotificationHistoryTitle({ isUnread, title }: { isUnread: boolean; title: string }) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      <span className="min-w-0 flex-1 wrap-break-word text-sm font-medium text-foreground">
        {title}
      </span>
      {isUnread ? <span className="size-2 rounded-full bg-primary" aria-hidden="true" /> : null}
    </span>
  );
}

function NotificationHistoryDescription({ description }: { description?: string | null }) {
  if (!description) {
    return null;
  }

  return (
    <span className="block min-w-0 wrap-break-word text-xs leading-5 text-muted-foreground">
      {description}
    </span>
  );
}

function NotificationHistoryMeta({ notification }: { notification: NotificationHistoryItem }) {
  return (
    <span className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
      <span>{formatNotificationTime(notification.createdAt)}</span>
      <NotificationSeverityBadge severity={notification.severity} />
    </span>
  );
}

function NotificationSeverityIcon({ notification }: { notification: NotificationHistoryItem }) {
  const Icon = getSeverityIcon(notification.severity);

  return (
    <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full border border-border bg-card text-muted-foreground">
      <Icon aria-hidden="true" className="size-4" />
    </span>
  );
}

function NotificationInboxSkeleton() {
  return (
    <output className="block space-y-2">
      <span className="sr-only">Loading notifications</span>
      {notificationInboxSkeletonRows.map((skeletonRowId) => (
        <div className="flex items-start gap-3 rounded-xl p-2.5" key={skeletonRowId}>
          <Skeleton className="size-8 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-full" />
          </div>
        </div>
      ))}
    </output>
  );
}

function NotificationInboxEmpty() {
  return (
    <div className="grid min-h-40 place-items-center rounded-xl border border-dashed border-border p-6 text-center">
      <div className="max-w-56 space-y-2">
        <p className="text-sm font-medium text-foreground">No notifications yet</p>
        <p className="text-xs leading-5 text-muted-foreground">
          New app activity will collect here even when toast alerts are muted.
        </p>
      </div>
    </div>
  );
}

function NotificationInboxError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="grid min-h-40 place-items-center rounded-xl border border-border p-6 text-center">
      <div className="max-w-56 space-y-3">
        <p className="text-sm font-medium text-foreground">Couldn’t load notifications.</p>
        <p className="text-xs leading-5 text-muted-foreground">Try again to refresh the inbox.</p>
        <Button className="h-8 px-3 text-xs" onClick={onRetry} type="button" variant="outline">
          Retry
        </Button>
      </div>
    </div>
  );
}

function NotificationInboxFooter({
  loadedCount,
  totalItems,
}: {
  loadedCount: number;
  totalItems: number;
}) {
  if (totalItems <= loadedCount || totalItems === 0) {
    return null;
  }

  return (
    <>
      <Separator />
      <p className="px-4 py-3 text-xs text-muted-foreground">
        Showing newest {loadedCount} of {totalItems}.
      </p>
    </>
  );
}

function formatUnreadCount(count: number): string {
  return count > 99 ? "99+" : count.toString();
}

function formatNotificationTime(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Just now";
  }

  return notificationTimeFormatter.format(date);
}

function getSeverityIcon(severity: NotificationHistoryItem["severity"]) {
  switch (severity) {
    case "success":
      return CheckCircleIcon;
    case "warning":
      return WarningCircleIcon;
    case "error":
      return XCircleIcon;
    case "info":
      return InfoIcon;
  }
}
