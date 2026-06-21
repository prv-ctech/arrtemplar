import type {
  AdminUserSummary,
  NotificationPreferences,
  PermissionCatalogEntry,
  UserPermission,
} from "@arrtemplar/shared";
import { CaretDownIcon } from "@phosphor-icons/react";
import { useId, useState } from "react";
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
import { Separator } from "@/components/ui/separator";
import { notify } from "@/features/notifications/notification-gateway";
import { cn } from "@/lib/utils";
import { getExplicitPermissionSet, togglePermissionSelection } from "../user/permission-selection";
import { usePermissionCatalogQuery, useUpdateManagedUserPermissionsMutation } from "./admin-users";

const permissionCategoryOrder: readonly PermissionCatalogEntry["category"][] = [
  "system",
  "users",
  "profile",
  "settings",
];

const serviceOperatorPermissions: readonly UserPermission[] = [
  "settings:theme",
  "settings:services",
  "settings:library",
  "settings:import",
  "settings:notifications",
  "settings:logs",
];

const userManagerPermissions: readonly UserPermission[] = [
  "users:manage",
  "users:create",
  "users:update",
  "users:password",
  "users:permissions",
  "users:disable",
  "users:delete",
];

const permissionsDialogContentClassName = [
  "grid max-h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] max-w-6xl",
  "grid-rows-[auto_auto_minmax(0,1fr)_auto] gap-3 overflow-hidden",
  "p-4 sm:w-[calc(100vw-2rem)] sm:p-5 lg:w-[calc(100vw-4rem)]",
].join(" ");

const permissionRowClassName = [
  "grid cursor-pointer grid-cols-[auto_minmax(0,1fr)_auto]",
  "items-center gap-2 py-2 first:pt-0 last:pb-0",
].join(" ");

const presetCardTriggerClassName = [
  "flex w-full cursor-pointer items-center gap-3 p-3 text-left",
  "transition-colors duration-200 hover:bg-accent/70",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
].join(" ");

const presetButtonClassName = [
  "h-auto min-h-10 justify-start rounded-xl px-2.5 py-2 text-left text-xs",
  "shadow-none hover:translate-y-0 active:translate-y-0",
].join(" ");

type EditUserPermissionsDialogProps = {
  notificationPreferences: NotificationPreferences;
  onClose: () => void;
  user: AdminUserSummary | null;
};

type PermissionGroups = Map<PermissionCatalogEntry["category"], PermissionCatalogEntry[]>;

export function EditUserPermissionsDialog({
  notificationPreferences,
  onClose,
  user,
}: EditUserPermissionsDialogProps) {
  function handleOpenChange(open: boolean) {
    if (!open) {
      onClose();
    }
  }

  return (
    <Dialog onOpenChange={handleOpenChange} open={Boolean(user)}>
      {user ? (
        <EditUserPermissionsContent
          key={user.id}
          notificationPreferences={notificationPreferences}
          onClose={onClose}
          user={user}
        />
      ) : null}
    </Dialog>
  );
}

