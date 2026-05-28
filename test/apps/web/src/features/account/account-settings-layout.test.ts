import { describe, expect, it } from "bun:test";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const workspaceRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../../../../../");
const accountSettingsSourcePath = `${workspaceRoot}/apps/web/src/features/account/AccountSettings.tsx`;

describe("account settings layout", () => {
  it("keeps self-service account settings separate from admin settings", async () => {
    const source = await Bun.file(accountSettingsSourcePath).text();

    expect(source).toContain('<h1 className="sr-only">Account settings</h1>');
    expect(source).toContain('label: "Profile"');
    expect(source).toContain('label: "Theme"');
    expect(source).toContain('label: "Notifications"');
    expect(source).toContain("activePage");
    expect(source).toContain("navigate({ to: entry.to })");
    expect(source).toContain('const profilePath = "/account"');
    expect(source).toContain('const themePath = "/account/theme"');
    expect(source).toContain('const notificationsPath = "/account/notifications"');
    expect(source).toContain('to: "/account"');
    expect(source).toContain('to: "/account/theme"');
    expect(source).toContain('to: "/account/notifications"');
    expect(source).not.toContain("$publicUserId");
    expect(source).not.toContain("publicUserId");
    expect(source).not.toContain('"/user/');
    expect(source).not.toContain("`/user/");
    expect(source).toContain("ADMIN_PERMISSION_CATALOG");
    expect(source).toContain("canAccessAccountSettingsPage");
    expect(source).toContain("hasDelegatedAccountPermission");
    expect(source).toContain("SettingsNav");
    expect(source).toContain("SettingsPanel");
    expect(source).not.toContain('label: "Users"');
    expect(source).not.toContain('label: "Import"');
    expect(source).not.toContain('label: "Logs"');
  });

  it("renders profile identity, password, theme, and mod-only notification sections", async () => {
    const source = await Bun.file(accountSettingsSourcePath).text();

    expect(source).toContain("initialData: user");
    expect(source).toContain("profile.username");
    expect(source).toContain("profile.email");
    expect(source).toContain("getUserProfile");
    expect(source).toContain("updateUserProfile");
    expect(source).toContain("currentPassword");
    expect(source).toContain("newPassword");
    expect(source).toContain("confirmPassword");
    expect(source).toContain("useTheme()");
    expect(source).toContain("Personal notifications");
    expect(source).toContain("hasDelegatedAccountPermission(");
    expect(source).toContain('"admin:notifications"');
    expect(source).toContain("Delegated notification controls");
    expect(source).toContain("without creating a separate");
  });
});
