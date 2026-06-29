import { describe, expect, it } from "bun:test";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { canAccessAccountSettingsPage } from "../../../../../../apps/web/src/features/account/account-settings-access";
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  DEFAULT_PROFILE_AVATAR_ID,
  DEFAULT_PROFILE_BANNER_ID,
  DEFAULT_SIGNED_IN_USER_PERMISSIONS,
  type PublicUser,
} from "../../../../../../packages/shared/src";

const workspaceRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../../../../../");
const accountSettingsSourcePath = `${workspaceRoot}/apps/web/src/features/account/AccountSettings.tsx`;
const notificationPreferencesSourcePath = `${workspaceRoot}/apps/web/src/features/notifications/notification-preferences.ts`;
const settingsPrimitivesSourcePath = `${workspaceRoot}/apps/web/src/features/settings/SettingsPrimitives.tsx`;

const baseUser: PublicUser = {
  id: "abcABC123",
  username: "operator",
  email: "operator@example.local",
  avatarId: DEFAULT_PROFILE_AVATAR_ID,
  bannerId: DEFAULT_PROFILE_BANNER_ID,
  notificationPreferences: DEFAULT_NOTIFICATION_PREFERENCES,
  permissions: [...DEFAULT_SIGNED_IN_USER_PERMISSIONS],
  createdAt: "2026-05-27T00:00:00.000Z",
  lastLoginAt: null,
};

