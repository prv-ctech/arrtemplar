import type { AdminUserSummary } from "@arrtemplar/shared";
import { useState } from "react";
import { toast } from "sonner";
import { canManageUsers, hasRequiredPermission } from "@/features/auth/auth-state";
import { useAuthenticatedRouteUser } from "@/routes/authenticated-route-user";
import {
  useDisableManagedUserMutation,
  useUpdateManagedUserStatusMutation,
  useUsersQuery,
} from "./admin-users";
import { AdminUsersTable } from "./admin-users-table";
import { ChangeUserPasswordDialog } from "./change-user-password-dialog";
import { CreateUserDialog } from "./create-user-dialog";
import { EditUserPermissionsDialog } from "./edit-user-permissions-dialog";

export function AdminUsersSettings() {
  const actor = useAuthenticatedRouteUser();
  const usersQuery = useUsersQuery();
  const disableUserMutation = useDisableManagedUserMutation();
  const updateStatusMutation = useUpdateManagedUserStatusMutation();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [passwordDialogUser, setPasswordDialogUser] = useState<AdminUserSummary | null>(null);
  const [permissionsDialogUser, setPermissionsDialogUser] = useState<AdminUserSummary | null>(null);

  const capabilities = {
    canCreateUsers: hasRequiredPermission(actor, "users:create"),
    canChangePasswords: hasRequiredPermission(actor, "users:password"),
    canEditPermissions: hasRequiredPermission(actor, "users:permissions"),
    canToggleStatus: hasRequiredPermission(actor, "users:disable"),
  };
  const rows = usersQuery.data ?? [];

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
      <AdminUsersTable
        actor={actor}
        capabilities={capabilities}
        onChangePassword={setPasswordDialogUser}
        onCreateUser={() => setIsCreateOpen(true)}
        onEditPermissions={setPermissionsDialogUser}
        onToggleStatus={toggleUserStatus}
        rows={rows}
      />

      <CreateUserDialog onOpenChange={setIsCreateOpen} open={isCreateOpen} />
      <ChangeUserPasswordDialog
        onClose={() => setPasswordDialogUser(null)}
        user={passwordDialogUser}
      />
      <EditUserPermissionsDialog
        onClose={() => setPermissionsDialogUser(null)}
        user={permissionsDialogUser}
      />
    </div>
  );
}
