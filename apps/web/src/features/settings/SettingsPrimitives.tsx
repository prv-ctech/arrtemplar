import { cva, type VariantProps } from "class-variance-authority";
import { Tabs as TabsPrimitive } from "radix-ui";
import type { ComponentProps, ReactNode } from "react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const settingsTabsListVariants = cva(
  "group/settings-tabs-list inline-flex w-fit items-center justify-center rounded-lg p-[3px] text-muted-foreground group-data-[orientation=horizontal]/settings-tabs:h-auto group-data-[orientation=vertical]/settings-tabs:h-fit group-data-[orientation=vertical]/settings-tabs:flex-col data-[variant=line]:rounded-none",
  {
    variants: {
      variant: {
        default: "bg-muted",
        line: "gap-1 bg-transparent",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export function SettingsTabs({
  className,
  orientation = "horizontal",
  ...props
}: ComponentProps<typeof TabsPrimitive.Root>) {
  return (
    <TabsPrimitive.Root
      className={cn(
        "group/settings-tabs flex gap-2 data-[orientation=horizontal]:flex-col",
        className,
      )}
      data-orientation={orientation}
      data-slot="settings-tabs"
      orientation={orientation}
      {...props}
    />
  );
}

export function SettingsTabsList({
  className,
  variant = "default",
  ...props
}: ComponentProps<typeof TabsPrimitive.List> & VariantProps<typeof settingsTabsListVariants>) {
  return (
    <TabsPrimitive.List
      className={cn(settingsTabsListVariants({ variant }), className)}
      data-slot="settings-tabs-list"
      data-variant={variant}
      {...props}
    />
  );
}

export function SettingsTabsTrigger({
  className,
  ...props
}: ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        "relative inline-flex h-[calc(100%-1px)] flex-1 items-center justify-center gap-1.5 rounded-md border border-transparent px-2 py-1 text-sm font-medium whitespace-nowrap text-muted-foreground transition-all group-data-[orientation=vertical]/settings-tabs:w-full group-data-[orientation=vertical]/settings-tabs:justify-start hover:text-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-1 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50 group-data-[variant=default]/settings-tabs-list:data-[state=active]:shadow-sm group-data-[variant=line]/settings-tabs-list:data-[state=active]:shadow-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        "group-data-[variant=line]/settings-tabs-list:bg-transparent group-data-[variant=line]/settings-tabs-list:data-[state=active]:border-transparent group-data-[variant=line]/settings-tabs-list:data-[state=active]:bg-transparent dark:group-data-[variant=line]/settings-tabs-list:data-[state=active]:border-transparent dark:group-data-[variant=line]/settings-tabs-list:data-[state=active]:bg-transparent",
        "data-[state=active]:z-10 data-[state=active]:border-selected-border data-[state=active]:bg-selected",
        "data-[state=active]:text-foreground",
        "after:absolute after:bg-foreground after:opacity-0 after:transition-opacity group-data-[orientation=horizontal]/settings-tabs:after:inset-x-0 group-data-[orientation=horizontal]/settings-tabs:after:-bottom-1.25 group-data-[orientation=horizontal]/settings-tabs:after:h-0.5 group-data-[orientation=vertical]/settings-tabs:after:inset-y-0 group-data-[orientation=vertical]/settings-tabs:after:-right-1 group-data-[orientation=vertical]/settings-tabs:after:w-0.5 group-data-[variant=line]/settings-tabs-list:data-[state=active]:after:opacity-100",
        className,
      )}
      data-slot="settings-tabs-trigger"
      {...props}
    />
  );
}

export function SettingsSection({
  children,
  density = "default",
  description,
  title,
}: {
  children: ReactNode;
  title: string;
  description?: string;
  density?: "default" | "compact";
}) {
  return (
    <div>
      <div className={cn(density === "compact" ? "mb-3" : "mb-5")}>
        <h3 className="text-base font-semibold tracking-tight text-foreground">{title}</h3>
        {description && (
          <p
            className={cn(
              "text-muted-foreground",
              density === "compact" ? "mt-0.5 text-xs leading-5" : "mt-1 text-sm",
            )}
          >
            {description}
          </p>
        )}
      </div>
      <div
        className={cn(
          "divide-y divide-border border border-border bg-card/50",
          density === "compact" ? "rounded-xl" : "rounded-3xl",
        )}
      >
        {children}
      </div>
    </div>
  );
}

export function SettingsRow({
  children,
  controlId,
  density = "default",
  description,
  label,
}: {
  children: ReactNode;
  label: string;
  description?: string;
  controlId?: string;
  density?: "default" | "compact";
}) {
  return (
    <div
      className={cn(
        "flex flex-col sm:flex-row sm:items-center sm:justify-between",
        density === "compact" ? "gap-2 px-3 py-2.5 sm:px-4" : "gap-4 px-5 py-4 sm:px-6",
      )}
    >
      <div
        className={cn(
          "min-w-0 shrink-0",
          density === "compact" ? "sm:max-w-xs lg:max-w-sm" : "sm:max-w-sm lg:max-w-md",
        )}
      >
        {controlId ? (
          <Label className="text-sm font-medium" htmlFor={controlId}>
            {label}
          </Label>
        ) : (
          <p className="text-sm font-medium text-foreground">{label}</p>
        )}
        {description && (
          <p
            className={cn(
              "mt-0.5 text-xs text-muted-foreground",
              density === "compact" ? "leading-4" : "leading-5",
            )}
          >
            {description}
          </p>
        )}
      </div>
      <div
        className={cn(
          "flex min-w-0 items-center sm:justify-end",
          density === "compact" ? "gap-2 sm:pl-3" : "gap-3 sm:pl-4",
        )}
      >
        {children}
      </div>
    </div>
  );
}

export function SettingsPanel({ activeId, children }: { activeId: string; children: ReactNode }) {
  return (
    <div
      aria-labelledby={`${activeId}-settings-tab`}
      className="min-w-0 flex-1 pt-6"
      id={`${activeId}-settings-panel`}
      role="tabpanel"
    >
      {children}
    </div>
  );
}

export function SettingsStatus({
  errorMessage,
  statusId,
  statusMessage,
}: {
  errorMessage: string | null;
  statusId: string;
  statusMessage: string | null;
}) {
  if (!statusMessage && !errorMessage) {
    return null;
  }

  return (
    <div className="flex flex-col gap-2 text-sm sm:flex-row sm:items-center sm:justify-between">
      <div aria-live="polite" className="min-h-5 text-muted-foreground" id={statusId}>
        {statusMessage}
      </div>
      {errorMessage ? (
        <p className="text-destructive" role="alert">
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
}
