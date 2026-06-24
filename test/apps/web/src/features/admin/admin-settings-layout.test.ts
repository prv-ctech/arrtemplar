import { describe, expect, it } from "bun:test";
import { readWorkspaceSource, readWorkspaceSources } from "./admin-settings-test-sources";

const settingsSourcePath = "apps/web/src/features/admin/AdminSettings.tsx";
const apiKeysSettingsSourcePath = "apps/web/src/features/admin/api-keys/ApiKeysSettings.tsx";
const authSettingsSourcePath = "apps/web/src/features/auth-settings/AuthSettings.tsx";
const settingsPrimitivesSourcePath = "apps/web/src/features/settings/SettingsPrimitives.tsx";
const tableSourcePath = "apps/web/src/components/ui/table.tsx";
const usersSourcePaths = [
  "apps/web/src/features/admin/AdminUsersSettings.tsx",
  "apps/web/src/features/admin/admin-users-table.tsx",
  "apps/web/src/features/admin/change-user-password-dialog.tsx",
  "apps/web/src/features/admin/create-user-dialog.tsx",
  "apps/web/src/features/admin/delete-user-dialog-content.tsx",
  "apps/web/src/features/admin/delete-user-dialog.tsx",
  "apps/web/src/features/admin/edit-user-permissions-dialog.tsx",
  "apps/web/src/features/admin/permission-grant-grid.tsx",
  "apps/web/src/features/admin/user-permission-summary.tsx",
  "apps/web/src/features/admin/user-row-actions.tsx",
] as const;
const usersHooksSourcePath = "apps/web/src/features/admin/admin-users.ts";

