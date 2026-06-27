import type { HelpTicketDetail, HelpTicketStatus } from "@arrtemplar/shared";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { HelpTicketAttachmentGrid } from "./HelpTicketAttachmentGrid";
import { HelpTicketStatusActions } from "./HelpTicketStatusActions";
import { HelpTicketStatusBadge } from "./help-ticket-status-badge";

export function HelpTicketDetailDialog({
  canManage,
  errorMessage,
  onOpenChange,
  onStatusChange,
  open,
  selectedTicket,
  statusPending,
}: {
  canManage: boolean;
  errorMessage: string | null;
  onOpenChange: (open: boolean) => void;
  onStatusChange: (status: HelpTicketStatus) => void;
  open: boolean;
  selectedTicket: HelpTicketDetail | null;
  statusPending: boolean;
}) {
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent aria-describedby={undefined} className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{selectedTicket?.title ?? "Ticket"}</DialogTitle>
          <DialogDescription className="sr-only">
            Review ticket details, attachment previews, and status controls.
          </DialogDescription>
        </DialogHeader>
        {!selectedTicket && errorMessage ? (
          <Card className="rounded-2xl border-dashed bg-card/70">
            <CardContent className="p-4 text-sm text-muted-foreground">{errorMessage}</CardContent>
          </Card>
        ) : !selectedTicket ? (
          <div className="grid gap-3">
            <Skeleton className="h-10 w-32" />
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-18 w-full" />
          </div>
        ) : (
          <div className="grid gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <HelpTicketStatusBadge status={selectedTicket.status} />
              {canManage ? (
                <span className="text-xs text-muted-foreground">{selectedTicket.createdBy.username}</span>
              ) : null}
              <span className="text-xs text-muted-foreground">{formatTicketDate(selectedTicket.updatedAt)}</span>
            </div>
            <Card className="rounded-2xl border-border/80 bg-card/80">
              <CardContent className="p-4 text-sm leading-6 text-foreground">{selectedTicket.description}</CardContent>
            </Card>
            {canManage ? (
              <HelpTicketStatusActions
                disabled={statusPending}
                onStatusChange={onStatusChange}
                selectedStatus={selectedTicket.status}
              />
            ) : null}
            <div className="grid gap-2">
              <p className="text-sm font-medium text-foreground">Attachments</p>
              <HelpTicketAttachmentGrid attachments={selectedTicket.attachments} ticketId={selectedTicket.id} />
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function formatTicketDate(value: string): string {
  return new Date(value).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}
