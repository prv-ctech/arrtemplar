import { ADMIN_PERMISSION_CATALOG, type PublicUser } from "@arrtemplar/shared";
import { BellIcon, CheckCircleIcon, PaletteIcon, UserCircleIcon } from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { type FormEvent, useRef } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { authQueryKey, hasDelegatedAccountPermission } from "@/features/auth/auth-state";
import { changePassword, getUserProfile, updateUserProfile } from "@/lib/api";
import { cn } from "@/lib/utils";
import { type SettingsEntry, SettingsNav } from "../settings/SettingsNav";
import { SettingsPanel, SettingsRow, SettingsSection } from "../settings/SettingsPrimitives";
import { ThemePreviewStrip } from "../theme/ThemePreviewStrip";
import { useTheme } from "../theme/theme-state";
import { syncUpdatedUserProfileCaches, userProfileQueryKey } from "../user/user-profile-cache";
import { canAccessAccountSettingsPage } from "./account-settings-access";
import type { AccountSettingsPage, DelegatedSettingsPage } from "./account-settings-types";

type AccountSettingsRouteTarget =
  | "/account"
  | "/account/theme"
  | "/account/notifications"
  | "/account/general"
  | "/account/library"
  | "/account/users"
  | "/account/import"
  | "/account/services"
  | "/account/logs"
  | "/account/about";
type AccountSettingsPath = "/account" | `/account/${Exclude<AccountSettingsPage, "profile">}`;

type AccountSettingsEntry = SettingsEntry<AccountSettingsPage> & {
  path: AccountSettingsPath;
  to: AccountSettingsRouteTarget;
};

function createSettingsEntries(user: PublicUser) {
  const profilePath = "/account";
  const themePath = "/account/theme";
  const notificationsPath = "/account/notifications";

  const personalEntries = [
    {
      id: "profile",
      label: "Profile",
      icon: <UserCircleIcon aria-hidden="true" className="size-5" />,
      description: "Account identity and password management",
      path: profilePath,
      to: "/account",
    },
    {
      id: "theme",
      label: "Theme",
      icon: <PaletteIcon aria-hidden="true" className="size-5" />,
      description: "Personal display theme for this browser",
      path: themePath,
      to: "/account/theme",
    },
    {
      id: "notifications",
      label: "Notifications",
      icon: <BellIcon aria-hidden="true" className="size-5" />,
      description: "Personal notification preferences",
      path: notificationsPath,
      to: "/account/notifications",
    },
  ] satisfies [AccountSettingsEntry, ...AccountSettingsEntry[]];
  const delegatedEntries: AccountSettingsEntry[] = [];

  for (const entry of ADMIN_PERMISSION_CATALOG) {
    if (entry.augmentsPersonalRoute || !canAccessAccountSettingsPage(user, entry.routeSlug)) {
      continue;
    }

    delegatedEntries.push({
      id: entry.routeSlug,
      label: entry.label,
      icon: <UserCircleIcon aria-hidden="true" className="size-5" />,
      description: entry.description,
      path: `/account/${entry.routeSlug}`,
      to: `/account/${entry.routeSlug}`,
    });
  }

  return [...personalEntries, ...delegatedEntries] satisfies [
    AccountSettingsEntry,
    ...AccountSettingsEntry[],
  ];
}

