import type { AdminUserSummary } from "@arrtemplar/shared";
import { UserCircleIcon, UserCirclePlusIcon } from "@phosphor-icons/react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { canManageUsers, hasRequiredPermission } from "@/features/auth/auth-state";
import { notify } from "@/features/notifications/notification-gateway";
import { useAuthenticatedRouteUser } from "@/routes/authenticated-route-user";
import {
  useDisableManagedUserMutation,
  useUpdateManagedUserStatusMutation,
  useUsersQuery,
} from "./admin-users";
import { AdminUsersTable } from "./admin-users-table";
import { ChangeUserPasswordDialog } from "./change-user-password-dialog";
import { CreateUserDialog } from "./create-user-dialog";
import { DeleteUserDialog } from "./delete-user-dialog";
import { EditUserPermissionsDialog } from "./edit-user-permissions-dialog";

export function AdminUsersSettings() {
  const actor = useAuthenticatedRouteUser();
  const usersQuery = useUsersQuery();
  const disableUserMutation = useDisableManagedUserMutation();
  const updateStatusMutation = useUpdateManagedUserStatusMutation();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [passwordDialogUser, setPasswordDialogUser] = useState<AdminUserSummary | null>(null);
  const [permissionsDialogUser, setPermissionsDialogUser] = useState<AdminUserSummary | null>(null);
  const [deleteDialogUser, setDeleteDialogUser] = useState<AdminUserSummary | null>(null);

  const capabilities = {
    canCreateUsers: hasRequiredPermission(actor, "users:create"),
    canChangePasswords: hasRequiredPermission(actor, "users:password"),
    canDeleteUsers: hasRequiredPermission(actor, "users:delete"),
    canEditPermissions: hasRequiredPermission(actor, "users:permissions"),
    canToggleStatus: hasRequiredPermission(actor, "users:disable"),
  };
  const rows = usersQuery.data ?? [];

  function toggleUserStatus(user: AdminUserSummary) {
    const callbacks = {
      onSuccess: () => {
        notify(
          {
            id: user.disabledAt ? "users.status.restored" : "users.status.disabled",
            title: user.disabledAt ? "User restored." : "User disabled.",
          },
          actor.notificationPreferences,
        );
      },
      onError: (error: unknown) => {
        notify(
          {
            id: "users.status.failed",
            title: error instanceof Error ? error.message : "Status update failed.",
          },
          actor.notificationPreferences,
        );
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
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="grid size-7 shrink-0 place-items-center rounded-md border border-border bg-secondary text-secondary-foreground">
            <UserCircleIcon aria-hidden="true" className="size-4" />
          </span>
          <h2 className="text-base font-semibold leading-5 tracking-tight">Users</h2>
        </div>
        {capabilities.canCreateUsers ? (
          <Button
            className="h-8 gap-1.5 rounded-md px-2.5 text-sm"
            onClick={() => setIsCreateOpen(true)}
            type="button"
          >
            <UserCirclePlusIcon aria-hidden="true" className="size-4" />
            New user
          </Button>
        ) : null}
      </div>

      <AdminUsersTable
        actor={actor}
        capabilities={capabilities}
        expandedUserId={expandedUserId}
        onChangePassword={setPasswordDialogUser}
        onDeleteUser={setDeleteDialogUser}
        onEditPermissions={setPermissionsDialogUser}
        onToggleExpand={setExpandedUserId}
        onToggleStatus={toggleUserStatus}
        rows={rows}
      />

      <CreateUserDialog
        notificationPreferences={actor.notificationPreferences}
        onOpenChange={setIsCreateOpen}
        open={isCreateOpen}
      />
      <ChangeUserPasswordDialog
        notificationPreferences={actor.notificationPreferences}
        onClose={() => setPasswordDialogUser(null)}
        user={passwordDialogUser}
      />
      <EditUserPermissionsDialog
        notificationPreferences={actor.notificationPreferences}
        onClose={() => setPermissionsDialogUser(null)}
        user={permissionsDialogUser}
      />
      <DeleteUserDialog
        notificationPreferences={actor.notificationPreferences}
        onClose={() => setDeleteDialogUser(null)}
        user={deleteDialogUser}
      />
    </section>
  );
}
