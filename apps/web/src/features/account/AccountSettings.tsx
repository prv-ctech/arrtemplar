import type {
  NotificationFrequency,
  NotificationPreferences,
  PublicUser,
} from "@arrtemplar/shared";
import {
  BellIcon,
  CaretDownIcon,
  CheckCircleIcon,
  LockIcon,
  UserCircleIcon,
} from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { type ChangeEvent, type FormEvent, type ReactNode, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { authQueryKey } from "@/features/auth/auth-state";
import { notify } from "@/features/notifications/notification-gateway";
import {
  useNotificationPreferencesQuery,
  useUpdateNotificationPreferencesMutation,
} from "@/features/notifications/notification-preferences";
import { changePassword, getUserProfile, updateUserProfile } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useAuthenticatedRouteUser } from "@/routes/authenticated-route-user";
import { type SettingsEntry, SettingsNav } from "../settings/SettingsNav";
import {
  SettingsPanel,
  SettingsRow,
  SettingsSection,
  SettingsStatus,
} from "../settings/SettingsPrimitives";
import { ThemePreviewStrip } from "../theme/ThemePreviewStrip";
import { type AppTheme, getThemeOption, type ThemePack } from "../theme/theme-options";
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

const compactAccountInputClassName =
  "h-8 w-full min-w-0 rounded-md border-border/85 bg-background/72 px-2.5 py-1 text-sm shadow-xs sm:w-64";

const accountSettingsActionButtonClassName = "h-8 rounded-md px-2.5 text-sm";

function AccountSettingsSectionHeader({
  action,
  icon,
  status,
  title,
}: {
  action: ReactNode;
  icon: ReactNode;
  status?: ReactNode;
  title: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2">
        <span className="grid size-7 shrink-0 place-items-center rounded-md border border-border bg-secondary text-secondary-foreground">
          {icon}
        </span>
        <h2 className="truncate text-base font-semibold leading-5 tracking-tight">{title}</h2>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {status}
        {action}
      </div>
    </div>
  );
}

function AccountSettingsFieldTable({
  children,
  label = "Value",
}: {
  children: ReactNode;
  label?: string;
}) {
  return (
    <Table containerClassName="rounded-lg border-border/90 bg-card/72 pb-0">
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead className="h-8 px-3 text-xs">Setting</TableHead>
          <TableHead className="h-8 px-3 text-right text-xs">{label}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>{children}</TableBody>
    </Table>
  );
}

function AccountSettingsFieldRow({
  children,
  controlId,
  label,
}: {
  children: ReactNode;
  controlId: string;
  label: string;
}) {
  return (
    <TableRow>
      <TableCell className="w-48 px-3 py-2 sm:w-64">
        <Label className="text-sm font-medium" htmlFor={controlId}>
          {label}
        </Label>
      </TableCell>
      <TableCell className="px-3 py-2">
        <div className="flex min-w-0 justify-end">{children}</div>
      </TableCell>
    </TableRow>
  );
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
      notify(
        {
          id: "profile.identity.updated",
          title: "Profile updated.",
        },
        updatedProfile.notificationPreferences,
      );
    },
    onError: (error) => {
      notify(
        {
          id: "profile.identity.update.failed",
          title: error instanceof Error ? error.message : "Profile update failed.",
        },
        profile.notificationPreferences,
      );
    },
  });

  function handleProfileSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const username = String(formData.get("username") ?? "").trim();
    const email = String(formData.get("email") ?? "").trim();

    if (username === profile.username && email === profile.email) {
      notify(
        {
          id: "profile.noop",
          title: "Profile is already up to date.",
        },
        profile.notificationPreferences,
      );
      return;
    }

    profileMutation.mutate({ username, email });
  }

  return (
    <form
      className="flex flex-col gap-3"
      key={`${profile.id}:${profile.username}:${profile.email}`}
      onSubmit={handleProfileSubmit}
    >
      <AccountSettingsSectionHeader
        action={
          <Button
            className={accountSettingsActionButtonClassName}
            disabled={profileMutation.isPending}
            type="submit"
          >
            {profileMutation.isPending ? "Saving profile" : "Save profile"}
          </Button>
        }
        icon={<UserCircleIcon aria-hidden="true" className="size-4" />}
        status={
          isProfileFetching ? (
            <span className="hidden text-xs text-muted-foreground sm:inline">Refreshing</span>
          ) : null
        }
        title="Profile"
      />
      <AccountSettingsFieldTable label="Value">
        <AccountSettingsFieldRow controlId="profile-settings-username" label="Username">
          <Input
            autoComplete="username"
            className={compactAccountInputClassName}
            defaultValue={profile.username}
            id="profile-settings-username"
            name="username"
            required
          />
        </AccountSettingsFieldRow>
        <AccountSettingsFieldRow controlId="profile-settings-email" label="Email">
          <Input
            autoComplete="email"
            className={compactAccountInputClassName}
            defaultValue={profile.email}
            id="profile-settings-email"
            name="email"
            required
            type="email"
          />
        </AccountSettingsFieldRow>
      </AccountSettingsFieldTable>
    </form>
  );
}

