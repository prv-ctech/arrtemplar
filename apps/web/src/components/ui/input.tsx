import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export function Input({ className, type, ...props }: ComponentProps<"input">) {
  return (
    <input
      className={cn(
        "h-11 w-full min-w-0 rounded-2xl border border-input bg-background/50 px-4 py-2 text-base text-foreground shadow-[inset_0_1px_0_hsl(0_0%_100%/0.04)] outline-none transition-[border-color,box-shadow] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] selection:bg-primary selection:text-primary-foreground placeholder:text-muted-foreground focus-visible:border-primary/70 focus-visible:ring-2 focus-visible:ring-primary/20 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/20",
        className,
      )}
      data-slot="input"
      type={type}
      {...props}
    />
  );
}
