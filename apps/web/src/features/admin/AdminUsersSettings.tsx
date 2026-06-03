import type {
  AdminPermissionCatalogEntry,
  AdminUserSummary,
  ManagedUserRole,
  UserPermission,
} from "@arrtemplar/shared";
import { ADMIN_PERMISSION_CATALOG } from "@arrtemplar/shared";
import { DotsThreeIcon, PlusIcon } from "@phosphor-icons/react";
import type { ComponentProps, FormEvent, ReactNode } from "react";
import { useState } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  useAdminPermissionCatalogQuery,
  useAdminUsersQuery,
  useChangeAdminUserPasswordMutation,
  useChangeAdminUserRoleMutation,
  useCreateAdminUserMutation,
  useDisableAdminUserMutation,
  useEnableAdminUserMutation,
  useUpdateAdminUserPermissionsMutation,
} from "@/features/admin/admin-users";
import { ApiClientError } from "@/lib/api-error";
import { cn } from "@/lib/utils";

const adminUserTimestampFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

type AdminUserDialogState =
  | { type: "none" }
  | { type: "password"; user: AdminUserSummary }
  | { type: "role"; user: AdminUserSummary }
  | { type: "permissions"; user: AdminUserSummary }
  | { type: "disable"; user: AdminUserSummary }
  | { type: "enable"; user: AdminUserSummary };

export function AdminUsersSettings() {
  const usersQuery = useAdminUsersQuery();
  const users = usersQuery.data ?? [];
  const [dialogState, setDialogState] = useState<AdminUserDialogState>({ type: "none" });
  const closeDialog = () => setDialogState({ type: "none" });

  return (
    <div className="flex min-h-[calc(100dvh-8rem)] flex-col gap-4 overflow-hidden">
      <div className="flex shrink-0 justify-end">
        <CreateUserDialog />
      </div>

      {usersQuery.isPending ? <UsersTableSkeleton /> : null}
      {usersQuery.isError ? <UsersErrorState onRetry={() => usersQuery.refetch()} /> : null}
      {usersQuery.isSuccess && users.length === 0 ? <UsersEmptyState /> : null}
      {usersQuery.isSuccess && users.length > 0 ? (
        <AdminUsersTable
          onChangePassword={(user) => setDialogState({ type: "password", user })}
          onChangeRole={(user) => setDialogState({ type: "role", user })}
          onManagePermissions={(user) => setDialogState({ type: "permissions", user })}
          onDisable={(user) => setDialogState({ type: "disable", user })}
          onEnable={(user) => setDialogState({ type: "enable", user })}
          users={users}
        />
      ) : null}

      {dialogState.type === "password" ? (
        <PasswordDialog onClose={closeDialog} user={dialogState.user} />
      ) : null}
      {dialogState.type === "role" ? (
        <RoleDialog onClose={closeDialog} user={dialogState.user} />
      ) : null}
      {dialogState.type === "permissions" ? (
        <PermissionsDialog onClose={closeDialog} user={dialogState.user} />
      ) : null}
      {dialogState.type === "disable" ? (
        <DisableUserAlert onClose={closeDialog} user={dialogState.user} />
      ) : null}
      {dialogState.type === "enable" ? (
        <EnableUserDialog onClose={closeDialog} user={dialogState.user} />
      ) : null}
    </div>
  );
}