function PasswordSettings({ user }: { user: PublicUser }) {
  const controls = usePasswordSettingsControls(user);

  return (
    <form className="flex flex-col gap-3" onSubmit={controls.handleSubmit} ref={controls.formRef}>
      <AccountSettingsSectionHeader
        action={<PasswordSubmitButton isPending={controls.isPending} />}
        icon={<LockIcon aria-hidden="true" className="size-4" />}
        title="Password"
      />
      <PasswordFieldSection />
      <PasswordMismatchAlert message={controls.passwordMismatchError} />
    </form>
  );
}

function usePasswordSettingsControls(user: PublicUser) {
  const queryClient = useQueryClient();
  const formRef = useRef<HTMLFormElement>(null);
  const [passwordMismatchError, setPasswordMismatchError] = useState<string | null>(null);
  const passwordMutation = useMutation({
    mutationFn: changePassword,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: authQueryKey });
      formRef.current?.reset();
      setPasswordMismatchError(null);
      notify(
        {
          id: "profile.password.changed",
          title: "Password updated.",
        },
        user.notificationPreferences,
      );
    },
    onError: (error) => {
      notify(
        {
          id: "profile.password.update.failed",
          title: error instanceof Error ? error.message : "Password update failed.",
        },
        user.notificationPreferences,
      );
    },
  });

  function handlePasswordSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const currentPassword = String(formData.get("currentPassword") ?? "");
    const newPassword = String(formData.get("newPassword") ?? "");
    const confirmPassword = String(formData.get("confirmPassword") ?? "");

    if (newPassword !== confirmPassword) {
      const message = "New password and confirmation do not match.";

      setPasswordMismatchError(message);
      notify(
        {
          id: "profile.password.mismatch",
          title: message,
        },
        user.notificationPreferences,
      );
      return;
    }

    setPasswordMismatchError(null);
    passwordMutation.mutate({ currentPassword, newPassword });
  }

  return {
    formRef,
    handleSubmit: handlePasswordSubmit,
    isPending: passwordMutation.isPending,
    passwordMismatchError,
  };
}

const compactPasswordInputClassName = compactAccountInputClassName;

function PasswordFieldSection() {
  return (
    <AccountSettingsFieldTable label="Value">
      <AccountSettingsFieldRow controlId="profile-current-password" label="Current password">
        <Input
          autoComplete="current-password"
          className={compactPasswordInputClassName}
          id="profile-current-password"
          name="currentPassword"
          required
          type="password"
        />
      </AccountSettingsFieldRow>
      <AccountSettingsFieldRow controlId="profile-new-password" label="New password">
        <Input
          autoComplete="new-password"
          className={compactPasswordInputClassName}
          id="profile-new-password"
          name="newPassword"
          required
          type="password"
        />
      </AccountSettingsFieldRow>
      <AccountSettingsFieldRow controlId="profile-confirm-password" label="Confirm new password">
        <Input
          autoComplete="new-password"
          className={compactPasswordInputClassName}
          id="profile-confirm-password"
          name="confirmPassword"
          required
          type="password"
        />
      </AccountSettingsFieldRow>
    </AccountSettingsFieldTable>
  );
}

function PasswordMismatchAlert({ message }: { message: string | null }) {
  return message ? (
    <p className="text-sm text-destructive" role="alert">
      {message}
    </p>
  ) : null;
}

function PasswordSubmitButton({ isPending }: { isPending: boolean }) {
  return (
    <Button
      className={accountSettingsActionButtonClassName}
      disabled={isPending}
      size="sm"
      type="submit"
    >
      {isPending ? "Updating password" : "Update password"}
    </Button>
  );
}

const notificationFrequencyOptions = [
  {
    value: "all",
    label: "All notifications",
  },
  {
    value: "minimal",
    label: "Minimal — important only",
  },
] satisfies Array<{
  value: NotificationFrequency;
  label: string;
}>;

