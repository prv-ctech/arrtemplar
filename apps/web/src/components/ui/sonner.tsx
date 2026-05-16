import { CheckCircleIcon, InfoIcon, WarningCircleIcon, XCircleIcon } from "@phosphor-icons/react";
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
        loading: <InfoIcon className="size-4 animate-pulse" weight="duotone" />,
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      {...props}
    />
  );
}
