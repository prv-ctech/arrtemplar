import { describe, expect, it } from "bun:test";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const workspaceRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../../../../../");
const appShellSourcePath = `${workspaceRoot}/apps/web/src/components/layout/AppShell.tsx`;

describe("app shell primary navigation", () => {
  it("uses dashboard as the only primary sidebar link and keeps users inside settings", async () => {
    const source = await Bun.file(appShellSourcePath).text();

    expect(source).toContain('to="/dashboard"');
    expect(source).toContain('to: "/dashboard"');
    expect(source).not.toContain('"/app/dashboard"');
    expect(source).not.toContain('label: "Users"');
    expect(source).not.toContain('to: "/users"');
    expect(source).not.toContain("canManageUsers(user)");
    expect(source).not.toContain('label: "Settings"');
    expect(source).not.toContain('to: "/settings"');
    expect(source).not.toContain("GearIcon");
    expect(source).not.toContain('label: "Admin"');
    expect(source).not.toContain('to: "/admin"');
    expect(source).not.toContain("user.role");
  });

  it("links the account dropdown to profile and settings surfaces without profile settings", async () => {
    const source = await Bun.file(appShellSourcePath).text();

    expect(source).not.toContain("ThemeSwitcher");
    expect(source).not.toContain("Change Catppuccin color theme");
    expect(source).not.toContain("Catppuccin flavor");
    expect(source).toContain("My Profile");
    expect(source).toContain("Settings");
    expect(source).toContain('to="/profile"');
    expect(source).toContain('to="/settings"');
    expect(source).toContain("canAccessSettings(user)");
    expect(source).not.toContain("Profile Settings");
    expect(source).not.toContain('to="/profile/settings/main"');
  });

  it("renders the account menu trigger from the current user profile avatar", async () => {
    const source = await Bun.file(appShellSourcePath).text();

    expect(source).toContain("getProfileAvatarOption(user.avatarId)");
    expect(source).toContain("avatarSrc={accountAvatar.src}");
    expect(source).toContain("src={avatarSrc}");
    expect(source).toContain("function AccountMenuTrigger");
    expect(source).toContain("<DropdownMenuTrigger");
    expect(source).toContain("cursor-pointer place-items-center");
    expect(source).toContain("pointer-events-none size-full rounded-full object-cover");
    expect(source).not.toContain("getAccountInitial(user.username)");
  });

  it("keeps failed sign-out attempts on the current session", async () => {
    const source = await Bun.file(appShellSourcePath).text();

    expect(source).toContain("onSuccess: () =>");
    expect(source).toContain("onError: (error) =>");
    expect(source).toContain('id: "auth.signed_out"');
    expect(source).toContain('id: "auth.sign_out.failed"');
    expect(source).not.toContain("onSettled: () =>");
  });
});