describe("profile self-service settings layout", () => {
  it("keeps profile settings focused on self-service pages and moves theme to top-level settings", async () => {
    const source = await Bun.file(accountSettingsSourcePath).text();

    expect(source).toContain('"/profile/settings/main"');
    expect(source).toContain('"/profile/settings/password"');
    expect(source).toContain('"/profile/settings/notifications"');
    expect(source).not.toContain('"/settings/theme"');
    expect(source).not.toContain('"/account"');
    expect(source).not.toContain('"/account/theme"');
    expect(source).not.toContain('"/profile/settings/theme"');
    expect(source).not.toContain("ADMIN_PERMISSION_CATALOG");
    expect(source).not.toContain("hasDelegatedAccountPermission");
    expect(source).not.toContain('label: "Users"');
    expect(source).not.toContain('label: "Import"');
    expect(source).not.toContain('label: "Logs"');
  });

  it("keeps profile identity and password forms inside settings without dashboard content", async () => {
    const source = await Bun.file(accountSettingsSourcePath).text();

    expect(source).toContain("getUserProfile");
    expect(source).toContain("updateUserProfile");
    expect(source).toContain("changePassword");
    expect(source).toContain("currentPassword");
    expect(source).toContain("newPassword");
    expect(source).toContain("confirmPassword");
    expect(source).toContain("Profile Settings");
    expect(source).not.toContain("ProfileOverview");
    expect(source).not.toContain('case "profile"');
    expect(source).not.toContain('activePage === "profile"');
    expect(source).toContain("ThemeSettings");
    expect(source).not.toContain("Theme settings");
    expect(source).not.toContain("Personal theme preference");
    expect(source).not.toContain("Theme settings affect only the signed-in user.");
    expect(source).not.toContain("profile.role");
  });

  it("keeps theme flavor options as real activatable buttons", async () => {
    const source = await Bun.file(accountSettingsSourcePath).text();

    expect(source).toContain("export function ThemeSettings()");
    expect(source).toContain("function ThemePackCard");
    expect(source).toContain("themePacks.map");
    expect(source).toContain("pack.logoSrc");
    expect(source).toContain('alt=""');
    expect(source).toContain('aria-hidden="true"');
    expect(source).toContain("<Card");
    expect(source).toContain("grid-cols-[repeat(auto-fit,minmax(min(100%,18rem),1fr))]");
    expect(source).not.toContain("grid-cols-[repeat(auto-fit,minmax(min(100%,18rem),24rem))]");
    expect(source).toContain("items-start");
    expect(source).toContain("<CardTitle");
    expect(source).toContain("{pack.label}");
    expect(source).toContain("</CardTitle>");
    expect(source).toContain("<Separator");
    expect(source).not.toContain("palettes");
    expect(source).toContain("useState(false)");
    expect(source).toContain("aria-expanded={isExpanded}");
    expect(source).toContain("onToggle={() => setIsExpanded((current) => !current)}");
    expect(source).toContain("onClick={onToggle}");
    expect(source).toContain("isExpanded ? (");
    expect(source).not.toContain("DropdownMenu");
    expect(source).toContain("pack.previewSwatches");
    expect(source).toContain("swatches={pack.previewSwatches}");
    expect(source).not.toContain("selectedOption?.previewSwatches");
    expect(source).toContain("option.previewSwatches ?? pack.previewSwatches");
    expect(source).toContain("pack.themes.map");
    expect(source).toContain("<fieldset");
    expect(source).toContain("{pack.label} themes</legend>");
    expect(source).toContain("aria-pressed={isSelected}");
    expect(source).toContain("onClick={() => onThemeChange(option.value)}");
    expect(source).toContain("onThemeChange={handleThemeChange}");
    expect(source).not.toContain("onThemeChange={setTheme}");
    expect(source).not.toContain("CATPPUCCIN_PREVIEW_SWATCHES");
    expect(source).not.toContain("CATPPUCCIN_LOGO_SRC");
    expect(source).not.toContain("SettingsRow description={option.description}");
  });

  it("emits theme-change notifications from user-driven theme buttons only", async () => {
    const source = await Bun.file(accountSettingsSourcePath).text();

    expect(source).toContain('id: "theme.changed"');
    expect(source).toContain("function handleThemeChange(nextTheme: AppTheme)");
    expect(source).toContain("if (nextTheme === theme)");
    expect(source).toContain("onThemeChange={handleThemeChange}");
    expect(source).not.toContain("useEffect(() => notify");
  });

  it("renders real self-service notification controls with visible states", async () => {
    const source = await Bun.file(accountSettingsSourcePath).text();
    const settingsPrimitivesSource = await Bun.file(settingsPrimitivesSourcePath).text();

    expect(source).toContain("useNotificationPreferencesQuery");
    expect(source).toContain("useUpdateNotificationPreferencesMutation");
    expect(source).toContain("Notifications");
    expect(source).toContain("All notifications");
    expect(source).toContain("Minimal — important only");
    expect(source).toContain("Refreshing notification settings");
    expect(source).toContain("Saving notification settings");
    expect(source).not.toContain("Notification preferences saved.");
    expect(settingsPrimitivesSource).toContain('role="alert"');
    expect(settingsPrimitivesSource).toContain('aria-live="polite"');
  });

  it("keeps notification frequency compact and conditional on enabled toasts", async () => {
    const source = await Bun.file(accountSettingsSourcePath).text();

    expect(source).toContain('density="compact"');
    expect(source).toContain("preferences.toastsEnabled ? (");
    expect(source).toContain("<select");
    expect(source).toContain('id="notification-frequency"');
    expect(source).not.toContain("Control toast alerts.");
    expect(source).not.toContain("Inline errors still appear.");
    expect(source).not.toContain("Minimal keeps important toasts only.");
    expect(source).not.toContain("function NotificationFrequencyOption");
  });

  it("routes self-service account toasts through the notification gateway", async () => {
    const source = await Bun.file(accountSettingsSourcePath).text();

    expect(source).toContain("notify(");
    expect(source).toContain('id: "profile.identity.updated"');
    expect(source).toContain('id: "profile.noop"');
    expect(source).toContain('id: "profile.password.changed"');
    expect(source).toContain('id: "profile.password.mismatch"');
    expect(source).not.toContain('import { toast } from "sonner"');
    expect(source).not.toContain("toast.success");
    expect(source).not.toContain("toast.error");
    expect(source).not.toContain("toast.message");
  });

  it("keeps password mismatch visible inline when toast delivery is disabled", async () => {
    const source = await Bun.file(accountSettingsSourcePath).text();

    expect(source).toContain("passwordMismatchError");
    expect(source).toContain('role="alert"');
    expect(source).toContain("New password and confirmation do not match.");
  });

  it("centralizes notification preference query keys with the first UI consumer", async () => {
    const source = await Bun.file(notificationPreferencesSourcePath).text();

    expect(source).toContain("notificationPreferenceKeys");
    expect(source).toContain("getNotificationPreferences");
    expect(source).toContain("updateNotificationPreferences");
    expect(source).toContain("useNotificationPreferencesQuery");
    expect(source).toContain("useUpdateNotificationPreferencesMutation");
    expect(source).toContain("queryClient.invalidateQueries({ queryKey: authQueryKey })");
    expect(source).toContain("queryClient.invalidateQueries({ queryKey: userProfileQueryKey })");
  });

  it("gates notification settings with the profile notifications permission", () => {
    expect(canAccessAccountSettingsPage(baseUser, "notifications")).toBe(true);
    expect(
      canAccessAccountSettingsPage(
        {
          ...baseUser,
          permissions: baseUser.permissions.filter(
            (permission) => permission !== "profile:notifications",
          ),
        },
        "notifications",
      ),
    ).toBe(false);
  });
});
