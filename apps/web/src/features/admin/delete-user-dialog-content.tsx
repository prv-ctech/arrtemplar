import { Button } from "@/components/ui/button";
import {
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type DeleteUserDialogContentProps = {
  isDeleting: boolean;
  onCancel: () => void;
  onDelete: () => void;
  username: string;
};

export function DeleteUserDialogContent({
  isDeleting,
  onCancel,
  onDelete,
  username,
}: DeleteUserDialogContentProps) {
  return (
    <DialogContent className="max-w-sm gap-3 rounded-2xl p-5" showCloseButton={!isDeleting}>
      <DeleteUserDialogHeader username={username} />
      <DeleteUserWarning />
      <DeleteUserDialogActions isDeleting={isDeleting} onCancel={onCancel} onDelete={onDelete} />
    </DialogContent>
  );
}

function DeleteUserDialogHeader({ username }: Pick<DeleteUserDialogContentProps, "username">) {
  return (
    <DialogHeader className="gap-1 pr-8 text-left">
      <DialogTitle>Delete this user?</DialogTitle>
      <DialogDescription className="wrap-break-word leading-5">
        {username} will be permanently removed. Audit logs stay for history.
      </DialogDescription>
    </DialogHeader>
  );
}

function DeleteUserWarning() {
  return (
    <p className="rounded-xl border border-destructive/25 bg-destructive/10 px-3 py-2 text-sm text-destructive">
      This cannot be undone.
    </p>
  );
}

function DeleteUserDialogActions({
  isDeleting,
  onCancel,
  onDelete,
}: Pick<DeleteUserDialogContentProps, "isDeleting" | "onCancel" | "onDelete">) {
  const deleteLabel = isDeleting ? "Deleting" : "Delete user";

  return (
    <DialogFooter className="pt-1">
      <Button disabled={isDeleting} onClick={onCancel} type="button" variant="ghost">
        Cancel
      </Button>
      <Button disabled={isDeleting} onClick={onDelete} type="button" variant="destructive">
        {deleteLabel}
      </Button>
    </DialogFooter>
  );
}
