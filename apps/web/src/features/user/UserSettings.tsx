import type {
  AdminUpdateUserPermissionsRequest,
  PublicUser,
  UserPermission,
} from "@arrtemplar/shared";
import { LockIcon, ShieldCheckIcon, UserCircleIcon } from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Navigate, useNavigate, useParams } from "@tanstack/react-router";
import { type FormEvent, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usePermissionCatalogQuery } from "@/features/admin/admin-users";
import { canManageUsers, hasRequiredPermission } from "@/features/auth/auth-state";
import { notify } from "@/features/notifications/notification-gateway";
import {
  changeManagedUserPassword,
  getManagedUserProfile,
  updateManagedUserPermissions,
  updateManagedUserProfile,
} from "@/lib/api";
import { useAuthenticatedRouteUser } from "@/routes/authenticated-route-user";
import { type SettingsEntry, SettingsNav } from "../settings/SettingsNav";
import { SettingsPanel, SettingsRow, SettingsSection } from "../settings/SettingsPrimitives";
import { getExplicitPermissionSet, togglePermissionSelection } from "./permission-selection";
import { managedUserProfileQueryKey } from "./user-profile-cache";

export type UserSettingsPage = "main" | "password" | "permissions";

type UserSettingsEntry = SettingsEntry<UserSettingsPage> & {
  to:
    | "/profile/$publicUserId/settings/main"
    | "/profile/$publicUserId/settings/password"
    | "/profile/$publicUserId/settings/permissions";
};

function createUserSettingsEntries(actor: ReturnType<typeof useAuthenticatedRouteUser>) {
  const entries: UserSettingsEntry[] = [];

  if (!canManageUsers(actor)) {
    return entries;
  }

  if (hasRequiredPermission(actor, "users:update")) {
    entries.push({
      id: "main",
      label: "Main",
      icon: <UserCircleIcon aria-hidden="true" className="size-5" />,
      to: "/profile/$publicUserId/settings/main",
    });
  }

  if (hasRequiredPermission(actor, "users:password")) {
    entries.push({
      id: "password",
      label: "Password",
      icon: <LockIcon aria-hidden="true" className="size-5" />,
      to: "/profile/$publicUserId/settings/password",
    });
  }

  if (hasRequiredPermission(actor, "users:permissions")) {
    entries.push({
      id: "permissions",
      label: "Permissions",
      icon: <ShieldCheckIcon aria-hidden="true" className="size-5" />,
      to: "/profile/$publicUserId/settings/permissions",
    });
  }

  return entries;
}

function getSelfProfileSettingsRedirect(page: UserSettingsPage) {
  switch (page) {
    case "password":
      return "/profile/settings/password";
    case "main":
    case "permissions":
      return "/profile/settings/main";
  }
}

function UserIdentitySettings({ actor }: { actor: PublicUser }) {
  const { publicUserId } = useParams({ from: "/profile/$publicUserId/settings/main" });
  const queryClient = useQueryClient();
  const { data: user } = useQuery({
    queryKey: managedUserProfileQueryKey(publicUserId),
    queryFn: () => getManagedUserProfile(publicUserId),
  });
  const mutation = useMutation({
    mutationFn: ({
      input,
      userId,
    }: {
      userId: string;
      input: { username?: string; email?: string };
    }) => updateManagedUserProfile(userId, input),
    onSuccess: async (updatedUser) => {
      queryClient.setQueryData(managedUserProfileQueryKey(publicUserId), updatedUser);
      notify(
        {
          id: "managed_user.identity.updated",
          title: "Managed user updated.",
        },
        actor.notificationPreferences,
      );
    },
    onError: (error) => {
      notify(
        {
          id: "managed_user.identity.failed",
          title: error instanceof Error ? error.message : "Managed user update failed.",
        },
        actor.notificationPreferences,
      );
    },
  });

  if (!user) {
    return null;
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    mutation.mutate({
      userId: publicUserId,
      input: {
        username: String(formData.get("username") ?? "").trim(),
        email: String(formData.get("email") ?? "").trim(),
      },
    });
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      <SettingsSection description="Update another user's identity details." title="Main">
        <SettingsRow controlId="managed-user-username" label="Username">
          <Input defaultValue={user.username} id="managed-user-username" name="username" required />
        </SettingsRow>
        <SettingsRow controlId="managed-user-email" label="Email">
          <Input
            defaultValue={user.email}
            id="managed-user-email"
            name="email"
            required
            type="email"
          />
        </SettingsRow>
      </SettingsSection>
      <div className="flex justify-end">
        <Button disabled={mutation.isPending} type="submit">
          {mutation.isPending ? "Saving" : "Save Changes"}
        </Button>
      </div>
    </form>
  );
}

function UserPasswordSettings({ actor }: { actor: PublicUser }) {
  const { publicUserId } = useParams({ from: "/profile/$publicUserId/settings/password" });
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: ({ input, userId }: { userId: string; input: { password: string } }) =>
      changeManagedUserPassword(userId, input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: managedUserProfileQueryKey(publicUserId) });
      notify(
        {
          id: "managed_user.password.changed",
          title: "Managed user password updated.",
        },
        actor.notificationPreferences,
      );
    },
    onError: (error) => {
      notify(
        {
          id: "managed_user.password.failed",
          title: error instanceof Error ? error.message : "Managed user password update failed.",
        },
        actor.notificationPreferences,
      );
    },
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    mutation.mutate({
      userId: publicUserId,
      input: { password: String(formData.get("password") ?? "") },
    });
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      <SettingsSection
        description="Rotate the managed user's password and revoke existing sessions."
        title="Password"
      >
        <SettingsRow controlId="managed-user-password" label="New password">
          <Input id="managed-user-password" name="password" required type="password" />
        </SettingsRow>
      </SettingsSection>
      <div className="flex justify-end">
        <Button disabled={mutation.isPending} type="submit">
          {mutation.isPending ? "Saving" : "Save Password"}
        </Button>
      </div>
    </form>
  );
}

