import type { AdminUserSummary, PublicUser } from "@arrtemplar/shared";
import { UserCircleIcon, UserCirclePlusIcon } from "@phosphor-icons/react";
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
import { UserPermissionSummary } from "./user-permission-summary";
import { type UserRowActionCapabilities, UserRowActions } from "./user-row-actions";

const userActionColumnBaseClassName = [
  "sticky right-0 w-12 border-l border-border bg-card text-right",
  "shadow-[-1px_0_0_0_var(--border),-12px_0_0_0_var(--card)]",
  "sm:static sm:border-l-0 sm:bg-transparent sm:shadow-none",
].join(" ");

const userActionHeaderClassName = `${userActionColumnBaseClassName} z-30`;
const userActionCellClassName = `${userActionColumnBaseClassName} z-20`;

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
    <TableHead className={userActionHeaderClassName}>
      {canCreateUsers ? (
        <Button
          aria-label="Create user"
          className="size-8 rounded-xl border border-primary/35 bg-primary text-primary-foreground shadow-(--shadow-button) hover:translate-y-0 hover:bg-primary/90 hover:text-primary-foreground active:translate-y-0 focus-visible:ring-0 focus-visible:shadow-none"
          onClick={onCreateUser}
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
      <TableCell className={userActionCellClassName}>
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
