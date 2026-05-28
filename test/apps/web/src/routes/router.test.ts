import { describe, expect, it } from "bun:test";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const workspaceRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../../../../");
const routerSourcePath = `${workspaceRoot}/apps/web/src/routes/router.tsx`;

describe("router route hierarchy", () => {
  it("groups authenticated app pages under /app and account pages under /account", async () => {
    const source = await Bun.file(routerSourcePath).text();

    expect(source).toContain("function AppRoute()");
    expect(source).toContain("function AccountRoute()");
    expect(source).toContain('to="/app/dashboard"');
    expect(source).toContain('path: "app"');
    expect(source).toContain('path: "account"');
    expect(source).toContain("getParentRoute: () => appRoute");
    expect(source).toContain('path: "dashboard"');
    expect(source).toContain("getParentRoute: () => accountRoute");
    expect(source).toContain('path: "/"');
    expect(source).toContain('activePage="profile"');
    expect(source).toContain('path: "theme"');
    expect(source).toContain('path: "notifications"');
    expect(source).toContain('path: "general"');
    expect(source).toContain('path: "library"');
    expect(source).toContain('path: "users"');
    expect(source).toContain('path: "import"');
    expect(source).toContain('path: "services"');
    expect(source).toContain('path: "logs"');
    expect(source).toContain('path: "about"');
    expect(source).toContain("AccountSettings");
    expect(source).toContain("canAccessAccountSettingsPage(user, page)");
    expect(source).not.toContain("UserAccountRoute");
    expect(source).not.toContain("userAccountRoute");
    expect(source).not.toContain("publicUserId");
    expect(source).not.toContain('path: "user/$publicUserId"');
    expect(source).not.toContain("/user/settings");
    expect(source).not.toContain("$publicUserId/settings");
    expect(source).not.toContain('path: "mod"');
    expect(source).not.toContain("/mod");
  });

  it("keeps admin and login routes at the root authorization boundary", async () => {
    const source = await Bun.file(routerSourcePath).text();
    const adminLayoutRoute = source.match(/const adminLayoutRoute = createRoute\([\s\S]*?\);/)?.[0];
    const adminIndexRoute = source.match(/const adminIndexRoute = createRoute\([\s\S]*?\);/)?.[0];
    const loginRoute = source.match(/const loginRoute = createRoute\([\s\S]*?\);/)?.[0];

    expect(adminLayoutRoute).toContain("getParentRoute: () => rootRoute");
    expect(adminLayoutRoute).toContain('path: "/admin"');
    expect(source).toContain('AuthGate requiredRole="admin"');
    expect(adminIndexRoute).toContain("getParentRoute: () => adminLayoutRoute");
    expect(adminIndexRoute).toContain('path: "/"');
    expect(loginRoute).toContain("getParentRoute: () => rootRoute");
    expect(loginRoute).toContain('path: "/login"');
  });
});
