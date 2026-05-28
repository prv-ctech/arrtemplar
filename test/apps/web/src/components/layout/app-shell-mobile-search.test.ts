import { describe, expect, it } from "bun:test";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const workspaceRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../../../../../");
const appShellSourcePath = `${workspaceRoot}/apps/web/src/components/layout/AppShell.tsx`;

describe("app shell mobile search", () => {
  it("exposes an accessible mobile header search trigger", async () => {
    const source = await Bun.file(appShellSourcePath).text();

    expect(source).toContain('aria-controls="mobile-shell-search"');
    expect(source).toContain("aria-expanded={isMobileSearchOpen}");
    expect(source).toContain("Open mobile search");
    expect(source).toContain("Close mobile search");
  });

  it("places the mobile search trigger in the primary navigation group", async () => {
    const source = await Bun.file(appShellSourcePath).text();
    const primaryNavigation = source.match(
      /<nav[\s\S]*?aria-label="Primary navigation"[\s\S]*?<\/nav>/,
    )?.[0];
    const mobileActions = source.match(
      /<ShellActions[\s\S]*?accountMenuSide="right"[\s\S]*?\/>/,
    )?.[0];

    expect(primaryNavigation).toContain('aria-controls="mobile-shell-search"');
    expect(mobileActions).not.toContain("isMobileSearchOpen");
    expect(mobileActions).not.toContain("onMobileSearchToggle");
  });

  it("renders a mobile-only blank search template", async () => {
    const source = await Bun.file(appShellSourcePath).text();

    expect(source).toContain('id="mobile-shell-search"');
    expect(source).toContain("Search titles, requests, import notes");
    expect(source).toContain("Search UI template");
    expect(source).toContain("Search results will appear here once modules are connected.");
    expect(source).toContain("lg:hidden");
  });

  it("keeps the mobile header row from stretching when search is open", async () => {
    const source = await Bun.file(appShellSourcePath).text();
    const mobileHeaderRowClass = source.match(/<div className="([^"]*lg:flex-col[^"]*)">/)?.[1];

    expect(mobileHeaderRowClass).toContain("lg:h-full");
    expect(mobileHeaderRowClass).not.toMatch(/(^|\s)h-full(\s|$)/);
  });
});

describe("app shell navigation", () => {
  it("uses the /app dashboard route for the logo and dashboard button", async () => {
    const source = await Bun.file(appShellSourcePath).text();

    expect(source).toContain('to="/app/dashboard"');
    expect(source).toContain('to: "/app/dashboard"');
    expect(source).not.toContain('to="/dashboard"');
    expect(source).not.toContain('to: "/dashboard"');
  });

  it("shows separate settings and admin buttons with different visibility rules", async () => {
    const source = await Bun.file(appShellSourcePath).text();

    expect(source).toContain('to: "/account"');
    expect(source).toContain('label: "Settings"');
    expect(source).not.toContain("ShellAccountNavItem");
    expect(source).not.toContain("publicUserId");
    expect(source).not.toContain('to: "/user/$publicUserId"');
    expect(source).not.toContain("$publicUserId/settings");
    expect(source).not.toContain("/user/settings");
    expect(source).toContain('label: "Admin"');
    expect(source).toContain('to: "/admin" as const');
    expect(source).toContain('user.role === "admin"');
  });
});