function ProfileSettings({ user }: { user: PublicUser }) {
  const queryClient = useQueryClient();
  const passwordFormRef = useRef<HTMLFormElement>(null);
  const profileQuery = useQuery({
    queryKey: userProfileQueryKey,
    queryFn: getUserProfile,
    initialData: user,
  });
  const profile = profileQuery.data;
  const profileMutation = useMutation({
    mutationFn: updateUserProfile,
    onSuccess: async (updatedProfile) => {
      syncUpdatedUserProfileCaches(queryClient, updatedProfile);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: userProfileQueryKey }),
        queryClient.invalidateQueries({ queryKey: authQueryKey }),
      ]);
      toast.success("Profile updated.");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Profile update failed.");
    },
  });
  const passwordMutation = useMutation({
    mutationFn: changePassword,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: authQueryKey });
      passwordFormRef.current?.reset();
      toast.success("Password updated.");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Password update failed.");
    },
  });

  function handleProfileSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const username = String(formData.get("username") ?? "");
    const email = String(formData.get("email") ?? "");
    const trimmedUsername = username.trim();
    const trimmedEmail = email.trim();

    if (trimmedUsername === profile.username && trimmedEmail === profile.email) {
      toast.message("Profile is already up to date.");
      return;
    }

    profileMutation.mutate({ username: trimmedUsername, email: trimmedEmail });
  }

  function handlePasswordSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const currentPassword = String(formData.get("currentPassword") ?? "");
    const newPassword = String(formData.get("newPassword") ?? "");
    const confirmPassword = String(formData.get("confirmPassword") ?? "");

    if (newPassword !== confirmPassword) {
      toast.error("New password and confirmation do not match.");
      return;
    }

    passwordMutation.mutate({ currentPassword, newPassword });
  }

  return (
    <div className="space-y-10">
      <form
        className="space-y-5"
        key={`${profile.id}:${profile.username}:${profile.email}`}
        onSubmit={handleProfileSubmit}
      >
        <SettingsSection
          description="Your account identity is shown across the app."
          title="Profile"
        >
          <SettingsRow
            controlId="account-profile-username"
            description="Visible in account menus and audit trails."
            label="Username"
          >
            <Input
              autoComplete="username"
              className="sm:max-w-72"
              defaultValue={profile.username}
              id="account-profile-username"
              name="username"
              required
            />
          </SettingsRow>
          <SettingsRow
            controlId="account-profile-email"
            description="Used for signing in and account recovery."
            label="Email"
          >
            <Input
              autoComplete="email"
              className="sm:max-w-72"
              defaultValue={profile.email}
              id="account-profile-email"
              name="email"
              required
              type="email"
            />
          </SettingsRow>
          <SettingsRow description="Current authorization level for this account." label="Role">
            <Badge variant="outline">{profile.role}</Badge>
          </SettingsRow>
        </SettingsSection>

        <div className="flex items-center justify-end gap-3">
          {profileQuery.isFetching ? (
            <span className="text-xs text-muted-foreground">Refreshing profile</span>
          ) : null}
          <Button disabled={profileMutation.isPending} type="submit">
            {profileMutation.isPending ? "Saving profile" : "Save profile"}
          </Button>
        </div>
      </form>

      <form className="space-y-5" onSubmit={handlePasswordSubmit} ref={passwordFormRef}>
        <SettingsSection
          description="Use your current password to protect account changes."
          title="Password"
        >
          <SettingsRow controlId="account-current-password" label="Current password">
            <Input
              autoComplete="current-password"
              className="sm:max-w-72"
              id="account-current-password"
              name="currentPassword"
              required
              type="password"
            />
          </SettingsRow>
          <SettingsRow controlId="account-new-password" label="New password">
            <Input
              autoComplete="new-password"
              className="sm:max-w-72"
              id="account-new-password"
              name="newPassword"
              required
              type="password"
            />
          </SettingsRow>
          <SettingsRow controlId="account-confirm-password" label="Confirm new password">
            <Input
              autoComplete="new-password"
              className="sm:max-w-72"
              id="account-confirm-password"
              name="confirmPassword"
              required
              type="password"
            />
          </SettingsRow>
        </SettingsSection>

        <div className="flex justify-end">
          <Button disabled={passwordMutation.isPending} type="submit">
            {passwordMutation.isPending ? "Updating password" : "Update password"}
          </Button>
        </div>
      </form>
    </div>
  );
}

