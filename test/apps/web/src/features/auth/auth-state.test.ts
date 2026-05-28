import { describe, expect, it } from "bun:test";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  hasDelegatedAccountPermission,
  hasRequiredPermission,
} from "../../../../../../apps/web/src/features/auth/auth-state";
import type { PublicUser } from "../../../../../../packages/shared/src";

const workspaceRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../../../../../");
const authStateSourcePath = `${workspaceRoot}/apps/web/src/features/auth/auth-state.ts`;

const baseUser = {
  id: "abcABC123",
  username: "operator",
  email: "operator@example.local",
  createdAt: "2026-05-27T00:00:00.000Z",
  lastLoginAt: null,
  permissions: [],
} satisfies Omit<PublicUser, "role">;

describe("useAuthSetupQuery", () => {
  it("always refreshes setup status when the login form mounts", async () => {
    const source = await Bun.file(authStateSourcePath).text();

    expect(source).toContain("staleTime: 0");
    expect(source).toContain('refetchOnMount: "always"');
  });
});

describe("hasRequiredPermission", () => {
  it("allows admins with effective permissions", () => {
    expect(
      hasRequiredPermission(
        { ...baseUser, role: "admin", permissions: ["admin:logs"] },
        "admin:logs",
      ),
    ).toBe(true);
  });

  it("allows mods only for granted permissions", () => {
    expect(
      hasRequiredPermission(
        { ...baseUser, role: "mod", permissions: ["admin:import"] },
        "admin:import",
      ),
    ).toBe(true);
    expect(
      hasRequiredPermission(
        { ...baseUser, role: "mod", permissions: ["admin:import"] },
        "admin:logs",
      ),
    ).toBe(false);
  });

  it("fails closed for normal users even if stale grants are present", () => {
    expect(
      hasRequiredPermission(
        { ...baseUser, role: "user", permissions: ["admin:logs"] },
        "admin:logs",
      ),
    ).toBe(false);
  });
});

describe("hasDelegatedAccountPermission", () => {
  it("denies admins because delegated account sections are mod-only", () => {
    expect(
      hasDelegatedAccountPermission(
        { ...baseUser, role: "admin", permissions: ["admin:logs"] },
        "admin:logs",
      ),
    ).toBe(false);
  });

  it("allows mods only for granted delegated account permissions", () => {
    expect(
      hasDelegatedAccountPermission(
        { ...baseUser, role: "mod", permissions: ["admin:import"] },
        "admin:import",
      ),
    ).toBe(true);
    expect(
      hasDelegatedAccountPermission(
        { ...baseUser, role: "mod", permissions: ["admin:import"] },
        "admin:logs",
      ),
    ).toBe(false);
  });

  it("fails closed for normal users even if stale grants are present", () => {
    expect(
      hasDelegatedAccountPermission(
        { ...baseUser, role: "user", permissions: ["admin:logs"] },
        "admin:logs",
      ),
    ).toBe(false);
  });
});
