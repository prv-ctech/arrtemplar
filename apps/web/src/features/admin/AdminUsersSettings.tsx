import {
  type AdminUserSummary,
  DEFAULT_SIGNED_IN_USER_PERMISSIONS,
  PERMISSION_CATALOG_BY_PERMISSION,
  type PermissionCatalogEntry,
  type PublicUser,
  SYSTEM_ADMIN_PERMISSION,
  type UserPermission,
} from "@arrtemplar/shared";
import { ShieldCheckIcon, UserCircleIcon, UserCirclePlusIcon } from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import { type FormEvent, useState } from "react";
import { toast } from "sonner";
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
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { canManageUsers, hasRequiredPermission } from "@/features/auth/auth-state";
import { useAuthenticatedRouteUser } from "@/routes/authenticated-route-user";
import { getExplicitPermissionSet, togglePermissionSelection } from "../user/permission-selection";
import {
  useChangeManagedUserPasswordMutation,
  useCreateUserMutation,
  useDisableManagedUserMutation,
  usePermissionCatalogQuery,
  useUpdateManagedUserPermissionsMutation,
  useUpdateManagedUserStatusMutation,
  useUsersQuery,
} from "./admin-users";

const userActionColumnBaseClassName = [
  "sticky right-0 w-12 border-l border-border bg-card text-right",
  "shadow-[-1px_0_0_0_var(--border),-12px_0_0_0_var(--card)]",
  "sm:static sm:border-l-0 sm:bg-transparent sm:shadow-none",
].join(" ");

const userActionHeaderClassName = `${userActionColumnBaseClassName} z-30`;
const userActionCellClassName = `${userActionColumnBaseClassName} z-20`;