function ThemeSettings() {
  const { setTheme, theme, themes } = useTheme();

  return (
    <SettingsSection description="Theme choice is stored locally for this browser." title="Theme">
      {themes.map((option) => {
        const isSelected = option.value === theme;
        return (
          <SettingsRow description={option.description} key={option.value} label={option.label}>
            <button
              aria-pressed={isSelected}
              className={cn(
                "flex min-w-52 items-center justify-between gap-3 rounded-2xl border px-3 py-2 text-left text-sm transition-[background,border-color,transform] duration-300",
                "hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:translate-y-px",
                isSelected
                  ? "border-primary/50 bg-primary/12 text-foreground"
                  : "border-border bg-card/72 text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
              onClick={() => setTheme(option.value)}
              type="button"
            >
              <ThemePreviewStrip className="h-8 w-20" swatches={option.swatches} />
              <span className="min-w-0 flex-1 font-medium">{option.label}</span>
              {isSelected ? (
                <CheckCircleIcon aria-hidden="true" className="size-4 text-primary" weight="fill" />
              ) : null}
            </button>
          </SettingsRow>
        );
      })}
    </SettingsSection>
  );
}

function NotificationSettings({ user }: { user: PublicUser }) {
  const canManageDelegatedNotifications = hasDelegatedAccountPermission(
    user,
    "admin:notifications",
  );

  return (
    <div className="space-y-6">
      <Card className="border-dashed bg-card/54 shadow-(--shadow-soft)">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <BellIcon aria-hidden="true" className="size-5 text-primary" weight="duotone" />
            Personal notifications
          </CardTitle>
          <CardDescription>
            Per-account notification channels will live here once notification delivery is
            connected.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-6 text-muted-foreground">
            Instance-wide webhook and service settings stay in the admin area. This page is reserved
            for account-owned notification preferences such as watchlist updates, request activity,
            and personal delivery channels.
          </p>
        </CardContent>
      </Card>
      {canManageDelegatedNotifications ? (
        <Card className="border-primary/25 bg-primary/8 shadow-(--shadow-soft)">
          <CardHeader>
            <CardTitle className="text-base">Delegated notification controls</CardTitle>
            <CardDescription>
              This section appears because an admin granted notification-settings access to your
              account.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-6 text-muted-foreground">
              Instance-wide notification controls can be connected here without creating a separate
              admin-notifications route.
            </p>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function DelegatedAdminSettings({ page }: { page: DelegatedSettingsPage }) {
  const catalogEntry = ADMIN_PERMISSION_CATALOG.find((entry) => entry.routeSlug === page);

  return (
    <Card className="border-dashed bg-card/54 shadow-(--shadow-soft)">
      <CardHeader>
        <CardTitle>{catalogEntry?.label ?? "Delegated settings"}</CardTitle>
        <CardDescription>
          {catalogEntry?.description ?? "This delegated settings section is unavailable."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm leading-6 text-muted-foreground">
          This section is available because your account role and granted permissions allow it.
        </p>
      </CardContent>
    </Card>
  );
}

function ActiveSettingsPage({
  activePage,
  user,
}: {
  activePage: AccountSettingsPage;
  user: PublicUser;
}) {
  switch (activePage) {
    case "profile":
      return <ProfileSettings user={user} />;
    case "theme":
      return <ThemeSettings />;
    case "notifications":
      return <NotificationSettings user={user} />;
    case "general":
    case "library":
    case "users":
    case "import":
    case "services":
    case "logs":
    case "about":
      return <DelegatedAdminSettings page={activePage} />;
  }
}

export function AccountSettings({
  activePage,
  user,
}: {
  activePage: AccountSettingsPage;
  user: PublicUser;
}) {
  const navigate = useNavigate();
  const settingsEntries = createSettingsEntries(user);
  const activeEntry =
    settingsEntries.find((entry) => entry.id === activePage) ?? settingsEntries[0];

  if (!canAccessAccountSettingsPage(user, activePage)) {
    return (
      <div className="flex flex-col items-center justify-center px-4 py-24 text-center">
        <p className="text-5xl font-black tracking-tight text-muted-foreground">404</p>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Settings section not found</h2>
        <p className="mt-2 max-w-sm text-sm text-muted-foreground">
          This settings section is not available for the signed-in account.
        </p>
      </div>
    );
  }

  function handlePageChange(page: AccountSettingsPage) {
    const entry = settingsEntries.find((currentEntry) => currentEntry.id === page);

    if (entry) {
      navigate({ to: entry.to });
    }
  }

  return (
    <div className="flex flex-col">
      <h1 className="sr-only">Account settings</h1>
      <SettingsNav
        active={activePage}
        entries={settingsEntries}
        label="Account settings"
        onSelect={handlePageChange}
      />

      <SettingsPanel
        activeId={activePage}
        description={activeEntry.description}
        title={activeEntry.label}
      >
        <ActiveSettingsPage activePage={activePage} user={user} />
      </SettingsPanel>
    </div>
  );
}
