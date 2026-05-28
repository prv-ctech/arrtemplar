import type { UserRole } from "./auth";

export const USER_PERMISSION_VALUES = [
  "admin:general",
  "admin:library",
  "admin:users",
  "admin:import",
  "admin:notifications",
  "admin:services",
  "admin:logs",
  "admin:about",
] as const;

export type UserPermission = (typeof USER_PERMISSION_VALUES)[number];

export type AdminPermissionCatalogEntry = {
  permission: UserPermission;
  label: string;
  description: string;
  routeSlug: string;
  sourceAdminRoute: string;
  minimumRole: Extract<UserRole, "mod" | "admin">;
  risk: "standard" | "high";
  augmentsPersonalRoute: boolean;
};

export const ADMIN_PERMISSION_CATALOG = [
  {
    permission: "admin:general",
    label: "General",
    description: "Delegate access to general administrative settings.",
    routeSlug: "general",
    sourceAdminRoute: "/admin/general",
    minimumRole: "mod",
    risk: "standard",
    augmentsPersonalRoute: false,
  },
  {
    permission: "admin:library",
    label: "Library",
    description: "Delegate access to library configuration and review surfaces.",
    routeSlug: "library",
    sourceAdminRoute: "/admin/library",
    minimumRole: "mod",
    risk: "standard",
    augmentsPersonalRoute: false,
  },
  {
    permission: "admin:users",
    label: "Users",
    description:
      "Delegate access to user-management views without allowing role or permission grants.",
    routeSlug: "users",
    sourceAdminRoute: "/admin/users",
    minimumRole: "mod",
    risk: "high",
    augmentsPersonalRoute: false,
  },
  {
    permission: "admin:import",
    label: "Import",
    description: "Delegate access to import tools and related settings.",
    routeSlug: "import",
    sourceAdminRoute: "/admin/import",
    minimumRole: "mod",
    risk: "standard",
    augmentsPersonalRoute: false,
  },
  {
    permission: "admin:notifications",
    label: "Notifications",
    description:
      "Delegate access to administrative notification controls inside personal notifications.",
    routeSlug: "notifications",
    sourceAdminRoute: "/admin/notifications",
    minimumRole: "mod",
    risk: "standard",
    augmentsPersonalRoute: true,
  },
  {
    permission: "admin:services",
    label: "Services",
    description: "Delegate access to services settings and status controls.",
    routeSlug: "services",
    sourceAdminRoute: "/admin/services",
    minimumRole: "mod",
    risk: "standard",
    augmentsPersonalRoute: false,
  },
  {
    permission: "admin:logs",
    label: "Logs",
    description: "Delegate access to operational log views.",
    routeSlug: "logs",
    sourceAdminRoute: "/admin/logs",
    minimumRole: "mod",
    risk: "standard",
    augmentsPersonalRoute: false,
  },
  {
    permission: "admin:about",
    label: "About",
    description: "Delegate access to application version and about settings.",
    routeSlug: "about",
    sourceAdminRoute: "/admin/about",
    minimumRole: "mod",
    risk: "standard",
    augmentsPersonalRoute: false,
  },
] as const satisfies readonly AdminPermissionCatalogEntry[];
