import type { FormEvent } from "react";
import { toast } from "sonner";
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
import { useCreateUserMutation } from "./admin-users";

type CreateUserDialogProps = {
  onOpenChange: (open: boolean) => void;
  open: boolean;
};

export function CreateUserDialog({ onOpenChange, open }: CreateUserDialogProps) {
  const createUserMutation = useCreateUserMutation();

  function handleCreateUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    createUserMutation.mutate(
      {
        username: String(formData.get("username") ?? "").trim(),
        email: String(formData.get("email") ?? "").trim(),
        password: String(formData.get("password") ?? ""),
      },
      {
        onSuccess: () => {
          onOpenChange(false);
          toast.success("User created.");
        },
        onError: (error) => {
          toast.error(error instanceof Error ? error.message : "User creation failed.");
        },
      },
    );
  }

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create User</DialogTitle>
          <DialogDescription>
            Create a new local account for the settings users directory.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={handleCreateUser}>
          <Input name="username" placeholder="Username" required />
          <Input name="email" placeholder="user@example.local" required type="email" />
          <Input name="password" placeholder="Password" required type="password" />
          <DialogFooter>
            <Button disabled={createUserMutation.isPending} type="submit">
              {createUserMutation.isPending ? "Creating" : "Create User"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
