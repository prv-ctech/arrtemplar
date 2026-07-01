import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return (
    <textarea
      className={cn(
        "flex min-h-28 w-full rounded-2xl border border-input bg-background/72 px-3 py-2 text-sm shadow-[inset_0_1px_0_hsl(0_0%_100%/0.05)] transition-[background-color,color,border-color,box-shadow] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      data-slot="textarea"
      {...props}
    />
  );
}
