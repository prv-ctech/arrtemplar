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
    expect(source).toContain("api.api.user.profile.get()");
    expect(source).toContain("export async function updateUserProfile");
    expect(source).toContain("api.api.user.profile.put(input)");
    expect(source).toContain("export async function changePassword");
    expect(source).toContain("api.api.user.password.put(input)");
  });
});
