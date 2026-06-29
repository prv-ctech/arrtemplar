import type { ToastNotificationSeverity } from "@arrtemplar/shared";
import type { ComponentProps, CSSProperties } from "react";
import { Badge } from "@/components/ui/badge";
import { toastPalette } from "@/components/ui/toast-palette";
import { cn } from "@/lib/utils";

const notificationSeverityBadgeBaseClasses = [
  "px-1.5 py-0 text-[10px] capitalize",
  "border-[color:var(--notification-badge-border)]",
  "bg-[color:var(--notification-badge-bg)]",
  "text-[color:var(--notification-badge-text)]",
].join(" ");

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
      className={cn(notificationSeverityBadgeBaseClasses, className)}
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
        toastPalette.successBg,
        toastPalette.successBorder,
        toastPalette.successText,
      );
    case "warning":
      return createNotificationSeverityBadgeStyle(
        toastPalette.warningBg,
        toastPalette.warningBorder,
        toastPalette.warningText,
      );
    case "error":
      return createNotificationSeverityBadgeStyle(
        toastPalette.errorBg,
        toastPalette.errorBorder,
        toastPalette.errorText,
      );
    case "info":
      return createNotificationSeverityBadgeStyle(
        toastPalette.infoBg,
        toastPalette.infoBorder,
        toastPalette.infoText,
      );
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
