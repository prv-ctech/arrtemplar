import {
  type ApiKeyReveal,
  type ApiKeySummary,
  isApiKeyEligiblePermission,
  PERMISSION_CATALOG_BY_PERMISSION,
  type UserPermission,
} from "@arrtemplar/shared";
import { CaretDownIcon, KeyIcon, PlusIcon } from "@phosphor-icons/react";
import type { FormEvent, ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
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
import { SettingsStatus } from "@/features/settings/SettingsPrimitives";
import { cn } from "@/lib/utils";
import { togglePermissionSelection } from "../../user/permission-selection";
import { usePermissionCatalogQuery } from "../admin-users";
import {
  PermissionCategoryGrid,
  permissionsDialogContentClassName,
} from "../permission-grant-grid";
import {
  useApiKeysQuery,
  useCreateApiKeyMutation,
  useDeleteApiKeyMutation,
  useRevokeApiKeyMutation,
  useUpdateApiKeyMutation,
} from "./api-keys";

type ApiKeyDialogMode =
  | { kind: "create" }
  | { apiKey: ApiKeySummary; kind: "edit" }
  | { kind: "closed" };
type PendingApiKeyAction =
  | { apiKey: ApiKeySummary; kind: "delete" | "revoke" }
  | { kind: "closed" };
type ApiKeysSettingsState = ReturnType<typeof useApiKeysSettingsState>;

const apiKeyActionColumnBaseClassName = [
  "sticky right-0 w-12 border-l border-border bg-card text-right",
  "shadow-[-1px_0_0_0_var(--border),-12px_0_0_0_var(--card)]",
  "sm:static sm:border-l-0 sm:bg-transparent sm:shadow-none",
].join(" ");

const apiKeyActionHeaderClassName = `${apiKeyActionColumnBaseClassName} z-30`;
const apiKeyActionCellClassName = `${apiKeyActionColumnBaseClassName} z-20`;

export function ApiKeysSettings() {
  return <ApiKeysSettingsView state={useApiKeysSettingsState()} />;
}

function useApiKeysSettingsState() {
  const apiKeysQuery = useApiKeysQuery();
  const revokeMutation = useRevokeApiKeyMutation();
  const deleteMutation = useDeleteApiKeyMutation();
  const [dialogMode, setDialogMode] = useState<ApiKeyDialogMode>({ kind: "closed" });
  const [pendingAction, setPendingAction] = useState<PendingApiKeyAction>({ kind: "closed" });
  const [revealedKey, setRevealedKey] = useState<ApiKeyReveal | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const rows = apiKeysQuery.data ?? [];

  function revokeApiKey(apiKey: ApiKeySummary) {
    setErrorMessage(null);
    revokeMutation.mutate(apiKey.id, {
      onSuccess: () => setStatusMessage("API key revoked."),
      onError: (error) => {
        setErrorMessage(error instanceof Error ? error.message : "Revoke failed.");
      },
    });
  }

  function deleteApiKey(apiKey: ApiKeySummary) {
    setErrorMessage(null);
    deleteMutation.mutate(apiKey.id, {
      onSuccess: () => setStatusMessage("API key deleted."),
      onError: (error) => {
        setErrorMessage(error instanceof Error ? error.message : "Delete failed.");
      },
    });
  }

  function confirmPendingAction() {
    if (pendingAction.kind === "closed") {
      return;
    }

    const apiKey = pendingAction.apiKey;
    const action = pendingAction.kind;
    setPendingAction({ kind: "closed" });

    getPendingActionHandler(action, {
      deleteApiKey,
      revokeApiKey,
    })(apiKey);
  }

  return {
    apiKeysQuery,
    deleteMutation,
    dialogMode,
    errorMessage,
    pendingAction,
    revealedKey,
    revokeMutation,
    rows,
    setDialogMode,
    setErrorMessage,
    setPendingAction,
    setRevealedKey,
    setStatusMessage,
    statusMessage,
    confirmPendingAction,
  };
}

function ApiKeysSettingsView({ state }: { state: ApiKeysSettingsState }) {
  const [isExpanded, setIsExpanded] = useState(true);
  const isLifecycleMutationPending =
    state.revokeMutation.isPending || state.deleteMutation.isPending;

  return (
    <div className="space-y-3">
      <ApiKeyServiceCard
        isExpanded={isExpanded}
        onToggle={() => setIsExpanded((current) => !current)}
      >
        <div className="space-y-3">
          <ApiKeyStatusMessage
            errorMessage={state.errorMessage}
            statusMessage={state.statusMessage}
          />
          <ApiKeysQueryContent state={state} />
        </div>
      </ApiKeyServiceCard>

      <ApiKeyFormDialog
        mode={state.dialogMode}
        onClose={() => state.setDialogMode({ kind: "closed" })}
        onError={state.setErrorMessage}
        onReveal={state.setRevealedKey}
        onStatus={state.setStatusMessage}
      />
      <ApiKeySecretDialog onClose={() => state.setRevealedKey(null)} reveal={state.revealedKey} />
      <ConfirmApiKeyActionDialog
        action={state.pendingAction}
        isPending={isLifecycleMutationPending}
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
        <ApiKeyServiceToggleButton
          contentId={contentId}
          isExpanded={isExpanded}
          onToggle={onToggle}
        />
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

function ApiKeyServiceToggleButton({
  contentId,
  isExpanded,
  onToggle,
}: {
  contentId: string;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  return (
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
      isMutating={state.revokeMutation.isPending || state.deleteMutation.isPending}
      onCreate={() => state.setDialogMode({ kind: "create" })}
      onDelete={(apiKey) => state.setPendingAction({ apiKey, kind: "delete" })}
      onEdit={(apiKey) => state.setDialogMode({ apiKey, kind: "edit" })}
      onRevoke={(apiKey) => state.setPendingAction({ apiKey, kind: "revoke" })}
      rows={state.rows}
    />
  );
}

function getPendingActionHandler(
  action: PendingApiKeyAction["kind"],
  handlers: {
    deleteApiKey: (apiKey: ApiKeySummary) => void;
    revokeApiKey: (apiKey: ApiKeySummary) => void;
  },
) {
  return {
    closed: () => undefined,
    delete: handlers.deleteApiKey,
    revoke: handlers.revokeApiKey,
  }[action];
}

function ApiKeyStatusMessage({
  errorMessage,
  statusMessage,
}: {
  errorMessage: string | null;
  statusMessage: string | null;
}) {
  return (
    <SettingsStatus
      errorMessage={errorMessage}
      statusId="api-keys-status"
      statusMessage={statusMessage}
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
  onEdit,
  onRevoke,
  rows,
}: {
  isMutating: boolean;
  onCreate: () => void;
  onDelete: (apiKey: ApiKeySummary) => void;
  onEdit: (apiKey: ApiKeySummary) => void;
  onRevoke: (apiKey: ApiKeySummary) => void;
  rows: readonly ApiKeySummary[];
}) {
  return (
    <Table className="border-separate border-spacing-0" containerClassName="max-w-full bg-card">
      <TableHeader>
        <TableRow>
          <TableHead>Key</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Permissions</TableHead>
          <TableHead>Last Used</TableHead>
          <TableHead>Expires</TableHead>
          <TableHead className={apiKeyActionHeaderClassName}>
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
              onEdit={onEdit}
              onRevoke={onRevoke}
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
  );
}

function CreateApiKeyTableAction({ onCreate }: { onCreate: () => void }) {
  return (
    <Button
      aria-label="Create API key"
      className="size-8 rounded-xl border border-primary/35 bg-primary text-primary-foreground shadow-(--shadow-button) hover:translate-y-0 hover:bg-primary/90 hover:text-primary-foreground active:translate-y-0 focus-visible:ring-0 focus-visible:shadow-none"
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
  onEdit,
  onRevoke,
}: {
  apiKey: ApiKeySummary;
  isMutating: boolean;
  onDelete: (apiKey: ApiKeySummary) => void;
  onEdit: (apiKey: ApiKeySummary) => void;
  onRevoke: (apiKey: ApiKeySummary) => void;
}) {
  return (
    <TableRow>
      <TableCell className="min-w-56">
        <div className="min-w-0">
          <div className="flex items-center gap-2 font-medium text-foreground">
            <KeyIcon aria-hidden="true" className="size-4 text-primary" />
            <span className="truncate">{apiKey.name}</span>
          </div>
          <div className="mt-1 truncate font-mono text-xs text-muted-foreground">
            {apiKey.maskedKey}
          </div>
        </div>
      </TableCell>
      <TableCell>
        <ApiKeyStatusBadge status={apiKey.status} />
      </TableCell>
      <TableCell className="min-w-44 max-w-72 text-sm text-muted-foreground">
        <ApiKeyPermissionSummary permissions={apiKey.permissions} />
      </TableCell>
      <TableCell>{formatDate(apiKey.lastUsedAt)}</TableCell>
      <TableCell>{apiKey.expiresAt ? formatDate(apiKey.expiresAt) : "No expiry"}</TableCell>
      <TableCell className={apiKeyActionCellClassName}>
        <ApiKeyRowActions
          apiKey={apiKey}
          isMutating={isMutating}
          onDelete={onDelete}
          onEdit={onEdit}
          onRevoke={onRevoke}
        />
      </TableCell>
    </TableRow>
  );
}

function ApiKeyRowActions({
  apiKey,
  isMutating,
  onDelete,
  onEdit,
  onRevoke,
}: {
  apiKey: ApiKeySummary;
  isMutating: boolean;
  onDelete: (apiKey: ApiKeySummary) => void;
  onEdit: (apiKey: ApiKeySummary) => void;
  onRevoke: (apiKey: ApiKeySummary) => void;
}) {
  const isActive = apiKey.status === "active";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Open API key actions for ${apiKey.name}`}
        className="grid size-9 cursor-pointer place-items-center rounded-md text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-0 focus-visible:shadow-none"
        type="button"
      >
        <span className="sr-only">Open API key actions</span>
        <span aria-hidden="true" className="text-xl leading-none">
          …
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>API key actions</DropdownMenuLabel>
        <DropdownMenuItem onSelect={() => onEdit(apiKey)}>Edit permissions</DropdownMenuItem>
        {isActive ? <DropdownMenuSeparator /> : null}
        {isActive ? (
          <DropdownMenuItem disabled={isMutating} onSelect={() => onRevoke(apiKey)}>
            Revoke key
          </DropdownMenuItem>
        ) : null}
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
  if (status === "active") {
    return <Badge>Active</Badge>;
  }

  return <Badge variant={status === "revoked" ? "destructive" : "secondary"}>{status}</Badge>;
}

function ApiKeyPermissionSummary({ permissions }: { permissions: readonly UserPermission[] }) {
  const visiblePermissions = permissions.slice(0, 3);
  const hiddenCount = permissions.length - visiblePermissions.length;

  if (permissions.length === 0) {
    return <Badge variant="secondary">No grants</Badge>;
  }

  return (
    <div className="flex max-w-full flex-wrap gap-1.5">
      {visiblePermissions.map((permission) => (
        <Badge key={permission} title={permission} variant="outline">
          {PERMISSION_CATALOG_BY_PERMISSION.get(permission)?.label ?? permission}
        </Badge>
      ))}
      {hiddenCount > 0 ? <Badge variant="outline">+{hiddenCount} more</Badge> : null}
    </div>
  );
}

function ApiKeyFormDialog({
  mode,
  onClose,
  onError,
  onReveal,
  onStatus,
}: {
  mode: ApiKeyDialogMode;
  onClose: () => void;
  onError: (message: string | null) => void;
  onReveal: (reveal: ApiKeyReveal) => void;
  onStatus: (message: string | null) => void;
}) {
  const createMutation = useCreateApiKeyMutation();
  const updateMutation = useUpdateApiKeyMutation();
  const permissionCatalogQuery = usePermissionCatalogQuery();
  const apiKey = mode.kind === "edit" ? mode.apiKey : null;
  const [selectedPermissions, setSelectedPermissions] = useState<Set<UserPermission>>(new Set());
  const eligiblePermissions = useMemo(
    () =>
      (permissionCatalogQuery.data ?? []).filter((entry) =>
        isApiKeyEligiblePermission(entry.permission),
      ),
    [permissionCatalogQuery.data],
  );

  useEffect(() => {
    setSelectedPermissions(new Set(apiKey?.permissions ?? []));
  }, [apiKey]);

  function handleOpenChange(open: boolean) {
    if (!open) {
      onClose();
      setSelectedPermissions(new Set());
    }
  }

  function togglePermission(permission: UserPermission) {
    setSelectedPermissions((current) => togglePermissionSelection(current, permission));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const permissions = [...selectedPermissions];
    const input = readApiKeyFormInput(new FormData(event.currentTarget), permissions);

    if (permissions.length === 0) {
      onError("Select at least one permission.");
      return;
    }

    onError(null);
    if (mode.kind === "create") {
      createMutation.mutate(input, {
        onSuccess: (result) => {
          onReveal(result);
          onStatus("API key created.");
          handleOpenChange(false);
        },
        onError: (error) => onError(error instanceof Error ? error.message : "Create failed."),
      });
      return;
    }

    if (apiKey) {
      updateMutation.mutate(
        { apiKeyId: apiKey.id, input },
        {
          onSuccess: () => {
            onStatus("API key updated.");
            handleOpenChange(false);
          },
          onError: (error) => onError(error instanceof Error ? error.message : "Update failed."),
        },
      );
    }
  }

  return (
    <Dialog onOpenChange={handleOpenChange} open={mode.kind !== "closed"}>
      <DialogContent className={permissionsDialogContentClassName}>
        <DialogHeader className="pr-8">
          <DialogTitle>{mode.kind === "create" ? "Create API Key" : "Edit API Key"}</DialogTitle>
          <DialogDescription>
            {selectedPermissions.size} selected grant{selectedPermissions.size === 1 ? "" : "s"}.
            High-risk grants are marked.
          </DialogDescription>
        </DialogHeader>
        <form
          className="min-h-0 space-y-3 overflow-y-auto pr-1"
          id="api-key-form"
          onSubmit={handleSubmit}
        >
          <ApiKeyMetadataFields apiKey={apiKey} />
          <PermissionCategoryGrid
            entries={eligiblePermissions}
            onTogglePermission={togglePermission}
            selectedPermissions={selectedPermissions}
          />
        </form>
        <DialogFooter className="border-t border-border pt-3">
          <Button
            disabled={createMutation.isPending || updateMutation.isPending}
            form="api-key-form"
            type="submit"
          >
            {createMutation.isPending || updateMutation.isPending ? "Saving" : "Save Key"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ApiKeyMetadataFields({ apiKey }: { apiKey: ApiKeySummary | null }) {
  const idPrefix = apiKey ? `api-key-${apiKey.id}` : "api-key-new";

  return (
    <div className="grid gap-3 rounded-xl border border-border bg-card/35 p-3 sm:grid-cols-2">
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-name`}>Key name</Label>
        <Input id={`${idPrefix}-name`} defaultValue={apiKey?.name ?? ""} name="name" required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-description`}>Description</Label>
        <Input
          id={`${idPrefix}-description`}
          defaultValue={apiKey?.description ?? ""}
          name="description"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-expires-at`}>Expires at</Label>
        <Input
          id={`${idPrefix}-expires-at`}
          defaultValue={toDateTimeLocalValue(apiKey?.expiresAt)}
          name="expiresAt"
          type="datetime-local"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-ip-allowlist`}>IP allowlist</Label>
        <Input
          id={`${idPrefix}-ip-allowlist`}
          defaultValue={apiKey?.ipAllowlist.join(", ") ?? ""}
          name="ipAllowlist"
          placeholder="192.0.2.10, 198.51.100.0/24"
        />
      </div>
    </div>
  );
}

function ApiKeySecretDialog({
  onClose,
  reveal,
}: {
  onClose: () => void;
  reveal: ApiKeyReveal | null;
}) {
  return (
    <Dialog onOpenChange={(open) => !open && onClose()} open={Boolean(reveal)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Copy API Key</DialogTitle>
          <DialogDescription>This secret is shown once. Store it before closing.</DialogDescription>
        </DialogHeader>
        {reveal ? <Input className="font-mono text-xs" readOnly value={reveal.secret} /> : null}
        <DialogFooter>
          {reveal ? (
            <Button
              onClick={() => void navigator.clipboard.writeText(reveal.secret)}
              type="button"
              variant="outline"
            >
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
          <DialogDescription>{copy.description}</DialogDescription>
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
  description: string;
  title: string;
} {
  if (action.kind === "revoke") {
    return {
      actionLabel: "Revoke Key",
      description: "External apps using this key will lose access immediately.",
      title: "Revoke this API key?",
    };
  }

  if (action.kind === "delete") {
    return {
      actionLabel: "Delete Key",
      description: "The key and its permission grants will be deleted from storage.",
      title: "Delete this API key?",
    };
  }

  return {
    actionLabel: "Confirm",
    description: "Confirm this API-key action.",
    title: "Confirm action",
  };
}

function readApiKeyFormInput(formData: FormData, permissions: UserPermission[]) {
  const description = String(formData.get("description") ?? "").trim();
  const expiresAtValue = String(formData.get("expiresAt") ?? "");
  const ipAllowlist = String(formData.get("ipAllowlist") ?? "")
    .split(/[\n,]/)
    .map((entry) => entry.trim())
    .filter(Boolean);

  return {
    name: String(formData.get("name") ?? "").trim(),
    permissions,
    description: description || null,
    expiresAt: expiresAtValue ? readDateTimeLocalIso(expiresAtValue) : null,
    ipAllowlist,
  };
}

function toDateTimeLocalValue(value: string | null | undefined): string {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

function readDateTimeLocalIso(value: string): string {
  return new Date(value).toISOString();
}

function formatDate(value: string | null): string {
  return value ? new Date(value).toLocaleDateString() : "Never";
}
