import type { ApiKeyReveal, ApiKeySummary, NotificationPreferences } from "@arrtemplar/shared";
import {
  ArrowsClockwiseIcon,
  DotsThreeVerticalIcon,
  KeyIcon,
  PlusIcon,
  TrashIcon,
} from "@phosphor-icons/react";
import { type FormEvent, Fragment, type ReactNode, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { TableCell, TableRow } from "@/components/ui/table";
import { notify } from "@/features/notifications/notification-gateway";
import { SettingsStatus } from "@/features/settings/SettingsPrimitives";
import { useAuthenticatedRouteUser } from "@/routes/authenticated-route-user";
import { AdminDesktopTable, ExpandableTableTitleButton } from "../admin-table-primitives";
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
  const [expandedKeyId, setExpandedKeyId] = useState<string | null>(null);
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
          setExpandedKeyId(result.apiKey.id);
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
        setExpandedKeyId(null);
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
    expandedKeyId,
    isCreateOpen,
    notificationPreferences: actor.notificationPreferences,
    pendingAction,
    revealedKey,
    rotateMutation,
    setErrorMessage,
    setExpandedKeyId,
    setIsCreateOpen,
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
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="grid size-7 shrink-0 place-items-center rounded-md border border-border bg-secondary text-secondary-foreground">
            <KeyIcon aria-hidden="true" className="size-4" />
          </span>
          <div className="min-w-0">
            <h2 className="text-base font-semibold leading-5 tracking-tight">API Keys</h2>
          </div>
        </div>
        <Button
          className="h-8 gap-1.5 rounded-md px-2.5 text-sm"
          onClick={() => state.setIsCreateOpen(true)}
          type="button"
        >
          <PlusIcon aria-hidden="true" className="size-4" />
          New key
        </Button>
      </div>

      <SettingsStatus
        errorMessage={state.errorMessage}
        statusId="api-keys-status"
        statusMessage={state.statusMessage}
      />

      <ApiKeysQueryContent state={state} />

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
    </section>
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
      expandedKeyId={state.expandedKeyId}
      isMutating={state.rotateMutation.isPending || state.deleteMutation.isPending}
      onDelete={(apiKey) => state.setPendingAction({ apiKey, kind: "delete" })}
      onRotate={(apiKey) => state.setPendingAction({ apiKey, kind: "rotate" })}
      onToggleExpand={state.setExpandedKeyId}
      rows={state.apiKeysQuery.data ?? []}
    />
  );
}

function ApiKeysSkeleton() {
  return (
    <div className="space-y-2">
      <Skeleton className="h-10 rounded-lg" />
      <Skeleton className="h-10 rounded-lg" />
      <Skeleton className="h-10 rounded-lg" />
    </div>
  );
}

function ApiKeysError() {
  return (
    <div className="rounded-lg border border-destructive/35 bg-destructive/5 p-3 text-sm font-medium text-destructive">
      API keys failed to load.
    </div>
  );
}

const API_KEY_DESKTOP_COLUMN_COUNT = 5;
const API_KEY_TABLE_COLUMNS = [
  { label: "Key" },
  { label: "Status" },
  { label: "Last used" },
  { label: "Created" },
  { align: "right", label: "Actions" },
] as const;

type ApiKeysTableProps = {
  expandedKeyId: string | null;
  isMutating: boolean;
  onDelete: (apiKey: ApiKeySummary) => void;
  onRotate: (apiKey: ApiKeySummary) => void;
  onToggleExpand: (apiKeyId: string | null) => void;
  rows: readonly ApiKeySummary[];
};

function ApiKeysTable(props: ApiKeysTableProps) {
  const { expandedKeyId, isMutating, onDelete, onRotate, onToggleExpand, rows } = props;

  return (
    <>
      <AdminDesktopTable columns={API_KEY_TABLE_COLUMNS}>
        {rows.length > 0 ? (
          rows.map((apiKey) => {
            const isExpanded = expandedKeyId === apiKey.id;

            return (
              <Fragment key={apiKey.id}>
                <TableRow
                  className="cursor-pointer"
                  data-state={isExpanded ? "selected" : undefined}
                  onClick={() => onToggleExpand(isExpanded ? null : apiKey.id)}
                >
                  <TableCell className="max-w-136 px-3 py-2">
                    <ApiKeyTitleButton
                      apiKey={apiKey}
                      expanded={isExpanded}
                      onToggle={() => onToggleExpand(isExpanded ? null : apiKey.id)}
                    />
                  </TableCell>
                  <TableCell className="px-3 py-2">
                    <ApiKeyStatusBadge status={apiKey.status} />
                  </TableCell>
                  <TableCell className="px-3 py-2 text-sm text-muted-foreground">
                    {formatDate(apiKey.lastUsedAt)}
                  </TableCell>
                  <TableCell className="px-3 py-2 text-sm text-muted-foreground">
                    {formatDate(apiKey.createdAt)}
                  </TableCell>
                  <TableCell
                    className="px-3 py-2 text-right"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <ApiKeyActionMenu
                      apiKey={apiKey}
                      disabled={isMutating}
                      onDelete={() => onDelete(apiKey)}
                      onRotate={() => onRotate(apiKey)}
                    />
                  </TableCell>
                </TableRow>
                {isExpanded ? (
                  <TableRow className="hover:bg-transparent">
                    <TableCell
                      className="bg-background/35 px-3 py-3"
                      colSpan={API_KEY_DESKTOP_COLUMN_COUNT}
                    >
                      <ApiKeyInlineDetail apiKey={apiKey} />
                    </TableCell>
                  </TableRow>
                ) : null}
              </Fragment>
            );
          })
        ) : (
          <TableRow className="hover:bg-transparent">
            <TableCell
              className="px-3 py-8 text-center text-sm text-muted-foreground"
              colSpan={API_KEY_DESKTOP_COLUMN_COUNT}
            >
              No API keys yet.
            </TableCell>
          </TableRow>
        )}
      </AdminDesktopTable>
      <ApiKeysMobileList {...props} />
    </>
  );
}

