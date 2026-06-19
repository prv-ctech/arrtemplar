import type { AdminUserSummary, NotificationPreferences } from "@arrtemplar/shared";
import type { FormEvent } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { notify } from "@/features/notifications/notification-gateway";
import { useChangeManagedUserPasswordMutation } from "./admin-users";

type ChangeUserPasswordDialogProps = {
  notificationPreferences: NotificationPreferences;
  onClose: () => void;
  user: AdminUserSummary | null;
};

export function ChangeUserPasswordDialog({
  notificationPreferences,
  onClose,
  user,
}: ChangeUserPasswordDialogProps) {
  const changePasswordMutation = useChangeManagedUserPasswordMutation();

  function handleOpenChange(open: boolean) {
    if (!open) {
      onClose();
    }
  }

  function handlePasswordSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!user) {
      return;
    }

    const formData = new FormData(event.currentTarget);
    const password = String(formData.get("password") ?? "");

    changePasswordMutation.mutate(
      { userId: user.id, input: { password } },
      {
        onSuccess: () => {
          onClose();
          notify(
            {
              id: "users.password.changed",
              title: "Password updated.",
            },
            notificationPreferences,
          );
        },
        onError: (error) => {
          notify(
            {
              id: "users.password.failed",
              title: error instanceof Error ? error.message : "Password update failed.",
            },
            notificationPreferences,
          );
        },
      },
    );
  }

  return (
    <Dialog onOpenChange={handleOpenChange} open={Boolean(user)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Change Password</DialogTitle>
          <DialogDescription>
            Update the password for {user?.username ?? "this user"}.
          </DialogDescription>
        </DialogHeader>
        <ChangeUserPasswordForm
          isPending={changePasswordMutation.isPending}
          onSubmit={handlePasswordSubmit}
        />
      </DialogContent>
    </Dialog>
  );
}

function ChangeUserPasswordForm({
  isPending,
  onSubmit,
}: {
  isPending: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form className="space-y-4" onSubmit={onSubmit}>
      <Input name="password" placeholder="New password" required type="password" />
      <DialogFooter>
        <Button disabled={isPending} type="submit">
          {isPending ? "Saving" : "Save Password"}
        </Button>
      </DialogFooter>
    </form>
  );
}
