import type { ToastNotificationSeverity } from "@arrtemplar/shared";
import type { ComponentProps, CSSProperties } from "react";
import { Badge } from "@/components/ui/badge";
import { toastPalette } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";

const notificationSeverityBadgeBaseClasses = [
  "px-1.5 py-0 text-[10px] capitalize",
  "border-[color:var(--notification-badge-border)]",
  "bg-[color:var(--notification-badge-bg)]",
  "text-[color:var(--notification-badge-text)]",
].join(" ");

const notificationSeverityBadgeInfoClasses =
  "px-1.5 py-0 text-[10px] border-border bg-secondary text-secondary-foreground capitalize";

type NotificationSeverityBadgeProps = Omit<ComponentProps<typeof Badge>, "variant"> & {
  severity: ToastNotificationSeverity;
};

export function NotificationSeverityBadge({
  children,
  className,
  severity,
  style,
  ...props
}: NotificationSeverityBadgeProps) {
  const severityStyle = readNotificationSeverityBadgeStyle(severity);

  return (
    <Badge
      className={cn(
        severity === "info"
          ? notificationSeverityBadgeInfoClasses
          : notificationSeverityBadgeBaseClasses,
        className,
      )}
      style={severityStyle ? { ...severityStyle, ...style } : style}
      variant="outline"
      {...props}
    >
      {children ?? severity}
    </Badge>
  );
}

function readNotificationSeverityBadgeStyle(
  severity: ToastNotificationSeverity,
): CSSProperties | undefined {
  switch (severity) {
    case "success":
      return createNotificationSeverityBadgeStyle(
        toastPalette.greenBg,
        toastPalette.greenBorder,
        toastPalette.greenText,
      );
    case "warning":
      return createNotificationSeverityBadgeStyle(
        toastPalette.yellowBg,
        toastPalette.yellowBorder,
        toastPalette.yellowText,
      );
    case "error":
      return createNotificationSeverityBadgeStyle(
        toastPalette.redBg,
        toastPalette.redBorder,
        toastPalette.redText,
      );
    case "info":
      return undefined;
  }
}

function createNotificationSeverityBadgeStyle(
  backgroundColor: string,
  borderColor: string,
  textColor: string,
): CSSProperties {
  return {
    "--notification-badge-bg": backgroundColor,
    "--notification-badge-border": borderColor,
    "--notification-badge-text": textColor,
  } as CSSProperties;
}
