import type { AdminUserSummary, PermissionCatalogEntry, UserPermission } from "@arrtemplar/shared";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getExplicitPermissionSet, togglePermissionSelection } from "../user/permission-selection";
import { usePermissionCatalogQuery, useUpdateManagedUserPermissionsMutation } from "./admin-users";

const permissionCategoryOrder: readonly PermissionCatalogEntry["category"][] = [
  "system",
  "users",
  "profile",
  "settings",
];

const serviceOperatorPermissions: readonly UserPermission[] = [
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
];

type EditUserPermissionsDialogProps = {
  onClose: () => void;
  user: AdminUserSummary | null;
};

export function EditUserPermissionsDialog({ onClose, user }: EditUserPermissionsDialogProps) {
  function handleOpenChange(open: boolean) {
    if (!open) {
      onClose();
    }
  }

  return (
    <Dialog onOpenChange={handleOpenChange} open={Boolean(user)}>
      {user ? <EditUserPermissionsContent key={user.id} onClose={onClose} user={user} /> : null}
    </Dialog>
  );
}

function EditUserPermissionsContent({
  onClose,
  user,
}: {
  onClose: () => void;
  user: AdminUserSummary;
}) {
  const permissionCatalogQuery = usePermissionCatalogQuery();
  const updatePermissionsMutation = useUpdateManagedUserPermissionsMutation();
  const [permissionDraft, setPermissionDraft] = useState<Set<UserPermission> | null>(null);
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
          toast.success("Permissions updated.");
        },
        onError: (error) => {
          toast.error(error instanceof Error ? error.message : "Permission update failed.");
        },
      },
    );
  }

  function applyPreset(permissions: readonly UserPermission[]) {
    setPermissionDraft(new Set(permissions));
  }

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Edit Permissions</DialogTitle>
        <DialogDescription>Choose explicit permissions for {user.username}.</DialogDescription>
      </DialogHeader>
      <p className="text-sm text-muted-foreground">
        Full admin is high risk. Grant <code>users:manage</code> for cross-user profile and settings
        access, and remember that <code>settings:theme</code> remains a per-user theme preference.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => applyPreset([])} size="sm" type="button" variant="outline">
          Default user
        </Button>
        <Button
          onClick={() => applyPreset(["system:admin"])}
          size="sm"
          type="button"
          variant="outline"
        >
          Full admin
        </Button>
        <Button
          onClick={() => applyPreset(serviceOperatorPermissions)}
          size="sm"
          type="button"
          variant="outline"
        >
          Service operator
        </Button>
        <Button
          onClick={() => applyPreset(userManagerPermissions)}
          size="sm"
          type="button"
          variant="outline"
        >
          User manager
        </Button>
      </div>
      <fieldset className="grid gap-3">
        <legend className="text-sm font-medium text-foreground">Available permission grants</legend>
        {permissionCategoryOrder.map((category) => {
          const entries = permissionGroups.get(category);

          if (!entries?.length) {
            return null;
          }

          return (
            <div className="space-y-3" key={category}>
              <h3 className="text-sm font-semibold capitalize text-foreground">{category}</h3>
              {entries.map((entry) => {
                const checked = selectedPermissions.has(entry.permission);
                return (
                  <label
                    className="flex items-start gap-3 rounded-2xl border border-border p-3"
                    key={entry.permission}
                  >
                    <input
                      checked={checked}
                      onChange={() => togglePermission(entry.permission)}
                      type="checkbox"
                    />
                    <span className="min-w-0 space-y-1">
                      <span className="flex flex-wrap items-center gap-2 font-medium text-foreground">
                        <span>{entry.label}</span>
                        {entry.risk === "critical" || entry.risk === "high" ? (
                          <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-amber-600">
                            High risk
                          </span>
                        ) : null}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {entry.permission}
                      </span>
                      <span className="block text-sm text-muted-foreground">
                        {entry.description}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          );
        })}
      </fieldset>
      <DialogFooter>
        <Button
          disabled={updatePermissionsMutation.isPending}
          onClick={savePermissions}
          type="button"
        >
          {updatePermissionsMutation.isPending ? "Saving" : "Save Permissions"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
