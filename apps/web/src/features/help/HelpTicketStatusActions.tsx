import { HELP_TICKET_STATUS_VALUES, type HelpTicketStatus } from "@arrtemplar/shared";
import { Button } from "@/components/ui/button";

export function HelpTicketStatusActions({
  disabled,
  onStatusChange,
  selectedStatus,
}: {
  disabled: boolean;
  onStatusChange: (status: HelpTicketStatus) => void;
  selectedStatus: HelpTicketStatus;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {HELP_TICKET_STATUS_VALUES.map((status) => (
        <Button
          disabled={disabled || selectedStatus === status}
          key={status}
          onClick={() => onStatusChange(status)}
          size="sm"
          type="button"
          variant={selectedStatus === status ? "default" : "secondary"}
        >
          {status.replaceAll("_", " ")}
        </Button>
      ))}
    </div>
  );
}
