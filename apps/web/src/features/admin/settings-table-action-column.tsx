import type { ReactNode } from "react";

const settingsTableActionColumnBaseClassName = [
  "sticky -right-px isolate w-12 overflow-visible border-l border-border bg-card text-right",
  "sm:static sm:border-l-0 sm:bg-transparent sm:shadow-none",
].join(" ");

export const settingsTableActionHeaderClassName = `${settingsTableActionColumnBaseClassName} z-30`;
export const settingsTableActionCellClassName = `${settingsTableActionColumnBaseClassName} z-20`;

export function SettingsTableActionColumnContent({ children }: { children: ReactNode }) {
  return (
    <>
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -inset-y-px -right-2 -left-8 z-0 bg-card sm:hidden"
        data-settings-table-action-surface="true"
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -inset-y-px left-0 z-[1] w-px bg-border sm:hidden"
        data-settings-table-action-divider="true"
      />
      <span className="relative z-10 inline-grid place-items-center">{children}</span>
    </>
  );
}