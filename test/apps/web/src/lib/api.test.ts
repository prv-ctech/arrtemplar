import { describe, expect, it } from "bun:test";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createApiRequestHeaders } from "../../../../../apps/web/src/lib/api";
import { CSRF_HEADER_NAME, CSRF_HEADER_VALUE } from "../../../../../packages/shared/src";

const workspaceRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../../../../");
const apiSourcePath = `${workspaceRoot}/apps/web/src/lib/api.ts`;

describe("api client CSRF headers", () => {
  it("adds the CSRF proof only for unsafe requests", () => {
    expect(createApiRequestHeaders("POST")).toEqual({ [CSRF_HEADER_NAME]: CSRF_HEADER_VALUE });
    expect(createApiRequestHeaders("PUT")).toEqual({ [CSRF_HEADER_NAME]: CSRF_HEADER_VALUE });
    expect(createApiRequestHeaders("PATCH")).toEqual({ [CSRF_HEADER_NAME]: CSRF_HEADER_VALUE });
    expect(createApiRequestHeaders("DELETE")).toEqual({ [CSRF_HEADER_NAME]: CSRF_HEADER_VALUE });
    expect(createApiRequestHeaders("GET")).toBeUndefined();
    expect(createApiRequestHeaders("HEAD")).toBeUndefined();
    expect(createApiRequestHeaders("OPTIONS")).toBeUndefined();
    expect(createApiRequestHeaders(undefined)).toBeUndefined();
  });
});

describe("user profile api client", () => {
  it("exposes typed client functions for profile and password endpoints", async () => {
    const source = await Bun.file(apiSourcePath).text();

    expect(source).toContain("UpdateUserProfileRequest");
    expect(source).toContain("ChangePasswordRequest");
    expect(source).toContain("export async function getUserProfile()");
    expect(source).toContain("api.api.profile.get()");
    expect(source).toContain("export async function updateUserProfile");
    expect(source).toContain("api.api.profile.put(input)");
    expect(source).toContain("export async function changePassword");
    expect(source).toContain("api.api.profile.password.put(input)");
  });
});

describe("permission api client", () => {
  it("exposes typed client functions for permission catalog and managed-user grant updates", async () => {
    const source = await Bun.file(apiSourcePath).text();

    expect(source).toContain("PermissionCatalogEntry");
    expect(source).toContain("AdminUpdateUserPermissionsRequest");
    expect(source).toContain("export async function getPermissionCatalog");
    expect(source).toContain("api.api.permissions.catalog.get()");
    expect(source).toContain("PERMISSION_CATALOG_BY_PERMISSION");
    expect(source).toContain("export async function updateManagedUserPermissions");
    expect(source).toContain(
      "api.api.users({ publicUserId: userId }).settings.permissions.put(input)",
    );
  });
});

describe("users api client", () => {
  it("uses typed managed-user endpoints with public user ids", async () => {
    const source = await Bun.file(apiSourcePath).text();

    expect(source).toContain("normalizeManagedUserSummary");
    expect(source).toContain("normalizeManagedUserProfile");
    expect(source).toContain("export async function listUsers");
    expect(source).toContain("api.api.users.get()");
    expect(source).toContain("export async function getManagedUserProfile");
    expect(source).toContain("api.api.users({ publicUserId: userId }).get()");
    expect(source).toContain("export async function updateManagedUserProfile");
    expect(source).toContain("api.api.users({ publicUserId: userId }).settings.main.put(input)");
    expect(source).toContain("export async function changeManagedUserPassword");
    expect(source).toContain(
      "api.api.users({ publicUserId: userId }).settings.password.put(input)",
    );
    expect(source).toContain("export async function updateManagedUserStatus");
    expect(source).toContain("api.api.users({ publicUserId: userId }).status.patch(input)");
    expect(source).toContain("CreateLocalUserRequest");
    expect(source).not.toContain("api.api.admin");
  });
});
