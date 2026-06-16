import type { PublicUser } from "@arrtemplar/shared";
import {
  BellIcon,
  CaretDownIcon,
  CheckCircleIcon,
  LockIcon,
  UserCircleIcon,
} from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { type FormEvent, useId, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { authQueryKey } from "@/features/auth/auth-state";
import { changePassword, getUserProfile, updateUserProfile } from "@/lib/api";
import { cn } from "@/lib/utils";
import { type SettingsEntry, SettingsNav } from "../settings/SettingsNav";
import { SettingsPanel, SettingsRow, SettingsSection } from "../settings/SettingsPrimitives";
import { ThemePreviewStrip } from "../theme/ThemePreviewStrip";
import type { AppTheme, ThemePack } from "../theme/theme-options";
import { useTheme } from "../theme/theme-state";
import { syncUpdatedUserProfileCaches, userProfileQueryKey } from "../user/user-profile-cache";
import { canAccessAccountSettingsPage } from "./account-settings-access";
import type { AccountSettingsPage } from "./account-settings-types";

type AccountSettingsRouteTarget =
  | "/profile/settings/main"
  | "/profile/settings/password"
  | "/profile/settings/notifications";

type ProfileSettingsPage = AccountSettingsPage;

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
      path: "/profile/settings/main",
      to: "/profile/settings/main",
    },
    {
      id: "password",
      label: "Password",
      icon: <LockIcon aria-hidden="true" className="size-5" />,
      path: "/profile/settings/password",
      to: "/profile/settings/password",
    },
    {
      id: "notifications",
      label: "Notifications",
      icon: <BellIcon aria-hidden="true" className="size-5" />,
      path: "/profile/settings/notifications",
      to: "/profile/settings/notifications",
    },
  ] satisfies [AccountSettingsEntry, ...AccountSettingsEntry[]];
}

function MainSettings({ user }: { user: PublicUser }) {
  const queryClient = useQueryClient();
  const { data: profile, isFetching: isProfileFetching } = useQuery({
    queryKey: userProfileQueryKey,
    queryFn: getUserProfile,
    initialData: user,
  });
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
        {isProfileFetching ? (
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

function ThemePackCard({
  onThemeChange,
  pack,
  selectedTheme,
}: {
  onThemeChange: (theme: AppTheme) => void;
  pack: ThemePack;
  selectedTheme: AppTheme;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const themesContentId = useId();

  return (
    <Card className="w-full overflow-hidden rounded-2xl bg-card/50 shadow-none">
      <CardHeader className="p-0">
        <button
          aria-controls={themesContentId}
          aria-expanded={isExpanded}
          className={cn(
            "flex w-full cursor-pointer items-center gap-3 p-3 text-left transition-colors duration-200",
            "hover:bg-accent/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          )}
          onClick={() => setIsExpanded((current) => !current)}
          type="button"
        >
          <img
            alt=""
            aria-hidden="true"
            className="size-11 rounded-full border border-border bg-card/70 p-0.5"
            src={pack.logoSrc}
          />
          <CardTitle className="min-w-0 flex-1 truncate text-base leading-6">
            {pack.label}
          </CardTitle>
          <ThemePreviewStrip
            className="hidden h-6 w-12 rounded-md sm:flex"
            swatches={pack.previewSwatches}
          />
          <CaretDownIcon
            aria-hidden="true"
            className={cn(
              "size-4 shrink-0 text-muted-foreground transition-transform duration-200",
              isExpanded && "rotate-180",
            )}
          />
        </button>
      </CardHeader>
      {isExpanded ? (
        <>
          <Separator />
          <CardContent className="p-2.5" id={themesContentId}>
            <fieldset className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,9.75rem),1fr))] gap-2">
              <legend className="sr-only">{pack.label} themes</legend>
              {pack.themes.map((option) => {
                const isSelected = option.value === selectedTheme;

                return (
                  <Button
                    aria-pressed={isSelected}
                    className={cn(
                      "h-auto min-h-11 justify-start gap-2 rounded-xl px-2.5 py-2 text-left",
                      "cursor-pointer shadow-none hover:translate-y-0 active:translate-y-0",
                      isSelected
                        ? "border-primary/50 bg-primary/12 text-foreground hover:bg-primary/16"
                        : "border-border bg-card/72 text-muted-foreground hover:bg-accent hover:text-foreground",
                    )}
                    key={option.value}
                    onClick={() => onThemeChange(option.value)}
                    type="button"
                    variant="outline"
                  >
                    <ThemePreviewStrip
                      className={cn("h-6 w-12 rounded-md", option.value)}
                      swatches={option.previewSwatches ?? pack.previewSwatches}
                    />
                    <span className="min-w-0 flex-1 truncate font-medium">{option.label}</span>
                    {isSelected ? (
                      <CheckCircleIcon
                        aria-hidden="true"
                        className="size-3.5 shrink-0 text-primary"
                        weight="fill"
                      />
                    ) : null}
                  </Button>
                );
              })}
            </fieldset>
          </CardContent>
        </>
      ) : null}
    </Card>
  );
}

export function ThemeSettings() {
  const { setTheme, theme, themePacks } = useTheme();

  return (
    <div className="grid items-start gap-4 grid-cols-[repeat(auto-fit,minmax(min(100%,18rem),1fr))]">
      {themePacks.map((pack) => (
        <ThemePackCard key={pack.id} onThemeChange={setTheme} pack={pack} selectedTheme={theme} />
      ))}
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

  const settingsEntries = createSettingsEntries();

  function handlePageChange(page: ProfileSettingsPage) {
    const entry = settingsEntries.find((currentEntry) => currentEntry.id === page);

    if (entry) {
      navigate({ to: entry.to });
    }
  }

  return (
    <div className="flex flex-col">
      <h1 className="sr-only">Profile Settings</h1>
      <SettingsNav
        active={activePage}
        entries={settingsEntries}
        label="Profile Settings"
        onSelect={handlePageChange}
      />

      <SettingsPanel activeId={activePage}>
        <ActiveSettingsPage activePage={activePage} user={user} />
      </SettingsPanel>
    </div>
  );
}
