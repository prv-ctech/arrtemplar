import type { ApiKeyReveal, ApiKeySummary, NotificationPreferences } from "@arrtemplar/shared";
import { CaretDownIcon, KeyIcon, PlusIcon } from "@phosphor-icons/react";
import type { FormEvent, ReactNode } from "react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { notify } from "@/features/notifications/notification-gateway";
import { SettingsStatus } from "@/features/settings/SettingsPrimitives";
import { cn } from "@/lib/utils";
import { useAuthenticatedRouteUser } from "@/routes/authenticated-route-user";
import {
  settingsTableActionCellClassName,
  settingsTableActionHeaderClassName,
} from "../settings-table-action-column";
import {
  useApiKeysQuery,
  useCreateApiKeyMutation,
  useDeleteApiKeyMutation,
  useRotateApiKeyMutation,
} from "./api-keys";

type PendingApiKeyAction =
  | { apiKey: ApiKeySummary; kind: "delete" | "rotate" }
  | { kind: "closed" };

type ApiKeysSettingsState = ReturnType<typeof useApiKeysSettingsState>;

export function ApiKeysSettings() {
  return <ApiKeysSettingsView state={useApiKeysSettingsState()} />;
}

function useApiKeysSettingsState() {
  const actor = useAuthenticatedRouteUser();
  const apiKeysQuery = useApiKeysQuery();
  const createMutation = useCreateApiKeyMutation();
  const rotateMutation = useRotateApiKeyMutation();
  const deleteMutation = useDeleteApiKeyMutation();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);
  const [pendingAction, setPendingAction] = useState<PendingApiKeyAction>({ kind: "closed" });
  const [revealedKey, setRevealedKey] = useState<ApiKeyReveal | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  function handleCreate(input: { description: string | null; name: string }) {
    setErrorMessage(null);
    createMutation.mutate(input, {
      onSuccess: (result) => {
        setIsCreateOpen(false);
        setRevealedKey(result);
        setStatusMessage("API key created.");
        notify(
          {
            id: "api_keys.created",
            title: "API key created.",
            description: result.apiKey.name,
          },
          actor.notificationPreferences,
        );
      },
      onError: (error) => {
        const message = error instanceof Error ? error.message : "Create failed.";

        setErrorMessage(message);
        notify({ id: "api_keys.create.failed", title: message }, actor.notificationPreferences);
      },
    });
  }

  function confirmPendingAction() {
    if (pendingAction.kind === "closed") {
      return;
    }

    const currentAction = pendingAction;
    setPendingAction({ kind: "closed" });
    setErrorMessage(null);

    if (currentAction.kind === "rotate") {
      rotateMutation.mutate(currentAction.apiKey.id, {
        onSuccess: (result) => {
          setRevealedKey(result);
          setStatusMessage("API key rotated.");
          notify(
            {
              id: "api_keys.updated",
              title: "API key rotated.",
              description: result.apiKey.name,
            },
            actor.notificationPreferences,
          );
        },
        onError: (error) => {
          const message = error instanceof Error ? error.message : "Rotate failed.";

          setErrorMessage(message);
          notify(
            {
              id: "api_keys.update.failed",
              title: message,
              description: currentAction.apiKey.name,
            },
            actor.notificationPreferences,
          );
        },
      });

      return;
    }

    deleteMutation.mutate(currentAction.apiKey.id, {
      onSuccess: (result) => {
        setStatusMessage("API key deleted.");
        notify(
          {
            id: "api_keys.deleted",
            title: "API key deleted.",
            description: result.name,
          },
          actor.notificationPreferences,
        );
      },
      onError: (error) => {
        const message = error instanceof Error ? error.message : "Delete failed.";

        setErrorMessage(message);
        notify(
          {
            id: "api_keys.delete.failed",
            title: message,
            description: currentAction.apiKey.name,
          },
          actor.notificationPreferences,
        );
      },
    });
  }

  return {
    apiKeysQuery,
    createMutation,
    deleteMutation,
    errorMessage,
    isCreateOpen,
    isExpanded,
    notificationPreferences: actor.notificationPreferences,
    pendingAction,
    revealedKey,
    rotateMutation,
    setErrorMessage,
    setIsCreateOpen,
    setIsExpanded,
    setPendingAction,
    setRevealedKey,
    setStatusMessage,
    statusMessage,
    confirmPendingAction,
    handleCreate,
  };
}

