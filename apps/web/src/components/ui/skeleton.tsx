import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export function Skeleton({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl bg-muted before:absolute before:inset-0 before:bg-linear-to-r before:from-transparent before:via-primary/12 before:to-transparent before:animate-[skeleton-shimmer_1.8s_ease-in-out_infinite]",
        className,
      )}
      data-slot="skeleton"
      {...props}
    />
  );
}
