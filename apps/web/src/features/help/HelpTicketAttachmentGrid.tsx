import type { HelpTicketDetail } from "@arrtemplar/shared";
import { Button } from "@/components/ui/button";
import { getHelpTicketAttachmentUrl } from "@/lib/api/help";
import { formatHelpTicketFileSize } from "./help-ticket-data";

export function HelpTicketAttachmentGrid({
  attachments,
  ticketId,
}: {
  attachments: HelpTicketDetail["attachments"];
  ticketId: string;
}) {
  return attachments.length ? (
    <div className="grid gap-1.5">
      {attachments.map((attachment) => {
        const attachmentUrl = getHelpTicketAttachmentUrl(ticketId, attachment.id);
        const mediaLabel = attachment.mediaKind === "image" ? "Image" : "Video";

        return (
          <div
            className="flex items-center gap-3 rounded-lg border border-border/80 bg-card/45 p-2"
            key={attachment.id}
          >
            <div className="size-14 shrink-0 overflow-hidden rounded-md border border-border bg-background">
              <div className="flex size-full items-center justify-center text-xs text-muted-foreground">
                {mediaLabel}
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">
                {attachment.originalFileName}
              </p>
              <p className="text-xs text-muted-foreground">
                {formatHelpTicketFileSize(attachment.storedSizeBytes)}
              </p>
            </div>
            <Button
              asChild
              className="h-7 rounded-md px-2 text-xs"
              size="sm"
              type="button"
              variant="ghost"
            >
              <a href={attachmentUrl} rel="noreferrer" target="_blank">
                Open
              </a>
            </Button>
          </div>
        );
      })}
    </div>
  ) : (
    <div className="rounded-lg border border-dashed border-border bg-card/45 p-3 text-sm text-muted-foreground">
      No attachments.
    </div>
  );
}