function NotificationSettings({ user }: { user: PublicUser }) {
  const controls = useNotificationSettingsControls(user);

  return (
    <div className="space-y-2.5">
      <SettingsSection density="compact" title="Personal Notifications">
        <NotificationToastToggleRow
          isSaving={controls.isSaving}
          onToastsEnabledChange={controls.saveToastsEnabled}
          preferences={controls.preferences}
          {...(controls.statusMessage ? { statusId: controls.statusId } : {})}
        />

        {controls.preferences.toastsEnabled ? (
          <NotificationFrequencyRow
            isDisabled={controls.isSaving}
            onFrequencyChange={controls.saveFrequency}
            preferences={controls.preferences}
          />
        ) : null}
      </SettingsSection>

      <SettingsStatus
        errorMessage={controls.errorMessage}
        statusMessage={controls.statusMessage}
        statusId={controls.statusId}
      />
    </div>
  );
}

function useNotificationSettingsControls(user: PublicUser) {
  const statusId = useId();
  const preferencesQuery = useNotificationPreferencesQuery(user.notificationPreferences);
  const preferencesMutation = useUpdateNotificationPreferencesMutation();
  const preferences =
    preferencesMutation.variables ?? preferencesQuery.data ?? user.notificationPreferences;
  const error = preferencesMutation.error ?? preferencesQuery.error;
  const isSaving = preferencesMutation.isPending;
  const isRefreshing = preferencesQuery.isFetching && !isSaving;
  const errorMessage = error ? getNotificationSettingsErrorMessage(error) : null;

  function savePreferences(nextPreferences: NotificationPreferences) {
    preferencesMutation.mutate(nextPreferences);
  }

  function saveToastsEnabled(toastsEnabled: boolean) {
    savePreferences({ ...preferences, toastsEnabled });
  }

  function saveFrequency(frequency: NotificationFrequency) {
    savePreferences({ ...preferences, frequency });
  }

  return {
    errorMessage,
    isRefreshing,
    isSaving,
    preferences,
    saveFrequency,
    saveToastsEnabled,
    statusMessage: getNotificationStatusMessage({ isRefreshing, isSaving }),
    statusId,
  };
}

function NotificationToastToggleRow({
  isSaving,
  onToastsEnabledChange,
  preferences,
  statusId,
}: {
  isSaving: boolean;
  onToastsEnabledChange: (toastsEnabled: boolean) => void;
  preferences: NotificationPreferences;
  statusId?: string;
}) {
  return (
    <SettingsRow controlId="notification-toasts-enabled" density="compact" label="Notifications">
      <label
        className={cn(
          "inline-flex min-w-24 cursor-pointer items-center justify-end gap-2 text-sm font-medium",
          isSaving && "cursor-not-allowed opacity-60",
        )}
      >
        <input
          aria-describedby={statusId}
          checked={preferences.toastsEnabled}
          className="peer sr-only"
          disabled={isSaving}
          id="notification-toasts-enabled"
          onChange={(event) => onToastsEnabledChange(event.currentTarget.checked)}
          type="checkbox"
        />
        <span
          aria-hidden="true"
          className="relative h-4 w-8 rounded-full border border-border bg-muted transition-colors after:absolute after:top-0.5 after:left-0.5 after:size-3 after:rounded-full after:bg-background after:shadow-sm after:transition-transform peer-checked:border-primary/60 peer-checked:bg-primary peer-checked:after:translate-x-4"
        />
        <span className="text-foreground">{preferences.toastsEnabled ? "On" : "Off"}</span>
      </label>
    </SettingsRow>
  );
}

