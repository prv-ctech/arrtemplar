import type { AdminUserSummary, PublicUser } from "@arrtemplar/shared";
import { UserCircleIcon, UserCirclePlusIcon } from "@phosphor-icons/react";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  settingsTableActionCellClassName,
  settingsTableActionHeaderClassName,
} from "./settings-table-action-column";
import { UserPermissionSummary } from "./user-permission-summary";
import { type UserRowActionCapabilities, UserRowActions } from "./user-row-actions";

type AdminUsersTableCapabilities = UserRowActionCapabilities & {
  canCreateUsers: boolean;
};
type AdminUsersTableProps = {
  actor: PublicUser;
  capabilities: AdminUsersTableCapabilities;
  onChangePassword: (user: AdminUserSummary) => void;
  onCreateUser: () => void;
  onDeleteUser: (user: AdminUserSummary) => void;
  onEditPermissions: (user: AdminUserSummary) => void;
  onToggleStatus: (user: AdminUserSummary) => void;
  rows: readonly AdminUserSummary[];
};

export function AdminUsersTable({
  actor,
  capabilities,
  onChangePassword,
  onCreateUser,
  onDeleteUser,
  onEditPermissions,
  onToggleStatus,
  rows,
}: AdminUsersTableProps) {
  return (
    <>
      <AdminUsersMobileList
        actor={actor}
        capabilities={capabilities}
        onChangePassword={onChangePassword}
        onCreateUser={onCreateUser}
        onDeleteUser={onDeleteUser}
        onEditPermissions={onEditPermissions}
        onToggleStatus={onToggleStatus}
        rows={rows}
      />
      <div className="hidden lg:block">
        <Table className="border-separate border-spacing-0" containerClassName="max-w-full bg-card">
          <AdminUsersTableHeader
            canCreateUsers={capabilities.canCreateUsers}
            onCreateUser={onCreateUser}
          />
          <AdminUsersTableBody
            actor={actor}
            capabilities={capabilities}
            onChangePassword={onChangePassword}
            onDeleteUser={onDeleteUser}
            onEditPermissions={onEditPermissions}
            onToggleStatus={onToggleStatus}
            rows={rows}
          />
        </Table>
      </div>
    </>
  );
}

function AdminUsersMobileList({
  actor,
  capabilities,
  onChangePassword,
  onCreateUser,
  onDeleteUser,
  onEditPermissions,
  onToggleStatus,
  rows,
}: AdminUsersTableProps) {
  return (
    <div className="rounded-2xl border border-border bg-card lg:hidden">
      <div className="flex items-center justify-between gap-3 border-border border-b px-3 py-2.5">
        <span className="text-sm font-medium text-foreground">Users</span>
        {capabilities.canCreateUsers ? <CreateUserButton onCreateUser={onCreateUser} /> : null}
      </div>
      {rows.length > 0 ? (
        <div className="divide-y divide-border">
          {rows.map((user) => (
            <AdminUserMobileCard
              actor={actor}
              capabilities={capabilities}
              key={user.id}
              onChangePassword={onChangePassword}
              onDeleteUser={onDeleteUser}
              onEditPermissions={onEditPermissions}
              onToggleStatus={onToggleStatus}
              user={user}
            />
          ))}
        </div>
      ) : (
        <p className="px-3 py-6 text-center text-muted-foreground text-sm">
          No managed local accounts yet.
        </p>
      )}
    </div>
  );
}

function AdminUsersTableHeader({
  canCreateUsers,
  onCreateUser,
}: {
  canCreateUsers: boolean;
  onCreateUser: () => void;
}) {
  return (
    <TableHeader>
      <TableRow>
        <TableHead>User</TableHead>
        <TableHead>Public ID</TableHead>
        <TableHead>Auth</TableHead>
        <TableHead>Permissions</TableHead>
        <TableHead>Status</TableHead>
        <TableHead>Created</TableHead>
        <TableHead>Updated</TableHead>
        <CreateUserHeaderAction canCreateUsers={canCreateUsers} onCreateUser={onCreateUser} />
      </TableRow>
    </TableHeader>
  );
}

function AdminUsersTableBody({
  actor,
  capabilities,
  onChangePassword,
  onDeleteUser,
  onEditPermissions,
  onToggleStatus,
  rows,
}: Omit<AdminUsersTableProps, "onCreateUser">) {
  return (
    <TableBody>
      {rows.length > 0 ? (
        rows.map((user) => (
          <AdminUserTableRow
            actor={actor}
            capabilities={capabilities}
            key={user.id}
            onChangePassword={onChangePassword}
            onDeleteUser={onDeleteUser}
            onEditPermissions={onEditPermissions}
            onToggleStatus={onToggleStatus}
            user={user}
          />
        ))
      ) : (
        <EmptyUsersRow />
      )}
    </TableBody>
  );
}