describe("app settings layout", () => {
  it("uses /settings paths and permission-aware section metadata instead of admin-only copy", async () => {
    const source = await readWorkspaceSource(settingsSourcePath);

    expect(source).toContain('<h1 className="sr-only">Settings</h1>');
    expect(source).toContain('path: "/settings/about"');
    expect(source).toContain('path: "/settings/theme"');
    expect(source).not.toContain("ThemePackHeader");
    expect(source).not.toContain("CATPPUCCIN_LOGO_SRC");
    expect(source).not.toContain("Theme preference for the signed-in user.");
    expect(source).toContain('path: "/settings/services"');
    expect(source).toContain('path: "/settings/auth"');
    expect(source).toContain("AuthSettings");
    expect(source).toContain("SYSTEM_ADMIN_PERMISSION");
    expect(source).not.toContain('hasRequiredPermission(user, "settings:auth")');
    expect(source).not.toContain('path: "/admin/');
    expect(source).not.toContain("Admin settings");
    expect(source).not.toContain("mod role");
  });

  it("keeps the users section as a real directory-driven management surface", async () => {
    const settingsSource = await readWorkspaceSource(settingsSourcePath);
    const usersSource = await readWorkspaceSources(usersSourcePaths);
    const usersTableSource = await readWorkspaceSource(
      "apps/web/src/features/admin/admin-users-table.tsx",
    );
    const hooksSource = await readWorkspaceSource(usersHooksSourcePath);

    expect(settingsSource).toContain("AdminUsersSettings");
    expect(settingsSource).toContain('path: "/settings/users"');
    expect(settingsSource).not.toContain('path: "/users"');
    expect(settingsSource).toContain("ThemeSettings");
    expect(settingsSource).not.toContain("<AccountSettings");
    expect(settingsSource).not.toContain('activePage="theme"');
    expect(usersSource).toContain("Public ID");
    expect(usersSource).toContain("AuthMethodBadge");
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
    expect(usersSource).toContain("users:delete");
    expect(usersSource).toContain("settings:theme");
    expect(usersSource).toContain("DropdownMenu");
    expect(usersSource).toContain("Open user actions");
    expect(usersSource).toContain("Delete user");
    expect(usersSource).toContain("DeleteUserDialog");
    expect(usersSource).toContain("Delete this user?");
    expect(usersTableSource.match(/onDeleteUser=\{onDeleteUser\}/g)).toHaveLength(3);
    expect(usersSource).toContain("Default: admin");
    expect(usersSource).toContain("canToggleUserStatus");
    expect(usersSource).toContain("canDeleteUser");
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
    expect(usersSource).toContain('to="/profile/$publicUserId"');
    expect(usersSource).toContain("publicUserId: userId");
    expect(usersSource).toContain("View profile");
    expect(usersSource).toContain('to="/profile"');
    expect(usersSource).toContain("function UserActionsTrigger");
    expect(usersSource).toContain("<DropdownMenuTrigger");
    expect(usersSource).toContain("cursor-pointer place-items-center");
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
    expect(hooksSource).toContain("useDeleteManagedUserMutation");
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

  it("uses API Keys as the real General settings surface", async () => {
    const settingsSource = await readWorkspaceSource(settingsSourcePath);
    const apiKeysSource = await readWorkspaceSource(apiKeysSettingsSourcePath);
    const tableSource = await readWorkspaceSource(tableSourcePath);

    expect(settingsSource).toContain("ApiKeysSettings");
    expect(settingsSource).toContain('case "general":');
    expect(settingsSource).not.toContain('title="General"');
    expect(settingsSource).not.toContain("Application settings and display preferences.");
    expect(apiKeysSource).toContain("API Keys");
    expect(apiKeysSource).toContain("ApiKeyServiceCard");
    expect(apiKeysSource).toContain("aria-expanded={isExpanded}");
    expect(apiKeysSource).toContain('aria-label="Create API key"');
    expect(apiKeysSource).toContain("KeyIcon");
    expect(apiKeysSource).toContain("PlusIcon");
    expect(apiKeysSource).toContain("Open API key actions");
    expect(apiKeysSource).toContain("DropdownMenuItem");
    expect(apiKeysSource).toContain("PermissionCategoryGrid");
    expect(apiKeysSource).toContain("permissionsDialogContentClassName");
    expect(apiKeysSource).toContain("Copy API Key");
    expect(apiKeysSource).toContain("External apps using this key will lose access immediately.");
    expect(apiKeysSource).toContain("Key name");
    expect(apiKeysSource).toContain("readDateTimeLocalIso");
    expect(apiKeysSource).toContain("isApiKeyEligiblePermission");
    expect(apiKeysSource).toContain("notify(");
    expect(apiKeysSource).toContain("api_keys.created");
    expect(apiKeysSource).toContain("api_keys.updated");
    expect(apiKeysSource).toContain("api_keys.revoked");
    expect(apiKeysSource).toContain("api_keys.deleted");
    expect(apiKeysSource).toContain("api_keys.secret.copied");
    expect(tableSource).toContain("pb-4 sm:pb-0");
    expect(apiKeysSource).not.toContain("Refresh key");
    expect(apiKeysSource).not.toContain("Rotate key");
    expect(apiKeysSource).not.toContain("useRefreshApiKeyMutation");
    expect(apiKeysSource).not.toContain("useRotateApiKeyMutation");
    expect(apiKeysSource).not.toContain('containerClassName="max-w-full bg-card pt-12"');
    expect(apiKeysSource).not.toContain("absolute top-3 left-3");
    expect(apiKeysSource).not.toContain("Create scoped credentials for external apps.");
    expect(apiKeysSource).not.toContain("External app credentials");
    expect(apiKeysSource).not.toContain("Secrets are shown once after creation.");
    expect(apiKeysSource).not.toContain("IconButton");
    expect(apiKeysSource).not.toContain("<TableHead>Actions</TableHead>");
    expect(apiKeysSource).not.toContain("Import");
  });

  it("uses an opaque selected settings tab surface across Catppuccin flavors", async () => {
    const source = await readWorkspaceSource(settingsPrimitivesSourcePath);

    expect(source).toContain("data-[state=active]:bg-selected");
    expect(source).toContain("data-[state=active]:border-selected-border");
    expect(source).toContain("text-muted-foreground");
    expect(source).not.toContain("text-foreground/60");
    expect(source).not.toContain("dark:data-[state=active]:bg-input/30");
  });

  it("keeps Auth settings as compact expandable OAuth method cards", async () => {
    const source = await readWorkspaceSource(authSettingsSourcePath);
    const forbiddenAuthDefaults = [
      ["Create a confidential OAuth2", "/OIDC provider."].join(""),
      ["Subject", " mode"].join(""),
      ["RSA or EC", " CertificateKeyPair"].join(""),
      ["default", "Issuer"].join(""),
      ["default", "Scopes"].join(""),
      ["getDefault", "RedirectUri"].join(""),
      ["https://auth", ".prvmr.com"].join(""),
      ["openid", "profile", "email"].join(" "),
      ["/application/o/", ["arr", "templar/"].join("")].join(""),
    ] as const;

    expect(source).toContain("AuthMethodGrid");
    expect(source).toContain("OidcMethodCard");
    expect(source).toContain("AuthServiceCard");
    expect(source).toContain('title="OAuth/OIDC"');
    expect(source).toContain("ProviderEnabledSwitch");
    expect(source).toContain("OidcAccountLinking");
    expect(source).toContain("Account linking");
    expect(source).toContain("sm:gap-6");
    expect(source).toContain('<Separator className="my-3" />');
    expect(source).toContain("This admin account has linked OAuth accounts.");
    expect(source).toContain("LinkedIdentityBadge");
    expect(source).toContain("LinkedIdentityList");
    expect(source).toContain("Connected");
    expect(source).toContain("providerKindLabels");
    expect(source).toContain("auth.provider.saved");
    expect(source).toContain("auth.provider.save.failed");
    expect(source).toContain("OAuth settings saved.");
    expect(source).toContain("Link Accounts");
    expect(source).toContain("Unlink all");
    expect(source).toContain("identity.displayName");
    expect(source).toContain("AUTH_PROVIDER_KIND_VALUES");
    expect(source).not.toContain("Link another OIDC account");
    expect(source).not.toContain("AUTHENTIK_LOGO_SRC");
    expect(source).not.toContain("AuthMethodStatusBadges");
    expect(source).not.toContain("OAuth login method.");
    expect(source).not.toContain("Authentik login and identity links.");
    expect(source).not.toContain("authentik-icon-white");
    expect(source).not.toContain("rounded-full border border-border bg-card/70 p-1.5");
    expect(source).not.toContain("LinkedIdentitiesPanel");
    expect(source).not.toContain("LinkedIdentityItem");
    expect(source).not.toContain("identity.subject");
    expect(source).not.toContain("identity.issuer");
    expect(source).not.toContain("AuthentikHelpCard");
    expect(source).not.toContain("LinkedIdentitiesCard");
    for (const forbiddenDefault of forbiddenAuthDefaults) {
      expect(source).not.toContain(forbiddenDefault);
    }
  });
});
