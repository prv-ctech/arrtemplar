import { describe, expect, it } from "bun:test";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createApiRequestHeaders,
  normalizeApiKeyListResponse,
  normalizeNotificationHistoryListResponse,
} from "../../../../../apps/web/src/lib/api";
import {
  CSRF_HEADER_NAME,
  CSRF_HEADER_VALUE,
  isServiceIntegrationKind,
} from "../../../../../packages/shared/src";

const workspaceRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../../../../");
const apiSourcePaths = {
  apiKeys: `${workspaceRoot}/apps/web/src/lib/api/api-keys.ts`,
  auth: `${workspaceRoot}/apps/web/src/lib/api/auth.ts`,
  client: `${workspaceRoot}/apps/web/src/lib/api/client.ts`,
  normalizers: `${workspaceRoot}/apps/web/src/lib/api/normalizers.ts`,
  profile: `${workspaceRoot}/apps/web/src/lib/api/profile.ts`,
  servicesSettings: `${workspaceRoot}/apps/web/src/features/services-settings/ServicesSettings.tsx`,
  serviceIntegrations: `${workspaceRoot}/apps/web/src/lib/api/service-integrations.ts`,
  users: `${workspaceRoot}/apps/web/src/lib/api/users.ts`,
};

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
    const authSource = await Bun.file(apiSourcePaths.auth).text();
    const clientSource = await Bun.file(apiSourcePaths.client).text();

    expect(clientSource).toContain("export type LogoutResult");
    expect(authSource).toContain('fetch(resolveApiRequestUrl("/api/auth/logout")');
    expect(authSource).toContain("redirectUri");
    expect(authSource).not.toContain('response.headers.get("content-type")');
    expect(authSource).not.toContain('contentType.includes("text/html")');
    expect(authSource).not.toContain("html: await response.text()");
    expect(authSource).not.toContain("unwrapData(await api.api.auth.logout.post()");
  });
});

