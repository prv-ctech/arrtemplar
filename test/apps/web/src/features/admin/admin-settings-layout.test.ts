import { describe, expect, it } from "bun:test";
import { readWorkspaceSource } from "./admin-settings-test-sources";

const adminSettingsSourcePath = "apps/web/src/features/admin/AdminSettings.tsx";
const adminUsersSettingsSourcePath = "apps/web/src/features/admin/AdminUsersSettings.tsx";
const alertDialogSourcePath = "apps/web/src/components/ui/alert-dialog.tsx";
const appShellSourcePath = "apps/web/src/components/layout/AppShell.tsx";
const dialogSourcePath = "apps/web/src/components/ui/dialog.tsx";
const settingsNavSourcePath = "apps/web/src/features/settings/SettingsNav.tsx";
const switchSourcePath = "apps/web/src/components/ui/switch.tsx";
const stylesSourcePath = "apps/web/src/styles.css";

describe("admin settings layout", () => {
  it("keeps a page-level heading available to assistive technology", async () => {
    const source = await readWorkspaceSource(adminSettingsSourcePath);

    expect(source).toContain('<h1 className="sr-only">Admin settings</h1>');
  });

  it("uses a single shell scroll container on mobile instead of nesting viewport and page scrolling", async () => {
    const source = await readWorkspaceSource(appShellSourcePath);

    expect(source).toContain("h-dvh w-full max-w-full overflow-hidden");
    expect(source).toContain("grid h-dvh w-full");
    expect(source).toContain("grid-rows-[auto_minmax(0,1fr)]");
    expect(source).toContain("min-h-0 overflow-y-auto lg:h-dvh");
    expect(source).not.toContain("max-w-420");
    expect(source).not.toContain('className="min-w-0 h-dvh overflow-y-auto"');
  });

  it("lets authenticated shell content fill wide viewports", async () => {
    const source = await readWorkspaceSource(appShellSourcePath);

    expect(source).toContain(
      'className="grid h-dvh w-full grid-rows-[auto_minmax(0,1fr)] lg:grid-cols-[4.75rem_minmax(0,1fr)]"',
    );
    expect(source).toContain(
      'className="flex w-full items-center gap-3 px-4 py-3 sm:px-6 lg:px-8"',
    );
    expect(source).toContain('className="w-full px-4 py-5 sm:px-6 lg:px-8 lg:py-7"');
    expect(source).not.toMatch(/max-w-(370|420)/);
  });

  it("keeps the compact account menu button accessible", async () => {
    const source = await readWorkspaceSource(appShellSourcePath);

    expect(source).toContain("Open account menu for");
    expect(source).toContain("user.username");
  });

  it("keeps mobile shell actions and places desktop actions beside search", async () => {
    const source = await readWorkspaceSource(appShellSourcePath);
    const shellHeaderStart = source.indexOf("<aside");
    const contentAreaStart = source.indexOf("<section");
    const desktopHeaderStart = source.indexOf("Desktop-only header with search and actions");
    const searchPosition = source.indexOf("<search", desktopHeaderStart);
    const desktopActionsPosition = source.indexOf(
      'className="hidden gap-2 lg:flex"',
      searchPosition,
    );
    const mobileActionsPosition = source.indexOf('className="lg:hidden"', shellHeaderStart);

    expect(shellHeaderStart).toBeGreaterThan(-1);
    expect(contentAreaStart).toBeGreaterThan(shellHeaderStart);
    expect(desktopHeaderStart).toBeGreaterThan(contentAreaStart);
    expect(mobileActionsPosition).toBeGreaterThan(shellHeaderStart);
    expect(mobileActionsPosition).toBeLessThan(contentAreaStart);
    expect(searchPosition).toBeGreaterThan(desktopHeaderStart);
    expect(desktopActionsPosition).toBeGreaterThan(searchPosition);
    expect(source).toContain('accountMenuSide="right"');
  });

  it("uses a desktop-only search header without adding a mobile header", async () => {
    const source = await readWorkspaceSource(appShellSourcePath);

    expect(source).toContain(
      'className="sticky top-0 z-20 hidden border-b border-border bg-background/92 backdrop-blur-lg lg:block"',
    );
    expect(source).toContain(
      'className="flex w-full items-center gap-3 px-4 py-3 sm:px-6 lg:px-8"',
    );
    expect(source).toContain('className="flex min-w-0 flex-1 items-center gap-3');
    expect(source).not.toContain("hidden min-w-72 items-center");
  });

  it("styles native scrollbars with theme tokens", async () => {
    const source = await readWorkspaceSource(stylesSourcePath);

    expect(source).toContain("scrollbar-color:");
    expect(source).toContain("var(--primary)");
    expect(source).toContain("var(--background)");
    expect(source).toContain("::-webkit-scrollbar-thumb");
    expect(source).toContain(".scrollbar-hidden");
    expect(source).toContain("scrollbar-width: none");
  });

  it("renders the users section as a real local-account management panel", async () => {
    const source = await readWorkspaceSource(adminSettingsSourcePath);
    const usersSource = await readWorkspaceSource(adminUsersSettingsSourcePath);
    const userUsernameInterpolation = "$" + "{user.username}";

    expect(source).toContain("AdminUsersSettings");
    expect(usersSource).toContain("useAdminUsersQuery");
    expect(usersSource).toContain("useCreateAdminUserMutation");
    expect(usersSource).toContain("useChangeAdminUserPasswordMutation");
    expect(usersSource).toContain("useChangeAdminUserRoleMutation");
    expect(usersSource).toContain("useAdminPermissionCatalogQuery");
    expect(usersSource).toContain("useUpdateAdminUserPermissionsMutation");
    expect(usersSource).toContain("ADMIN_PERMISSION_CATALOG");
    expect(usersSource).toContain("useDisableAdminUserMutation");
    expect(usersSource).toContain("useEnableAdminUserMutation");
    expect(usersSource).toContain("<Table");
    expect(usersSource).toContain("<Dialog");
    expect(usersSource).toContain("<AlertDialog");
    expect(usersSource).toContain("managed non-admin local accounts");
    expect(usersSource).toContain("No managed local accounts yet");
    expect(usersSource).not.toContain("currentAdminPassword");
    expect(usersSource).not.toContain("Your admin password");
    expect(usersSource).toContain("Permission grants");
    expect(usersSource).toContain("function PermissionsCell");
    expect(usersSource).toContain("Manage permissions");
    expect(usersSource).toContain("PlusIcon");
    expect(usersSource).toContain(
      `aria-label={\`Manage permissions for ${userUsernameInterpolation}\`}`,
    );
    expect(usersSource).toContain("onClick={onManagePermissions}");
    expect(usersSource).toContain("getPermissionLabel(permission)");
    expect(usersSource).toContain("High risk");
    expect(usersSource).toContain('option value="user"');
    expect(usersSource).toContain('option value="mod"');
    expect(usersSource).not.toContain('option value="admin"');
    expect(usersSource).not.toContain("Full admin");
    expect(usersSource).toContain("user.permissions");
    expect(usersSource).not.toContain("Last active admin accounts cannot be disabled or demoted.");
    expect(usersSource).not.toContain("activeAdminCount");
    expect(usersSource).not.toContain("isActiveAdmin");
    expect(source).not.toContain("Allow Registration");
    expect(source).not.toContain("Default role assigned to newly registered users.");
  });

  it("keeps dialogs and permission grants viewport-safe on phones", async () => {
    const alertDialogSource = await readWorkspaceSource(alertDialogSourcePath);
    const dialogSource = await readWorkspaceSource(dialogSourcePath);
    const usersSource = await readWorkspaceSource(adminUsersSettingsSourcePath);

    expect(dialogSource).toContain("max-h-[calc(100dvh-2rem)]");
    expect(dialogSource).toContain("overflow-y-auto overscroll-contain");
    expect(alertDialogSource).toContain("max-h-[calc(100dvh-2rem)]");
    expect(alertDialogSource).toContain("overflow-y-auto overscroll-contain");
    expect(usersSource).toContain("grid-rows-[auto_minmax(0,1fr)]");
    expect(usersSource).toContain("grid-rows-[minmax(0,1fr)_auto_auto]");
    expect(usersSource).toContain("Available permission grants</legend>");
    expect(usersSource).not.toContain("{entry.permission}</span>");
  });
});

describe("admin settings navigation", () => {
  it("exposes horizontal tab semantics and keyboard movement", async () => {
    const source = await readWorkspaceSource(settingsNavSourcePath);

    expect(source).toContain('role="tablist"');
    expect(source).toContain('role="tab"');
    expect(source).toContain("aria-selected={isActive}");
    expect(source).toContain("aria-controls={");
    expect(source).toContain("-settings-panel`}");
    expect(source).toContain("scrollbar-hidden");
    expect(source).toContain("tabIndex={isActive ? 0 : -1}");
    expect(source).toContain("ArrowRight");
    expect(source).toContain("ArrowLeft");
    expect(source).toContain("Home");
    expect(source).toContain("End");
  });
});

describe("settings switch styling", () => {
  it("does not combine conflicting border colors and uses canonical translate utilities", async () => {
    const source = await readWorkspaceSource(switchSourcePath);

    expect(source).not.toContain("border border-input border-transparent");
    expect(source).toContain("data-[state=checked]:translate-x-5.5");
    expect(source).not.toContain("data-[state=checked]:translate-x-[1.375rem]");
  });
});
