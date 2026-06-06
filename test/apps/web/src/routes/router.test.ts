import { describe, expect, it } from "bun:test";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const workspaceRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../../../../");
const routerSourcePath = `${workspaceRoot}/apps/web/src/routes/router.tsx`;

describe("router route taxonomy", () => {
  it("defines profile dashboard, profile settings, managed profile, and settings route families", async () => {
    const source = await Bun.file(routerSourcePath).text();

    expect(source).toContain('path: "dashboard"');
    expect(source).toContain('path: "profile"');
    expect(source).toContain("PersonalProfileRoute");
    expect(source).toContain("ProfileSettingsIndexRedirect");
    expect(source).toContain("publicUserId === actor.id");
    expect(source).toContain('to="/profile/settings/main"');
    expect(source).toContain('path: "settings/main"');
    expect(source).toContain('path: "settings/password"');
    expect(source).toContain('path: "settings/notifications"');
    expect(source).toContain('path: "$publicUserId"');
    expect(source).toContain("ManagedProfileSettingsIndexRedirect");
    expect(source).toContain('path: "$publicUserId/settings/main"');
    expect(source).toContain('path: "$publicUserId/settings/password"');
    expect(source).toContain('path: "$publicUserId/settings/permissions"');
    expect(source).toContain("UserProfilePage");
    expect(source).toContain("UserSettings");
    expect(source).toContain('path: "settings"');
    expect(source).toContain('path: "users"');
    expect(source).toContain('path: "theme"');
    expect(source).toContain('path: "about"');
    expect(source).toContain('path: "services"');
    expect(source).not.toContain('path: "Users"');
  });

  it("routes settings theme through the app settings shell", async () => {
    const source = await Bun.file(routerSourcePath).text();

    expect(source).toContain("AdminThemeRoute");
    expect(source).not.toContain("AccountThemeRoute");
  });

  it("removes legacy admin and delegated account route paths", async () => {
    const source = await Bun.file(routerSourcePath).text();

    expect(source).not.toContain('path: "app"');
    expect(source).not.toContain("/app/dashboard");
    expect(source).not.toContain('path: "account"');
    expect(source).not.toContain('path: "/admin"');
    expect(source).not.toContain('path: "/users"');
    expect(source).not.toContain("AdminLayout");
    expect(source).not.toContain('path: "/account/services"');
    expect(source).not.toContain('path: "mod"');
    expect(source).not.toContain("/profile/settings/theme");
  });

  it("uses an explicit root not-found component for removed frontend routes", async () => {
    const source = await Bun.file(routerSourcePath).text();

    expect(source).toContain("RootNotFoundRoute");
    expect(source).toContain("notFoundComponent: RootNotFoundRoute");
  });
});
