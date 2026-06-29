import type { AdminUserSummary, PublicUser } from "@arrtemplar/shared";
import { CaretRightIcon } from "@phosphor-icons/react";
import { Fragment, type ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { UserPermissionSummary } from "./user-permission-summary";
import { type UserRowActionCapabilities, UserRowActions } from "./user-row-actions";

type AdminUsersTableCapabilities = UserRowActionCapabilities;
type AdminUsersTableProps = {
  actor: PublicUser;
  capabilities: AdminUsersTableCapabilities;
  expandedUserId: string | null;
  onChangePassword: (user: AdminUserSummary) => void;
  onDeleteUser: (user: AdminUserSummary) => void;
  onEditPermissions: (user: AdminUserSummary) => void;
  onToggleExpand: (userId: string | null) => void;
  onToggleStatus: (user: AdminUserSummary) => void;
  rows: readonly AdminUserSummary[];
};

const ADMIN_USERS_DESKTOP_COLUMN_COUNT = 5;

export function AdminUsersTable({
  actor,
  capabilities,
  expandedUserId,
  onChangePassword,
  onDeleteUser,
  onEditPermissions,
  onToggleExpand,
  onToggleStatus,
  rows,
}: AdminUsersTableProps) {
  return (
    <>
      <div className="hidden md:block">
        <Table containerClassName="rounded-lg border-border/80 bg-card/50 pb-0">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="h-8 px-3 text-xs">User</TableHead>
              <TableHead className="h-8 px-3 text-xs">Auth</TableHead>
              <TableHead className="h-8 px-3 text-xs">Status</TableHead>
              <TableHead className="h-8 px-3 text-xs">Updated</TableHead>
              <TableHead className="h-8 px-3 text-right text-xs">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length > 0 ? (
              rows.map((user) => {
                const isExpanded = expandedUserId === user.id;

                return (
                  <Fragment key={user.id}>
                    <TableRow data-state={isExpanded ? "selected" : undefined}>
                      <TableCell className="max-w-136 px-3 py-2">
                        <UserTitleButton
                          expanded={isExpanded}
                          onToggle={() => onToggleExpand(isExpanded ? null : user.id)}
                          user={user}
                        />
                      </TableCell>
                      <TableCell className="px-3 py-2">
                        <AuthMethodBadge method={user.authMethod ?? "local"} />
                      </TableCell>
                      <TableCell className="px-3 py-2">
                        <UserStatusBadge disabledAt={user.disabledAt} />
                      </TableCell>
                      <TableCell className="px-3 py-2 text-sm text-muted-foreground">
                        {formatUserDate(user.updatedAt)}
                      </TableCell>
                      <TableCell className="px-3 py-2 text-right">
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
                    {isExpanded ? (
                      <TableRow className="hover:bg-transparent">
                        <TableCell
                          className="bg-background/35 px-3 py-3"
                          colSpan={ADMIN_USERS_DESKTOP_COLUMN_COUNT}
                        >
                          <UserInlineDetail user={user} />
                        </TableCell>
                      </TableRow>
                    ) : null}
                  </Fragment>
                );
              })
            ) : (
              <TableRow className="hover:bg-transparent">
                <TableCell
                  className="px-3 py-8 text-center text-sm text-muted-foreground"
                  colSpan={ADMIN_USERS_DESKTOP_COLUMN_COUNT}
                >
                  No managed local accounts yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <AdminUsersMobileList
        actor={actor}
        capabilities={capabilities}
        expandedUserId={expandedUserId}
        onChangePassword={onChangePassword}
        onDeleteUser={onDeleteUser}
        onEditPermissions={onEditPermissions}
        onToggleExpand={onToggleExpand}
        onToggleStatus={onToggleStatus}
        rows={rows}
      />
    </>
  );
}

function AdminUsersMobileList({
  actor,
  capabilities,
  expandedUserId,
  onChangePassword,
  onDeleteUser,
  onEditPermissions,
  onToggleExpand,
  onToggleStatus,
  rows,
}: AdminUsersTableProps) {
  return (
    <div className="grid gap-2 md:hidden">
      {rows.length > 0 ? (
        rows.map((user) => (
          <AdminUserMobileCard
            actor={actor}
            capabilities={capabilities}
            expanded={expandedUserId === user.id}
            key={user.id}
            onChangePassword={onChangePassword}
            onDeleteUser={onDeleteUser}
            onEditPermissions={onEditPermissions}
            onToggleExpand={() => onToggleExpand(expandedUserId === user.id ? null : user.id)}
            onToggleStatus={onToggleStatus}
            user={user}
          />
        ))
      ) : (
        <div className="rounded-lg border border-border/80 bg-card/50 px-3 py-8 text-center text-sm text-muted-foreground">
          No managed local accounts yet.
        </div>
      )}
    </div>
  );
}

function UserTitleButton({
  expanded,
  onToggle,
  user,
}: {
  expanded: boolean;
  onToggle: () => void;
  user: AdminUserSummary;
}) {
  return (
    <button
      aria-expanded={expanded}
      className="group flex min-w-0 items-center gap-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      onClick={onToggle}
      type="button"
    >
      <CaretRightIcon
        aria-hidden="true"
        className={cn(
          "size-3.5 shrink-0 text-muted-foreground transition-transform",
          expanded && "rotate-90",
        )}
      />
      <span className="grid min-w-0">
        <span className="block truncate text-sm font-medium text-foreground group-hover:text-primary">
          {user.username}
        </span>
        <span className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground">
          {user.id}
        </span>
      </span>
    </button>
  );
}

function UserInlineDetail({ user }: { user: AdminUserSummary }) {
  return (
    <div className="grid gap-3">
      <div className="grid gap-1.5">
        <p className="text-xs font-medium text-muted-foreground">Permissions</p>
        <UserPermissionSummary permissions={user.permissions} />
      </div>
      <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
        <UserDetail label="Public ID">
          <span className="font-mono">{user.id}</span>
        </UserDetail>
        <UserDetail label="Auth">
          <AuthMethodBadge method={user.authMethod ?? "local"} />
        </UserDetail>
        <UserDetail label="Created">{formatUserDate(user.createdAt)}</UserDetail>
        <UserDetail label="Updated">{formatUserDate(user.updatedAt)}</UserDetail>
      </dl>
    </div>
  );
}

function UserDetail({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-3 border-b border-border/60 pb-1.5 text-sm sm:border-0 sm:pb-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 truncate text-right text-foreground">{children}</dd>
    </div>
  );
}

function AdminUserMobileCard({
  actor,
  capabilities,
  expanded,
  onChangePassword,
  onDeleteUser,
  onEditPermissions,
  onToggleExpand,
  onToggleStatus,
  user,
}: {
  actor: PublicUser;
  capabilities: AdminUsersTableCapabilities;
  expanded: boolean;
  onChangePassword: (user: AdminUserSummary) => void;
  onDeleteUser: (user: AdminUserSummary) => void;
  onEditPermissions: (user: AdminUserSummary) => void;
  onToggleExpand: () => void;
  onToggleStatus: (user: AdminUserSummary) => void;
  user: AdminUserSummary;
}) {
  return (
    <article className="rounded-lg border border-border/80 bg-card/50 p-3">
      <div className="flex items-start justify-between gap-3">
        <UserTitleButton expanded={expanded} onToggle={onToggleExpand} user={user} />
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
      <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <AuthMethodBadge method={user.authMethod ?? "local"} />
          <UserStatusBadge disabledAt={user.disabledAt} />
        </div>
        <span>{formatUserDate(user.updatedAt)}</span>
      </div>
      {expanded ? (
        <div className="mt-3 border-t border-border pt-3">
          <UserInlineDetail user={user} />
        </div>
      ) : null}
    </article>
  );
}

function UserStatusBadge({ disabledAt }: { disabledAt: string | null }) {
  if (disabledAt) {
    return (
      <Badge
        variant="outline"
        className="border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300"
      >
        Disabled
      </Badge>
    );
  }

  return (
    <Badge
      variant="outline"
      className="border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
    >
      Active
    </Badge>
  );
}

function AuthMethodBadge({ method }: { method: "local" | "oauth" }) {
  const isOauth = method === "oauth";

  return (
    <Badge
      variant="outline"
      className={cn(
        "capitalize",
        isOauth
          ? "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300"
          : "border-muted-foreground/25 bg-muted/40 text-muted-foreground",
      )}
    >
      {isOauth ? "OAuth" : "Local"}
    </Badge>
  );
}

function formatUserDate(value: string): string {
  return new Date(value).toLocaleDateString();
}
