import { describe, expect, it } from "bun:test";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  canAccessSettings,
  canManageUsers,
  hasAnyRequiredPermission,
  hasRequiredPermission,
} from "../../../../../../apps/web/src/features/auth/auth-state";
import {
  DEFAULT_PROFILE_AVATAR_ID,
  DEFAULT_PROFILE_BANNER_ID,
  DEFAULT_SIGNED_IN_USER_PERMISSIONS,
  PERMISSION_CATALOG,
  type PublicUser,
  SYSTEM_ADMIN_PERMISSION,
} from "../../../../../../packages/shared/src";

const workspaceRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../../../../../");
const authStateSourcePath = `${workspaceRoot}/apps/web/src/features/auth/auth-state.ts`;
const sharedAuthSourcePath = `${workspaceRoot}/packages/shared/src/api/auth.ts`;

const baseUser: PublicUser = {
  id: "abcABC123",
  username: "operator",
  email: "operator@example.local",
  avatarId: DEFAULT_PROFILE_AVATAR_ID,
  bannerId: DEFAULT_PROFILE_BANNER_ID,
  permissions: [...DEFAULT_SIGNED_IN_USER_PERMISSIONS],
  createdAt: "2026-05-27T00:00:00.000Z",
  lastLoginAt: null,
};

describe("useAuthSetupQuery", () => {
  it("always refreshes setup status when the login form mounts", async () => {
    const source = await Bun.file(authStateSourcePath).text();

    expect(source).toContain("staleTime: 0");
    expect(source).toContain('refetchOnMount: "always"');
  });
});

describe("permission-first shared auth contracts", () => {
  it("removes public role contracts from shared auth types", async () => {
    const source = await Bun.file(sharedAuthSourcePath).text();

    expect(source).not.toContain("USER_ROLES");
    expect(source).not.toContain("UserRole");
    expect(source).not.toContain("ManagedUserRole");
    expect(source).not.toContain("role:");
  });

  it("exposes self-service and safe settings permissions by default", () => {
    expect(DEFAULT_SIGNED_IN_USER_PERMISSIONS).toEqual([
      "profile:update",
      "profile:password",
      "profile:notifications",
      "settings:view",
      "settings:about",
      "settings:theme",
    ]);

    expect(PERMISSION_CATALOG.find((entry) => entry.permission === "settings:view")).toMatchObject({
      label: "Settings",
      category: "settings",
      route: { surface: "settings", path: "/settings" },
      defaultGrant: "signed-in-user",
    });
    expect(
      PERMISSION_CATALOG.find((entry) => entry.permission === "users:permissions"),
    ).toMatchObject({
      label: "Manage user permissions",
      category: "users",
      route: { surface: "users", path: "/profile/:publicUserId/settings/permissions" },
      defaultGrant: "explicit",
    });
  });

  it("removes role-only helper logic from the web auth state module", async () => {
    const source = await Bun.file(authStateSourcePath).text();

    expect(source).not.toContain("hasRequiredRole");
    expect(source).not.toContain("hasDelegatedAccountPermission");
    expect(source).not.toContain("user.role");
  });
});

describe("permission helpers", () => {
  it("supports exact permission checks and system:admin bypass", () => {
    expect(hasRequiredPermission(baseUser, "settings:theme")).toBe(true);
    expect(hasRequiredPermission(baseUser, "users:manage")).toBe(false);

    expect(
      hasRequiredPermission(
        { ...baseUser, permissions: [SYSTEM_ADMIN_PERMISSION] },
        "users:manage",
      ),
    ).toBe(true);
  });

  it("supports multi-permission checks and route-neutral access helpers", () => {
    expect(hasAnyRequiredPermission(baseUser, ["users:manage", "settings:view"])).toBe(true);
    expect(canAccessSettings(baseUser)).toBe(true);
    expect(canManageUsers(baseUser)).toBe(false);
    expect(
      canManageUsers({
        ...baseUser,
        permissions: [...DEFAULT_SIGNED_IN_USER_PERMISSIONS, "users:manage"],
      }),
    ).toBe(true);
  });
});
