export const PERMISSION_CATEGORIES = ["system", "users", "profile", "help", "settings"] as const;

export type PermissionCategory = (typeof PERMISSION_CATEGORIES)[number];

export const PERMISSION_RISK_VALUES = ["low", "medium", "high", "critical"] as const;

export type PermissionRisk = (typeof PERMISSION_RISK_VALUES)[number];

export const PERMISSION_DEFAULT_GRANTS = [
  "bootstrap-first-user",
  "signed-in-user",
  "explicit",
] as const;

export type PermissionDefaultGrant = (typeof PERMISSION_DEFAULT_GRANTS)[number];

export const PERMISSION_ROUTE_SURFACES = ["profile", "help", "settings", "users"] as const;

export type PermissionRouteSurface = (typeof PERMISSION_ROUTE_SURFACES)[number];

export type PermissionRoute = {
  surface: PermissionRouteSurface;
  path: string;
};

type PermissionCatalogShape = {
  permission: string;
  category: PermissionCategory;
  label: string;
  description: string;
  risk: PermissionRisk;
  defaultGrant: PermissionDefaultGrant;
  route: PermissionRoute | null;
};

export const PERMISSION_CATALOG = [
  {
    permission: "system:admin",
    category: "system",
    label: "Full admin",
    description: "Full access to every current and future protected surface in the application.",
    risk: "critical",
    defaultGrant: "bootstrap-first-user",
    route: null,
  },
  {
    permission: "users:manage",
    category: "users",
    label: "Manage users",
    description: "View the user directory and access cross-user profile and settings pages.",
    risk: "high",
    defaultGrant: "explicit",
    route: { surface: "users", path: "/settings/users" },
  },
  {
    permission: "users:create",
    category: "users",
    label: "Create users",
    description: "Create local user accounts from the managed users directory.",
    risk: "medium",
    defaultGrant: "explicit",
    route: { surface: "users", path: "/settings/users" },
  },
  {
    permission: "users:update",
    category: "users",
    label: "Update users",
    description: "Edit another user's identity and account settings details.",
    risk: "high",
    defaultGrant: "explicit",
    route: { surface: "users", path: "/profile/:publicUserId/settings/main" },
  },
  {
    permission: "users:password",
    category: "users",
    label: "Change user passwords",
    description: "Reset another user's password and revoke their existing sessions.",
    risk: "high",
    defaultGrant: "explicit",
    route: { surface: "users", path: "/profile/:publicUserId/settings/password" },
  },
  {
    permission: "users:permissions",
    category: "users",
    label: "Manage user permissions",
    description: "Grant or revoke explicit permissions for managed users.",
    risk: "critical",
    defaultGrant: "explicit",
    route: { surface: "users", path: "/profile/:publicUserId/settings/permissions" },
  },
  {
    permission: "users:disable",
    category: "users",
    label: "Disable users",
    description: "Disable or restore managed user access while preserving audit history.",
    risk: "high",
    defaultGrant: "explicit",
    route: { surface: "users", path: "/profile/:publicUserId" },
  },
  {
    permission: "users:delete",
    category: "users",
    label: "Delete users",
    description: "Permanently delete managed users while preserving audit history.",
    risk: "critical",
    defaultGrant: "explicit",
    route: { surface: "users", path: "/settings/users" },
  },
  {
    permission: "profile:update",
    category: "profile",
    label: "Update profile",
    description: "Edit the signed-in user's own profile details.",
    risk: "low",
    defaultGrant: "signed-in-user",
    route: { surface: "profile", path: "/profile/settings/main" },
  },
  {
    permission: "profile:password",
    category: "profile",
    label: "Change own password",
    description: "Change the signed-in user's own password.",
    risk: "low",
    defaultGrant: "signed-in-user",
    route: { surface: "profile", path: "/profile/settings/password" },
  },
  {
    permission: "profile:notifications",
    category: "profile",
    label: "Manage profile notifications",
    description: "Change the signed-in user's personal notification preferences.",
    risk: "low",
    defaultGrant: "signed-in-user",
    route: { surface: "profile", path: "/profile/settings/notifications" },
  },
  {
    permission: "help:view",
    category: "help",
    label: "Help",
    description: "Open the help shell and FAQ surfaces.",
    risk: "low",
    defaultGrant: "signed-in-user",
    route: { surface: "help", path: "/help" },
  },
  {
    permission: "help:create",
    category: "help",
    label: "Create tickets",
    description: "Create help tickets with optional image or video attachments.",
    risk: "low",
    defaultGrant: "signed-in-user",
    route: { surface: "help", path: "/help/tickets" },
  },
  {
    permission: "help:read",
    category: "help",
    label: "View own tickets",
    description: "View help tickets created by the signed-in user.",
    risk: "low",
    defaultGrant: "signed-in-user",
    route: { surface: "help", path: "/help/tickets" },
  },
  {
    permission: "help:manage",
    category: "help",
    label: "Manage tickets",
    description: "View all help tickets and update ticket status across users.",
    risk: "high",
    defaultGrant: "explicit",
    route: { surface: "help", path: "/help/tickets" },
  },
  {
    permission: "settings:view",
    category: "settings",
    label: "Settings",
    description: "Enter the top-level application settings shell.",
    risk: "low",
    defaultGrant: "signed-in-user",
    route: { surface: "settings", path: "/settings" },
  },
  {
    permission: "settings:general",
    category: "settings",
    label: "General settings",
    description: "Manage general application configuration.",
    risk: "high",
    defaultGrant: "explicit",
    route: { surface: "settings", path: "/settings/general" },
  },
  {
    permission: "settings:services",
    category: "settings",
    label: "Service settings",
    description: "Manage integrations and external application services.",
    risk: "high",
    defaultGrant: "explicit",
    route: { surface: "settings", path: "/settings/services" },
  },
  {
    permission: "settings:library",
    category: "settings",
    label: "Library settings",
    description: "Manage library metadata, curation, and related application settings.",
    risk: "medium",
    defaultGrant: "explicit",
    route: { surface: "settings", path: "/settings/library" },
  },
  {
    permission: "settings:notifications",
    category: "settings",
    label: "Notification settings",
    description: "Manage app-wide notification channels and delivery settings.",
    risk: "medium",
    defaultGrant: "explicit",
    route: { surface: "settings", path: "/settings/notifications" },
  },
  {
    permission: "settings:auth",
    category: "settings",
    label: "Auth settings",
    description: "Manage native OAuth login provider configuration and admin account linking.",
    risk: "critical",
    defaultGrant: "explicit",
    route: { surface: "settings", path: "/settings/auth" },
  },
  {
    permission: "settings:logs",
    category: "settings",
    label: "Log settings",
    description: "View and manage audit, retention, and operational log settings.",
    risk: "high",
    defaultGrant: "explicit",
    route: { surface: "settings", path: "/settings/logs" },
  },
  {
    permission: "settings:about",
    category: "settings",
    label: "About settings",
    description: "View safe application information, version details, and support metadata.",
    risk: "low",
    defaultGrant: "signed-in-user",
    route: { surface: "settings", path: "/settings/about" },
  },
  {
    permission: "settings:theme",
    category: "settings",
    label: "Theme settings",
    description: "Manage the signed-in user's own theme preference from the shared settings area.",
    risk: "low",
    defaultGrant: "signed-in-user",
    route: { surface: "settings", path: "/settings/theme" },
  },
] as const satisfies readonly PermissionCatalogShape[];

