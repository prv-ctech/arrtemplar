import type { AdminUserSummary, NotificationPreferences } from "@arrtemplar/shared";
import { Dialog } from "@/components/ui/dialog";
import { notify } from "@/features/notifications/notification-gateway";
import { useDeleteManagedUserMutation } from "./admin-users";
import { DeleteUserDialogContent } from "./delete-user-dialog-content";

type DeleteUserDialogProps = {
  notificationPreferences: NotificationPreferences;
  onClose: () => void;
  user: AdminUserSummary | null;
};

export function DeleteUserDialog({
  notificationPreferences,
  onClose,
  user,
}: DeleteUserDialogProps) {
  const deleteUserMutation = useDeleteManagedUserMutation();

  function handleOpenChange(open: boolean) {
    if (!open && !deleteUserMutation.isPending) {
      onClose();
    }
  }

  function deleteUser() {
    if (!user) {
      return;
    }

    deleteUserMutation.mutate(user.id, {
      onSuccess: () => {
        onClose();
        notify(
          {
            id: "users.deleted",
            title: "User deleted.",
          },
          notificationPreferences,
        );
      },
      onError: (error) => {
        notify(
          {
            id: "users.delete.failed",
            title: error instanceof Error ? error.message : "User delete failed.",
          },
          notificationPreferences,
        );
      },
    });
  }

  if (!user) {
    return <Dialog onOpenChange={handleOpenChange} open={false} />;
  }

  return (
    <Dialog onOpenChange={handleOpenChange} open>
      <DeleteUserDialogContent
        isDeleting={deleteUserMutation.isPending}
        onCancel={onClose}
        onDelete={deleteUser}
        username={user.username}
      />
    </Dialog>
  );
}
