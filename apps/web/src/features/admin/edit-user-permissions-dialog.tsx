import type { AdminUserSummary, NotificationPreferences, UserPermission } from "@arrtemplar/shared";
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
import { PermissionCategoryGrid, permissionsDialogContentClassName } from "./permission-grant-grid";

const serviceOperatorPermissions: readonly UserPermission[] = [
  "settings:theme",
  "settings:services",
  "settings:library",
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
  const selectedPermissions = permissionDraft ?? getExplicitPermissionSet(user.permissions);

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
        entries={permissionCatalog}
        onTogglePermission={togglePermission}
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

function PermissionsDialogFooter({ isSaving, onSave }: { isSaving: boolean; onSave: () => void }) {
  return (
    <DialogFooter className="border-t border-border pt-3">
      <Button disabled={isSaving} onClick={onSave} type="button">
        {isSaving ? "Saving" : "Save Permissions"}
      </Button>
    </DialogFooter>
  );
}