export function AdminUsersSettings() {
  const actor = useAuthenticatedRouteUser();
  const usersQuery = useUsersQuery();
  const permissionCatalogQuery = usePermissionCatalogQuery();
  const createUserMutation = useCreateUserMutation();
  const changePasswordMutation = useChangeManagedUserPasswordMutation();
  const updatePermissionsMutation = useUpdateManagedUserPermissionsMutation();
  const disableUserMutation = useDisableManagedUserMutation();
  const updateStatusMutation = useUpdateManagedUserStatusMutation();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [passwordDialogUser, setPasswordDialogUser] = useState<AdminUserSummary | null>(null);
  const [permissionsDialogUser, setPermissionsDialogUser] = useState<AdminUserSummary | null>(null);
  const [selectedPermissions, setSelectedPermissions] = useState<Set<UserPermission>>(new Set());

  const canCreateUsers = hasRequiredPermission(actor, "users:create");
  const canChangePasswords = hasRequiredPermission(actor, "users:password");
  const canEditPermissions = hasRequiredPermission(actor, "users:permissions");
  const canToggleStatus = hasRequiredPermission(actor, "users:disable");
  const rows = usersQuery.data ?? [];
  const permissionCatalog = permissionCatalogQuery.data ?? [];
  const permissionGroups = new Map<PermissionCatalogEntry["category"], PermissionCatalogEntry[]>();

  for (const entry of permissionCatalog) {
    permissionGroups.set(entry.category, [...(permissionGroups.get(entry.category) ?? []), entry]);
  }

  function handleCreateUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    createUserMutation.mutate(
      {
        username: String(formData.get("username") ?? "").trim(),
        email: String(formData.get("email") ?? "").trim(),
        password: String(formData.get("password") ?? ""),
      },
      {
        onSuccess: () => {
          setIsCreateOpen(false);
          toast.success("User created.");
        },
        onError: (error) => {
          toast.error(error instanceof Error ? error.message : "User creation failed.");
        },
      },
    );
  }

  function handlePasswordSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!passwordDialogUser) {
      return;
    }

    const formData = new FormData(event.currentTarget);
    const password = String(formData.get("password") ?? "");

    changePasswordMutation.mutate(
      { userId: passwordDialogUser.id, input: { password } },
      {
        onSuccess: () => {
          setPasswordDialogUser(null);
          toast.success("Password updated.");
        },
        onError: (error) => {
          toast.error(error instanceof Error ? error.message : "Password update failed.");
        },
      },
    );
  }

  function openPermissionsDialog(user: AdminUserSummary) {
    setPermissionsDialogUser(user);
    setSelectedPermissions(getExplicitPermissionSet(user.permissions));
  }

  function togglePermission(permission: UserPermission) {
    setSelectedPermissions((current) => togglePermissionSelection(current, permission));
  }

  function savePermissions() {
    if (!permissionsDialogUser) {
      return;
    }

    updatePermissionsMutation.mutate(
      {
        userId: permissionsDialogUser.id,
        input: { permissions: [...selectedPermissions] },
      },
      {
        onSuccess: () => {
          setPermissionsDialogUser(null);
          toast.success("Permissions updated.");
        },
        onError: (error) => {
          toast.error(error instanceof Error ? error.message : "Permission update failed.");
        },
      },
    );
  }

  function applyPreset(permissions: readonly UserPermission[]) {
    setSelectedPermissions(new Set(permissions));
  }

  function toggleUserStatus(user: AdminUserSummary) {
    const callbacks = {
      onSuccess: () => {
        toast.success(user.disabledAt ? "User restored." : "User disabled.");
      },
      onError: (error: unknown) => {
        toast.error(error instanceof Error ? error.message : "Status update failed.");
      },
    };

    if (user.disabledAt) {
      updateStatusMutation.mutate({ userId: user.id, input: { disabled: false } }, callbacks);
      return;
    }

    disableUserMutation.mutate({ userId: user.id, input: {} }, callbacks);
  }

  if (!canManageUsers(actor)) {
    return null;
  }

  return (
    <div className="space-y-6">
      <Table className="border-separate border-spacing-0" containerClassName="max-w-full bg-card">
        <TableHeader>
          <TableRow>
            <TableHead>User</TableHead>
            <TableHead>Public ID</TableHead>
            <TableHead>Permissions</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Created</TableHead>
            <TableHead>Updated</TableHead>
            <TableHead className={userActionHeaderClassName}>
              {canCreateUsers ? (
                <Button
                  aria-label="Create user"
                  className="size-8 rounded-xl border border-primary/35 bg-primary text-primary-foreground shadow-(--shadow-button) hover:translate-y-0 hover:bg-primary/90 hover:text-primary-foreground active:translate-y-0 focus-visible:ring-0 focus-visible:shadow-none"
                  onClick={() => setIsCreateOpen(true)}
                  size="icon"
                  type="button"
                  variant="ghost"
                >
                  <UserCirclePlusIcon aria-hidden="true" className="pointer-events-none size-4" />
                </Button>
              ) : (
                <span className="sr-only">User actions</span>
              )}
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length > 0 ? (
            rows.map((user) => {
              return (
                <TableRow key={user.id}>
                  <TableCell>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 font-medium text-foreground">
                        <UserCircleIcon aria-hidden="true" className="size-4 text-primary" />
                        <span className="truncate">{user.username}</span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {user.id}
                  </TableCell>
                  <TableCell className="min-w-44 max-w-72 text-sm text-muted-foreground">
                    <UserPermissionSummary permissions={user.permissions} />
                  </TableCell>
                  <TableCell>{user.disabledAt ? "Disabled" : "Active"}</TableCell>
                  <TableCell>{new Date(user.createdAt).toLocaleDateString()}</TableCell>
                  <TableCell>{new Date(user.updatedAt).toLocaleDateString()}</TableCell>
                  <TableCell className={userActionCellClassName}>
                    <UserRowActions
                      actor={actor}
                      canChangePasswords={canChangePasswords}
                      canEditPermissions={canEditPermissions}
                      canToggleStatus={canToggleStatus}
                      onChangePassword={setPasswordDialogUser}
                      onEditPermissions={openPermissionsDialog}
                      onToggleStatus={toggleUserStatus}
                      user={user}
                    />
                  </TableCell>
                </TableRow>
              );
            })
          ) : (
            <TableRow>
              <TableCell className="text-center text-muted-foreground" colSpan={7}>
                No managed local accounts yet.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <Dialog onOpenChange={setIsCreateOpen} open={isCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create User</DialogTitle>
            <DialogDescription>
              Create a new local account for the /users directory.
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={handleCreateUser}>
            <Input name="username" placeholder="Username" required />
            <Input name="email" placeholder="user@example.local" required type="email" />
            <Input name="password" placeholder="Password" required type="password" />
            <DialogFooter>
              <Button disabled={createUserMutation.isPending} type="submit">
                {createUserMutation.isPending ? "Creating" : "Create User"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        onOpenChange={(open) => !open && setPasswordDialogUser(null)}
        open={Boolean(passwordDialogUser)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Password</DialogTitle>
            <DialogDescription>
              Update the password for {passwordDialogUser?.username ?? "this user"}.
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={handlePasswordSubmit}>
            <Input name="password" placeholder="New password" required type="password" />
            <DialogFooter>
              <Button disabled={changePasswordMutation.isPending} type="submit">
                {changePasswordMutation.isPending ? "Saving" : "Save Password"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        onOpenChange={(open) => {
          if (!open) {
            setPermissionsDialogUser(null);
            setSelectedPermissions(new Set());
          }
        }}
        open={Boolean(permissionsDialogUser)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Permissions</DialogTitle>
            <DialogDescription>
              Choose explicit permissions for {permissionsDialogUser?.username ?? "this user"}.
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Full admin is high risk. Grant <code>users:manage</code> for cross-user profile and
            settings access, and remember that <code>settings:theme</code> remains a per-user theme
            preference.
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
              onClick={() =>
                applyPreset([
                  "settings:services",
                  "settings:library",
                  "settings:import",
                  "settings:notifications",
                  "settings:logs",
                ])
              }
              size="sm"
              type="button"
              variant="outline"
            >
              Service operator
            </Button>
            <Button
              onClick={() =>
                applyPreset([
                  "users:manage",
                  "users:create",
                  "users:update",
                  "users:password",
                  "users:permissions",
                  "users:disable",
                ])
              }
              size="sm"
              type="button"
              variant="outline"
            >
              User manager
            </Button>
          </div>
          <fieldset className="grid gap-3">
            <legend className="text-sm font-medium text-foreground">
              Available permission grants
            </legend>
            {["system", "users", "profile", "settings"].map((category) => {
              const entries = permissionGroups.get(category as PermissionCatalogEntry["category"]);

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
      </Dialog>
    </div>
  );
}

function UserPermissionSummary({ permissions }: { permissions: readonly UserPermission[] }) {
  if (permissions.includes(SYSTEM_ADMIN_PERMISSION)) {
    return <Badge>Default: admin</Badge>;
  }

  const explicitPermissions = permissions.filter(
    (permission) => !DEFAULT_SIGNED_IN_USER_PERMISSIONS.includes(permission),
  );

  if (explicitPermissions.length === 0) {
    return <Badge variant="secondary">Default user</Badge>;
  }

  const visiblePermissions = explicitPermissions.slice(0, 2);
  const hiddenCount = explicitPermissions.length - visiblePermissions.length;

  return (
    <div className="flex max-w-full flex-wrap gap-1.5">
      <Badge variant="secondary">Default user</Badge>
      {visiblePermissions.map((permission) => (
        <Badge key={permission} title={permission} variant="outline">
          {getPermissionLabel(permission)}
        </Badge>
      ))}
      {hiddenCount > 0 ? <Badge variant="outline">+{hiddenCount} more</Badge> : null}
    </div>
  );
}

function UserRowActions({
  actor,
  canChangePasswords,
  canEditPermissions,
  canToggleStatus,
  onChangePassword,
  onEditPermissions,
  onToggleStatus,
  user,
}: {
  actor: PublicUser;
  canChangePasswords: boolean;
  canEditPermissions: boolean;
  canToggleStatus: boolean;
  onChangePassword: (user: AdminUserSummary) => void;
  onEditPermissions: (user: AdminUserSummary) => void;
  onToggleStatus: (user: AdminUserSummary) => void;
  user: AdminUserSummary;
}) {
  const isActorRow = actor.id === user.id;
  const canRunManagedMutation = !isActorRow;
  const showManagedActions =
    canRunManagedMutation &&
    (canChangePasswords ||
      canEditPermissions ||
      (canToggleStatus && canToggleUserStatus(actor, user)));

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          aria-label={`Open user actions for ${user.username}`}
          className="size-9 text-muted-foreground hover:translate-y-0 hover:text-foreground active:translate-y-0 focus-visible:ring-0 focus-visible:shadow-none"
          size="icon"
          type="button"
          variant="ghost"
        >
          <span className="sr-only">Open user actions</span>
          <span aria-hidden="true" className="text-xl leading-none">
            …
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>User actions</DropdownMenuLabel>
        <DropdownMenuItem asChild>
          <Link to="/users/$publicUserId" params={{ publicUserId: user.id }}>
            View profile
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          {isActorRow ? (
            <Link to="/profile/settings/main">Edit settings</Link>
          ) : (
            <Link to="/users/$publicUserId/settings/main" params={{ publicUserId: user.id }}>
              Edit settings
            </Link>
          )}
        </DropdownMenuItem>
        {showManagedActions ? <DropdownMenuSeparator /> : null}
        {canRunManagedMutation && canChangePasswords ? (
          <DropdownMenuItem onSelect={() => onChangePassword(user)}>
            Change password
          </DropdownMenuItem>
        ) : null}
        {canRunManagedMutation && canEditPermissions ? (
          <DropdownMenuItem onSelect={() => onEditPermissions(user)}>
            <ShieldCheckIcon aria-hidden="true" className="size-4" />
            Edit permissions
          </DropdownMenuItem>
        ) : null}
        {canToggleStatus && canToggleUserStatus(actor, user) ? (
          <DropdownMenuItem
            onSelect={() => onToggleStatus(user)}
            variant={user.disabledAt ? "default" : "destructive"}
          >
            {user.disabledAt ? "Restore user" : "Disable user"}
          </DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function canToggleUserStatus(actor: PublicUser, user: AdminUserSummary): boolean {
  return actor.id !== user.id;
}

function getPermissionLabel(permission: UserPermission): string {
  return PERMISSION_CATALOG_BY_PERMISSION.get(permission)?.label ?? permission;
}
