import type { PublicUser } from "@arrtemplar/shared";
import { BellIcon, CheckCircleIcon, LockIcon, UserCircleIcon } from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { type FormEvent, useRef } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { authQueryKey } from "@/features/auth/auth-state";
import { changePassword, getUserProfile, updateUserProfile } from "@/lib/api";
import { cn } from "@/lib/utils";
import { type SettingsEntry, SettingsNav } from "../settings/SettingsNav";
import { SettingsPanel, SettingsRow, SettingsSection } from "../settings/SettingsPrimitives";
import { ThemePreviewStrip } from "../theme/ThemePreviewStrip";
import { CATPPUCCIN_PREVIEW_SWATCHES } from "../theme/theme-options";
import { useTheme } from "../theme/theme-state";
import { syncUpdatedUserProfileCaches, userProfileQueryKey } from "../user/user-profile-cache";
import { canAccessAccountSettingsPage } from "./account-settings-access";
import type { AccountSettingsPage } from "./account-settings-types";

type AccountSettingsRouteTarget =
  | "/profile"
  | "/profile/settings/main"
  | "/profile/settings/password"
  | "/profile/settings/notifications";

type ProfileSettingsPage = Exclude<AccountSettingsPage, "theme">;

type AccountSettingsEntry = SettingsEntry<ProfileSettingsPage> & {
  path: AccountSettingsRouteTarget;
  to: AccountSettingsRouteTarget;
};

function createSettingsEntries() {
  return [
    {
      id: "main",
      label: "Main",
      icon: <UserCircleIcon aria-hidden="true" className="size-5" />,
      description: "Profile identity and contact details.",
      path: "/profile/settings/main",
      to: "/profile/settings/main",
    },
    {
      id: "password",
      label: "Password",
      icon: <LockIcon aria-hidden="true" className="size-5" />,
      description: "Change your password for this account.",
      path: "/profile/settings/password",
      to: "/profile/settings/password",
    },
    {
      id: "notifications",
      label: "Notifications",
      icon: <BellIcon aria-hidden="true" className="size-5" />,
      description: "Personal notification preferences.",
      path: "/profile/settings/notifications",
      to: "/profile/settings/notifications",
    },
  ] satisfies [AccountSettingsEntry, ...AccountSettingsEntry[]];
}

