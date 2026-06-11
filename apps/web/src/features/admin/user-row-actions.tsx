import type { AdminUserSummary, PublicUser } from "@arrtemplar/shared";
import { ShieldCheckIcon } from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type UserRowActionsProps = {
  actor: PublicUser;
  canChangePasswords: boolean;
  canEditPermissions: boolean;
  canToggleStatus: boolean;
  onChangePassword: (user: AdminUserSummary) => void;
  onEditPermissions: (user: AdminUserSummary) => void;
  onToggleStatus: (user: AdminUserSummary) => void;
  user: AdminUserSummary;
};

export function UserRowActions({
  actor,
  canChangePasswords,
  canEditPermissions,
  canToggleStatus,
  onChangePassword,
  onEditPermissions,
  onToggleStatus,
  user,
}: UserRowActionsProps) {
  const isActorRow = actor.id === user.id;
  const canRunManagedMutation = !isActorRow;
  const canChangeManagedPassword = canRunManagedMutation && canChangePasswords;
  const canEditManagedPermissions = canRunManagedMutation && canEditPermissions;
  const canToggleManagedStatus =
    canRunManagedMutation && canToggleStatus && canToggleUserStatus(actor, user);
  const showManagedActions =
    canChangeManagedPassword || canEditManagedPermissions || canToggleManagedStatus;
  const profileLink = isActorRow
    ? ({ to: "/profile" } as const)
    : ({ to: "/profile/$publicUserId", params: { publicUserId: user.id } } as const);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          aria-label={`Open user actions for ${user.username}`}
          className="size-9 text-muted-foreground hover:translate-y-0 hover:text-foreground active:translate-y-0 focus-visible:ring-0 focus-visible:shadow-none"
          size="icon"
          type="button"
          variant="ghost"
        >
          <span className="sr-only">Open user actions</span>
          <span aria-hidden="true" className="text-xl leading-none">
            …
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>User actions</DropdownMenuLabel>
        <DropdownMenuItem asChild>
          <Link {...profileLink}>View profile</Link>
        </DropdownMenuItem>
        {showManagedActions ? <DropdownMenuSeparator /> : null}
        {canChangeManagedPassword ? (
          <DropdownMenuItem onSelect={() => onChangePassword(user)}>
            Change password
          </DropdownMenuItem>
        ) : null}
        {canEditManagedPermissions ? (
          <DropdownMenuItem onSelect={() => onEditPermissions(user)}>
            <ShieldCheckIcon aria-hidden="true" className="size-4" />
            Edit permissions
          </DropdownMenuItem>
        ) : null}
        {canToggleManagedStatus ? (
          <DropdownMenuItem
            onSelect={() => onToggleStatus(user)}
            variant={user.disabledAt ? "default" : "destructive"}
          >
            {user.disabledAt ? "Restore user" : "Disable user"}
          </DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function canToggleUserStatus(actor: PublicUser, user: AdminUserSummary): boolean {
  return actor.id !== user.id;
}