function UserPermissionsSettings({ actor }: { actor: PublicUser }) {
  const { publicUserId } = useParams({ from: "/profile/$publicUserId/settings/permissions" });
  const queryClient = useQueryClient();
  const { data: user } = useQuery({
    queryKey: managedUserProfileQueryKey(publicUserId),
    queryFn: () => getManagedUserProfile(publicUserId),
  });
  const permissionCatalogQuery = usePermissionCatalogQuery();
  const mutation = useMutation({
    mutationFn: ({ userId, input }: { userId: string; input: AdminUpdateUserPermissionsRequest }) =>
      updateManagedUserPermissions(userId, input),
    onSuccess: async (updatedUser) => {
      if (user) {
        queryClient.setQueryData(managedUserProfileQueryKey(publicUserId), {
          ...user,
          permissions: updatedUser.permissions,
          disabledAt: updatedUser.disabledAt,
          updatedAt: updatedUser.updatedAt,
        });
      }
      notify(
        {
          id: "managed_user.permissions.updated",
          title: "Managed user permissions updated.",
        },
        actor.notificationPreferences,
      );
    },
    onError: (error) => {
      notify(
        {
          id: "managed_user.permissions.failed",
          title: error instanceof Error ? error.message : "Managed user permission update failed.",
        },
        actor.notificationPreferences,
      );
    },
  });
  const [selectedPermissions, setSelectedPermissions] = useState<Set<UserPermission>>(new Set());

  const catalog = permissionCatalogQuery.data ?? [];

  useEffect(() => {
    if (user) {
      setSelectedPermissions(getExplicitPermissionSet(user.permissions));
    }
  }, [user]);

  if (!user) {
    return null;
  }

  function togglePermission(permission: UserPermission) {
    setSelectedPermissions((current) => togglePermissionSelection(current, permission));
  }

  function savePermissions() {
    mutation.mutate({ userId: publicUserId, input: { permissions: [...selectedPermissions] } });
  }

  return (
    <div className="space-y-5">
      <SettingsSection
        description="Choose explicit permissions for the managed user."
        title="Permissions"
      >
        {catalog.map((entry) => {
          const checked = selectedPermissions.has(entry.permission);
          return (
            <SettingsRow description={entry.description} key={entry.permission} label={entry.label}>
              <label className="flex items-center gap-3 text-sm text-foreground">
                <input
                  checked={checked}
                  onChange={() => togglePermission(entry.permission)}
                  type="checkbox"
                />
                <span>{entry.permission}</span>
              </label>
            </SettingsRow>
          );
        })}
      </SettingsSection>
      <div className="flex justify-end">
        <Button disabled={mutation.isPending} onClick={savePermissions} type="button">
          {mutation.isPending ? "Saving" : "Save Permissions"}
        </Button>
      </div>
    </div>
  );
}

export function UserSettings({ activePage }: { activePage: UserSettingsPage }) {
  const actor = useAuthenticatedRouteUser();
  const navigate = useNavigate();
  const { publicUserId } = useParams({
    from: getUserSettingsRoute(activePage),
  });

  if (publicUserId === actor.id) {
    return <Navigate replace to={getSelfProfileSettingsRedirect(activePage)} />;
  }

  const entries = createUserSettingsEntries(actor);
  const activeEntry = entries.find((entry) => entry.id === activePage);

  if (!activeEntry) {
    return <UnavailableUserSettingsPage />;
  }

  function handlePageChange(page: UserSettingsPage) {
    const entry = entries.find((currentEntry) => currentEntry.id === page);
    if (entry) {
      navigate({ params: { publicUserId }, to: entry.to });
    }
  }

  return (
    <div className="flex flex-col">
      <SettingsNav
        active={activePage}
        entries={entries}
        label="User Settings"
        onSelect={handlePageChange}
      />
      <SettingsPanel activeId={activePage}>
        <ActiveUserSettingsPage activePage={activePage} actor={actor} />
      </SettingsPanel>
    </div>
  );
}

function getUserSettingsRoute(page: UserSettingsPage) {
  switch (page) {
    case "main":
      return "/profile/$publicUserId/settings/main";
    case "password":
      return "/profile/$publicUserId/settings/password";
    case "permissions":
      return "/profile/$publicUserId/settings/permissions";
  }
}

function UnavailableUserSettingsPage() {
  return (
    <div className="rounded-3xl border border-dashed border-border bg-card/54 p-6 text-sm text-muted-foreground">
      This user settings page is not available for the signed-in account.
    </div>
  );
}

function ActiveUserSettingsPage({
  activePage,
  actor,
}: {
  activePage: UserSettingsPage;
  actor: PublicUser;
}) {
  switch (activePage) {
    case "main":
      return <UserIdentitySettings actor={actor} />;
    case "password":
      return <UserPasswordSettings actor={actor} />;
    case "permissions":
      return <UserPermissionsSettings actor={actor} />;
  }
}
