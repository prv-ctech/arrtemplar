import { describe, expect, it } from "bun:test";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const workspaceRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../../../../../");
const userSettingsSourcePath = `${workspaceRoot}/apps/web/src/features/user/UserSettings.tsx`;

describe("user settings layout", () => {
  it("keeps user-owned settings separate from admin settings", async () => {
    const source = await Bun.file(userSettingsSourcePath).text();

    expect(source).toContain('<h1 className="sr-only">User settings</h1>');
    expect(source).toContain('label: "Profile"');
    expect(source).toContain('label: "Theme"');
    expect(source).toContain('label: "Notifications"');
    expect(source).toContain("SettingsNav");
    expect(source).toContain("SettingsPanel");
    expect(source).not.toContain('label: "Users"');
    expect(source).not.toContain('label: "Import"');
    expect(source).not.toContain('label: "Logs"');
  });

  it("renders profile identity, password, theme, and notification sections", async () => {
    const source = await Bun.file(userSettingsSourcePath).text();

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
  });
});