function ApiKeysSettingsView({ state }: { state: ApiKeysSettingsState }) {
  const isActionPending =
    state.createMutation.isPending ||
    state.rotateMutation.isPending ||
    state.deleteMutation.isPending;

  return (
    <div className="space-y-3">
      <ApiKeyServiceCard
        isExpanded={state.isExpanded}
        onToggle={() => state.setIsExpanded((current) => !current)}
      >
        <div className="space-y-3">
          <SettingsStatus
            errorMessage={state.errorMessage}
            statusId="api-keys-status"
            statusMessage={state.statusMessage}
          />
          <ApiKeysQueryContent state={state} />
        </div>
      </ApiKeyServiceCard>

      <CreateApiKeyDialog
        isOpen={state.isCreateOpen}
        isPending={state.createMutation.isPending}
        onClose={() => state.setIsCreateOpen(false)}
        onSubmit={state.handleCreate}
      />
      <ApiKeySecretDialog
        notificationPreferences={state.notificationPreferences}
        onClose={() => state.setRevealedKey(null)}
        reveal={state.revealedKey}
      />
      <ConfirmApiKeyActionDialog
        action={state.pendingAction}
        isPending={isActionPending}
        onClose={() => state.setPendingAction({ kind: "closed" })}
        onConfirm={state.confirmPendingAction}
      />
    </div>
  );
}