function NotificationFrequencyRow({
  isDisabled,
  onFrequencyChange,
  preferences,
}: {
  isDisabled: boolean;
  onFrequencyChange: (frequency: NotificationFrequency) => void;
  preferences: NotificationPreferences;
}) {
  return (
    <SettingsRow controlId="notification-frequency" density="compact" label="Frequency">
      <div className="relative w-full min-w-0 sm:w-64">
        <select
          className="h-8 w-full appearance-none rounded-md border border-border bg-card/72 px-2.5 pr-8 text-sm text-foreground outline-none transition-colors hover:bg-accent focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isDisabled}
          id="notification-frequency"
          onChange={handleNotificationFrequencyChange(onFrequencyChange)}
          value={preferences.frequency}
        >
          {notificationFrequencyOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <CaretDownIcon
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 right-2.5 size-3.5 -translate-y-1/2 text-muted-foreground"
        />
      </div>
    </SettingsRow>
  );
}

function handleNotificationFrequencyChange(
  onFrequencyChange: (frequency: NotificationFrequency) => void,
) {
  return (event: ChangeEvent<HTMLSelectElement>) => {
    const nextFrequency = event.currentTarget.value;

    if (isNotificationFrequency(nextFrequency)) {
      onFrequencyChange(nextFrequency);
    }
  };
}

function getNotificationStatusMessage({
  isRefreshing,
  isSaving,
}: {
  isRefreshing: boolean;
  isSaving: boolean;
}): string | null {
  if (isSaving) {
    return "Saving notification settings";
  }

  if (isRefreshing) {
    return "Refreshing notification settings";
  }

  return null;
}

function isNotificationFrequency(value: string): value is NotificationFrequency {
  return value === "all" || value === "minimal";
}

function getNotificationSettingsErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Notification preferences update failed.";
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
        <ThemePackTrigger
          isExpanded={isExpanded}
          onToggle={() => setIsExpanded((current) => !current)}
          pack={pack}
          themesContentId={themesContentId}
        />
      </CardHeader>
      {isExpanded ? (
        <ThemePackOptions
          onThemeChange={onThemeChange}
          pack={pack}
          selectedTheme={selectedTheme}
          themesContentId={themesContentId}
        />
      ) : null}
    </Card>
  );
}

function ThemePackTrigger({
  isExpanded,
  onToggle,
  pack,
  themesContentId,
}: {
  isExpanded: boolean;
  onToggle: () => void;
  pack: ThemePack;
  themesContentId: string;
}) {
  return (
    <button
      aria-controls={themesContentId}
      aria-expanded={isExpanded}
      className={cn(
        "flex w-full cursor-pointer items-center gap-3 p-3 text-left transition-colors duration-200",
        "hover:bg-accent/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      )}
      onClick={onToggle}
      type="button"
    >
      <img
        alt=""
        aria-hidden="true"
        className="size-11 rounded-full border border-border bg-card/70 p-0.5"
        src={pack.logoSrc}
      />
      <CardTitle className="min-w-0 flex-1 truncate text-base leading-6">{pack.label}</CardTitle>
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
  );
}

function ThemePackOptions({
  onThemeChange,
  pack,
  selectedTheme,
  themesContentId,
}: {
  onThemeChange: (theme: AppTheme) => void;
  pack: ThemePack;
  selectedTheme: AppTheme;
  themesContentId: string;
}) {
  return (
    <>
      <Separator />
      <CardContent className="p-2.5" id={themesContentId}>
        <fieldset className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,9.75rem),1fr))] gap-2">
          <legend className="sr-only">{pack.label} themes</legend>
          {pack.themes.map((option) => (
            <ThemeOptionButton
              isSelected={option.value === selectedTheme}
              key={option.value}
              onThemeChange={onThemeChange}
              option={option}
              pack={pack}
            />
          ))}
        </fieldset>
      </CardContent>
    </>
  );
}

function ThemeOptionButton({
  isSelected,
  onThemeChange,
  option,
  pack,
}: {
  isSelected: boolean;
  onThemeChange: (theme: AppTheme) => void;
  option: ThemePack["themes"][number];
  pack: ThemePack;
}) {
  return (
    <Button
      aria-pressed={isSelected}
      className={cn(
        "h-auto min-h-11 justify-start gap-2 rounded-xl px-2.5 py-2 text-left",
        "cursor-pointer shadow-none",
        isSelected
          ? "border-selected-border bg-selected text-foreground hover:bg-selected"
          : "border-border bg-card/72 text-muted-foreground hover:bg-accent hover:text-foreground",
      )}
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
}

export function ThemeSettings() {
  const user = useAuthenticatedRouteUser();
  const { setTheme, theme, themePacks } = useTheme();

  function handleThemeChange(nextTheme: AppTheme) {
    if (nextTheme === theme) {
      return;
    }

    setTheme(nextTheme);
    notify(
      {
        id: "theme.changed",
        title: "Theme changed.",
        description: getThemeOption(nextTheme).label,
      },
      user.notificationPreferences,
    );
  }

  return (
    <div className="grid items-start gap-4 grid-cols-[repeat(auto-fit,minmax(min(100%,18rem),1fr))]">
      {themePacks.map((pack) => (
        <ThemePackCard
          key={pack.id}
          onThemeChange={handleThemeChange}
          pack={pack}
          selectedTheme={theme}
        />
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
      return <PasswordSettings user={user} />;
    case "notifications":
      return <NotificationSettings user={user} />;
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
