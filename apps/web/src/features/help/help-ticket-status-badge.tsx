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
  const badge = readHelpTicketStatusBadge(status);

  return (
    <Badge
      className={cn("rounded-md px-1.5 py-0.5 capitalize", badge.className, className)}
      variant={badge.variant}
    >
      {status.replaceAll("_", " ")}
    </Badge>
  );
}

function readHelpTicketStatusBadge(status: HelpTicketStatus): {
  className?: string;
  variant: "outline" | "success";
} {
  switch (status) {
    case "new":
      return {
        className:
          "border-[color:var(--action-info-border)] bg-[color:var(--action-info-bg)] text-[color:var(--action-info-foreground)]",
        variant: "outline",
      };
    case "in_progress":
      return {
        className: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
        variant: "outline",
      };
    case "completed":
      return { variant: "success" };
  }
}
