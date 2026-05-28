import { describe, expect, it } from "bun:test";
import {
  generatePublicUserId,
  PUBLIC_USER_ID_ALPHABET,
  PUBLIC_USER_ID_LENGTH,
} from "../../../../../apps/server/src/auth/public-user-id";
import { userPermissionGrants, userRoles, users } from "../../../../../apps/server/src/db/schema";
import {
  ADMIN_PERMISSION_CATALOG,
  USER_PERMISSION_VALUES,
  type UserPermission,
} from "../../../../../packages/shared/src";

const expectedPermissions: UserPermission[] = [
  "admin:general",
  "admin:library",
  "admin:users",
  "admin:import",
  "admin:notifications",
  "admin:services",
  "admin:logs",
  "admin:about",
];

describe("managed account public IDs", () => {
  it("generates exactly 9 base62 characters", () => {
    const publicUserId = generatePublicUserId();

    expect(publicUserId).toHaveLength(9);
    expect(publicUserId).toMatch(/^[A-Za-z0-9]{9}$/);
    expect(PUBLIC_USER_ID_LENGTH).toBe(9);
    expect(PUBLIC_USER_ID_ALPHABET).toHaveLength(62);
  });

  it("uses rejection sampling so high random bytes do not bias the alphabet", () => {
    const queuedBytes = [248, 249, 250, 251, 252, 253, 254, 255, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
    const publicUserId = generatePublicUserId((buffer) => {
      for (let index = 0; index < buffer.length; index += 1) {
        const nextByte = queuedBytes.shift();
        if (nextByte === undefined) {
          throw new Error("The deterministic random source ran out of bytes.");
        }
        buffer[index] = nextByte;
      }
    });

    expect(publicUserId).toBe(PUBLIC_USER_ID_ALPHABET.slice(0, PUBLIC_USER_ID_LENGTH));
  });

  it("does not repeat IDs across a focused sample", () => {
    const generatedIds = new Set(Array.from({ length: 500 }, () => generatePublicUserId()));

    expect(generatedIds.size).toBe(500);
  });
});

describe("role and permission foundations", () => {
  it("models the ordered user < mod < admin role hierarchy", () => {
    expect(userRoles).toEqual(["user", "mod", "admin"]);
  });

  it("exports the shared admin-derived permission catalog", () => {
    expect([...USER_PERMISSION_VALUES]).toEqual(expectedPermissions);
    expect(ADMIN_PERMISSION_CATALOG.map((entry) => entry.permission)).toEqual(expectedPermissions);
    expect(ADMIN_PERMISSION_CATALOG.map((entry) => entry.routeSlug)).toEqual([
      "general",
      "library",
      "users",
      "import",
      "notifications",
      "services",
      "logs",
      "about",
    ]);
    expect(ADMIN_PERMISSION_CATALOG.every((entry) => entry.minimumRole === "mod")).toBe(true);
    expect(
      ADMIN_PERMISSION_CATALOG.every((entry) => entry.sourceAdminRoute.startsWith("/admin/")),
    ).toBe(true);
  });

  it("exports schema columns and tables for managed account IDs and permission grants", () => {
    expect(users.publicId).toBeDefined();
    expect(userPermissionGrants).toBeDefined();
  });
});
