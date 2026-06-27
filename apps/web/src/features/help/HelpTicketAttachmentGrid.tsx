import type { HelpTicketDetail } from "@arrtemplar/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
    <div className="grid gap-3 sm:grid-cols-2">
      {attachments.map((attachment) => {
        const attachmentUrl = getHelpTicketAttachmentUrl(ticketId, attachment.id);

        return (
          <Card className="rounded-2xl border-border/80 bg-card/80" key={attachment.id}>
            <CardContent className="grid gap-3 p-4">
              {attachment.mediaKind === "image" ? (
                <img
                  alt={attachment.originalFileName}
                  className="aspect-video w-full rounded-xl border border-border object-cover"
                  src={attachmentUrl}
                />
              ) : (
                <div className="flex aspect-video items-center justify-center rounded-xl border border-dashed border-border bg-background text-sm text-muted-foreground">
                  Video
                </div>
              )}
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">{attachment.originalFileName}</p>
                <p className="text-xs text-muted-foreground">{formatHelpTicketFileSize(attachment.storedSizeBytes)}</p>
              </div>
              <Button asChild size="sm" type="button" variant="secondary">
                <a href={attachmentUrl} rel="noreferrer" target="_blank">
                  Open
                </a>
              </Button>
            </CardContent>
          </Card>
        );
      })}
    </div>
  ) : (
    <Card className="rounded-2xl border-dashed bg-card/70">
      <CardContent className="p-4 text-sm text-muted-foreground">No attachments.</CardContent>
    </Card>
  );
}