function ProfileOverview({ user }: { user: PublicUser }) {
  const navigate = useNavigate();

  return (
    <Card className="shadow-(--shadow-panel)">
      <CardHeader>
        <CardTitle>Profile overview</CardTitle>
        <CardDescription>
          Your self-service profile stays separate from application and service settings.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="min-w-0 rounded-2xl border border-border bg-card/72 p-4">
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
              Username
            </p>
            <p className="mt-2 truncate text-sm font-semibold text-foreground">{user.username}</p>
          </div>
          <div className="min-w-0 rounded-2xl border border-border bg-card/72 p-4">
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
              Email
            </p>
            <p className="mt-2 truncate text-sm font-semibold text-foreground">{user.email}</p>
          </div>
          <div className="min-w-0 rounded-2xl border border-border bg-card/72 p-4">
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
              Public ID
            </p>
            <p className="mt-2 truncate font-mono text-sm text-foreground">{user.id}</p>
          </div>
          <div className="min-w-0 rounded-2xl border border-border bg-card/72 p-4">
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
              Permissions
            </p>
            <p className="mt-2 text-sm text-foreground">{user.permissions.length} active</p>
          </div>
        </div>
        <div className="flex items-center justify-between gap-3">
          <Badge variant="outline">Joined {new Date(user.createdAt).toLocaleDateString()}</Badge>
          <Button onClick={() => navigate({ to: "/profile/settings/main" })} type="button">
            Profile Settings
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function MainSettings({ user }: { user: PublicUser }) {
  const queryClient = useQueryClient();
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

  function handleProfileSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const username = String(formData.get("username") ?? "").trim();
    const email = String(formData.get("email") ?? "").trim();

    if (username === profile.username && email === profile.email) {
      toast.message("Profile is already up to date.");
      return;
    }

    profileMutation.mutate({ username, email });
  }

  return (
    <form
      className="space-y-5"
      key={`${profile.id}:${profile.username}:${profile.email}`}
      onSubmit={handleProfileSubmit}
    >
      <SettingsSection
        description="Update the identity shown across the app."
        title="Profile Settings"
      >
        <SettingsRow
          controlId="profile-settings-username"
          description="Visible in profile headers and activity history."
          label="Username"
        >
          <Input
            autoComplete="username"
            className="sm:max-w-72"
            defaultValue={profile.username}
            id="profile-settings-username"
            name="username"
            required
          />
        </SettingsRow>
        <SettingsRow
          controlId="profile-settings-email"
          description="Used for sign-in and account recovery."
          label="Email"
        >
          <Input
            autoComplete="email"
            className="sm:max-w-72"
            defaultValue={profile.email}
            id="profile-settings-email"
            name="email"
            required
            type="email"
          />
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
  );
}

function PasswordSettings() {
  const queryClient = useQueryClient();
  const passwordFormRef = useRef<HTMLFormElement>(null);
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
    <form className="space-y-5" onSubmit={handlePasswordSubmit} ref={passwordFormRef}>
      <SettingsSection
        description="Use your current password to authorize password changes."
        title="Password"
      >
        <SettingsRow controlId="profile-current-password" label="Current password">
          <Input
            autoComplete="current-password"
            className="sm:max-w-72"
            id="profile-current-password"
            name="currentPassword"
            required
            type="password"
          />
        </SettingsRow>
        <SettingsRow controlId="profile-new-password" label="New password">
          <Input
            autoComplete="new-password"
            className="sm:max-w-72"
            id="profile-new-password"
            name="newPassword"
            required
            type="password"
          />
        </SettingsRow>
        <SettingsRow controlId="profile-confirm-password" label="Confirm new password">
          <Input
            autoComplete="new-password"
            className="sm:max-w-72"
            id="profile-confirm-password"
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
  );
}

function NotificationSettings() {
  return (
    <Card className="border-dashed bg-card/54 shadow-(--shadow-soft)">
      <CardHeader>
        <CardTitle>Personal notifications</CardTitle>
        <CardDescription>
          Notification delivery preferences for the signed-in user will live here.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm leading-6 text-muted-foreground">
          App-wide notification channels belong under top-level settings. This page is reserved for
          self-service notification preferences.
        </p>
      </CardContent>
    </Card>
  );
}

export function ThemeSettings() {
  const { setTheme, theme, themes } = useTheme();

  return (
    <div className="divide-y divide-border rounded-3xl border border-border bg-card/50">
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
              <ThemePreviewStrip
                className={cn("h-8 w-20", option.value)}
                swatches={CATPPUCCIN_PREVIEW_SWATCHES}
              />
              <span className="min-w-0 flex-1 font-medium">{option.label}</span>
              {isSelected ? (
                <CheckCircleIcon aria-hidden="true" className="size-4 text-primary" weight="fill" />
              ) : null}
            </button>
          </SettingsRow>
        );
      })}
    </div>
  );
}

function ActiveSettingsPage({
  activePage,
  user,
}: {
  activePage: ProfileSettingsPage;
  user: PublicUser;
}) {
  switch (activePage) {
    case "profile":
      return <ProfileOverview user={user} />;
    case "main":
      return <MainSettings user={user} />;
    case "password":
      return <PasswordSettings />;
    case "notifications":
      return <NotificationSettings />;
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

  if (activePage === "theme") {
    return <ThemeSettings />;
  }

  const settingsEntries = createSettingsEntries();

  function handlePageChange(page: ProfileSettingsPage) {
    const entry = settingsEntries.find((currentEntry) => currentEntry.id === page);

    if (entry) {
      navigate({ to: entry.to });
    }
  }

  const heading = activePage === "profile" ? "Profile" : "Profile Settings";
  const activeEntry =
    settingsEntries.find((entry) => entry.id === activePage) ?? settingsEntries[0];

  return (
    <div className="flex flex-col">
      <h1 className="sr-only">{heading}</h1>
      <SettingsNav
        active={activePage}
        entries={settingsEntries}
        label="Profile Settings"
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
