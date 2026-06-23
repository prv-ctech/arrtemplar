import { describe, expect, it } from "bun:test";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createApiRequestHeaders,
  normalizeApiKeyListResponse,
  normalizeNotificationHistoryListResponse,
} from "../../../../../apps/web/src/lib/api";
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

  it("handles logout as JSON with optional OAuth redirect URI", async () => {
    const source = await Bun.file(apiSourcePath).text();

    expect(source).toContain("export type LogoutResult");
    expect(source).toContain('fetch(resolveApiRequestUrl("/api/auth/logout")');
    expect(source).toContain("redirectUri");
    expect(source).not.toContain('response.headers.get("content-type")');
    expect(source).not.toContain('contentType.includes("text/html")');
    expect(source).not.toContain("html: await response.text()");
    expect(source).not.toContain("unwrapData(await api.api.auth.logout.post()");
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

  it("normalizes notification preferences on public user payloads", async () => {
    const source = await Bun.file(apiSourcePath).text();

    expect(source).toContain("NotificationPreferences");
    expect(source).toContain("DEFAULT_NOTIFICATION_PREFERENCES");
    expect(source).toContain("normalizeNotificationPreferences");
    expect(source).toContain(
      "notificationPreferences: normalizeNotificationPreferences(user.notificationPreferences)",
    );
  });

  it("exposes typed notification history helpers and validates response taxonomy", async () => {
    const source = await Bun.file(apiSourcePath).text();

    expect(source).toContain("NotificationHistoryListResponse");
    expect(source).toContain("CreateNotificationHistoryRequest");
    expect(source).toContain("MarkNotificationReadRequest");
    expect(source).toContain("export async function listNotificationHistory");
    expect(source).toContain("api.api.profile.notifications.history.get");
    expect(source).toContain("export async function createNotificationHistory");
    expect(source).toContain("api.api.profile.notifications.history.post(input)");
    expect(source).toContain("export async function markNotificationRead");
    expect(source).toContain("api.api.profile.notifications.history({ notificationId }).patch");
    expect(source).toContain("export async function clearNotificationHistory");
    expect(source).toContain("api.api.profile.notifications.history.delete");
    expect(source).toContain("normalizeNotificationHistoryListResponse");
    expect(source).toContain("isToastNotificationId");
    expect(source).toContain("isToastNotificationSeverity");
    expect(source).toContain("isToastNotificationImportance");
    expect(source).toContain("value instanceof Date");
    expect(source).toContain("isoDateTimePattern");
    expect(source).toContain("toISOString()");
  });

  it("rejects malformed notification history timestamps", () => {
    expect(() =>
      normalizeNotificationHistoryListResponse(
        createNotificationHistoryResponse({ createdAt: "2026-06-19", readAt: null }),
      ),
    ).toThrow("Notification history response was invalid.");
  });

  it("accepts valid notification history Date payloads", () => {
    const createdAt = "2026-06-19T12:00:00.000Z";
    const readAt = "2026-06-19T12:01:00.000Z";
    const response = normalizeNotificationHistoryListResponse(
      createNotificationHistoryResponse({
        createdAt: new Date(createdAt),
        readAt: new Date(readAt),
      }),
    );

    expect(response.notifications[0]?.createdAt).toBe(createdAt);
    expect(response.notifications[0]?.readAt).toBe(readAt);
  });
});

function createNotificationHistoryResponse({
  createdAt,
  readAt,
}: {
  createdAt: unknown;
  readAt: unknown;
}) {
  return {
    notifications: [
      {
        id: "notification-history-date-test",
        eventId: "profile.identity.updated",
        title: "Profile updated.",
        description: null,
        severity: "success",
        importance: "standard",
        readAt,
        createdAt,
      },
    ],
    unreadCount: readAt ? 0 : 1,
    pagination: { page: 1, pageSize: 25, totalItems: 1, totalPages: 1 },
  };
}

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

describe("api key api client", () => {
  it("exposes typed client functions and response normalizers", async () => {
    const source = await Bun.file(apiSourcePath).text();

    expect(source).toContain("ApiKeySummary");
    expect(source).toContain("CreateApiKeyRequest");
    expect(source).toContain("UpdateApiKeyRequest");
    expect(source).toContain("export async function listApiKeys");
    expect(source).toContain('path: "/api/api-keys"');
    expect(source).toContain("export async function createApiKey");
    expect(source).toContain("export async function updateApiKey");
    expect(source).toContain("export async function revokeApiKey");
    expect(source).toContain("export async function deleteApiKey");
    expect(source).toContain("normalizeApiKeyListResponse");
    expect(source).toContain("normalizeApiKeyReveal");
    expect(source).toContain("API_KEY_STATUS_VALUES");
  });

  it("rejects malformed API key statuses", () => {
    expect(() =>
      normalizeApiKeyListResponse(createApiKeyListResponse({ status: "pending" })),
    ).toThrow("API key response was invalid.");
  });

  it("accepts valid API key Date payloads", () => {
    const createdAt = "2026-06-23T12:00:00.000Z";
    const updatedAt = "2026-06-23T12:01:00.000Z";
    const lastUsedAt = "2026-06-23T12:02:00.000Z";
    const response = normalizeApiKeyListResponse(
      createApiKeyListResponse({
        createdAt: new Date(createdAt),
        lastUsedAt: new Date(lastUsedAt),
        updatedAt: new Date(updatedAt),
      }),
    );

    expect(response.apiKeys[0]?.createdAt).toBe(createdAt);
    expect(response.apiKeys[0]?.updatedAt).toBe(updatedAt);
    expect(response.apiKeys[0]?.lastUsedAt).toBe(lastUsedAt);
  });
});

function createApiKeyListResponse(overrides: Record<string, unknown> = {}) {
  return {
    apiKeys: [
      {
        id: "api-key-test",
        name: "Test key",
        description: null,
        prefix: "artk_abc12345",
        maskedKey: "artk_abc12345••••wxyz",
        status: "active",
        permissions: ["settings:services"],
        permissionCount: 1,
        expiresAt: null,
        ipAllowlist: [],
        lastUsedAt: null,
        lastUsedIpAddress: null,
        lastUsedUserAgent: null,
        createdBy: { id: "Abc123xyz", username: "admin" },
        createdAt: "2026-06-23T12:00:00.000Z",
        updatedAt: "2026-06-23T12:01:00.000Z",
        revokedAt: null,
        ...overrides,
      },
    ],
  };
}

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
