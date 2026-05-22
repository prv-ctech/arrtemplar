import type { PublicUser } from "@arrtemplar/shared";
import { BellIcon, CheckCircleIcon, PaletteIcon, UserCircleIcon } from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type FormEvent, useEffect, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { changePassword, getUserProfile, updateUserProfile } from "@/lib/api";
import { cn } from "@/lib/utils";
import { type SettingsEntry, SettingsNav } from "../settings/SettingsNav";
import { SettingsPanel, SettingsRow, SettingsSection } from "../settings/SettingsPrimitives";
import { useTheme } from "../theme/theme-state";
import { syncUpdatedUserProfileCaches, userProfileQueryKey } from "./user-profile-cache";

type UserSettingsPage = "profile" | "theme" | "notifications";

const settingsEntries = [
  {
    id: "profile",
    label: "Profile",
    icon: <UserCircleIcon aria-hidden="true" className="size-5" />,
    description: "Account identity and password management",
  },
  {
    id: "theme",
    label: "Theme",
    icon: <PaletteIcon aria-hidden="true" className="size-5" />,
    description: "Personal display theme for this browser",
  },
  {
    id: "notifications",
    label: "Notifications",
    icon: <BellIcon aria-hidden="true" className="size-5" />,
    description: "Personal notification preferences",
  },
] satisfies [SettingsEntry<UserSettingsPage>, ...SettingsEntry<UserSettingsPage>[]];

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
            controlId="user-profile-username"
            description="Visible in account menus and audit trails."
            label="Username"
          >
            <Input
              autoComplete="username"
              className="sm:max-w-72"
              id="user-profile-username"
              onChange={(event) => setUsername(event.target.value)}
              required
              value={username}
            />
          </SettingsRow>
          <SettingsRow
            controlId="user-profile-email"
            description="Used for signing in and account recovery."
            label="Email"
          >
            <Input
              autoComplete="email"
              className="sm:max-w-72"
              id="user-profile-email"
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
          <SettingsRow controlId="user-current-password" label="Current password">
            <Input
              autoComplete="current-password"
              className="sm:max-w-72"
              id="user-current-password"
              onChange={(event) => setCurrentPassword(event.target.value)}
              required
              type="password"
              value={currentPassword}
            />
          </SettingsRow>
          <SettingsRow controlId="user-new-password" label="New password">
            <Input
              autoComplete="new-password"
              className="sm:max-w-72"
              id="user-new-password"
              onChange={(event) => setNewPassword(event.target.value)}
              required
              type="password"
              value={newPassword}
            />
          </SettingsRow>
          <SettingsRow controlId="user-confirm-password" label="Confirm new password">
            <Input
              autoComplete="new-password"
              className="sm:max-w-72"
              id="user-confirm-password"
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

function NotificationSettings() {
  return (
    <div className="space-y-6">
      <Card className="border-dashed bg-card/54 shadow-(--shadow-soft)">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <BellIcon aria-hidden="true" className="size-5 text-primary" weight="duotone" />
            Personal notifications
          </CardTitle>
          <CardDescription>
            Per-user notification channels will live here once notification delivery is connected.
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
    </div>
  );
}

function renderActiveSettingsPage(activePage: UserSettingsPage, user: PublicUser) {
  switch (activePage) {
    case "profile":
      return <ProfileSettings user={user} />;
    case "theme":
      return <ThemeSettings />;
    case "notifications":
      return <NotificationSettings />;
  }
}

export function UserSettings({ user }: { user: PublicUser }) {
  const [activePage, setActivePage] = useState<UserSettingsPage>("profile");
  const activeEntry =
    settingsEntries.find((entry) => entry.id === activePage) ?? settingsEntries[0];

  return (
    <div className="flex flex-col">
      <h1 className="sr-only">User settings</h1>
      <SettingsNav
        active={activePage}
        entries={settingsEntries}
        label="User settings"
        onSelect={setActivePage}
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
