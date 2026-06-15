import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

type ThemePreviewStripProps = Omit<ComponentProps<"span">, "children"> & {
  swatches: readonly string[];
};

export function ThemePreviewStrip({ className, swatches, ...props }: ThemePreviewStripProps) {
  return (
    <span
      aria-hidden="true"
      className={cn("flex shrink-0 overflow-hidden rounded-xl border border-border", className)}
      {...props}
    >
      {swatches.map((swatch) => (
        <span className="min-w-0 flex-1" key={swatch} style={{ backgroundColor: swatch }} />
      ))}
    </span>
  );
}
