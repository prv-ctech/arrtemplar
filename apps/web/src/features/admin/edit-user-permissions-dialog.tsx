import type { AdminUserSummary, PermissionCatalogEntry, UserPermission } from "@arrtemplar/shared";
import { CaretDownIcon } from "@phosphor-icons/react";
import { useId, useState } from "react";
import { toast } from "sonner";
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
    <DialogContent className={permissionsDialogContentClassName}>
      <DialogHeader className="pr-8">
        <DialogTitle>Edit Permissions</DialogTitle>
        <DialogDescription>
          {user.username} has {selectedPermissions.size} explicit grant
          {selectedPermissions.size === 1 ? "" : "s"}. High-risk grants are marked.
        </DialogDescription>
      </DialogHeader>
      <Card className="w-full overflow-hidden rounded-xl bg-card/40 shadow-none">
        <CardHeader className="p-0">
          <button
            aria-controls={presetsContentId}
            aria-expanded={arePresetsExpanded}
            className={presetCardTriggerClassName}
            onClick={() => setArePresetsExpanded((current) => !current)}
            type="button"
          >
            <CardTitle className="min-w-0 flex-1 text-sm leading-5">Presets</CardTitle>
            <span className="hidden text-xs text-muted-foreground sm:inline">
              Apply common grants
            </span>
            <CaretDownIcon
              aria-hidden="true"
              className={cn(
                "size-4 shrink-0 text-muted-foreground transition-transform duration-200",
                arePresetsExpanded && "rotate-180",
              )}
            />
          </button>
        </CardHeader>
        {arePresetsExpanded ? (
          <>
            <Separator />
            <CardContent className="p-2" id={presetsContentId}>
              <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,7rem),1fr))] gap-2">
                <Button
                  className={presetButtonClassName}
                  onClick={() => applyPreset([])}
                  type="button"
                  variant="outline"
                >
                  Default
                </Button>
                <Button
                  className={presetButtonClassName}
                  onClick={() => applyPreset(["system:admin"])}
                  type="button"
                  variant="outline"
                >
                  Full admin
                </Button>
                <Button
                  className={presetButtonClassName}
                  onClick={() => applyPreset(serviceOperatorPermissions)}
                  type="button"
                  variant="outline"
                >
                  Service operator
                </Button>
                <Button
                  className={presetButtonClassName}
                  onClick={() => applyPreset(userManagerPermissions)}
                  type="button"
                  variant="outline"
                >
                  User manager
                </Button>
              </div>
            </CardContent>
          </>
        ) : null}
      </Card>
      <fieldset className="min-h-0 overflow-y-auto overscroll-contain pr-1">
        <legend className="sr-only">Available permission grants</legend>
        <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-4">
          {permissionCategoryOrder.map((category) => {
            const entries = permissionGroups.get(category);

            if (!entries?.length) {
              return null;
            }

            return (
              <section
                aria-labelledby={`permission-category-${category}`}
                className="min-w-0 rounded-xl border border-border bg-card/35 p-3"
                key={category}
              >
                <div className="mb-2 flex items-center justify-between gap-3">
                  <h3
                    className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground"
                    id={`permission-category-${category}`}
                  >
                    {category}
                  </h3>
                  <span className="text-xs text-muted-foreground">{entries.length}</span>
                </div>
                <div className="divide-y divide-border/70">
                  {entries.map((entry) => {
                    const checked = selectedPermissions.has(entry.permission);
                    const highRisk = entry.risk === "critical" || entry.risk === "high";

                    return (
                      <label
                        className={permissionRowClassName}
                        key={entry.permission}
                        title={entry.description}
                      >
                        <input
                          checked={checked}
                          className="size-4 accent-primary"
                          onChange={() => togglePermission(entry.permission)}
                          type="checkbox"
                        />
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium text-foreground">
                            {entry.label}
                          </span>
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
                  })}
                </div>
              </section>
            );
          })}
        </div>
      </fieldset>
      <DialogFooter className="border-t border-border pt-3">
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
