import { describe, expect, it } from "bun:test";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const workspaceRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../../../../../");
const userProfileSourcePath = `${workspaceRoot}/apps/web/src/features/user/UserProfilePage.tsx`;
const userSettingsSourcePath = `${workspaceRoot}/apps/web/src/features/user/UserSettings.tsx`;

describe("profile dashboard and managed user routing", () => {
  it("renders a personal profile dashboard without the settings tab shell", async () => {
    const source = await Bun.file(userProfileSourcePath).text();

    expect(source).toContain("PersonalProfileRoute");
    expect(source).toContain("Edit Profile");
    expect(source).toContain('to="/profile/settings/main"');
    expect(source).not.toContain("SettingsNav");
    expect(source).not.toContain("AccountSettings");
  });

  it("uses /profile public-id routes for managed dashboards and a single settings button", async () => {
    const source = await Bun.file(userProfileSourcePath).text();

    expect(source).toContain('from: "/profile/$publicUserId"');
    expect(source).toContain("publicUserId === actor.id");
    expect(source).toContain('<Navigate replace to="/profile" />');
    expect(source).toContain('to="/profile/$publicUserId/settings/main"');
    expect(source).not.toContain('to="/profile/$publicUserId/settings/password"');
    expect(source).not.toContain('to="/profile/$publicUserId/settings/permissions"');
    expect(source).not.toContain('"/users/$publicUserId"');
  });

  it("uses /profile public-id settings routes for managed user settings", async () => {
    const source = await Bun.file(userSettingsSourcePath).text();

    expect(source).toContain("canManageUsers(actor)");
    expect(source).toContain("getSelfProfileSettingsRedirect");
    expect(source).toContain("publicUserId === actor.id");
    expect(source).toContain('return "/profile/settings/main"');
    expect(source).toContain('return "/profile/settings/password"');
    expect(source).toContain('"/profile/$publicUserId/settings/main"');
    expect(source).toContain('"/profile/$publicUserId/settings/password"');
    expect(source).toContain('"/profile/$publicUserId/settings/permissions"');
    expect(source).not.toContain("as [UserSettingsEntry");
    expect(source).not.toContain('"/users/$publicUserId/settings/main"');
    expect(source).not.toContain('"/users/$publicUserId/settings/password"');
    expect(source).not.toContain('"/users/$publicUserId/settings/permissions"');
  });
});
