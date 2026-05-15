import {
  CheckCircleIcon,
  InfoIcon,
  SpinnerGapIcon,
  WarningCircleIcon,
  XCircleIcon,
} from "@phosphor-icons/react";
import type * as React from "react";
import { Toaster as Sonner, type ToasterProps } from "sonner";

export function Toaster(props: ToasterProps) {
  return (
    <Sonner
      className="toaster group"
      icons={{
        success: <CheckCircleIcon className="size-4" weight="duotone" />,
        info: <InfoIcon className="size-4" weight="duotone" />,
        warning: <WarningCircleIcon className="size-4" weight="duotone" />,
        error: <XCircleIcon className="size-4" weight="duotone" />,
        loading: <SpinnerGapIcon className="size-4 animate-spin" />,
      }}
      style={
        {
          "--normal-bg": "var(--color-popover)",
          "--normal-text": "var(--color-popover-foreground)",
          "--normal-border": "var(--color-border)",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      theme="dark"
      {...props}
    />
  );
}
