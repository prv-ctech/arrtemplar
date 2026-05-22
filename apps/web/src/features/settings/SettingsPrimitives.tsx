import type { ComponentProps, ReactNode } from "react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const selectClassName =
  "h-11 w-full rounded-2xl border border-input bg-background/50 px-4 py-2 text-sm text-foreground shadow-[inset_0_1px_0_hsl(0_0%_100%/0.04)] outline-none transition-[border-color] duration-300 focus-visible:border-primary/70 focus-visible:ring-2 focus-visible:ring-primary/20 sm:max-w-48";

export function SettingsSection({
  children,
  description,
  title,
}: {
  children: ReactNode;
  title: string;
  description?: string;
}) {
  return (
    <div>
      <div className="mb-5">
        <h3 className="text-base font-semibold tracking-tight text-foreground">{title}</h3>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      <div className="divide-y divide-border rounded-3xl border border-border bg-card/50">
        {children}
      </div>
    </div>
  );
}

export function SettingsRow({
  children,
  controlId,
  description,
  label,
}: {
  children: ReactNode;
  label: string;
  description?: string;
  controlId?: string;
}) {
  return (
    <div className="flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
      <div className="min-w-0 shrink-0 sm:max-w-sm lg:max-w-md">
        {controlId ? (
          <Label className="text-sm font-medium" htmlFor={controlId}>
            {label}
          </Label>
        ) : (
          <p className="text-sm font-medium text-foreground">{label}</p>
        )}
        {description && (
          <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{description}</p>
        )}
      </div>
      <div className="flex min-w-0 items-center gap-3 sm:justify-end sm:pl-4">{children}</div>
    </div>
  );
}

export function SettingsSelect({ className, ...props }: ComponentProps<"select">) {
  return <select className={cn(selectClassName, className)} {...props} />;
}

export function SettingsPanel({
  activeId,
  children,
  description,
  title,
}: {
  activeId: string;
  children: ReactNode;
  description: string;
  title: string;
}) {
  return (
    <div
      aria-labelledby={`${activeId}-settings-tab`}
      className="min-w-0 flex-1 pt-6"
      id={`${activeId}-settings-panel`}
      role="tabpanel"
    >
      <div className="mb-8">
        <h2 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      {children}
    </div>
  );
}
