import { describe, expect, it } from "bun:test";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const workspaceRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../../../../../");
const accountSettingsSourcePath = `${workspaceRoot}/apps/web/src/features/account/AccountSettings.tsx`;

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

  it("keeps profile identity and password forms plus a dedicated profile overview", async () => {
    const source = await Bun.file(accountSettingsSourcePath).text();

    expect(source).toContain("getUserProfile");
    expect(source).toContain("updateUserProfile");
    expect(source).toContain("changePassword");
    expect(source).toContain("currentPassword");
    expect(source).toContain("newPassword");
    expect(source).toContain("confirmPassword");
    expect(source).toContain("Profile overview");
    expect(source).toContain("Profile Settings");
    expect(source).toContain("ThemeSettings");
    expect(source).not.toContain("Theme settings");
    expect(source).not.toContain("Personal theme preference");
    expect(source).not.toContain("Theme settings affect only the signed-in user.");
    expect(source).not.toContain("profile.role");
  });

  it("keeps theme flavor options as real activatable buttons", async () => {
    const source = await Bun.file(accountSettingsSourcePath).text();

    expect(source).toContain("export function ThemeSettings()");
    expect(source).toContain("aria-pressed={isSelected}");
    expect(source).toContain("onClick={() => setTheme(option.value)}");
    expect(source).toContain('type="button"');
  });
});
