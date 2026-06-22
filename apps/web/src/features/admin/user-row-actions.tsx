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

export type UserRowActionCapabilities = {
  canChangePasswords: boolean;
  canDeleteUsers: boolean;
  canEditPermissions: boolean;
  canToggleStatus: boolean;
};

type UserRowActionsProps = {
  actor: PublicUser;
  capabilities: UserRowActionCapabilities;
  onChangePassword: (user: AdminUserSummary) => void;
  onDeleteUser: (user: AdminUserSummary) => void;
  onEditPermissions: (user: AdminUserSummary) => void;
  onToggleStatus: (user: AdminUserSummary) => void;
  user: AdminUserSummary;
};

type ManagedActionState = {
  canChangePassword: boolean;
  canDeleteUser: boolean;
  canEditPermissions: boolean;
  canToggleStatus: boolean;
  showManagedActions: boolean;
};

export function UserRowActions({
  actor,
  capabilities,
  onChangePassword,
  onDeleteUser,
  onEditPermissions,
  onToggleStatus,
  user,
}: UserRowActionsProps) {
  const isActorRow = actor.id === user.id;
  const managedActions = getManagedActionState({
    actor,
    capabilities,
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
          onDeleteUser={onDeleteUser}
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
  capabilities,
  isActorRow,
  user,
}: Pick<UserRowActionsProps, "actor" | "capabilities" | "user"> & {
  isActorRow: boolean;
}): ManagedActionState {
  const canRunManagedMutation = !isActorRow;
  const state = {
    canChangePassword: canRunManagedMutation && capabilities.canChangePasswords,
    canDeleteUser:
      canRunManagedMutation && capabilities.canDeleteUsers && canDeleteUser(actor, user),
    canEditPermissions: canRunManagedMutation && capabilities.canEditPermissions,
    canToggleStatus:
      canRunManagedMutation && capabilities.canToggleStatus && canToggleUserStatus(actor, user),
  };

  return {
    ...state,
    showManagedActions:
      state.canChangePassword ||
      state.canDeleteUser ||
      state.canEditPermissions ||
      state.canToggleStatus,
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
  onDeleteUser,
  onEditPermissions,
  onToggleStatus,
  user,
}: {
  actions: ManagedActionState;
  onChangePassword: (user: AdminUserSummary) => void;
  onDeleteUser: (user: AdminUserSummary) => void;
  onEditPermissions: (user: AdminUserSummary) => void;
  onToggleStatus: (user: AdminUserSummary) => void;
  user: AdminUserSummary;
}) {
  const showDeleteSeparator =
    actions.canDeleteUser &&
    (actions.canChangePassword || actions.canEditPermissions || actions.canToggleStatus);

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
      {showDeleteSeparator ? <DropdownMenuSeparator /> : null}
      {actions.canDeleteUser ? (
        <DropdownMenuItem onSelect={() => onDeleteUser(user)} variant="destructive">
          Delete user
        </DropdownMenuItem>
      ) : null}
    </>
  );
}

function canDeleteUser(actor: PublicUser, user: AdminUserSummary): boolean {
  return actor.id !== user.id;
}

function canToggleUserStatus(actor: PublicUser, user: AdminUserSummary): boolean {
  return actor.id !== user.id;
}
