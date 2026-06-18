import type { AdminUserSummary, PublicUser } from "@arrtemplar/shared";
import { ShieldCheckIcon } from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

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

type ManagedActionState = {
  canChangePassword: boolean;
  canEditPermissions: boolean;
  canToggleStatus: boolean;
  showManagedActions: boolean;
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
  const managedActions = getManagedActionState({
    actor,
    canChangePasswords,
    canEditPermissions,
    canToggleStatus,
    isActorRow,
    user,
  });

  return (
    <DropdownMenu>
      <UserActionsTrigger username={user.username} />
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>User actions</DropdownMenuLabel>
        <ProfileMenuItem isActorRow={isActorRow} userId={user.id} />
        {managedActions.showManagedActions ? <DropdownMenuSeparator /> : null}
        <ManagedUserActionItems
          actions={managedActions}
          onChangePassword={onChangePassword}
          onEditPermissions={onEditPermissions}
          onToggleStatus={onToggleStatus}
          user={user}
        />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function getManagedActionState({
  actor,
  canChangePasswords,
  canEditPermissions,
  canToggleStatus,
  isActorRow,
  user,
}: Pick<
  UserRowActionsProps,
  "actor" | "canChangePasswords" | "canEditPermissions" | "canToggleStatus" | "user"
> & {
  isActorRow: boolean;
}): ManagedActionState {
  const canRunManagedMutation = !isActorRow;
  const state = {
    canChangePassword: canRunManagedMutation && canChangePasswords,
    canEditPermissions: canRunManagedMutation && canEditPermissions,
    canToggleStatus: canRunManagedMutation && canToggleStatus && canToggleUserStatus(actor, user),
  };

  return {
    ...state,
    showManagedActions:
      state.canChangePassword || state.canEditPermissions || state.canToggleStatus,
  };
}

function UserActionsTrigger({ username }: { username: string }) {
  return (
    <DropdownMenuTrigger
      aria-label={`Open user actions for ${username}`}
      className={cn(
        "grid size-9 cursor-pointer place-items-center rounded-md text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-0 focus-visible:shadow-none",
      )}
      type="button"
    >
      <span className="sr-only">Open user actions</span>
      <span aria-hidden="true" className="text-xl leading-none">
        …
      </span>
    </DropdownMenuTrigger>
  );
}

function ProfileMenuItem({ isActorRow, userId }: { isActorRow: boolean; userId: string }) {
  if (isActorRow) {
    return (
      <DropdownMenuItem asChild>
        <Link to="/profile">View profile</Link>
      </DropdownMenuItem>
    );
  }

  return (
    <DropdownMenuItem asChild>
      <Link params={{ publicUserId: userId }} to="/profile/$publicUserId">
        View profile
      </Link>
    </DropdownMenuItem>
  );
}

function ManagedUserActionItems({
  actions,
  onChangePassword,
  onEditPermissions,
  onToggleStatus,
  user,
}: {
  actions: ManagedActionState;
  onChangePassword: (user: AdminUserSummary) => void;
  onEditPermissions: (user: AdminUserSummary) => void;
  onToggleStatus: (user: AdminUserSummary) => void;
  user: AdminUserSummary;
}) {
  return (
    <>
      {actions.canChangePassword ? (
        <DropdownMenuItem onSelect={() => onChangePassword(user)}>Change password</DropdownMenuItem>
      ) : null}
      {actions.canEditPermissions ? (
        <DropdownMenuItem onSelect={() => onEditPermissions(user)}>
          <ShieldCheckIcon aria-hidden="true" className="size-4" />
          Edit permissions
        </DropdownMenuItem>
      ) : null}
      {actions.canToggleStatus ? (
        <DropdownMenuItem
          onSelect={() => onToggleStatus(user)}
          variant={user.disabledAt ? "default" : "destructive"}
        >
          {user.disabledAt ? "Restore user" : "Disable user"}
        </DropdownMenuItem>
      ) : null}
    </>
  );
}

function canToggleUserStatus(actor: PublicUser, user: AdminUserSummary): boolean {
  return actor.id !== user.id;
}
