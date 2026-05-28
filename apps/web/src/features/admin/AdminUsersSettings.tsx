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

export function AdminUsersSettings() {
  const usersQuery = useAdminUsersQuery();
  const users = usersQuery.data ?? [];
  const [passwordTarget, setPasswordTarget] = useState<AdminUserSummary | null>(null);
  const [roleTarget, setRoleTarget] = useState<AdminUserSummary | null>(null);
  const [permissionsTarget, setPermissionsTarget] = useState<AdminUserSummary | null>(null);
  const [disableTarget, setDisableTarget] = useState<AdminUserSummary | null>(null);
  const [enableTarget, setEnableTarget] = useState<AdminUserSummary | null>(null);

  return (
    <div className="space-y-6">
      <section className="rounded-4xl border border-border bg-card/70 p-5 shadow-(--shadow-soft)">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <h2 className="text-lg font-semibold tracking-tight text-foreground">Local accounts</h2>
            <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
              Create managed non-admin local accounts, rotate passwords, grant mod permissions, and
              remove access by disabling accounts. Admin accounts manage their own profile in
              Account settings.
            </p>
          </div>
          <CreateUserDialog />
        </div>
      </section>

      {usersQuery.isPending ? <UsersTableSkeleton /> : null}
      {usersQuery.isError ? <UsersErrorState onRetry={() => usersQuery.refetch()} /> : null}
      {usersQuery.isSuccess && users.length === 0 ? <UsersEmptyState /> : null}
      {usersQuery.isSuccess && users.length > 0 ? (
        <AdminUsersTable
          onChangePassword={setPasswordTarget}
          onChangeRole={setRoleTarget}
          onManagePermissions={setPermissionsTarget}
          onDisable={setDisableTarget}
          onEnable={setEnableTarget}
          users={users}
        />
      ) : null}

      {passwordTarget ? (
        <PasswordDialog onClose={() => setPasswordTarget(null)} user={passwordTarget} />
      ) : null}
      {roleTarget ? <RoleDialog onClose={() => setRoleTarget(null)} user={roleTarget} /> : null}
      {permissionsTarget ? (
        <PermissionsDialog onClose={() => setPermissionsTarget(null)} user={permissionsTarget} />
      ) : null}
      {disableTarget ? (
        <DisableUserAlert onClose={() => setDisableTarget(null)} user={disableTarget} />
      ) : null}
      {enableTarget ? (
        <EnableUserDialog onClose={() => setEnableTarget(null)} user={enableTarget} />
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
    <Table aria-label="Local user accounts">
      <TableHeader>
        <TableRow>
          <TableHead>User</TableHead>
          <TableHead>Role</TableHead>
          <TableHead>Permission grants</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Created</TableHead>
          <TableHead>Updated</TableHead>
          <TableHead className="w-16 text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {users.map((user) => (
          <TableRow key={user.id}>
            <TableCell>
              <div className="flex flex-col gap-1">
                <span className="font-medium text-foreground">{user.username}</span>
                <span className="font-mono text-xs text-muted-foreground">{user.id}</span>
              </div>
            </TableCell>
            <TableCell>
              <RoleBadge role={user.role} />
            </TableCell>
            <TableCell>
              <PermissionsCell onManagePermissions={() => onManagePermissions(user)} user={user} />
            </TableCell>
            <TableCell>
              <StatusBadge disabledAt={user.disabledAt} />
            </TableCell>
            <TableCell className="text-muted-foreground">
              {formatTimestamp(user.createdAt)}
            </TableCell>
            <TableCell className="text-muted-foreground">
              {formatTimestamp(user.updatedAt)}
            </TableCell>
            <TableCell className="text-right">
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
  const [currentAdminPassword, setCurrentAdminPassword] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    if (password !== confirmPassword) {
      setFormError("Passwords do not match.");
      return;
    }

    mutation.mutate(
      { userId: user.id, input: { password, currentAdminPassword } },
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
      description="This revokes existing sessions for the target user. Confirm with your admin password."
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
        <AdminPasswordField onChange={setCurrentAdminPassword} value={currentAdminPassword} />
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
  const [role, setRole] = useState<ManagedUserRole>(user.role);
  const [currentAdminPassword, setCurrentAdminPassword] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    mutation.mutate(
      { userId: user.id, input: { role, currentAdminPassword } },
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
      description="Role changes revoke the target user's active sessions and require your admin password."
      onClose={onClose}
      title={`Change ${user.username}'s role`}
    >
      <form className="space-y-4" onSubmit={handleSubmit}>
        <FormField label="Role">
          <NativeSelect
            onChange={(event) => setRole(event.target.value as ManagedUserRole)}
            value={role}
          >
            <option value="user">User</option>
            <option value="mod">Mod</option>
          </NativeSelect>
        </FormField>
        <AdminPasswordField onChange={setCurrentAdminPassword} value={currentAdminPassword} />
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
  const [currentAdminPassword, setCurrentAdminPassword] = useState("");

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
          currentAdminPassword,
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
      description="Permission changes revoke the target user's active sessions and require your admin password. Grants apply only to mod accounts."
      onClose={onClose}
      title={`Permission grants for ${user.username}`}
    >
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="space-y-3 rounded-3xl border border-border bg-background/35 p-3">
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
        <AdminPasswordField onChange={setCurrentAdminPassword} value={currentAdminPassword} />
        <MutationErrorMessage error={mutation.error} fallback="Could not update permissions." />
        <DialogFooter>
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
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-border bg-card/60 p-3 text-sm">
      <input
        checked={selected}
        className="mt-1 size-4 accent-primary"
        onChange={onToggle}
        type="checkbox"
      />
      <span className="space-y-1">
        <span className="flex flex-wrap items-center gap-2 font-medium text-foreground">
          {entry.label}
          {entry.risk === "high" ? <Badge variant="destructive">High risk</Badge> : null}
        </span>
        <span className="block text-muted-foreground">{entry.description}</span>
        <span className="block font-mono text-xs text-muted-foreground">{entry.permission}</span>
      </span>
    </label>
  );
}

function DisableUserAlert({ onClose, user }: { onClose: () => void; user: AdminUserSummary }) {
  const mutation = useDisableAdminUserMutation();
  const [currentAdminPassword, setCurrentAdminPassword] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    mutation.mutate(
      { userId: user.id, input: { currentAdminPassword } },
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
          <AdminPasswordField onChange={setCurrentAdminPassword} value={currentAdminPassword} />
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
  const [currentAdminPassword, setCurrentAdminPassword] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    mutation.mutate(
      { userId: user.id, input: { disabled: false, currentAdminPassword } },
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
        <AdminPasswordField onChange={setCurrentAdminPassword} value={currentAdminPassword} />
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
    <div aria-busy="true" aria-label="Loading local accounts" className="space-y-3" role="status">
      {Array.from({ length: 4 }, (_, index) => (
        <Skeleton className="h-16" key={`admin-user-skeleton-${index}`} />
      ))}
    </div>
  );
}

function AdminUserDialogFrame({
  children,
  description,
  onClose,
  title,
}: {
  children: ReactNode;
  description: string;
  onClose: () => void;
  title: string;
}) {
  return (
    <Dialog onOpenChange={(open) => !open && onClose()} open>
      <DialogContent>
        <DialogHeader>
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
    <div className="flex items-center justify-between gap-2">
      <PermissionBadges user={user} />
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

function PermissionBadges({ user }: { user: AdminUserSummary }) {
  if (user.permissions.length === 0) {
    return <span className="text-sm text-muted-foreground">No grants</span>;
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {user.permissions.map((permission) => (
        <Badge key={permission} variant="outline">
          {getPermissionLabel(permission)}
        </Badge>
      ))}
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

function AdminPasswordField({
  onChange,
  value,
}: {
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <FormField label="Your admin password">
      <Input
        autoComplete="current-password"
        onChange={(event) => onChange(event.target.value)}
        required
        type="password"
        value={value}
      />
    </FormField>
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
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
