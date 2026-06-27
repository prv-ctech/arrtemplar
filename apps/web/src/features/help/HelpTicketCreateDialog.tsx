import type { ChangeEvent } from "react";
import { useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatHelpTicketFileSize } from "./help-ticket-data";

export function HelpTicketCreateDialog({
  attachments,
  createDisabled,
  draftDescription,
  draftError,
  draftTitle,
  isSubmitting,
  onAttachmentsChange,
  onDescriptionChange,
  onOpenChange,
  onRemoveAttachment,
  onSubmit,
  onTitleChange,
  open,
}: {
  attachments: File[];
  createDisabled: boolean;
  draftDescription: string;
  draftError: string | null;
  draftTitle: string;
  isSubmitting: boolean;
  onAttachmentsChange: (files: FileList | null) => void;
  onDescriptionChange: (value: string) => void;
  onOpenChange: (open: boolean) => void;
  onRemoveAttachment: (index: number) => void;
  onSubmit: () => void;
  onTitleChange: (value: string) => void;
  open: boolean;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent aria-describedby={undefined} className="max-w-xl">
        <DialogHeader>
          <DialogTitle>New ticket</DialogTitle>
          <DialogDescription className="sr-only">
            Create a help ticket with a short summary, details, and optional attachments.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <Label className="sr-only" htmlFor="help-ticket-title">
            Title
          </Label>
          <Input
            id="help-ticket-title"
            onChange={(event) => onTitleChange(event.target.value)}
            placeholder="Title"
            value={draftTitle}
          />
          <Label className="sr-only" htmlFor="help-ticket-description">
            Description
          </Label>
          <Textarea
            id="help-ticket-description"
            onChange={(event) => onDescriptionChange(event.target.value)}
            placeholder="Describe issue"
            value={draftDescription}
          />
          <div className="grid gap-3">
            <button
              aria-label="Ticket attachment drop area"
              className="rounded-2xl border border-dashed border-border bg-card/70 p-4 text-left"
              onClick={() => inputRef.current?.click()}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                onAttachmentsChange(event.dataTransfer.files);
              }}
              type="button"
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-foreground">Attachments</p>
                  <p className="text-xs text-muted-foreground">JPG, PNG, WebP, MP4, WebM, MOV.</p>
                </div>
                <span className="inline-flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground">
                  Add files
                </span>
              </div>
            </button>
            <input
                  accept=".jpg,.jpeg,.png,.webp,.mp4,.webm,.mov"
              className="sr-only"
                  id="help-ticket-files"
              multiple
              onChange={(event: ChangeEvent<HTMLInputElement>) => onAttachmentsChange(event.target.files)}
              ref={inputRef}
              type="file"
            />
            {attachments.length ? (
              <div className="mt-3 grid gap-2">
                {attachments.map((attachment, index) => (
                  <div className="flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-background/80 px-3 py-2" key={`${attachment.name}-${attachment.size}-${attachment.lastModified}`}>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{attachment.name}</p>
                      <p className="text-xs text-muted-foreground">{formatHelpTicketFileSize(attachment.size)}</p>
                    </div>
                    <Button onClick={() => onRemoveAttachment(index)} size="sm" type="button" variant="ghost">
                      Remove
                    </Button>
                  </div>
                ))}
              </div>
            ) : null}
            {draftError ? <p className="mt-3 text-sm text-destructive">{draftError}</p> : null}
          </div>
        </div>
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)} type="button" variant="ghost">
            Cancel
          </Button>
          <Button disabled={createDisabled} onClick={onSubmit} type="button">
            {isSubmitting ? "Submitting" : "Submit"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