function EditUserPermissionsContent({
  notificationPreferences,
  onClose,
  user,
}: {
  notificationPreferences: NotificationPreferences;
  onClose: () => void;
  user: AdminUserSummary;
}) {
  const permissionCatalogQuery = usePermissionCatalogQuery();
  const updatePermissionsMutation = useUpdateManagedUserPermissionsMutation();
  const [permissionDraft, setPermissionDraft] = useState<Set<UserPermission> | null>(null);
  const [arePresetsExpanded, setArePresetsExpanded] = useState(false);
  const presetsContentId = useId();
  const permissionCatalog = permissionCatalogQuery.data ?? [];
  const permissionGroups = new Map<PermissionCatalogEntry["category"], PermissionCatalogEntry[]>();
  const selectedPermissions = permissionDraft ?? getExplicitPermissionSet(user.permissions);

  for (const entry of permissionCatalog) {
    permissionGroups.set(entry.category, [...(permissionGroups.get(entry.category) ?? []), entry]);
  }

  function togglePermission(permission: UserPermission) {
    setPermissionDraft((current) =>
      togglePermissionSelection(current ?? selectedPermissions, permission),
    );
  }

  function savePermissions() {
    updatePermissionsMutation.mutate(
      {
        userId: user.id,
        input: { permissions: [...selectedPermissions] },
      },
      {
        onSuccess: () => {
          onClose();
          notify(
            {
              id: "users.permissions.updated",
              title: "Permissions updated.",
            },
            notificationPreferences,
          );
        },
        onError: (error) => {
          notify(
            {
              id: "users.permissions.failed",
              title: error instanceof Error ? error.message : "Permission update failed.",
            },
            notificationPreferences,
          );
        },
      },
    );
  }

  function applyPreset(permissions: readonly UserPermission[]) {
    setPermissionDraft(new Set(permissions));
  }

  return (
    <DialogContent className={permissionsDialogContentClassName}>
      <PermissionsDialogHeader grantCount={selectedPermissions.size} username={user.username} />
      <PermissionsPresetCard
        arePresetsExpanded={arePresetsExpanded}
        onApplyPreset={applyPreset}
        onToggle={() => setArePresetsExpanded((current) => !current)}
        presetsContentId={presetsContentId}
      />
      <PermissionCategoryGrid
        onTogglePermission={togglePermission}
        permissionGroups={permissionGroups}
        selectedPermissions={selectedPermissions}
      />
      <PermissionsDialogFooter
        isSaving={updatePermissionsMutation.isPending}
        onSave={savePermissions}
      />
    </DialogContent>
  );
}

function PermissionsDialogHeader({
  grantCount,
  username,
}: {
  grantCount: number;
  username: string;
}) {
  return (
    <DialogHeader className="pr-8">
      <DialogTitle>Edit Permissions</DialogTitle>
      <DialogDescription>
        {username} has {grantCount} explicit grant{grantCount === 1 ? "" : "s"}. High-risk grants
        are marked.
      </DialogDescription>
    </DialogHeader>
  );
}

function PermissionsPresetCard({
  arePresetsExpanded,
  onApplyPreset,
  onToggle,
  presetsContentId,
}: {
  arePresetsExpanded: boolean;
  onApplyPreset: (permissions: readonly UserPermission[]) => void;
  onToggle: () => void;
  presetsContentId: string;
}) {
  return (
    <Card className="w-full overflow-hidden rounded-xl bg-card/40 shadow-none">
      <CardHeader className="p-0">
        <PresetCardTrigger
          arePresetsExpanded={arePresetsExpanded}
          onToggle={onToggle}
          presetsContentId={presetsContentId}
        />
      </CardHeader>
      {arePresetsExpanded ? (
        <PresetCardContent onApplyPreset={onApplyPreset} presetsContentId={presetsContentId} />
      ) : null}
    </Card>
  );
}

function PresetCardTrigger({
  arePresetsExpanded,
  onToggle,
  presetsContentId,
}: {
  arePresetsExpanded: boolean;
  onToggle: () => void;
  presetsContentId: string;
}) {
  return (
    <button
      aria-controls={presetsContentId}
      aria-expanded={arePresetsExpanded}
      className={presetCardTriggerClassName}
      onClick={onToggle}
      type="button"
    >
      <CardTitle className="min-w-0 flex-1 text-sm leading-5">Presets</CardTitle>
      <span className="hidden text-xs text-muted-foreground sm:inline">Apply common grants</span>
      <CaretDownIcon
        aria-hidden="true"
        className={cn(
          "size-4 shrink-0 text-muted-foreground transition-transform duration-200",
          arePresetsExpanded && "rotate-180",
        )}
      />
    </button>
  );
}

