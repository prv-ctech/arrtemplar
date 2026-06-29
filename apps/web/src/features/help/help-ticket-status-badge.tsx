import type { HelpTicketStatus } from "@arrtemplar/shared";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function HelpTicketStatusBadge({
  className,
  status,
}: {
  className?: string;
  status: HelpTicketStatus;
}) {
  return (
    <Badge
      className={cn(
        "rounded-md px-1.5 py-0.5 capitalize",
        readHelpTicketStatusClassName(status),
        className,
      )}
      variant="outline"
    >
      {status.replaceAll("_", " ")}
    </Badge>
  );
}

function readHelpTicketStatusClassName(status: HelpTicketStatus): string {
  switch (status) {
    case "new":
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
    case "in_progress":
      return "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300";
    case "completed":
      return "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300";
  }
}
