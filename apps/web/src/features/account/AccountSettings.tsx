import { ADMIN_PERMISSION_CATALOG, type PublicUser } from "@arrtemplar/shared";
import { BellIcon, CheckCircleIcon, PaletteIcon, UserCircleIcon } from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { type FormEvent, useEffect, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { hasDelegatedAccountPermission } from "@/features/auth/auth-state";
import { changePassword, getUserProfile, updateUserProfile } from "@/lib/api";
import { cn } from "@/lib/utils";
import { type SettingsEntry, SettingsNav } from "../settings/SettingsNav";
import { SettingsPanel, SettingsRow, SettingsSection } from "../settings/SettingsPrimitives";
import { useTheme } from "../theme/theme-state";
import { syncUpdatedUserProfileCaches, userProfileQueryKey } from "../user/user-profile-cache";

type DelegatedSettingsPage = (typeof ADMIN_PERMISSION_CATALOG)[number]["routeSlug"];

export type AccountSettingsPage = "profile" | "theme" | "notifications" | DelegatedSettingsPage;
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
  const delegatedEntries = ADMIN_PERMISSION_CATALOG.filter(
    (entry) => !entry.augmentsPersonalRoute && canAccessAccountSettingsPage(user, entry.routeSlug),
  ).map((entry) => ({
    id: entry.routeSlug,
    label: entry.label,
    icon: <UserCircleIcon aria-hidden="true" className="size-5" />,
    description: entry.description,
    path: `/account/${entry.routeSlug}`,
    to: `/account/${entry.routeSlug}`,
  })) satisfies AccountSettingsEntry[];

  return [...personalEntries, ...delegatedEntries] satisfies [
    AccountSettingsEntry,
    ...AccountSettingsEntry[],
  ];
}

export function canAccessAccountSettingsPage(user: PublicUser, page: AccountSettingsPage): boolean {
  if (page === "profile" || page === "theme" || page === "notifications") {
    return true;
  }

  const catalogEntry = ADMIN_PERMISSION_CATALOG.find((entry) => entry.routeSlug === page);

  return catalogEntry ? hasDelegatedAccountPermission(user, catalogEntry.permission) : false;
}

function ProfileSettings({ user }: { user: PublicUser }) {
  const queryClient = useQueryClient();
  const profileQuery = useQuery({
    queryKey: userProfileQueryKey,
    queryFn: getUserProfile,
    initialData: user,
  });
  const profile = profileQuery.data;
  const [username, setUsername] = useState(profile.username);
  const [email, setEmail] = useState(profile.email);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const profileMutation = useMutation({
    mutationFn: updateUserProfile,
    onSuccess: (updatedProfile) => {
      syncUpdatedUserProfileCaches(queryClient, updatedProfile);
      setUsername(updatedProfile.username);
      setEmail(updatedProfile.email);
      toast.success("Profile updated.");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Profile update failed.");
    },
  });
  const passwordMutation = useMutation({
    mutationFn: changePassword,
    onSuccess: () => {
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast.success("Password updated.");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Password update failed.");
    },
  });

  useEffect(() => {
    setUsername(profile.username);
    setEmail(profile.email);
  }, [profile.email, profile.username]);

  function handleProfileSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

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

    if (newPassword !== confirmPassword) {
      toast.error("New password and confirmation do not match.");
      return;
    }

    passwordMutation.mutate({ currentPassword, newPassword });
  }

  return (
    <div className="space-y-10">
      <form className="space-y-5" onSubmit={handleProfileSubmit}>
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
              id="account-profile-username"
              onChange={(event) => setUsername(event.target.value)}
              required
              value={username}
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
              id="account-profile-email"
              onChange={(event) => setEmail(event.target.value)}
              required
              type="email"
              value={email}
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

      <form className="space-y-5" onSubmit={handlePasswordSubmit}>
        <SettingsSection
          description="Use your current password to protect account changes."
          title="Password"
        >
          <SettingsRow controlId="account-current-password" label="Current password">
            <Input
              autoComplete="current-password"
              className="sm:max-w-72"
              id="account-current-password"
              onChange={(event) => setCurrentPassword(event.target.value)}
              required
              type="password"
              value={currentPassword}
            />
          </SettingsRow>
          <SettingsRow controlId="account-new-password" label="New password">
            <Input
              autoComplete="new-password"
              className="sm:max-w-72"
              id="account-new-password"
              onChange={(event) => setNewPassword(event.target.value)}
              required
              type="password"
              value={newPassword}
            />
          </SettingsRow>
          <SettingsRow controlId="account-confirm-password" label="Confirm new password">
            <Input
              autoComplete="new-password"
              className="sm:max-w-72"
              id="account-confirm-password"
              onChange={(event) => setConfirmPassword(event.target.value)}
              required
              type="password"
              value={confirmPassword}
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
              <span
                aria-hidden="true"
                className="grid size-8 shrink-0 grid-cols-3 overflow-hidden rounded-xl border border-border"
              >
                {option.swatches.map((swatch) => (
                  <span key={swatch} style={{ backgroundColor: swatch }} />
                ))}
              </span>
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

function renderActiveSettingsPage(activePage: AccountSettingsPage, user: PublicUser) {
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
        {renderActiveSettingsPage(activePage, user)}
      </SettingsPanel>
    </div>
  );
}
