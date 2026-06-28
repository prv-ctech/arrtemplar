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
      <DialogContent aria-describedby={undefined} className="max-w-xl gap-3 rounded-xl p-4">
        <DialogHeader className="gap-1">
          <DialogTitle className="text-base">New ticket</DialogTitle>
          <DialogDescription className="sr-only">
            Create a help ticket with a short summary, details, and optional attachments.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2.5">
          <div className="grid gap-1.5">
            <Label className="text-xs" htmlFor="help-ticket-title">
              Title
            </Label>
            <Input
              className="h-8 rounded-md px-2.5 text-sm"
              id="help-ticket-title"
              onChange={(event) => onTitleChange(event.target.value)}
              placeholder="Short summary"
              value={draftTitle}
            />
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs" htmlFor="help-ticket-description">
              Description
            </Label>
            <Textarea
              className="min-h-28 rounded-md px-2.5 py-2"
              id="help-ticket-description"
              onChange={(event) => onDescriptionChange(event.target.value)}
              placeholder="What happened?"
              value={draftDescription}
            />
          </div>
          <div className="grid gap-2">
            <Label className="text-xs" htmlFor="help-ticket-files">
              Attachments
            </Label>
            <button
              aria-label="Ticket attachment drop area"
              className="rounded-lg border border-dashed border-border bg-muted/20 p-3 text-left transition-colors hover:bg-muted/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onClick={() => inputRef.current?.click()}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                onAttachmentsChange(event.dataTransfer.files);
              }}
              type="button"
            >
              <span className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-foreground">
                    Drop files or browse
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    JPG, PNG, WebP, MP4, WebM, MOV.
                  </span>
                </span>
                <span className="inline-flex h-7 items-center rounded-md border border-border bg-background px-2 text-xs text-foreground">
                  Add files
                </span>
              </span>
            </button>
            <input
              accept=".jpg,.jpeg,.png,.webp,.mp4,.webm,.mov"
              aria-label="Ticket attachments"
              className="sr-only"
              id="help-ticket-files"
              multiple
              onChange={(event: ChangeEvent<HTMLInputElement>) =>
                onAttachmentsChange(event.target.files)
              }
              ref={inputRef}
              type="file"
            />
            {attachments.length ? (
              <div className="grid gap-1.5">
                {attachments.map((attachment, index) => (
                  <div
                    className="flex items-center justify-between gap-3 rounded-md border border-border/70 bg-background/80 px-2 py-1.5"
                    key={`${attachment.name}-${attachment.size}-${attachment.lastModified}`}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">
                        {attachment.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatHelpTicketFileSize(attachment.size)}
                      </p>
                    </div>
                    <Button
                      className="h-7 rounded-md px-2 text-xs"
                      onClick={() => onRemoveAttachment(index)}
                      size="sm"
                      type="button"
                      variant="ghost"
                    >
                      Remove
                    </Button>
                  </div>
                ))}
              </div>
            ) : null}
            {draftError ? <p className="text-xs text-destructive">{draftError}</p> : null}
          </div>
        </div>
        <DialogFooter className="gap-2 pt-1">
          <Button
            className="h-8 rounded-md px-2.5 text-sm"
            onClick={() => onOpenChange(false)}
            type="button"
            variant="ghost"
          >
            Cancel
          </Button>
          <Button
            className="h-8 rounded-md px-2.5 text-sm"
            disabled={createDisabled}
            onClick={onSubmit}
            type="button"
          >
            {isSubmitting ? "Submitting" : "Submit"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