function ApiKeysMobileList({
  expandedKeyId,
  isMutating,
  onDelete,
  onRotate,
  onToggleExpand,
  rows,
}: ApiKeysTableProps) {
  return (
    <div className="grid gap-2 md:hidden">
      {rows.length > 0 ? (
        rows.map((apiKey) => (
          <ApiKeyMobileCard
            apiKey={apiKey}
            expanded={expandedKeyId === apiKey.id}
            isMutating={isMutating}
            key={apiKey.id}
            onDelete={() => onDelete(apiKey)}
            onRotate={() => onRotate(apiKey)}
            onToggleExpand={() => onToggleExpand(expandedKeyId === apiKey.id ? null : apiKey.id)}
          />
        ))
      ) : (
        <div className="rounded-lg border border-border/80 bg-card/50 px-3 py-8 text-center text-sm text-muted-foreground">
          No API keys yet.
        </div>
      )}
    </div>
  );
}

function ApiKeyMobileCard({
  apiKey,
  expanded,
  isMutating,
  onDelete,
  onRotate,
  onToggleExpand,
}: {
  apiKey: ApiKeySummary;
  expanded: boolean;
  isMutating: boolean;
  onDelete: () => void;
  onRotate: () => void;
  onToggleExpand: () => void;
}) {
  return (
    <article className="rounded-lg border border-border/80 bg-card/50 p-3">
      <div className="flex items-start justify-between gap-3">
        <ApiKeyTitleButton apiKey={apiKey} expanded={expanded} onToggle={onToggleExpand} />
        <ApiKeyActionMenu
          apiKey={apiKey}
          disabled={isMutating}
          onDelete={onDelete}
          onRotate={onRotate}
        />
      </div>
      <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
        <ApiKeyStatusBadge status={apiKey.status} />
        <span>{formatDate(apiKey.updatedAt)}</span>
      </div>
      {expanded ? (
        <div className="mt-3 border-t border-border pt-3">
          <ApiKeyInlineDetail apiKey={apiKey} />
        </div>
      ) : null}
    </article>
  );
}

function ApiKeyTitleButton({
  apiKey,
  expanded,
  onToggle,
}: {
  apiKey: ApiKeySummary;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <ExpandableTableTitleButton expanded={expanded} onToggle={onToggle}>
      <span className="grid min-w-0">
        <span className="block truncate text-sm font-medium text-foreground group-hover:text-primary">
          {apiKey.name}
        </span>
        <span className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground">
          {apiKey.maskedKey}
          <span className="ml-1">#{apiKey.fingerprint}</span>
        </span>
      </span>
    </ExpandableTableTitleButton>
  );
}

function ApiKeyInlineDetail({ apiKey }: { apiKey: ApiKeySummary }) {
  return (
    <div className="grid gap-3">
      {apiKey.description ? (
        <div className="rounded-lg border border-border/80 bg-background/60 p-3 text-sm leading-6 text-foreground">
          {apiKey.description}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">No description.</p>
      )}
      <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
        <ApiKeyDetail label="Fingerprint">
          <span className="font-mono">{apiKey.fingerprint}</span>
        </ApiKeyDetail>
        <ApiKeyDetail label="Created by">{apiKey.createdBy?.username ?? "—"}</ApiKeyDetail>
        <ApiKeyDetail label="Rotated">{formatDate(apiKey.rotatedAt)}</ApiKeyDetail>
        <ApiKeyDetail label="Created">{formatDate(apiKey.createdAt)}</ApiKeyDetail>
        <ApiKeyDetail label="Last used IP">{apiKey.lastUsedIpAddress ?? "—"}</ApiKeyDetail>
        <ApiKeyDetail label="User agent">{apiKey.lastUsedUserAgent ?? "—"}</ApiKeyDetail>
      </dl>
    </div>
  );
}

function ApiKeyDetail({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-3 border-b border-border/60 pb-1.5 text-sm sm:border-0 sm:pb-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 truncate text-right text-foreground">{children}</dd>
    </div>
  );
}

function ApiKeyActionMenu({
  apiKey,
  disabled,
  onDelete,
  onRotate,
}: {
  apiKey: ApiKeySummary;
  disabled: boolean;
  onDelete: () => void;
  onRotate: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          aria-label={`Open API key actions for ${apiKey.name}`}
          className="size-7 rounded-md p-0"
          disabled={disabled}
          size="icon"
          type="button"
          variant="ghost"
        >
          <DotsThreeVerticalIcon aria-hidden="true" className="size-4" weight="bold" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44 rounded-xl">
        <DropdownMenuItem disabled={disabled} onSelect={onRotate}>
          <ArrowsClockwiseIcon aria-hidden="true" className="size-4" />
          Rotate key
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled={disabled} onSelect={onDelete} variant="destructive">
          <TrashIcon aria-hidden="true" className="size-4" />
          Delete key
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ApiKeyStatusBadge({ status }: { status: ApiKeySummary["status"] }) {
  if (status === "active") {
    return (
      <Badge
        variant="outline"
        className="border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
      >
        Active
      </Badge>
    );
  }

  return (
    <Badge
      variant="outline"
      className="border-muted-foreground/25 bg-muted/40 text-muted-foreground"
    >
      Deleted
    </Badge>
  );
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
