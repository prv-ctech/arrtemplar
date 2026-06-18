import {
  CheckCircleIcon,
  InfoIcon,
  SpinnerGapIcon,
  WarningCircleIcon,
  XCircleIcon,
} from "@phosphor-icons/react";
import type * as React from "react";
import { Toaster as Sonner, type ToasterProps } from "sonner";

const toastPalette = {
  greenBg: "color-mix(in srgb, var(--catppuccin-color-green) 18%, var(--popover))",
  greenBorder: "color-mix(in srgb, var(--catppuccin-color-green) 46%, var(--border))",
  greenText: "color-mix(in srgb, var(--catppuccin-color-green) 82%, white)",
  redBg: "color-mix(in srgb, var(--catppuccin-color-red) 18%, var(--popover))",
  redBorder: "color-mix(in srgb, var(--catppuccin-color-red) 50%, var(--border))",
  redText: "color-mix(in srgb, var(--catppuccin-color-red) 76%, white)",
  yellowBg: "color-mix(in srgb, var(--catppuccin-color-yellow) 18%, var(--popover))",
  yellowBorder: "color-mix(in srgb, var(--catppuccin-color-yellow) 50%, var(--border))",
  yellowText: "color-mix(in srgb, var(--catppuccin-color-yellow) 82%, white)",
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
          "--normal-bg": toastPalette.greenBg,
          "--normal-text": toastPalette.greenText,
          "--normal-border": toastPalette.greenBorder,
          "--success-bg": toastPalette.greenBg,
          "--success-text": toastPalette.greenText,
          "--success-border": toastPalette.greenBorder,
          "--error-bg": toastPalette.redBg,
          "--error-text": toastPalette.redText,
          "--error-border": toastPalette.redBorder,
          "--warning-bg": toastPalette.yellowBg,
          "--warning-text": toastPalette.yellowText,
          "--warning-border": toastPalette.yellowBorder,
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      {...props}
    />
  );
}
