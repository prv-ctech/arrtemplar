import type { ReactNode } from "react";

type SettingsMobileDefinitionProps = {
  children: ReactNode;
  label: string;
};

export function SettingsMobileDefinition({ children, label }: SettingsMobileDefinitionProps) {
  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,0.75fr)_minmax(0,1fr)] items-start gap-3">
      <dt className="text-muted-foreground text-xs leading-5">{label}</dt>
      <dd className="min-w-0 justify-self-end text-right text-foreground wrap-break-word">
        {children}
      </dd>
    </div>
  );
}