function ApiKeyServiceCard({
  children,
  isExpanded,
  onToggle,
}: {
  children: ReactNode;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const contentId = "api-keys-settings-content";

  return (
    <Card className="w-full overflow-hidden rounded-2xl bg-card/50 shadow-none">
      <CardHeader className="p-0">
        <button
          aria-controls={contentId}
          aria-expanded={isExpanded}
          aria-label={`${isExpanded ? "Collapse" : "Expand"} API key settings`}
          className={cn(
            "flex w-full min-w-0 cursor-pointer items-start gap-3 p-3 text-left transition-colors duration-200",
            "hover:bg-accent/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          )}
          onClick={onToggle}
          type="button"
        >
          <div
            aria-hidden="true"
            className="grid size-10 shrink-0 place-items-center rounded-xl border border-border bg-secondary text-secondary-foreground"
          >
            <KeyIcon className="size-5" />
          </div>
          <div className="min-w-0 flex-1 py-2.5">
            <CardTitle className="text-sm leading-5 sm:text-base">API Keys</CardTitle>
          </div>
          <CaretDownIcon
            aria-hidden="true"
            className={cn(
              "mt-3 size-4 shrink-0 text-muted-foreground transition-transform duration-200",
              isExpanded && "rotate-180",
            )}
          />
        </button>
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

function ApiKeysQueryContent({ state }: { state: ApiKeysSettingsState }) {
  if (state.apiKeysQuery.isLoading) {
    return <ApiKeysSkeleton />;
  }

  if (state.apiKeysQuery.isError) {
    return <ApiKeysError />;
  }

  return (
    <ApiKeysTable
      isMutating={state.rotateMutation.isPending || state.deleteMutation.isPending}
      onCreate={() => state.setIsCreateOpen(true)}
      onDelete={(apiKey) => state.setPendingAction({ apiKey, kind: "delete" })}
      onRotate={(apiKey) => state.setPendingAction({ apiKey, kind: "rotate" })}
      rows={state.apiKeysQuery.data ?? []}
    />
  );
}

function ApiKeysSkeleton() {
  return (
    <div className="space-y-2">
      <Skeleton className="h-12" />
      <Skeleton className="h-12" />
      <Skeleton className="h-12" />
    </div>
  );
}

function ApiKeysError() {
  return (
    <Card className="border-destructive/35 bg-destructive/5 shadow-none">
      <CardHeader>
        <CardTitle className="text-sm text-destructive">API keys failed to load.</CardTitle>
      </CardHeader>
    </Card>
  );
}

function ApiKeysTable({
  isMutating,
  onCreate,
  onDelete,
  onRotate,
  rows,
}: {
  isMutating: boolean;
  onCreate: () => void;
  onDelete: (apiKey: ApiKeySummary) => void;
  onRotate: (apiKey: ApiKeySummary) => void;
  rows: readonly ApiKeySummary[];
}) {
  return (
    <>
      <ApiKeysMobileList
        isMutating={isMutating}
        onCreate={onCreate}
        onDelete={onDelete}
        onRotate={onRotate}
        rows={rows}
      />
      <div className="hidden lg:block">
        <Table className="border-separate border-spacing-0" containerClassName="max-w-full bg-card">
          <TableHeader>
            <TableRow>
              <TableHead>Key</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Last used</TableHead>
              <TableHead>Rotated</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className={settingsTableActionHeaderClassName}>
                <CreateApiKeyTableAction onCreate={onCreate} />
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length > 0 ? (
              rows.map((apiKey) => (
                <ApiKeyRow
                  apiKey={apiKey}
                  isMutating={isMutating}
                  key={apiKey.id}
                  onDelete={onDelete}
                  onRotate={onRotate}
                />
              ))
            ) : (
              <TableRow>
                <TableCell className="text-center text-muted-foreground" colSpan={6}>
                  No API keys yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </>
  );
}

function ApiKeysMobileList({
  isMutating,
  onCreate,
  onDelete,
  onRotate,
  rows,
}: {
  isMutating: boolean;
  onCreate: () => void;
  onDelete: (apiKey: ApiKeySummary) => void;
  onRotate: (apiKey: ApiKeySummary) => void;
  rows: readonly ApiKeySummary[];
}) {
  return (
    <div className="rounded-2xl border border-border bg-card lg:hidden">
      <div className="flex items-center justify-between gap-3 border-border border-b px-3 py-2.5">
        <span className="text-sm font-medium text-foreground">API keys</span>
        <CreateApiKeyTableAction onCreate={onCreate} />
      </div>
      {rows.length > 0 ? (
        <div className="divide-y divide-border">
          {rows.map((apiKey) => (
            <ApiKeyMobileCard
              apiKey={apiKey}
              isMutating={isMutating}
              key={apiKey.id}
              onDelete={onDelete}
              onRotate={onRotate}
            />
          ))}
        </div>
      ) : (
        <p className="px-3 py-6 text-center text-muted-foreground text-sm">No API keys yet.</p>
      )}
    </div>
  );
}

function CreateApiKeyTableAction({ onCreate }: { onCreate: () => void }) {
  return (
    <Button
      aria-label="Create API key"
      className="size-8 rounded-xl border border-primary/35 bg-primary text-primary-foreground shadow-(--shadow-button) hover:translate-y-0 hover:bg-primary/90 hover:text-primary-foreground active:translate-y-0"
      onClick={onCreate}
      size="icon"
      type="button"
      variant="ghost"
    >
      <span aria-hidden="true" className="relative grid size-5 place-items-center">
        <KeyIcon className="size-4" />
        <PlusIcon className="absolute -top-0.5 -right-0.5 size-2.5 rounded-full bg-primary text-primary-foreground" />
      </span>
    </Button>
  );
}

function ApiKeyRow({
  apiKey,
  isMutating,
  onDelete,
  onRotate,
}: {
  apiKey: ApiKeySummary;
  isMutating: boolean;
  onDelete: (apiKey: ApiKeySummary) => void;
  onRotate: (apiKey: ApiKeySummary) => void;
}) {
  return (
    <TableRow>
      <TableCell className="min-w-56">
        <ApiKeyIdentity apiKey={apiKey} />
      </TableCell>
      <TableCell>
        <ApiKeyStatusBadge status={apiKey.status} />
      </TableCell>
      <TableCell>{formatDate(apiKey.lastUsedAt)}</TableCell>
      <TableCell>{formatDate(apiKey.rotatedAt)}</TableCell>
      <TableCell>{formatDate(apiKey.createdAt)}</TableCell>
      <TableCell className={settingsTableActionCellClassName}>
        <ApiKeyRowActions
          apiKey={apiKey}
          isMutating={isMutating}
          onDelete={onDelete}
          onRotate={onRotate}
        />
      </TableCell>
    </TableRow>
  );
}

function ApiKeyMobileCard({
  apiKey,
  isMutating,
  onDelete,
  onRotate,
}: {
  apiKey: ApiKeySummary;
  isMutating: boolean;
  onDelete: (apiKey: ApiKeySummary) => void;
  onRotate: (apiKey: ApiKeySummary) => void;
}) {
  return (
    <article className="p-3">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <ApiKeyIdentity apiKey={apiKey} />
        </div>
        <ApiKeyRowActions
          apiKey={apiKey}
          isMutating={isMutating}
          onDelete={onDelete}
          onRotate={onRotate}
        />
      </div>
      <dl className="mt-3 grid gap-2 text-sm">
        <MobileDefinition label="Status">
          <ApiKeyStatusBadge status={apiKey.status} />
        </MobileDefinition>
        <MobileDefinition label="Last used">{formatDate(apiKey.lastUsedAt)}</MobileDefinition>
        <MobileDefinition label="Rotated">{formatDate(apiKey.rotatedAt)}</MobileDefinition>
        <MobileDefinition label="Created">{formatDate(apiKey.createdAt)}</MobileDefinition>
      </dl>
    </article>
  );
}

function ApiKeyIdentity({ apiKey }: { apiKey: ApiKeySummary }) {
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-2 font-medium text-foreground">
        <KeyIcon aria-hidden="true" className="size-4 text-primary" />
        <span className="truncate">{apiKey.name}</span>
      </div>
      <div className="mt-1 flex min-w-0 flex-wrap items-center gap-2 text-muted-foreground text-xs">
        <span className="truncate font-mono">{apiKey.maskedKey}</span>
        <span className="font-mono">#{apiKey.fingerprint}</span>
      </div>
    </div>
  );
}

function MobileDefinition({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div className="grid gap-1">
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="min-w-0 text-foreground">{children}</dd>
    </div>
  );
}

function ApiKeyRowActions({
  apiKey,
  isMutating,
  onDelete,
  onRotate,
}: {
  apiKey: ApiKeySummary;
  isMutating: boolean;
  onDelete: (apiKey: ApiKeySummary) => void;
  onRotate: (apiKey: ApiKeySummary) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Open API key actions for ${apiKey.name}`}
        className="grid size-9 cursor-pointer place-items-center rounded-md text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        type="button"
      >
        <span className="sr-only">Open API key actions</span>
        <span aria-hidden="true" className="text-xl leading-none">
          …
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Actions</DropdownMenuLabel>
        <DropdownMenuItem disabled={isMutating} onSelect={() => onRotate(apiKey)}>
          Rotate key
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled={isMutating}
          onSelect={() => onDelete(apiKey)}
          variant="destructive"
        >
          Delete key
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ApiKeyStatusBadge({ status }: { status: ApiKeySummary["status"] }) {
  return status === "active" ? <Badge>Active</Badge> : <Badge variant="secondary">Deleted</Badge>;
}

function CreateApiKeyDialog({
  isOpen,
  isPending,
  onClose,
  onSubmit,
}: {
  isOpen: boolean;
  isPending: boolean;
  onClose: () => void;
  onSubmit: (input: { description: string | null; name: string }) => void;
}) {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const name = String(formData.get("name") ?? "").trim();
    const descriptionValue = String(formData.get("description") ?? "").trim();

    if (!name) {
      return;
    }

    onSubmit({
      name,
      description: descriptionValue || null,
    });
  }

  return (
    <Dialog onOpenChange={(open) => !open && onClose()} open={isOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New API key</DialogTitle>
          <DialogDescription>Shown once after save.</DialogDescription>
        </DialogHeader>
        <form className="space-y-3" id="create-api-key-form" onSubmit={handleSubmit}>
          <div className="space-y-1.5">
            <Label htmlFor="api-key-name">Name</Label>
            <Input id="api-key-name" name="name" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="api-key-description">Description</Label>
            <Input id="api-key-description" name="description" />
          </div>
        </form>
        <DialogFooter>
          <Button onClick={onClose} type="button" variant="outline">
            Cancel
          </Button>
          <Button disabled={isPending} form="create-api-key-form" type="submit">
            {isPending ? "Saving" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ApiKeySecretDialog({
  notificationPreferences,
  onClose,
  reveal,
}: {
  notificationPreferences: NotificationPreferences;
  onClose: () => void;
  reveal: ApiKeyReveal | null;
}) {
  function copySecret(secret: string) {
    void navigator.clipboard.writeText(secret).then(
      () =>
        notify({ id: "api_keys.secret.copied", title: "API key copied." }, notificationPreferences),
      () =>
        notify(
          { id: "api_keys.secret.copy.failed", title: "Copy failed." },
          notificationPreferences,
        ),
    );
  }

  return (
    <Dialog onOpenChange={(open) => !open && onClose()} open={Boolean(reveal)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Copy API key</DialogTitle>
          <DialogDescription>Shown once.</DialogDescription>
        </DialogHeader>
        {reveal ? <Input className="font-mono text-xs" readOnly value={reveal.secret} /> : null}
        <DialogFooter>
          {reveal ? (
            <Button onClick={() => copySecret(reveal.secret)} type="button" variant="outline">
              Copy
            </Button>
          ) : null}
          <Button onClick={onClose} type="button">
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ConfirmApiKeyActionDialog({
  action,
  isPending,
  onClose,
  onConfirm,
}: {
  action: PendingApiKeyAction;
  isPending: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const copy = readConfirmActionCopy(action);

  return (
    <Dialog onOpenChange={(open) => !open && onClose()} open={action.kind !== "closed"}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{copy.title}</DialogTitle>
          {copy.description ? <DialogDescription>{copy.description}</DialogDescription> : null}
        </DialogHeader>
        <DialogFooter>
          <Button disabled={isPending} onClick={onClose} type="button" variant="outline">
            Cancel
          </Button>
          <Button disabled={isPending} onClick={onConfirm} type="button" variant="destructive">
            {isPending ? "Working" : copy.actionLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function readConfirmActionCopy(action: PendingApiKeyAction): {
  actionLabel: string;
  description: string | null;
  title: string;
} {
  if (action.kind === "rotate") {
    return {
      actionLabel: "Rotate",
      description: action.apiKey.name,
      title: "Rotate key?",
    };
  }

  if (action.kind === "delete") {
    return {
      actionLabel: "Delete",
      description: action.apiKey.name,
      title: "Delete key?",
    };
  }

  return {
    actionLabel: "Confirm",
    description: null,
    title: "Confirm",
  };
}

function formatDate(value: string | null): string {
  return value ? new Date(value).toLocaleString() : "Never";
}
