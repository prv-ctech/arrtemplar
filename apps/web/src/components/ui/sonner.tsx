import {
  CheckCircleIcon,
  InfoIcon,
  SpinnerGapIcon,
  WarningCircleIcon,
  XCircleIcon,
} from "@phosphor-icons/react";
import type * as React from "react";
import { Toaster as Sonner, type ToasterProps } from "sonner";

export const toastPalette = {
  successBg: "var(--toast-success-bg)",
  successBorder: "var(--toast-success-border)",
  successText: "var(--toast-success-text)",
  warningBg: "var(--toast-warning-bg)",
  warningBorder: "var(--toast-warning-border)",
  warningText: "var(--toast-warning-text)",
  errorBg: "var(--toast-error-bg)",
  errorBorder: "var(--toast-error-border)",
  errorText: "var(--toast-error-text)",
  infoBg: "var(--toast-info-bg)",
  infoBorder: "var(--toast-info-border)",
  infoText: "var(--toast-info-text)",
} as const;

export function Toaster(props: ToasterProps) {
  return (
    <Sonner
      className="toaster group"
      icons={{
        success: <CheckCircleIcon className="size-4" weight="duotone" />,
        info: <InfoIcon className="size-4" weight="duotone" />,
        warning: <WarningCircleIcon className="size-4" weight="duotone" />,
        error: <XCircleIcon className="size-4" weight="duotone" />,
        loading: <SpinnerGapIcon className="size-4 animate-spin" weight="duotone" />,
      }}
      style={
        {
          "--normal-bg": toastPalette.infoBg,
          "--normal-text": toastPalette.infoText,
          "--normal-border": toastPalette.infoBorder,
          "--info-bg": toastPalette.infoBg,
          "--info-text": toastPalette.infoText,
          "--info-border": toastPalette.infoBorder,
          "--success-bg": toastPalette.successBg,
          "--success-text": toastPalette.successText,
          "--success-border": toastPalette.successBorder,
          "--error-bg": toastPalette.errorBg,
          "--error-text": toastPalette.errorText,
          "--error-border": toastPalette.errorBorder,
          "--warning-bg": toastPalette.warningBg,
          "--warning-text": toastPalette.warningText,
          "--warning-border": toastPalette.warningBorder,
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      {...props}
    />
  );
}
