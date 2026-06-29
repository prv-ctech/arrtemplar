import type { AdminUserSummary, PublicUser } from "@arrtemplar/shared";
import {
  DotsThreeVerticalIcon,
  LockSimpleIcon,
  PowerIcon,
  ShieldCheckIcon,
  TrashIcon,
  UserCircleIcon,
} from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
      <DropdownMenuContent align="end" className="w-44 rounded-xl">
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
    <DropdownMenuTrigger asChild>
      <Button
        aria-label={`Open user actions for ${username}`}
        className="size-7 rounded-md p-0"
        size="icon"
        type="button"
        variant="ghost"
      >
        <DotsThreeVerticalIcon aria-hidden="true" className="size-4" weight="bold" />
      </Button>
    </DropdownMenuTrigger>
  );
}

function ProfileMenuItem({ isActorRow, userId }: { isActorRow: boolean; userId: string }) {
  if (isActorRow) {
    return (
      <DropdownMenuItem asChild>
        <Link to="/profile">
          <UserCircleIcon aria-hidden="true" className="size-4" />
          View profile
        </Link>
      </DropdownMenuItem>
    );
  }

  return (
    <DropdownMenuItem asChild>
      <Link params={{ publicUserId: userId }} to="/profile/$publicUserId">
        <UserCircleIcon aria-hidden="true" className="size-4" />
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
        <DropdownMenuItem onSelect={() => onChangePassword(user)}>
          <LockSimpleIcon aria-hidden="true" className="size-4" />
          Change password
        </DropdownMenuItem>
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
          <PowerIcon aria-hidden="true" className="size-4" />
          {user.disabledAt ? "Restore user" : "Disable user"}
        </DropdownMenuItem>
      ) : null}
      {showDeleteSeparator ? <DropdownMenuSeparator /> : null}
      {actions.canDeleteUser ? (
        <DropdownMenuItem onSelect={() => onDeleteUser(user)} variant="destructive">
          <TrashIcon aria-hidden="true" className="size-4" />
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