export type UserPermission = (typeof PERMISSION_CATALOG)[number]["permission"];
export type PermissionCatalogEntry = (typeof PERMISSION_CATALOG)[number];

export const USER_PERMISSION_VALUES = PERMISSION_CATALOG.map(
  (entry) => entry.permission,
) as readonly UserPermission[];
export const SYSTEM_ADMIN_PERMISSION: UserPermission = "system:admin";

export const DEFAULT_SIGNED_IN_USER_PERMISSIONS = PERMISSION_CATALOG.filter(
  (entry) => entry.defaultGrant === "signed-in-user",
).map((entry) => entry.permission) as readonly UserPermission[];

export const BOOTSTRAP_ADMIN_PERMISSIONS = PERMISSION_CATALOG.filter(
  (entry) => entry.defaultGrant === "bootstrap-first-user",
).map((entry) => entry.permission) as readonly UserPermission[];

export const PERMISSION_CATALOG_BY_PERMISSION = new Map<UserPermission, PermissionCatalogEntry>(
  PERMISSION_CATALOG.map((entry) => [entry.permission, entry]),
);

const permissionOrder = new Map<UserPermission, number>(
  USER_PERMISSION_VALUES.map((permission, index) => [permission, index]),
);

export function isUserPermission(value: string): value is UserPermission {
  return PERMISSION_CATALOG_BY_PERMISSION.has(value as UserPermission);
}

export function normalizePermissionList(permissions: readonly UserPermission[]): UserPermission[] {
  return [...new Set(permissions)].sort(
    (left, right) => (permissionOrder.get(left) ?? 0) - (permissionOrder.get(right) ?? 0),
  );
}

export function hasPermissionGrant(
  permissions: readonly UserPermission[],
  requiredPermission: UserPermission,
): boolean {
  return permissions.includes(SYSTEM_ADMIN_PERMISSION) || permissions.includes(requiredPermission);
}
