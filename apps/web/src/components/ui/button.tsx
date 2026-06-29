import type { VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import type { ComponentProps } from "react";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";

export type ButtonProps = ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  };

export function Button({ asChild = false, className, variant, size, ref, ...props }: ButtonProps) {
  const Component = asChild ? Slot.Root : "button";

  return (
    <Component className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
  );
}
