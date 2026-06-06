import { describe, expect, it } from "bun:test";
import { readWorkspaceSource } from "./admin-settings-test-sources";

const settingsSourcePath = "apps/web/src/features/admin/AdminSettings.tsx";
const settingsPrimitivesSourcePath = "apps/web/src/features/settings/SettingsPrimitives.tsx";
const usersSourcePath = "apps/web/src/features/admin/AdminUsersSettings.tsx";
const usersHooksSourcePath = "apps/web/src/features/admin/admin-users.ts";

describe("app settings layout", () => {
  it("uses /settings paths and permission-aware section metadata instead of admin-only copy", async () => {
    const source = await readWorkspaceSource(settingsSourcePath);

    expect(source).toContain('<h1 className="sr-only">Settings</h1>');
    expect(source).toContain('path: "/settings/about"');
    expect(source).toContain('path: "/settings/theme"');
    expect(source).toContain('path: "/settings/services"');
    expect(source).not.toContain('path: "/admin/');
    expect(source).not.toContain("Admin settings");
    expect(source).not.toContain("mod role");
  });

  it("keeps the users section as a real directory-driven management surface", async () => {
    const settingsSource = await readWorkspaceSource(settingsSourcePath);
    const usersSource = await readWorkspaceSource(usersSourcePath);
    const hooksSource = await readWorkspaceSource(usersHooksSourcePath);

    expect(settingsSource).toContain("AdminUsersSettings");
    expect(settingsSource).toContain('path: "/settings/users"');
    expect(settingsSource).not.toContain('path: "/users"');
    expect(settingsSource).toContain("ThemeSettings");
    expect(settingsSource).not.toContain("<AccountSettings");
    expect(settingsSource).not.toContain('activePage="theme"');
    expect(usersSource).toContain("Public ID");
    expect(usersSource).toContain("Permissions");
    expect(usersSource).toContain("Status");
    expect(usersSource).toContain("Created");
    expect(usersSource).toContain("Updated");
    expect(usersSource).not.toContain("RoleBadge");
    expect(usersSource).not.toContain('option value="mod"');
    expect(usersSource).not.toContain('option value="admin"');
    expect(usersSource).not.toContain('option value="user"');
    expect(usersSource).toContain("Full admin");
    expect(usersSource).toContain("High risk");
    expect(usersSource).toContain("Default user");
    expect(usersSource).toContain("Service operator");
    expect(usersSource).toContain("User manager");
    expect(usersSource).toContain("users:manage");
    expect(usersSource).toContain("settings:theme");
    expect(usersSource).toContain("DropdownMenu");
    expect(usersSource).toContain("Open user actions");
    expect(usersSource).toContain("Default: admin");
    expect(usersSource).toContain("canToggleUserStatus");
    expect(usersSource).toContain("UserCirclePlusIcon");
    expect(usersSource).toContain('aria-label="Create user"');
    expect(usersSource).toContain('containerClassName="max-w-full bg-card"');
    expect(usersSource).toContain('className="border-separate border-spacing-0"');
    expect(usersSource).toContain("sticky right-0 w-12 border-l border-border");
    expect(usersSource).toContain("shadow-[-1px_0_0_0_var(--border),-12px_0_0_0_var(--card)]");
    expect(usersSource).toContain("sm:shadow-none");
    expect(usersSource).toContain("sm:static sm:border-l-0 sm:bg-transparent");
    expect(usersSource).not.toContain("bg-card/95");
    expect(usersSource).not.toContain("backdrop-blur-sm");
    expect(usersSource).toContain("const userActionHeaderClassName");
    expect(usersSource).toContain("const userActionCellClassName");
    expect(usersSource).toContain("bg-primary text-primary-foreground");
    expect(usersSource).toContain("shadow-(--shadow-button)");
    expect(usersSource).toContain("pointer-events-none size-4");
    expect(usersSource).toContain('to: "/profile/$publicUserId"');
    expect(usersSource).toContain("publicUserId: user.id");
    expect(usersSource).toContain("View profile");
    expect(usersSource).toContain('to: "/profile"');
    expect(usersSource).not.toContain('to="/profile/settings/main"');
    expect(usersSource).not.toContain('to="/profile/$publicUserId/settings/main"');
    expect(usersSource).not.toContain("Edit settings");
    expect(usersSource).not.toContain("UserSettingsActionLink");
    expect(usersSource).not.toContain("UserProfileActionLink");
    expect(usersSource).not.toContain('to="/Users/$publicUserId"');
    expect(usersSource).not.toContain('to="/Users/$publicUserId/settings/main"');
    expect(usersSource).not.toContain("lucide-react");
    expect(usersSource).not.toContain("UserRoundPlus");
    expect(usersSource).toContain("focus-visible:ring-0");
    expect(usersSource).toContain("focus-visible:shadow-none");
    expect(usersSource).toContain("hover:translate-y-0");
    expect(usersSource).toContain("active:translate-y-0");
    expect(usersSource).not.toContain(
      "Manage local users by public ID, permissions, and account status.",
    );
    expect(usersSource).not.toContain("/users directory");
    expect(usersSource).not.toContain("<PlusIcon");
    expect(usersSource).not.toContain("<TableHead>Actions</TableHead>");
    expect(usersSource).not.toContain('explicitPermissions.join(", ")');
    expect(hooksSource).toContain("useUsersQuery");
    expect(hooksSource).toContain("useCreateUserMutation");
    expect(hooksSource).toContain("useChangeManagedUserPasswordMutation");
    expect(hooksSource).toContain("usePermissionCatalogQuery");
    expect(hooksSource).toContain("useUpdateManagedUserPermissionsMutation");
    expect(hooksSource).toContain("useUpdateManagedUserStatusMutation");
    expect(hooksSource).not.toContain("useChangeAdminUserRoleMutation");
  });

  it("keeps the settings tabs shell static while scrolling tab items inside it", async () => {
    const source = await readWorkspaceSource("apps/web/src/features/settings/SettingsNav.tsx");

    expect(source).toContain("w-full min-w-0 overflow-hidden rounded-2xl");
    expect(source).toContain("scrollbar-hidden min-w-0 overflow-x-auto");
    expect(source).toContain('className="w-max min-w-max"');
    expect(source).toContain('className="h-auto w-max min-w-max gap-1 bg-transparent p-0"');
    expect(source).not.toContain("py-1 pr-4 pl-0");
    expect(source).not.toContain('className="w-max min-w-full"');
    expect(source).not.toContain("data-[state=active]:bg-background");
  });

  it("uses an opaque selected settings tab surface across Catppuccin flavors", async () => {
    const source = await readWorkspaceSource(settingsPrimitivesSourcePath);

    expect(source).toContain("data-[state=active]:bg-selected");
    expect(source).toContain("data-[state=active]:border-selected-border");
    expect(source).toContain("text-muted-foreground");
    expect(source).not.toContain("text-foreground/60");
    expect(source).not.toContain("dark:data-[state=active]:bg-input/30");
  });
});