function CreateUserHeaderAction({
  canCreateUsers,
  onCreateUser,
}: {
  canCreateUsers: boolean;
  onCreateUser: () => void;
}) {
  return (
    <TableHead className={settingsTableActionHeaderClassName}>
      {canCreateUsers ? <CreateUserButton onCreateUser={onCreateUser} /> : null}
      <span className="sr-only">User actions</span>
    </TableHead>
  );
}

function CreateUserButton({ onCreateUser }: { onCreateUser: () => void }) {
  return (
    <Button
      aria-label="Create user"
      className="size-8 rounded-xl border border-primary/35 bg-primary text-primary-foreground shadow-(--shadow-button) hover:translate-y-0 hover:bg-primary/90 hover:text-primary-foreground active:translate-y-0"
      onClick={onCreateUser}
      size="icon"
      type="button"
      variant="ghost"
    >
      <UserCirclePlusIcon aria-hidden="true" className="pointer-events-none size-4" />
    </Button>
  );
}

function AdminUserTableRow({
  actor,
  capabilities,
  onChangePassword,
  onDeleteUser,
  onEditPermissions,
  onToggleStatus,
  user,
}: Omit<AdminUsersTableProps, "onCreateUser" | "rows"> & { user: AdminUserSummary }) {
  return (
    <TableRow>
      <TableCell>
        <UserIdentityCell username={user.username} />
      </TableCell>
      <TableCell className="font-mono text-xs text-muted-foreground">{user.id}</TableCell>
      <TableCell>
        <AuthMethodBadge method={user.authMethod ?? "local"} />
      </TableCell>
      <TableCell className="min-w-44 max-w-72 text-sm text-muted-foreground">
        <UserPermissionSummary permissions={user.permissions} />
      </TableCell>
      <TableCell>{user.disabledAt ? "Disabled" : "Active"}</TableCell>
      <TableCell>{new Date(user.createdAt).toLocaleDateString()}</TableCell>
      <TableCell>{new Date(user.updatedAt).toLocaleDateString()}</TableCell>
      <TableCell className={settingsTableActionCellClassName}>
        <UserRowActions
          actor={actor}
          capabilities={capabilities}
          onChangePassword={onChangePassword}
          onDeleteUser={onDeleteUser}
          onEditPermissions={onEditPermissions}
          onToggleStatus={onToggleStatus}
          user={user}
        />
      </TableCell>
    </TableRow>
  );
}

function AdminUserMobileCard({
  actor,
  capabilities,
  onChangePassword,
  onDeleteUser,
  onEditPermissions,
  onToggleStatus,
  user,
}: Omit<AdminUsersTableProps, "onCreateUser" | "rows"> & { user: AdminUserSummary }) {
  return (
    <article className="p-3">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <UserIdentityCell username={user.username} />
          <div className="mt-1 truncate font-mono text-muted-foreground text-xs">{user.id}</div>
        </div>
        <UserRowActions
          actor={actor}
          capabilities={capabilities}
          onChangePassword={onChangePassword}
          onDeleteUser={onDeleteUser}
          onEditPermissions={onEditPermissions}
          onToggleStatus={onToggleStatus}
          user={user}
        />
      </div>
      <dl className="mt-3 grid gap-2 text-sm">
        <MobileDefinition label="Auth">
          <AuthMethodBadge method={user.authMethod ?? "local"} />
        </MobileDefinition>
        <MobileDefinition label="Permissions">
          <UserPermissionSummary permissions={user.permissions} />
        </MobileDefinition>
        <MobileDefinition label="Status">
          {user.disabledAt ? "Disabled" : "Active"}
        </MobileDefinition>
        <MobileDefinition label="Created">
          {new Date(user.createdAt).toLocaleDateString()}
        </MobileDefinition>
        <MobileDefinition label="Updated">
          {new Date(user.updatedAt).toLocaleDateString()}
        </MobileDefinition>
      </dl>
    </article>
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

function UserIdentityCell({ username }: { username: string }) {
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-2 font-medium text-foreground">
        <UserCircleIcon aria-hidden="true" className="size-4 text-primary" />
        <span className="truncate">{username}</span>
      </div>
    </div>
  );
}

function EmptyUsersRow() {
  return (
    <TableRow>
      <TableCell className="text-center text-muted-foreground" colSpan={8}>
        No managed local accounts yet.
      </TableCell>
    </TableRow>
  );
}

function AuthMethodBadge({ method }: { method: "local" | "oauth" }) {
  return (
    <Badge variant={method === "oauth" ? "default" : "secondary"}>
      {method === "oauth" ? "OAuth" : "Local"}
    </Badge>
  );
}