function AdminUsersTable({
  onChangePassword,
  onChangeRole,
  onManagePermissions,
  onDisable,
  onEnable,
  users,
}: {
  onChangePassword: (user: AdminUserSummary) => void;
  onChangeRole: (user: AdminUserSummary) => void;
  onManagePermissions: (user: AdminUserSummary) => void;
  onDisable: (user: AdminUserSummary) => void;
  onEnable: (user: AdminUserSummary) => void;
  users: AdminUserSummary[];
}) {
  return (
    <div className="min-h-0 flex-1">
      <Table
        aria-label="Local user accounts"
        className="min-w-full table-fixed"
        containerClassName="h-full min-h-[22rem] overflow-auto rounded-3xl bg-card/55"
      >
        <TableHeader className="sticky top-0 z-10 bg-card/95 backdrop-blur">
          <TableRow>
            <TableHead className="w-[min(18rem,70vw)]">User</TableHead>
            <TableHead className="hidden w-24 sm:table-cell">Role</TableHead>
            <TableHead className="hidden md:table-cell">Permission grants</TableHead>
            <TableHead className="hidden w-28 lg:table-cell">Status</TableHead>
            <TableHead className="hidden w-44 xl:table-cell">Created</TableHead>
            <TableHead className="hidden w-44 xl:table-cell">Updated</TableHead>
            <TableHead className="w-14 text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((user) => (
            <TableRow key={user.id}>
              <TableCell className="max-w-0 align-top sm:align-middle">
                <div className="min-w-0 space-y-2">
                  <span className="block truncate font-medium text-foreground">
                    {user.username}
                  </span>
                  <span className="block break-all font-mono text-xs text-muted-foreground">
                    {user.id}
                  </span>
                  <div className="flex flex-wrap gap-1.5 lg:hidden">
                    <span className="sm:hidden">
                      <RoleBadge role={user.role} />
                    </span>
                    <StatusBadge disabledAt={user.disabledAt} />
                  </div>
                  <PermissionBadges className="md:hidden" limit={3} user={user} />
                  <p className="text-xs leading-5 text-muted-foreground xl:hidden">
                    Updated {formatTimestamp(user.updatedAt)}
                  </p>
                </div>
              </TableCell>
              <TableCell className="hidden sm:table-cell">
                <RoleBadge role={user.role} />
              </TableCell>
              <TableCell className="hidden md:table-cell">
                <PermissionsCell
                  onManagePermissions={() => onManagePermissions(user)}
                  user={user}
                />
              </TableCell>
              <TableCell className="hidden lg:table-cell">
                <StatusBadge disabledAt={user.disabledAt} />
              </TableCell>
              <TableCell className="hidden text-muted-foreground xl:table-cell">
                {formatTimestamp(user.createdAt)}
              </TableCell>
              <TableCell className="hidden text-muted-foreground xl:table-cell">
                {formatTimestamp(user.updatedAt)}
              </TableCell>
              <TableCell className="text-right align-top sm:align-middle">
                <AdminUserActionMenu
                  disabled={Boolean(user.disabledAt)}
                  onChangePassword={() => onChangePassword(user)}
                  onChangeRole={() => onChangeRole(user)}
                  onManagePermissions={() => onManagePermissions(user)}
                  onDisable={() => onDisable(user)}
                  onEnable={() => onEnable(user)}
                  canManagePermissions={user.role === "mod" && !user.disabledAt}
                  username={user.username}
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function AdminUserActionMenu({
  disabled,
  onChangePassword,
  onChangeRole,
  onManagePermissions,
  onDisable,
  onEnable,
  canManagePermissions,
  username,
}: {
  disabled: boolean;
  onChangePassword: () => void;
  onChangeRole: () => void;
  onManagePermissions: () => void;
  onDisable: () => void;
  onEnable: () => void;
  canManagePermissions: boolean;
  username: string;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          aria-label={`Open actions for ${username}`}
          size="icon"
          type="button"
          variant="ghost"
        >
          <DotsThreeIcon aria-hidden="true" className="size-5" weight="bold" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Account actions</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled={disabled} onSelect={onChangePassword}>
          Change password
        </DropdownMenuItem>
        <DropdownMenuItem disabled={disabled} onSelect={onChangeRole}>
          Change role
        </DropdownMenuItem>
        <DropdownMenuItem disabled={!canManagePermissions} onSelect={onManagePermissions}>
          Manage permissions
        </DropdownMenuItem>
        {disabled ? (
          <DropdownMenuItem onSelect={onEnable}>Restore access</DropdownMenuItem>
        ) : (
          <DropdownMenuItem onSelect={onDisable} variant="destructive">
            Remove access
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function CreateUserDialog() {
  const mutation = useCreateAdminUserMutation();
  const [open, setOpen] = useState(false);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  function resetForm() {
    setUsername("");
    setEmail("");
    setPassword("");
    mutation.reset();
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) {
      resetForm();
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    mutation.mutate(
      { username, email, password },
      {
        onSuccess: (user) => {
          toast.success(`Created local account for ${user.username}.`);
          handleOpenChange(false);
        },
      },
    );
  }

  return (
    <Dialog onOpenChange={handleOpenChange} open={open}>
      <Button onClick={() => setOpen(true)} type="button">
        Create user
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create local account</DialogTitle>
          <DialogDescription>
            New accounts are created with the user role. Promote them to mod if they need delegated
            account sections.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <FormField label="Username">
            <Input
              autoComplete="username"
              maxLength={80}
              onChange={(event) => setUsername(event.target.value)}
              required
              value={username}
            />
          </FormField>
          <FormField label="Email">
            <Input
              autoComplete="email"
              inputMode="email"
              onChange={(event) => setEmail(event.target.value)}
              required
              type="email"
              value={email}
            />
          </FormField>
          <FormField label="Temporary password">
            <Input
              autoComplete="new-password"
              minLength={12}
              onChange={(event) => setPassword(event.target.value)}
              required
              type="password"
              value={password}
            />
          </FormField>
          <MutationErrorMessage
            error={mutation.error}
            fallback="Could not create the local account."
          />
          <DialogFooter>
            <Button onClick={() => handleOpenChange(false)} type="button" variant="outline">
              Cancel
            </Button>
            <Button disabled={mutation.isPending} type="submit">
              {mutation.isPending ? "Creating…" : "Create user"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function PasswordDialog({ onClose, user }: { onClose: () => void; user: AdminUserSummary }) {
  const mutation = useChangeAdminUserPasswordMutation();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    if (password !== confirmPassword) {
      setFormError("Passwords do not match.");
      return;
    }

    mutation.mutate(
      { userId: user.id, input: { password } },
      {
        onSuccess: () => {
          toast.success(`Password updated for ${user.username}.`);
          onClose();
        },
      },
    );
  }

  return (
    <AdminUserDialogFrame
      description="This revokes existing sessions for the target user."
      onClose={onClose}
      title={`Change ${user.username}'s password`}
    >
      <form className="space-y-4" onSubmit={handleSubmit}>
        <FormField label="New password">
          <Input
            autoComplete="new-password"
            minLength={12}
            onChange={(event) => setPassword(event.target.value)}
            required
            type="password"
            value={password}
          />
        </FormField>
        <FormField label="Confirm new password">
          <Input
            autoComplete="new-password"
            minLength={12}
            onChange={(event) => setConfirmPassword(event.target.value)}
            required
            type="password"
            value={confirmPassword}
          />
        </FormField>
        <InlineErrorMessage message={formError} />
        <MutationErrorMessage
          error={mutation.error}
          fallback="Could not update the target password."
        />
        <DialogFooter>
          <Button onClick={onClose} type="button" variant="outline">
            Cancel
          </Button>
          <Button disabled={mutation.isPending} type="submit">
            {mutation.isPending ? "Updating…" : "Update password"}
          </Button>
        </DialogFooter>
      </form>
    </AdminUserDialogFrame>
  );
}

function RoleDialog({ onClose, user }: { onClose: () => void; user: AdminUserSummary }) {
  const mutation = useChangeAdminUserRoleMutation();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const role = formData.get("role");

    if (role !== "user" && role !== "mod") {
      toast.error("Choose a valid role.");
      return;
    }

    mutation.mutate(
      { userId: user.id, input: { role } },
      {
        onSuccess: (updatedUser) => {
          toast.success(`${updatedUser.username} is now ${updatedUser.role}.`);
          onClose();
        },
      },
    );
  }

  return (
    <AdminUserDialogFrame
      description="Role changes revoke the target user's active sessions."
      onClose={onClose}
      title={`Change ${user.username}'s role`}
    >
      <form className="space-y-4" onSubmit={handleSubmit}>
        <FormField label="Role">
          <NativeSelect defaultValue={user.role} name="role">
            <option value="user">User</option>
            <option value="mod">Mod</option>
          </NativeSelect>
        </FormField>
        <MutationErrorMessage error={mutation.error} fallback="Could not update the role." />
        <DialogFooter>
          <Button onClick={onClose} type="button" variant="outline">
            Cancel
          </Button>
          <Button disabled={mutation.isPending} type="submit">
            {mutation.isPending ? "Saving…" : "Save role"}
          </Button>
        </DialogFooter>
      </form>
    </AdminUserDialogFrame>
  );
}

function PermissionsDialog({ onClose, user }: { onClose: () => void; user: AdminUserSummary }) {
  const catalogQuery = useAdminPermissionCatalogQuery();
  const mutation = useUpdateAdminUserPermissionsMutation();
  const [selectedPermissions, setSelectedPermissions] = useState<Set<UserPermission>>(
    () => new Set(user.permissions),
  );

  function togglePermission(permission: UserPermission) {
    setSelectedPermissions((currentPermissions) => {
      const nextPermissions = new Set(currentPermissions);

      if (nextPermissions.has(permission)) {
        nextPermissions.delete(permission);
      } else {
        nextPermissions.add(permission);
      }

      return nextPermissions;
    });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    mutation.mutate(
      {
        userId: user.id,
        input: {
          permissions: [...selectedPermissions],
        },
      },
      {
        onSuccess: (updatedUser) => {
          toast.success(`Updated permission grants for ${updatedUser.username}.`);
          onClose();
        },
      },
    );
  }

  return (
    <AdminUserDialogFrame
      contentClassName="grid max-h-[calc(100dvh-1rem)] grid-rows-[auto_minmax(0,1fr)] gap-4 overflow-hidden p-0 sm:max-h-[calc(100dvh-2rem)]"
      description="Select the admin areas this mod can access. Saving revokes their active sessions."
      headerClassName="px-5 pt-5 sm:px-6 sm:pt-6"
      onClose={onClose}
      title={`Permission grants for ${user.username}`}
    >
      <form
        className="grid min-h-0 grid-rows-[minmax(0,1fr)_auto_auto] gap-4 px-5 pb-5 sm:px-6 sm:pb-6"
        onSubmit={handleSubmit}
      >
        <fieldset className="min-h-0 overflow-y-auto rounded-3xl border border-border bg-background/35 p-2">
          <legend className="sr-only">Available permission grants</legend>
          <div className="grid gap-2">
            {catalogQuery.isPending ? (
              <p className="text-sm text-muted-foreground">Loading permission catalog…</p>
            ) : null}
            {catalogQuery.isError ? (
              <p className="text-sm text-destructive">Could not load permission catalog.</p>
            ) : null}
            {catalogQuery.data?.map((entry) => (
              <PermissionOption
                entry={entry}
                key={entry.permission}
                onToggle={() => togglePermission(entry.permission)}
                selected={selectedPermissions.has(entry.permission)}
              />
            ))}
          </div>
        </fieldset>
        <MutationErrorMessage error={mutation.error} fallback="Could not update permissions." />
        <DialogFooter className="border-t border-border pt-3 sm:pt-0">
          <Button onClick={onClose} type="button" variant="outline">
            Cancel
          </Button>
          <Button disabled={mutation.isPending || catalogQuery.isPending} type="submit">
            {mutation.isPending ? "Saving…" : "Save permissions"}
          </Button>
        </DialogFooter>
      </form>
    </AdminUserDialogFrame>
  );
}

function PermissionOption({
  entry,
  onToggle,
  selected,
}: {
  entry: AdminPermissionCatalogEntry;
  onToggle: () => void;
  selected: boolean;
}) {
  const optionId = `permission-${entry.permission.replace(/[^a-z0-9]+/gi, "-")}`;
  const descriptionId = `${optionId}-description`;

  return (
    <div
      className={cn(
        "grid grid-cols-[auto_minmax(0,1fr)] items-start gap-3 rounded-2xl border p-3 text-sm transition-[background,border-color] duration-200",
        selected
          ? "border-primary/45 bg-primary/10"
          : "border-border bg-card/55 hover:border-primary/35 hover:bg-accent/45",
      )}
    >
      <Checkbox
        aria-describedby={descriptionId}
        checked={selected}
        className="mt-0.5"
        id={optionId}
        onChange={onToggle}
      />
      <div className="min-w-0 space-y-1.5">
        <Label
          className="inline-flex cursor-pointer flex-wrap items-center gap-2 text-sm font-medium leading-5 text-foreground"
          htmlFor={optionId}
        >
          {entry.label}
          {entry.risk === "high" ? <Badge variant="destructive">High risk</Badge> : null}
        </Label>
        <p className="text-sm leading-5 text-muted-foreground" id={descriptionId}>
          {entry.description}
        </p>
      </div>
    </div>
  );
}

function DisableUserAlert({ onClose, user }: { onClose: () => void; user: AdminUserSummary }) {
  const mutation = useDisableAdminUserMutation();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    mutation.mutate(
      { userId: user.id, input: {} },
      {
        onSuccess: (updatedUser) => {
          toast.success(`Removed access for ${updatedUser.username}.`);
          onClose();
        },
      },
    );
  }

  return (
    <AlertDialog onOpenChange={(open) => !open && onClose()} open>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove access for {user.username}?</AlertDialogTitle>
          <AlertDialogDescription>
            This disables the account, revokes active sessions, and prevents future sign-ins until
            access is restored.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <form className="space-y-4" id="admin-disable-user-form" onSubmit={handleSubmit}>
          <MutationErrorMessage error={mutation.error} fallback="Could not remove access." />
        </form>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onClose}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={mutation.isPending}
            form="admin-disable-user-form"
            type="submit"
          >
            {mutation.isPending ? "Removing…" : "Remove access"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function EnableUserDialog({ onClose, user }: { onClose: () => void; user: AdminUserSummary }) {
  const mutation = useEnableAdminUserMutation();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    mutation.mutate(
      { userId: user.id, input: { disabled: false } },
      {
        onSuccess: (updatedUser) => {
          toast.success(`Restored access for ${updatedUser.username}.`);
          onClose();
        },
      },
    );
  }

  return (
    <AdminUserDialogFrame
      description="Restoring access lets the user sign in again with their existing password."
      onClose={onClose}
      title={`Restore access for ${user.username}`}
    >
      <form className="space-y-4" onSubmit={handleSubmit}>
        <MutationErrorMessage error={mutation.error} fallback="Could not restore access." />
        <DialogFooter>
          <Button onClick={onClose} type="button" variant="outline">
            Cancel
          </Button>
          <Button disabled={mutation.isPending} type="submit">
            {mutation.isPending ? "Restoring…" : "Restore access"}
          </Button>
        </DialogFooter>
      </form>
    </AdminUserDialogFrame>
  );
}

function UsersTableSkeleton() {
  return (
    <div aria-busy="true" className="space-y-3">
      <span className="sr-only">Loading local accounts</span>
      {Array.from({ length: 4 }, (_, index) => (
        <Skeleton className="h-16" key={`admin-user-skeleton-${index}`} />
      ))}
    </div>
  );
}

function AdminUserDialogFrame({
  children,
  contentClassName,
  description,
  headerClassName,
  onClose,
  title,
}: {
  children: ReactNode;
  contentClassName?: string;
  description: string;
  headerClassName?: string;
  onClose: () => void;
  title: string;
}) {
  return (
    <Dialog onOpenChange={(open) => !open && onClose()} open>
      <DialogContent className={contentClassName}>
        <DialogHeader className={headerClassName}>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}

function UsersErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="rounded-4xl border border-destructive/30 bg-destructive/10 p-5" role="alert">
      <h2 className="font-semibold text-destructive">Could not load local accounts</h2>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        Refresh the account list or check the API connection.
      </p>
      <Button className="mt-4" onClick={onRetry} type="button" variant="outline">
        Retry
      </Button>
    </div>
  );
}

function UsersEmptyState() {
  return (
    <div className="rounded-4xl border border-dashed border-border bg-card/45 p-8 text-center">
      <h2 className="font-semibold text-foreground">No managed local accounts yet</h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
        Create the first non-admin local account when you are ready to delegate access.
      </p>
    </div>
  );
}

function RoleBadge({ role }: { role: ManagedUserRole }) {
  return <Badge variant={role === "mod" ? "default" : "secondary"}>{role}</Badge>;
}

function PermissionsCell({
  onManagePermissions,
  user,
}: {
  onManagePermissions: () => void;
  user: AdminUserSummary;
}) {
  const canManagePermissions = user.role === "mod" && !user.disabledAt;

  return (
    <div className="flex min-w-0 items-center justify-between gap-2">
      <PermissionBadges className="min-w-0" limit={4} user={user} />
      <Button
        aria-label={`Manage permissions for ${user.username}`}
        disabled={!canManagePermissions}
        onClick={onManagePermissions}
        size="icon"
        title={canManagePermissions ? "Manage permissions" : "Promote to mod to manage grants"}
        type="button"
        variant="outline"
      >
        <PlusIcon aria-hidden="true" className="size-4" weight="bold" />
      </Button>
    </div>
  );
}

function PermissionBadges({
  className,
  limit,
  user,
}: {
  className?: string;
  limit?: number;
  user: AdminUserSummary;
}) {
  if (user.permissions.length === 0) {
    return <span className={cn("text-sm text-muted-foreground", className)}>No grants</span>;
  }

  const visiblePermissions = limit ? user.permissions.slice(0, limit) : user.permissions;
  const remainingCount = limit ? Math.max(user.permissions.length - limit, 0) : 0;

  return (
    <div className={cn("flex min-w-0 flex-wrap gap-1.5", className)}>
      {visiblePermissions.map((permission) => (
        <Badge key={permission} variant="outline">
          {getPermissionLabel(permission)}
        </Badge>
      ))}
      {remainingCount > 0 ? <Badge variant="secondary">+{remainingCount}</Badge> : null}
    </div>
  );
}

function getPermissionLabel(permission: UserPermission): string {
  return (
    ADMIN_PERMISSION_CATALOG.find((entry) => entry.permission === permission)?.label ??
    permission.replace("admin:", "")
  );
}

function StatusBadge({ disabledAt }: { disabledAt: string | null }) {
  return disabledAt ? (
    <Badge variant="destructive">Disabled</Badge>
  ) : (
    <Badge variant="outline">Active</Badge>
  );
}

function FormField({ children, label }: { children: ReactNode; label: string }) {
  return (
    <Label className="flex flex-col items-start gap-2 text-muted-foreground">
      <span>{label}</span>
      {children}
    </Label>
  );
}

function NativeSelect({ className, ...props }: ComponentProps<"select">) {
  return (
    <select
      className={cn(
        "h-11 w-full rounded-2xl border border-input bg-background/50 px-4 py-2 text-sm text-foreground outline-none transition-[border-color,box-shadow] focus-visible:border-primary/70 focus-visible:ring-2 focus-visible:ring-primary/20 disabled:pointer-events-none disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

function InlineErrorMessage({ message }: { message: string | null }) {
  return message ? (
    <p
      className="rounded-2xl border border-destructive/35 bg-destructive/10 px-4 py-3 text-sm leading-6 text-destructive"
      role="alert"
    >
      {message}
    </p>
  ) : null;
}

function MutationErrorMessage({ error, fallback }: { error: Error | null; fallback: string }) {
  return <InlineErrorMessage message={readMutationError(error, fallback)} />;
}

function readMutationError(error: Error | null, fallback: string): string | null {
  if (!error) {
    return null;
  }

  return error instanceof ApiClientError ? error.message : fallback;
}

function formatTimestamp(value: string): string {
  return adminUserTimestampFormatter.format(new Date(value));
}
