import { describe, expect, it } from "bun:test";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const workspaceRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../../../../");
const routerSourcePath = `${workspaceRoot}/apps/web/src/routes/router.tsx`;

describe("router route hierarchy", () => {
  it("groups authenticated app pages under /app and user-owned pages under /user", async () => {
    const source = await Bun.file(routerSourcePath).text();

    expect(source).toContain("function AppRoute()");
    expect(source).toContain("function UserRoute()");
    expect(source).toContain('to="/app/dashboard"');
    expect(source).toContain('path: "app"');
    expect(source).toContain('path: "user"');
    expect(source).toContain("getParentRoute: () => appRoute");
    expect(source).toContain('path: "dashboard"');
    expect(source).toContain("getParentRoute: () => userRoute");
    expect(source).toContain('path: "settings"');
    expect(source).toContain("UserSettings");
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
