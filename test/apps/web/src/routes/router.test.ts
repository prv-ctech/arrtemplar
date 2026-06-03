import { describe, expect, it } from "bun:test";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const workspaceRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../../../../");
const routerSourcePath = `${workspaceRoot}/apps/web/src/routes/router.tsx`;
const routeComponentsPath = `${workspaceRoot}/apps/web/src/routes/components`;

describe("router route hierarchy", () => {
  it("groups authenticated app pages under /app and account pages under /account", async () => {
    const [
      source,
      appRouteSource,
      accountRouteSource,
      indexRouteSource,
      accountProfileRouteSource,
      accountGuardSource,
    ] = await Promise.all([
      Bun.file(routerSourcePath).text(),
      Bun.file(`${routeComponentsPath}/app-route.tsx`).text(),
      Bun.file(`${routeComponentsPath}/account-route.tsx`).text(),
      Bun.file(`${routeComponentsPath}/index-route.tsx`).text(),
      Bun.file(`${routeComponentsPath}/account-profile-route.tsx`).text(),
      Bun.file(`${routeComponentsPath}/account-delegated-settings-route.tsx`).text(),
    ]);

    expect(appRouteSource).toContain("function AppRoute()");
    expect(accountRouteSource).toContain("function AccountRoute()");
    expect(indexRouteSource).toContain('to="/app/dashboard"');
    expect(source).toContain('path: "app"');
    expect(source).toContain('path: "account"');
    expect(source).toContain("getParentRoute: () => appRoute");
    expect(source).toContain('path: "dashboard"');
    expect(source).toContain("getParentRoute: () => accountRoute");
    expect(source).toContain('path: "/"');
    expect(source).toContain('path: "theme"');
    expect(source).toContain('path: "notifications"');
    expect(source).toContain('path: "general"');
    expect(source).toContain('path: "library"');
    expect(source).toContain('path: "users"');
    expect(source).toContain('path: "import"');
    expect(source).toContain('path: "services"');
    expect(source).toContain('path: "logs"');
    expect(source).toContain('path: "about"');
    expect(accountProfileRouteSource).toContain('activePage="profile"');
    expect(accountGuardSource).toContain("AccountSettings");
    expect(accountGuardSource).toContain("canAccessAccountSettingsPage(user, page)");
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
    const [source, adminLayoutSource] = await Promise.all([
      Bun.file(routerSourcePath).text(),
      Bun.file(`${routeComponentsPath}/admin-layout.tsx`).text(),
    ]);
    const adminLayoutRoute = source.match(/const adminLayoutRoute = createRoute\([\s\S]*?\);/)?.[0];
    const adminIndexRoute = source.match(/const adminIndexRoute = createRoute\([\s\S]*?\);/)?.[0];
    const loginRoute = source.match(/const loginRoute = createRoute\([\s\S]*?\);/)?.[0];

    expect(adminLayoutRoute).toContain("getParentRoute: () => rootRoute");
    expect(adminLayoutRoute).toContain('path: "/admin"');
    expect(adminLayoutSource).toContain('AuthGate requiredRole="admin"');
    expect(adminIndexRoute).toContain("getParentRoute: () => adminLayoutRoute");
    expect(adminIndexRoute).toContain('path: "/"');
    expect(loginRoute).toContain("getParentRoute: () => rootRoute");
    expect(loginRoute).toContain('path: "/login"');
  });
});
