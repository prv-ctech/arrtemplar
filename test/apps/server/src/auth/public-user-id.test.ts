import { describe, expect, it } from "bun:test";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  generatePublicUserId,
  PUBLIC_USER_ID_ALPHABET,
  PUBLIC_USER_ID_LENGTH,
} from "../../../../../apps/server/src/auth/public-user-id";
import {
  DEFAULT_SIGNED_IN_USER_PERMISSIONS,
  PERMISSION_CATALOG,
  USER_PERMISSION_VALUES,
  type UserPermission,
} from "../../../../../packages/shared/src";

const workspaceRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../../../../");
const schemaSourcePath = `${workspaceRoot}/apps/server/src/db/schema.ts`;
const sqlBaselinePath = `${workspaceRoot}/apps/server/drizzle/0000_core_tables.sql`;
const snapshotPath = `${workspaceRoot}/apps/server/drizzle/meta/0000_snapshot.json`;

const expectedPermissions: UserPermission[] = [
  "system:admin",
  "users:manage",
  "users:create",
  "users:update",
  "users:password",
  "users:permissions",
  "users:disable",
  "users:delete",
  "profile:update",
  "profile:password",
  "profile:notifications",
  "settings:view",
  "settings:general",
  "settings:services",
  "settings:library",
  "settings:import",
  "settings:notifications",
  "settings:auth",
  "settings:logs",
  "settings:about",
  "settings:theme",
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

describe("permission foundations", () => {
  it("exports the shared permission-first catalog", () => {
    expect([...USER_PERMISSION_VALUES]).toEqual(expectedPermissions);
    expect(PERMISSION_CATALOG.map((entry) => entry.permission)).toEqual(expectedPermissions);
    expect(DEFAULT_SIGNED_IN_USER_PERMISSIONS).toEqual([
      "profile:update",
      "profile:password",
      "profile:notifications",
      "settings:view",
      "settings:about",
      "settings:theme",
    ]);

    expect(PERMISSION_CATALOG.find((entry) => entry.permission === "system:admin")).toMatchObject({
      category: "system",
      risk: "critical",
      defaultGrant: "bootstrap-first-user",
      route: null,
    });
    expect(PERMISSION_CATALOG.find((entry) => entry.permission === "users:manage")).toMatchObject({
      category: "users",
      route: { surface: "users", path: "/settings/users" },
      defaultGrant: "explicit",
    });
    expect(PERMISSION_CATALOG.find((entry) => entry.permission === "profile:update")).toMatchObject(
      {
        category: "profile",
        route: { surface: "profile", path: "/profile/settings/main" },
        defaultGrant: "signed-in-user",
      },
    );
    expect(PERMISSION_CATALOG.find((entry) => entry.permission === "settings:theme")).toMatchObject(
      {
        category: "settings",
        route: { surface: "settings", path: "/settings/theme" },
        defaultGrant: "signed-in-user",
      },
    );
  });

  it("keeps public IDs and permission grants in the server schema source", async () => {
    const source = await Bun.file(schemaSourcePath).text();

    expect(source).toContain('publicId: text("public_id")');
    expect(source).toContain('"user_permission_grants"');
  });

  it("removes legacy role storage from the users table sources", async () => {
    const [schemaSource, sqlSource, snapshotSource] = await Promise.all([
      Bun.file(schemaSourcePath).text(),
      Bun.file(sqlBaselinePath).text(),
      Bun.file(snapshotPath).text(),
    ]);
    const snapshot = JSON.parse(snapshotSource) as {
      tables: {
        users: {
          columns: Record<string, unknown>;
          indexes: Record<string, unknown>;
        };
      };
    };

    expect(schemaSource).not.toContain("USER_ROLES");
    expect(schemaSource).not.toContain('role: text("role"');
    expect(schemaSource).not.toContain('index("users_role_idx"');

    expect(sqlSource).not.toContain("`role` text");
    expect(sqlSource).not.toContain("CREATE INDEX `users_role_idx`");

    expect(snapshot.tables.users.columns.role).toBeUndefined();
    expect(snapshot.tables.users.indexes.users_role_idx).toBeUndefined();
  });
});
