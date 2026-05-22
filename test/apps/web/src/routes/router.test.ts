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
    const adminRoute = source.match(/const adminRoute = createRoute\([\s\S]*?\);/)?.[0];
    const loginRoute = source.match(/const loginRoute = createRoute\([\s\S]*?\);/)?.[0];

    expect(adminRoute).toContain("getParentRoute: () => rootRoute");
    expect(adminRoute).toContain('path: "/admin"');
    expect(source).toContain('AuthGate requiredRole="admin"');
    expect(loginRoute).toContain("getParentRoute: () => rootRoute");
    expect(loginRoute).toContain('path: "/login"');
  });
});
