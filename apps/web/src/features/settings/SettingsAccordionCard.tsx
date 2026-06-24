import { CaretDownIcon } from "@phosphor-icons/react";
import type { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

export function SettingsAccordionCard({
  action,
  children,
  contentId,
  icon,
  isExpanded,
  onToggle,
  title,
  toggleLabel,
}: {
  action?: ReactNode;
  children: ReactNode;
  contentId: string;
  icon: ReactNode;
  isExpanded: boolean;
  onToggle: () => void;
  title: string;
  toggleLabel: string;
}) {
  return (
    <Card className="w-full min-w-0 overflow-hidden rounded-2xl bg-card/50 shadow-none">
      <CardHeader className="p-0">
        <div className="flex items-start gap-2 p-3">
          <button
            aria-controls={contentId}
            aria-expanded={isExpanded}
            aria-label={toggleLabel}
            className={cn(
              "flex min-w-0 flex-1 cursor-pointer items-start gap-3 rounded-xl text-left transition-colors duration-200",
              "hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            )}
            onClick={onToggle}
            type="button"
          >
            {icon}
            <div className="min-w-0 flex-1 py-2.5">
              <CardTitle className="truncate text-sm leading-5 sm:text-base">{title}</CardTitle>
            </div>
            <CaretDownIcon
              aria-hidden="true"
              className={cn(
                "mt-3 size-4 shrink-0 text-muted-foreground transition-transform duration-200",
                isExpanded && "rotate-180",
              )}
            />
          </button>
          {action}
        </div>
      </CardHeader>
      {isExpanded ? (
        <>
          <Separator />
          <CardContent className="p-2.5" id={contentId}>
            {children}
          </CardContent>
        </>
      ) : null}
    </Card>
  );
}