function PresetCardContent({
  onApplyPreset,
  presetsContentId,
}: {
  onApplyPreset: (permissions: readonly UserPermission[]) => void;
  presetsContentId: string;
}) {
  return (
    <>
      <Separator />
      <CardContent className="p-2" id={presetsContentId}>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,7rem),1fr))] gap-2">
          <PresetButton label="Default" onClick={() => onApplyPreset([])} />
          <PresetButton label="Full admin" onClick={() => onApplyPreset(["system:admin"])} />
          <PresetButton
            label="Service operator"
            onClick={() => onApplyPreset(serviceOperatorPermissions)}
          />
          <PresetButton
            label="User manager"
            onClick={() => onApplyPreset(userManagerPermissions)}
          />
        </div>
      </CardContent>
    </>
  );
}

function PresetButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Button className={presetButtonClassName} onClick={onClick} type="button" variant="outline">
      {label}
    </Button>
  );
}

function PermissionCategoryGrid({
  onTogglePermission,
  permissionGroups,
  selectedPermissions,
}: {
  onTogglePermission: (permission: UserPermission) => void;
  permissionGroups: PermissionGroups;
  selectedPermissions: ReadonlySet<UserPermission>;
}) {
  return (
    <fieldset className="min-h-0 overflow-y-auto overscroll-contain pr-1">
      <legend className="sr-only">Available permission grants</legend>
      <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-4">
        {permissionCategoryOrder.map((category) => (
          <PermissionCategorySection
            category={category}
            entries={permissionGroups.get(category) ?? []}
            key={category}
            onTogglePermission={onTogglePermission}
            selectedPermissions={selectedPermissions}
          />
        ))}
      </div>
    </fieldset>
  );
}

function PermissionCategorySection({
  category,
  entries,
  onTogglePermission,
  selectedPermissions,
}: {
  category: PermissionCatalogEntry["category"];
  entries: PermissionCatalogEntry[];
  onTogglePermission: (permission: UserPermission) => void;
  selectedPermissions: ReadonlySet<UserPermission>;
}) {
  if (!entries.length) {
    return null;
  }

  return (
    <section
      aria-labelledby={`permission-category-${category}`}
      className="min-w-0 rounded-xl border border-border bg-card/35 p-3"
    >
      <PermissionCategoryHeader category={category} count={entries.length} />
      <div className="divide-y divide-border/70">
        {entries.map((entry) => (
          <PermissionRow
            checked={selectedPermissions.has(entry.permission)}
            entry={entry}
            key={entry.permission}
            onTogglePermission={onTogglePermission}
          />
        ))}
      </div>
    </section>
  );
}

function PermissionCategoryHeader({
  category,
  count,
}: {
  category: PermissionCatalogEntry["category"];
  count: number;
}) {
  return (
    <div className="mb-2 flex items-center justify-between gap-3">
      <h3
        className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground"
        id={`permission-category-${category}`}
      >
        {category}
      </h3>
      <span className="text-xs text-muted-foreground">{count}</span>
    </div>
  );
}

function PermissionRow({
  checked,
  entry,
  onTogglePermission,
}: {
  checked: boolean;
  entry: PermissionCatalogEntry;
  onTogglePermission: (permission: UserPermission) => void;
}) {
  const highRisk = entry.risk === "critical" || entry.risk === "high";

  return (
    <label className={permissionRowClassName} title={entry.description}>
      <input
        checked={checked}
        className="size-4 accent-primary"
        onChange={() => onTogglePermission(entry.permission)}
        type="checkbox"
      />
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium text-foreground">{entry.label}</span>
        <span className="block truncate font-mono text-[11px] text-muted-foreground">
          {entry.permission}
        </span>
      </span>
      {highRisk ? (
        <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-amber-600">
          High risk
        </span>
      ) : null}
    </label>
  );
}

function PermissionsDialogFooter({ isSaving, onSave }: { isSaving: boolean; onSave: () => void }) {
  return (
    <DialogFooter className="border-t border-border pt-3">
      <Button disabled={isSaving} onClick={onSave} type="button">
        {isSaving ? "Saving" : "Save Permissions"}
      </Button>
    </DialogFooter>
  );
}
