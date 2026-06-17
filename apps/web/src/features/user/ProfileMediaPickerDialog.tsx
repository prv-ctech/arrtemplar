import { CheckCircleIcon } from "@phosphor-icons/react";
import { type ReactNode, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type ProfileMediaOption = {
  id: string;
  label: string;
  group?: string;
  src: string;
  alt: string;
};

type ProfileMediaPickerDialogProps = {
  disabled?: boolean;
  kind: "avatar" | "banner";
  onSelect: (id: string) => Promise<void> | void;
  options: readonly ProfileMediaOption[];
  selectedId: string;
  trigger: ReactNode;
};

export function ProfileMediaPickerDialog({
  disabled = false,
  kind,
  onSelect,
  options,
  selectedId,
  trigger,
}: ProfileMediaPickerDialogProps) {
  const [open, setOpen] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const groupedOptions = groupMediaOptions(options);
  const isAvatar = kind === "avatar";
  const showGroupHeadings = isAvatar || groupedOptions.length > 1;

  async function handleSelect(option: ProfileMediaOption) {
    if (option.id === selectedId) {
      setOpen(false);
      return;
    }

    setPendingId(option.id);

    try {
      await onSelect(option.id);
      setOpen(false);
    } finally {
      setPendingId(null);
    }
  }

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger asChild disabled={disabled}>
        {trigger}
      </DialogTrigger>
      <DialogContent className="max-w-xl gap-3 rounded-3xl p-4 sm:p-5">
        <DialogHeader className="gap-1 pr-8 text-left">
          <DialogTitle>{isAvatar ? "Choose avatar" : "Choose banner"}</DialogTitle>
          <DialogDescription>Pick one curated image. Changes save immediately.</DialogDescription>
        </DialogHeader>

        <div className="max-h-[min(28rem,calc(100dvh-12rem))] overflow-y-auto pr-1">
          {groupedOptions.map((group) => (
            <section className="not-first:mt-4" key={group.label}>
              {showGroupHeadings ? (
                <h3 className="mb-2 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                  {group.label}
                </h3>
              ) : null}
              <div
                className={
                  isAvatar ? "grid grid-cols-4 gap-2 sm:grid-cols-6" : "grid gap-2 sm:grid-cols-2"
                }
              >
                {group.options.map((option) => {
                  const selected = option.id === selectedId;
                  const saving = option.id === pendingId;

                  return (
                    <button
                      aria-label={`${selected ? "Selected" : "Select"} ${option.label}`}
                      aria-pressed={selected}
                      className={cn(
                        "group relative min-w-0 overflow-hidden border bg-card transition-colors duration-150",
                        "hover:border-primary/60 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-60",
                        selected ? "border-primary/80" : "border-border",
                        isAvatar ? "aspect-square rounded-2xl p-1.5" : "aspect-3/1 rounded-2xl p-1",
                      )}
                      disabled={disabled || pendingId !== null}
                      key={option.id}
                      onClick={() => void handleSelect(option)}
                      type="button"
                    >
                      <img
                        alt=""
                        aria-hidden="true"
                        className="pointer-events-none size-full rounded-xl bg-background object-cover"
                        decoding="async"
                        src={option.src}
                      />
                      {selected || saving ? (
                        <span className="pointer-events-none absolute top-1.5 right-1.5 rounded-full border border-background bg-primary p-0.5 text-primary-foreground shadow-(--shadow-soft)">
                          <CheckCircleIcon aria-hidden="true" className="size-3.5" weight="fill" />
                          <span className="sr-only">{saving ? "Saving" : "Selected"}</span>
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function groupMediaOptions(options: readonly ProfileMediaOption[]) {
  const groups = new Map<string, ProfileMediaOption[]>();

  for (const option of options) {
    const label = option.group ?? "Banners";
    groups.set(label, [...(groups.get(label) ?? []), option]);
  }

  return [...groups.entries()].map(([label, groupOptions]) => ({ label, options: groupOptions }));
}