describe("user profile api client", () => {
  it("exposes typed client functions for profile and password endpoints", async () => {
    const source = await Bun.file(apiSourcePaths.profile).text();

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
    const source = await Bun.file(apiSourcePaths.normalizers).text();

    expect(source).toContain("NotificationPreferences");
    expect(source).toContain("DEFAULT_NOTIFICATION_PREFERENCES");
    expect(source).toContain("normalizeNotificationPreferences");
    expect(source).toContain(
      "notificationPreferences: normalizeNotificationPreferences(user.notificationPreferences)",
    );
  });

  it("exposes typed notification history helpers and validates response taxonomy", async () => {
    const normalizersSource = await Bun.file(apiSourcePaths.normalizers).text();
    const profileSource = await Bun.file(apiSourcePaths.profile).text();

    expect(profileSource).toContain("NotificationHistoryListResponse");
    expect(profileSource).toContain("CreateNotificationHistoryRequest");
    expect(profileSource).toContain("MarkNotificationReadRequest");
    expect(profileSource).toContain("export async function listNotificationHistory");
    expect(profileSource).toContain("api.api.profile.notifications.history.get");
    expect(profileSource).toContain("export async function createNotificationHistory");
    expect(profileSource).toContain("api.api.profile.notifications.history.post(input)");
    expect(profileSource).toContain("export async function markNotificationRead");
    expect(profileSource).toContain(
      "api.api.profile.notifications.history({ notificationId }).patch",
    );
    expect(profileSource).toContain("export async function clearNotificationHistory");
    expect(profileSource).toContain("api.api.profile.notifications.history.delete");
    expect(profileSource).toContain("normalizeNotificationHistoryListResponse");
    expect(normalizersSource).toContain("isToastNotificationId");
    expect(normalizersSource).toContain("isToastNotificationSeverity");
    expect(normalizersSource).toContain("isToastNotificationImportance");
    expect(normalizersSource).toContain("value instanceof Date");
    expect(normalizersSource).toContain("isoDateTimePattern");
    expect(normalizersSource).toContain("toISOString()");
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
    const source = await Bun.file(apiSourcePaths.users).text();

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
    const apiKeysSource = await Bun.file(apiSourcePaths.apiKeys).text();
    const normalizersSource = await Bun.file(apiSourcePaths.normalizers).text();

    expect(apiKeysSource).toContain("ApiKeySummary");
    expect(apiKeysSource).toContain("CreateApiKeyRequest");
    expect(apiKeysSource).toContain("export async function listApiKeys");
    expect(apiKeysSource).toContain('path: "/api/api-keys"');
    expect(apiKeysSource).toContain("export async function createApiKey");
    expect(apiKeysSource).toContain("export async function rotateApiKey");
    expect(apiKeysSource).toContain("export async function deleteApiKey");
    expect(apiKeysSource).toContain("normalizeApiKeyListResponse");
    expect(apiKeysSource).toContain("normalizeApiKeyReveal");
    expect(normalizersSource).toContain("API_KEY_STATUS_VALUES");
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

describe("service integration api client", () => {
  it("exposes typed client functions and response normalizers for settings/services", async () => {
    const normalizersSource = await Bun.file(apiSourcePaths.normalizers).text();
    const serviceIntegrationsSource = await Bun.file(apiSourcePaths.serviceIntegrations).text();

    expect(serviceIntegrationsSource).toContain("ServiceIntegrationKind");
    expect(serviceIntegrationsSource).toContain("UpsertServiceIntegrationRequest");
    expect(serviceIntegrationsSource).toContain(
      "export async function listServiceIntegrationConfigs",
    );
    expect(serviceIntegrationsSource).toContain('path: "/api/settings/services"');
    expect(serviceIntegrationsSource).toContain(
      "export async function upsertServiceIntegrationConfig",
    );
    expect(serviceIntegrationsSource).toContain(
      "export async function createServiceIntegrationConfig",
    );
    expect(serviceIntegrationsSource).toContain(
      "export async function updateServiceIntegrationConfig",
    );
    expect(serviceIntegrationsSource).toContain(
      "export async function deleteServiceIntegrationConfigById",
    );
    expect(serviceIntegrationsSource).toContain(
      "export async function testServiceIntegrationConfig",
    );
    expect(serviceIntegrationsSource).toContain(
      "export async function testServiceIntegrationConfigById",
    );
    expect(serviceIntegrationsSource).toContain(
      "export async function getServiceIntegrationStatus",
    );
    expect(serviceIntegrationsSource).toContain(
      "export async function getServiceIntegrationStatusById",
    );
    expect(serviceIntegrationsSource).toContain("normalizeServiceIntegrationListResponse");
    expect(serviceIntegrationsSource).toContain("normalizeServiceIntegrationProbeResponse");
    expect(normalizersSource).toContain("isServiceIntegrationKind");
    expect(normalizersSource).toContain("isServiceIntegrationAuthMode");
    expect(normalizersSource).toContain("isServiceIntegrationProbeOutcome");
  });

  it("accepts Jackett, NZBHydra2, Plex, and Jellyfin service kinds", () => {
    expect(isServiceIntegrationKind("jackett")).toBe(true);
    expect(isServiceIntegrationKind("nzbhydra2")).toBe(true);
    expect(isServiceIntegrationKind("plex")).toBe(true);
    expect(isServiceIntegrationKind("jellyfin")).toBe(true);
  });

  it("renders Plex and Jellyfin services with API-key-only cards", async () => {
    const servicesSettingsSource = await Bun.file(apiSourcePaths.servicesSettings).text();
    const serviceIntegrationsSource = await Bun.file(apiSourcePaths.serviceIntegrations).text();

    expect(servicesSettingsSource).toContain(
      [
        "  {",
        '    kind: "plex",',
        '    title: "Plex",',
        '    logoPath: "/services/plex.svg",',
        '    authModeOptions: [{ label: "Token", value: "api_key" }],',
        "  },",
      ].join("\n"),
    );
    expect(servicesSettingsSource).toContain(
      [
        "  {",
        '    kind: "jellyfin",',
        '    title: "Jellyfin",',
        '    logoPath: "/services/jellyfin.svg",',
        '    authModeOptions: [{ label: "API key", value: "api_key" }],',
        "  },",
      ].join("\n"),
    );
    expect(serviceIntegrationsSource).not.toContain("apiKeyEncrypted");
    expect(serviceIntegrationsSource).not.toContain("passwordEncrypted");
  });
});

function createApiKeyListResponse(overrides: Record<string, unknown> = {}) {
  return {
    apiKeys: [
      {
        id: "api-key-test",
        name: "Test key",
        description: null,
        keyPrefix: "abc12345",
        fingerprint: "0123456789ab",
        maskedKey: "abc12345••••wxyz",
        status: "active",
        lastUsedAt: null,
        lastUsedIpAddress: null,
        lastUsedUserAgent: null,
        createdBy: { id: "Abc123xyz", username: "admin" },
        createdAt: "2026-06-23T12:00:00.000Z",
        updatedAt: "2026-06-23T12:01:00.000Z",
        rotatedAt: null,
        deletedAt: null,
        ...overrides,
      },
    ],
  };
}

describe("users api client", () => {
  it("uses typed managed-user endpoints with public user ids", async () => {
    const normalizersSource = await Bun.file(apiSourcePaths.normalizers).text();
    const usersSource = await Bun.file(apiSourcePaths.users).text();

    expect(normalizersSource).toContain("normalizeManagedUserSummary");
    expect(normalizersSource).toContain("normalizeManagedUserProfile");
    expect(usersSource).toContain("export async function listUsers");
    expect(usersSource).toContain("api.api.users.get()");
    expect(usersSource).toContain("export async function getManagedUserProfile");
    expect(usersSource).toContain("api.api.users({ publicUserId: userId }).get()");
    expect(usersSource).toContain("export async function updateManagedUserProfile");
    expect(usersSource).toContain(
      "api.api.users({ publicUserId: userId }).settings.main.put(input)",
    );
    expect(usersSource).toContain("export async function changeManagedUserPassword");
    expect(usersSource).toContain(
      "api.api.users({ publicUserId: userId }).settings.password.put(input)",
    );
    expect(usersSource).toContain("export async function updateManagedUserStatus");
    expect(usersSource).toContain("api.api.users({ publicUserId: userId }).status.patch(input)");
    expect(usersSource).toContain("CreateLocalUserRequest");
    expect(usersSource).not.toContain("api.api.admin");
  });
});
