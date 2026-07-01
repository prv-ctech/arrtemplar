import { Select as SelectPrimitive } from "radix-ui";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export function Select({ ...props }: ComponentProps<typeof SelectPrimitive.Root>) {
  return <SelectPrimitive.Root data-slot="select" {...props} />;
}

export function SelectGroup({ ...props }: ComponentProps<typeof SelectPrimitive.Group>) {
  return <SelectPrimitive.Group data-slot="select-group" {...props} />;
}

export function SelectValue({ ...props }: ComponentProps<typeof SelectPrimitive.Value>) {
  return <SelectPrimitive.Value data-slot="select-value" {...props} />;
}

export function SelectTrigger({
  children,
  className,
  size = "default",
  ...props
}: ComponentProps<typeof SelectPrimitive.Trigger> & { size?: "sm" | "default" }) {
  return (
    <SelectPrimitive.Trigger
      className={cn(
        "flex w-fit items-center justify-between gap-2 rounded-md border border-input bg-background/72 px-3 py-2 text-sm whitespace-nowrap shadow-[inset_0_1px_0_hsl(0_0%_100%/0.05)] outline-none transition-[background-color,color,border-color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 data-placeholder:text-muted-foreground data-[size=default]:h-9 data-[size=sm]:h-8 *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-2",
        className,
      )}
      data-size={size}
      data-slot="select-trigger"
      {...props}
    >
      {children}
      <SelectPrimitive.Icon asChild>
        <span aria-hidden="true" className="text-xs text-muted-foreground">
          ▾
        </span>
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  );
}

export function SelectContent({
  align = "center",
  children,
  className,
  position = "item-aligned",
  ...props
}: ComponentProps<typeof SelectPrimitive.Content>) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        align={align}
        className={cn(
          "relative z-50 max-h-(--radix-select-content-available-height) min-w-32 origin-(--radix-select-content-transform-origin) overflow-x-hidden overflow-y-auto rounded-md border bg-popover text-popover-foreground shadow-md data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
          position === "popper" &&
            "data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1",
          className,
        )}
        data-slot="select-content"
        position={position}
        {...props}
      >
        <SelectScrollUpButton />
        <SelectPrimitive.Viewport
          className={cn(
            "p-1",
            position === "popper" &&
              "h-(--radix-select-trigger-height) w-full min-w-(--radix-select-trigger-width) scroll-my-1",
          )}
        >
          {children}
        </SelectPrimitive.Viewport>
        <SelectScrollDownButton />
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  );
}

export function SelectLabel({ className, ...props }: ComponentProps<typeof SelectPrimitive.Label>) {
  return (
    <SelectPrimitive.Label
      className={cn("px-2 py-1.5 text-xs text-muted-foreground", className)}
      data-slot="select-label"
      {...props}
    />
  );
}

export function SelectItem({
  children,
  className,
  ...props
}: ComponentProps<typeof SelectPrimitive.Item>) {
  return (
    <SelectPrimitive.Item
      className={cn(
        "relative flex w-full cursor-default items-center gap-2 rounded-sm py-1.5 pr-8 pl-2 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground data-disabled:pointer-events-none data-disabled:opacity-50",
        className,
      )}
      data-slot="select-item"
      {...props}
    >
      <span
        className="absolute right-2 flex size-3.5 items-center justify-center text-xs"
        data-slot="select-item-indicator"
      >
        <SelectPrimitive.ItemIndicator>✓</SelectPrimitive.ItemIndicator>
      </span>
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  );
}

export function SelectSeparator({
  className,
  ...props
}: ComponentProps<typeof SelectPrimitive.Separator>) {
  return (
    <SelectPrimitive.Separator
      className={cn("pointer-events-none -mx-1 my-1 h-px bg-border", className)}
      data-slot="select-separator"
      {...props}
    />
  );
}

export function SelectScrollUpButton({
  className,
  ...props
}: ComponentProps<typeof SelectPrimitive.ScrollUpButton>) {
  return (
    <SelectPrimitive.ScrollUpButton
      className={cn("flex cursor-default items-center justify-center py-1 text-xs", className)}
      data-slot="select-scroll-up-button"
      {...props}
    >
      ↑
    </SelectPrimitive.ScrollUpButton>
  );
}

export function SelectScrollDownButton({
  className,
  ...props
}: ComponentProps<typeof SelectPrimitive.ScrollDownButton>) {
  return (
    <SelectPrimitive.ScrollDownButton
      className={cn("flex cursor-default items-center justify-center py-1 text-xs", className)}
      data-slot="select-scroll-down-button"
      {...props}
    >
      ↓
    </SelectPrimitive.ScrollDownButton>
  );
}
