import { afterEach, describe, expect, it } from "bun:test";
import { hashPassword } from "../../../../../apps/server/src/auth/password";
import { generatePublicUserId } from "../../../../../apps/server/src/auth/public-user-id";
import { LoginRateLimiter } from "../../../../../apps/server/src/auth/rate-limit";
import { createRequestContext } from "../../../../../apps/server/src/auth/routes";
import {
  createSessionExpiresAt,
  generateSessionToken,
  hashSessionToken,
  SESSION_COOKIE_NAME,
} from "../../../../../apps/server/src/auth/session-token";
import type { DatabaseClient } from "../../../../../apps/server/src/db/client";
import {
  auditLogs,
  authProviders,
  notificationHistory,
  sessions,
  userPermissionGrants,
  users,
} from "../../../../../apps/server/src/db/schema";
import { encryptOAuthIdToken } from "../../../../../apps/server/src/security/oauth-crypto";
import {
  createLogoutStateCookieValue,
  createOAuthStateCookieValue,
  OAUTH_LOGOUT_STATE_COOKIE_NAME,
  OAUTH_STATE_COOKIE_NAME,
} from "../../../../../apps/server/src/security/oauth-state";
import {
  CSRF_HEADER_NAME,
  CSRF_HEADER_VALUE,
  DEFAULT_NOTIFICATION_PREFERENCES,
  DEFAULT_PROFILE_AVATAR_ID,
  DEFAULT_PROFILE_BANNER_ID,
  DEFAULT_SIGNED_IN_USER_PERMISSIONS,
  PROFILE_AVATAR_IDS,
  PROFILE_BANNER_IDS,
  SYSTEM_ADMIN_PERMISSION,
  TOAST_NOTIFICATION_EVENTS,
  USER_PERMISSION_VALUES,
  type UserPermission,
} from "../../../../../packages/shared/src";
import { readFormAction } from "../../../../helpers/html";
import {
  closeServerTestDatabases,
  createServerTestApp,
  csrfJsonRequest,
  TEST_WEB_ORIGIN,
  type TestAppContext,
} from "../../../../helpers/server";

const DEFAULT_PASSWORD = "correct-horse-battery-staple";
const OAUTH_TEST_ENCRYPTION_KEY =
  "hex:000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f";
const openDatabases: DatabaseClient[] = [];

afterEach(() => {
  closeServerTestDatabases(openDatabases);
});

describe("auth routes", () => {
  it("reports setup required before the first user exists", async () => {
    const { app } = await createEmptyAuthTestApp();

    const response = await app.handle(new Request("http://localhost/api/auth/setup"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ required: true });
  });

  it("creates the first account with an explicit system:admin grant and full effective permissions", async () => {
    const { app, database } = await createEmptyAuthTestApp();

    const response = await app.handle(
      csrfJsonRequest("/api/auth/setup", {
        username: "owner",
        email: "owner@example.local",
        password: DEFAULT_PASSWORD,
      }),
    );
    const body = await response.json();
    const setCookie = response.headers.get("set-cookie") ?? "";
    const cookieHeader = toCookieHeader(setCookie);
    const sessionToken = readCookieValue(cookieHeader);

    expect(response.status).toBe(200);
    expect(body).toEqual({
      user: {
        id: expect.any(String),
        username: "owner",
        email: "owner@example.local",
        avatarId: DEFAULT_PROFILE_AVATAR_ID,
        bannerId: DEFAULT_PROFILE_BANNER_ID,
        notificationPreferences: DEFAULT_NOTIFICATION_PREFERENCES,
        permissions: [...USER_PERMISSION_VALUES],
        createdAt: expect.any(String),
        lastLoginAt: null,
      },
    });
    expect(JSON.stringify(body)).not.toContain("passwordHash");
    expectSecureSessionCookie(setCookie);

    const [storedUser] = database.db.select().from(users).all();
    const storedGrants = database.db.select().from(userPermissionGrants).all();
    const [storedSession] = database.db.select().from(sessions).all();

    expect(storedUser?.publicId).toBe(body.user.id);
    expect(storedGrants).toHaveLength(1);
    expect(storedGrants[0]?.userId).toBe(storedUser?.id);
    expect(storedGrants[0]?.permission).toBe(SYSTEM_ADMIN_PERMISSION);
    expect(storedSession?.tokenHash).toBe(hashSessionToken(sessionToken));
    expect("role" in (storedUser ?? {})).toBe(false);

    const usersResponse = await app.handle(
      new Request("http://localhost/api/users", { headers: { cookie: cookieHeader } }),
    );

    expect(usersResponse.status).toBe(200);
  });

  it("blocks setup after any user exists", async () => {
    const { app, database } = await createAuthTestApp();

    const statusResponse = await app.handle(new Request("http://localhost/api/auth/setup"));
    const statusBody = await statusResponse.json();
    const createResponse = await app.handle(
      csrfJsonRequest("/api/auth/setup", {
        username: "second-admin",
        email: "second-admin@example.local",
        password: DEFAULT_PASSWORD,
      }),
    );
    const createBody = await createResponse.json();

    expect(statusResponse.status).toBe(200);
    expect(statusBody).toEqual({ required: false });
    expect(createResponse.status).toBe(409);
    expect(createBody).toEqual({
      error: {
        code: "SETUP_ALREADY_COMPLETE",
        message: "Admin setup is already complete.",
      },
    });
    expect(database.db.select().from(users).all()).toHaveLength(2);
  });

  it("returns default self-service permissions for signed-in users without explicit grants", async () => {
    const { app } = await createAuthTestApp();
    const viewerCookie = await loginAndReadCookie(app, "viewer@example.local");

    const response = await app.handle(
      new Request("http://localhost/api/auth/me", { headers: { cookie: viewerCookie } }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      user: {
        id: expect.any(String),
        username: "viewer",
        email: "viewer@example.local",
        avatarId: DEFAULT_PROFILE_AVATAR_ID,
        bannerId: DEFAULT_PROFILE_BANNER_ID,
        notificationPreferences: DEFAULT_NOTIFICATION_PREFERENCES,
        permissions: [...DEFAULT_SIGNED_IN_USER_PERMISSIONS],
        createdAt: expect.any(String),
        lastLoginAt: expect.any(String),
      },
    });
    expect("role" in body.user).toBe(false);
  });

  it("gates the users directory behind users:manage and returns safe summaries", async () => {
    const { app, database, viewer } = await createAuthTestApp([
      {
        username: "manager",
        email: "manager@example.local",
        password: DEFAULT_PASSWORD,
        permissions: ["users:manage"],
      },
    ]);
    const manager = requireStoredUserByEmail(database, "manager@example.local");

    const anonymousResponse = await app.handle(new Request("http://localhost/api/users"));
    const viewerCookie = await loginAndReadCookie(app, "viewer@example.local");
    const viewerResponse = await app.handle(
      new Request("http://localhost/api/users", { headers: { cookie: viewerCookie } }),
    );
    const managerCookie = await loginAndReadCookie(app, "manager@example.local");
    const managerResponse = await app.handle(
      new Request("http://localhost/api/users", { headers: { cookie: managerCookie } }),
    );
    const managerBody = await managerResponse.json();

    expect(anonymousResponse.status).toBe(401);
    expect(viewerResponse.status).toBe(403);
    expect(managerResponse.status).toBe(200);
    const listedIds = managerBody.users.map((user: { id: string }) => user.id);
    expect(listedIds).toContain(manager.publicId);
    expect(listedIds).toContain(viewer.publicId);
    expect(listedIds).toHaveLength(3);
    for (const listedUser of managerBody.users) {
      expect("email" in listedUser).toBe(false);
      expect("lastLoginAt" in listedUser).toBe(false);
      expect("notificationPreferences" in listedUser).toBe(false);
      expect("role" in listedUser).toBe(false);
      expect("passwordHash" in listedUser).toBe(false);
    }
  });

  it("requires users:create in addition to users:manage when creating users", async () => {
    const { app } = await createAuthTestApp([
      {
        username: "manager",
        email: "manager@example.local",
        password: DEFAULT_PASSWORD,
        permissions: ["users:manage"],
      },
    ]);

    const managerCookie = await loginAndReadCookie(app, "manager@example.local");
    const managerResponse = await app.handle(
      csrfJsonRequest(
        "/api/users",
        {
          username: "blocked-user",
          email: "blocked-user@example.local",
          password: DEFAULT_PASSWORD,
        },
        { cookie: managerCookie },
      ),
    );
    const managerBody = await managerResponse.json();

    expect(managerResponse.status).toBe(403);
    expect(managerBody).toEqual({
      error: {
        code: "FORBIDDEN",
        message: "users:create permission is required.",
      },
    });

    const adminCookie = await loginAndReadCookie(app, "admin@example.local");
    const adminResponse = await app.handle(
      csrfJsonRequest(
        "/api/users",
        {
          username: "watcher",
          email: "watcher@example.local",
          password: DEFAULT_PASSWORD,
        },
        { cookie: adminCookie },
      ),
    );
    const adminBody = await adminResponse.json();

    expect(adminResponse.status).toBe(200);
    expect(adminBody).toEqual({
      user: {
        id: expect.any(String),
        username: "watcher",
        disabledAt: null,
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
        permissions: [...DEFAULT_SIGNED_IN_USER_PERMISSIONS],
      },
    });
    expect("email" in adminBody.user).toBe(false);
    expect("role" in adminBody.user).toBe(false);
  });

  it("enforces cross-user read access and supports managed profile updates", async () => {
    const { app, admin, viewer } = await createAuthTestApp([
      {
        username: "manager",
        email: "manager@example.local",
        password: DEFAULT_PASSWORD,
        permissions: ["users:manage", "users:update"],
      },
    ]);

    const viewerCookie = await loginAndReadCookie(app, "viewer@example.local");
    const deniedResponse = await app.handle(
      new Request(`http://localhost/api/users/${admin.publicId}`, {
        headers: { cookie: viewerCookie },
      }),
    );

    expect(deniedResponse.status).toBe(403);

    const managerCookie = await loginAndReadCookie(app, "manager@example.local");
    const profileResponse = await app.handle(
      new Request(`http://localhost/api/users/${viewer.publicId}`, {
        headers: { cookie: managerCookie },
      }),
    );
    const profileBody = await profileResponse.json();

    expect(profileResponse.status).toBe(200);
    expect(profileBody.user).toMatchObject({
      id: viewer.publicId,
      username: "viewer",
      email: "viewer@example.local",
      permissions: [...DEFAULT_SIGNED_IN_USER_PERMISSIONS],
    });
    expect("notificationPreferences" in profileBody.user).toBe(false);

    const updateResponse = await app.handle(
      csrfJsonPutRequest(
        `/api/users/${viewer.publicId}/settings/main`,
        { username: "reader", email: "reader@example.local" },
        { cookie: managerCookie },
      ),
    );
    const updateBody = await updateResponse.json();

    expect(updateResponse.status).toBe(200);
    expect(updateBody.user).toMatchObject({
      id: viewer.publicId,
      username: "reader",
      email: "reader@example.local",
    });

    const duplicateResponse = await app.handle(
      csrfJsonPutRequest(
        `/api/users/${viewer.publicId}/settings/main`,
        { username: "admin", email: "admin@example.local" },
        { cookie: managerCookie },
      ),
    );

    expect(duplicateResponse.status).toBe(409);
  });

  it("returns the permission catalog and revokes sessions after permission changes", async () => {
    const { app, viewer, viewerCookie } = await createAuthTestApp([
      {
        username: "manager",
        email: "manager@example.local",
        password: DEFAULT_PASSWORD,
        permissions: ["users:manage"],
      },
    ]);

    const managerCookie = await loginAndReadCookie(app, "manager@example.local");
    const managerCatalogResponse = await app.handle(
      new Request("http://localhost/api/permissions/catalog", {
        headers: { cookie: managerCookie },
      }),
    );
    const managerCatalogBody = await managerCatalogResponse.json();

    expect(managerCatalogResponse.status).toBe(200);
    expect(
      managerCatalogBody.permissions.map((entry: { permission: string }) => entry.permission),
    ).toEqual([...USER_PERMISSION_VALUES]);

    const deniedPermissionsResponse = await app.handle(
      csrfJsonPutRequest(
        `/api/users/${viewer.publicId}/settings/permissions`,
        { permissions: ["settings:services"] },
        { cookie: managerCookie },
      ),
    );
    const deniedPermissionsBody = await deniedPermissionsResponse.json();

    expect(deniedPermissionsResponse.status).toBe(403);
    expect(deniedPermissionsBody).toEqual({
      error: {
        code: "FORBIDDEN",
        message: "users:permissions permission is required.",
      },
    });

    const adminCookie = await loginAndReadCookie(app, "admin@example.local");
    const invalidPermissionsResponse = await app.handle(
      csrfJsonPutRequest(
        `/api/users/${viewer.publicId}/settings/permissions`,
        { permissions: ["settings:services", "settings:unknown"] },
        { cookie: adminCookie },
      ),
    );

    expect(invalidPermissionsResponse.status).toBe(422);

    const grantResponse = await app.handle(
      csrfJsonPutRequest(
        `/api/users/${viewer.publicId}/settings/permissions`,
        { permissions: ["settings:services"] },
        { cookie: adminCookie },
      ),
    );
    const grantBody = await grantResponse.json();

    expect(grantResponse.status).toBe(200);
    expect(grantBody.user.permissions).toEqual([
      ...DEFAULT_SIGNED_IN_USER_PERMISSIONS.slice(0, 4),
      "settings:services",
      ...DEFAULT_SIGNED_IN_USER_PERMISSIONS.slice(4),
    ]);
    await expectSessionRejected(app, viewerCookie);

    const reloginCookie = await loginAndReadCookie(app, "viewer@example.local");
    const meResponse = await app.handle(
      new Request("http://localhost/api/auth/me", { headers: { cookie: reloginCookie } }),
    );
    const meBody = await meResponse.json();

    expect(meResponse.status).toBe(200);
    expect(meBody.user.permissions).toEqual([
      ...DEFAULT_SIGNED_IN_USER_PERMISSIONS.slice(0, 4),
      "settings:services",
      ...DEFAULT_SIGNED_IN_USER_PERMISSIONS.slice(4),
    ]);
  });

  it("requires users:password for cross-user password changes and revokes target sessions", async () => {
    const { app, viewerCookie, viewer } = await createAuthTestApp([
      {
        username: "operator",
        email: "operator@example.local",
        password: DEFAULT_PASSWORD,
        permissions: ["users:manage", "users:password"],
      },
    ]);

    const operatorCookie = await loginAndReadCookie(app, "operator@example.local");
    const newPassword = "updated-correct-horse-battery-staple";

    const response = await app.handle(
      csrfJsonPutRequest(
        `/api/users/${viewer.publicId}/settings/password`,
        { password: newPassword },
        { cookie: operatorCookie },
      ),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ status: "ok" });
    await expectSessionRejected(app, viewerCookie);
    await expectPasswordReplaced(app, "viewer@example.local", newPassword);
  });

  it("protects the last active system admin from disable operations", async () => {
    const { app, admin } = await createAuthTestApp([
      {
        username: "operator",
        email: "operator@example.local",
        password: DEFAULT_PASSWORD,
        permissions: ["users:manage", "users:disable"],
      },
    ]);

    const operatorCookie = await loginAndReadCookie(app, "operator@example.local");
    const response = await app.handle(
      csrfJsonPatchRequest(
        `/api/users/${admin.publicId}/status`,
        { disabled: true },
        { cookie: operatorCookie },
      ),
    );
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body).toEqual({
      error: {
        code: "LAST_SYSTEM_ADMIN_REQUIRED",
        message: "At least one active user must keep the system:admin permission.",
      },
    });
  });

  it("prevents administrators from disabling their own account through managed status", async () => {
    const { app, admin } = await createAuthTestApp();
    const adminCookie = await loginAndReadCookie(app, "admin@example.local");
    const response = await app.handle(
      csrfJsonPatchRequest(
        `/api/users/${admin.publicId}/status`,
        { disabled: true },
        { cookie: adminCookie },
      ),
    );
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body).toEqual({
      error: {
        code: "SELF_SERVICE_ONLY",
        message: "Use the self-service profile endpoints for your own account.",
      },
    });
  });

  it("disables and restores managed users when the actor has users:disable", async () => {
    const { app, viewer, viewerCookie } = await createAuthTestApp();
    const adminCookie = await loginAndReadCookie(app, "admin@example.local");

    const disableResponse = await app.handle(
      csrfJsonPatchRequest(
        `/api/users/${viewer.publicId}/status`,
        { disabled: true },
        { cookie: adminCookie },
      ),
    );
    const disableBody = await disableResponse.json();

    expect(disableResponse.status).toBe(200);
    expect(disableBody.user.disabledAt).toEqual(expect.any(String));
    await expectSessionRejected(app, viewerCookie);

    const disabledLoginResponse = await loginWithPassword(
      app,
      "viewer@example.local",
      DEFAULT_PASSWORD,
    );

    expect(disabledLoginResponse.status).toBe(401);

    const enableResponse = await app.handle(
      csrfJsonPatchRequest(
        `/api/users/${viewer.publicId}/status`,
        { disabled: false },
        { cookie: adminCookie },
      ),
    );
    const enableBody = await enableResponse.json();

    expect(enableResponse.status).toBe(200);
    expect(enableBody.user.disabledAt).toBeNull();

    const enabledLoginResponse = await loginWithPassword(
      app,
      "viewer@example.local",
      DEFAULT_PASSWORD,
    );

    expect(enabledLoginResponse.status).toBe(200);
  });

  it("does not let spoofed forwarded IPs reset login throttling for an account", async () => {
    const { app } = await createAuthTestApp([], new LoginRateLimiter(1));

    const firstFailure = await app.handle(
      csrfJsonRequest(
        "/api/auth/login",
        { email: "admin@example.local", password: "wrong-password" },
        { "x-forwarded-for": "198.51.100.10" },
      ),
    );
    const spoofedIpFailure = await app.handle(
      csrfJsonRequest(
        "/api/auth/login",
        { email: "admin@example.local", password: "wrong-password" },
        { "x-forwarded-for": "203.0.113.10" },
      ),
    );
    const body = await spoofedIpFailure.json();

    expect(firstFailure.status).toBe(401);
    expect(spoofedIpFailure.status).toBe(429);
    expect(body).toEqual({
      error: {
        code: "RATE_LIMITED",
        message: "Too many failed login attempts. Try again later.",
      },
    });
  });

  it("derives auth request IP from direct server metadata only", () => {
    const request = new Request("http://localhost/api/auth/oauth/authentik/start", {
      headers: { "x-forwarded-for": "203.0.113.10", "user-agent": "auth-test" },
    });
    const context = createRequestContext(request, {
      requestIP: () => ({ address: "198.51.100.10" }),
    });
    const noServerContext = createRequestContext(request);

    expect(context).toEqual({ ipAddress: "198.51.100.10", userAgent: "auth-test" });
    expect(noServerContext).toEqual({ ipAddress: null, userAgent: "auth-test" });
  });

  it("rate-limits OAuth authorization starts without trusting spoofed forwarded IPs", async () => {
    const { app, database } = await createEmptyAuthTestApp(
      new LoginRateLimiter(1, 60_000),
      OAUTH_TEST_ENCRYPTION_KEY,
    );
    let startIssuer = "";
    const discoveryServer = Bun.serve({
      port: 0,
      fetch: () =>
        Response.json({
          issuer: startIssuer,
          authorization_endpoint: `${startIssuer}authorize/`,
          token_endpoint: `${startIssuer}token/`,
          jwks_uri: `${startIssuer}jwks/`,
          id_token_signing_alg_values_supported: ["RS256"],
        }),
    });

    startIssuer = new URL("/application/o/start-rate-limit/", discoveryServer.url).toString();
    insertAuthProvider(database, startIssuer);

    try {
      const firstResponse = await app.handle(
        new Request("http://localhost/api/auth/oauth/authentik/start", {
          headers: { "x-forwarded-for": "198.51.100.10" },
        }),
      );
      const blockedResponse = await app.handle(
        new Request("http://localhost/api/auth/oauth/authentik/start", {
          headers: { "x-forwarded-for": "198.51.100.10" },
        }),
      );
      const spoofedIpResponse = await app.handle(
        new Request("http://localhost/api/auth/oauth/authentik/start", {
          headers: { "x-forwarded-for": "198.51.100.11" },
        }),
      );

      expect(firstResponse.status).toBe(302);
      expect(blockedResponse.status).toBe(429);
      expect(await blockedResponse.json()).toEqual({
        error: {
          code: "RATE_LIMITED",
          message: "Too many OAuth requests. Try again later.",
        },
      });
      expect(spoofedIpResponse.status).toBe(429);
    } finally {
      discoveryServer.stop(true);
    }
  });

  it("partitions failed OAuth callbacks by signed state mode", async () => {
    const { app, database } = await createEmptyAuthTestApp(
      new LoginRateLimiter(1, 60_000),
      OAUTH_TEST_ENCRYPTION_KEY,
    );
    insertAuthProvider(database, "http://localhost/application/o/callback-mode-rate-limit/");
    const loginState = await createOAuthCallbackStateCookie("login", "login-state");
    const linkState = await createOAuthCallbackStateCookie("link", "link-state");

    const loginFailure = await app.handle(
      new Request(
        `http://localhost/api/auth/callback/authentik?code=login-code&state=${loginState.state}`,
        {
          headers: { cookie: loginState.cookie },
        },
      ),
    );
    const linkFailure = await app.handle(
      new Request(
        `http://localhost/api/auth/callback/authentik?code=link-code&state=${linkState.state}`,
        {
          headers: { cookie: linkState.cookie },
        },
      ),
    );
    const blockedLogin = await app.handle(
      new Request(
        `http://localhost/api/auth/callback/authentik?code=other-login-code&state=${loginState.state}`,
        {
          headers: { cookie: loginState.cookie },
        },
      ),
    );

    expect(loginFailure.status).not.toBe(429);
    expect(linkFailure.status).not.toBe(429);
    expect(blockedLogin.status).toBe(429);
  });

  it("rate-limits failed OAuth callbacks and audits without code or state values", async () => {
    const { app, database } = await createEmptyAuthTestApp(
      new LoginRateLimiter(1, 60_000),
      OAUTH_TEST_ENCRYPTION_KEY,
    );
    insertAuthProvider(database, "http://localhost/application/o/callback-rate-limit/");

    const firstResponse = await app.handle(
      new Request(
        "http://localhost/api/auth/callback/authentik?code=first-code&state=first-state",
        {
          headers: { "x-forwarded-for": "198.51.100.12" },
        },
      ),
    );
    const blockedResponse = await app.handle(
      new Request(
        "http://localhost/api/auth/callback/authentik?code=second-code&state=second-state",
        { headers: { "x-forwarded-for": "198.51.100.12" } },
      ),
    );
    const auditLog = database.db
      .select()
      .from(auditLogs)
      .all()
      .find((log) => log.action === "auth.oauth.route_rate_limited");

    expect(firstResponse.status).toBe(400);
    expect(blockedResponse.status).toBe(429);
    expect(auditLog?.metadataJson).toBe(
      JSON.stringify({
        provider: "authentik",
        route: "callback",
        mode: null,
      }),
    );
    expect(auditLog?.metadataJson).not.toContain("second-code");
    expect(auditLog?.metadataJson).not.toContain("second-state");
  });

  it("updates and protects the signed-in user's own profile surfaces", async () => {
    const { app, database } = await createAuthTestApp();
    const viewerCookie = await loginAndReadCookie(app, "viewer@example.local");

    const profileResponse = await app.handle(
      new Request("http://localhost/api/profile", { headers: { cookie: viewerCookie } }),
    );
    const profileBody = await profileResponse.json();

    expect(profileResponse.status).toBe(200);
    expect(profileBody.user).toMatchObject({
      username: "viewer",
      email: "viewer@example.local",
      permissions: [...DEFAULT_SIGNED_IN_USER_PERMISSIONS],
    });

    const updateResponse = await app.handle(
      csrfJsonPutRequest(
        "/api/profile",
        { username: "reader", email: "reader@example.local" },
        { cookie: viewerCookie },
      ),
    );
    const updateBody = await updateResponse.json();

    expect(updateResponse.status).toBe(200);
    expect(updateBody.user).toMatchObject({
      username: "reader",
      email: "reader@example.local",
    });
    expect(findStoredUserByPublicId(database, updateBody.user.id)?.email).toBe(
      "reader@example.local",
    );

    const wrongPasswordResponse = await app.handle(
      csrfJsonPutRequest(
        "/api/profile/password",
        { currentPassword: "wrong-password", newPassword: "new-secure-password" },
        { cookie: viewerCookie },
      ),
    );

    expect(wrongPasswordResponse.status).toBe(401);

    const passwordResponse = await app.handle(
      csrfJsonPutRequest(
        "/api/profile/password",
        { currentPassword: DEFAULT_PASSWORD, newPassword: "new-secure-password" },
        { cookie: viewerCookie },
      ),
    );
    const passwordBody = await passwordResponse.json();

    expect(passwordResponse.status).toBe(200);
    expect(passwordBody).toEqual({ status: "ok" });
    await expectPasswordReplaced(app, "reader@example.local", "new-secure-password");
  });

  it("returns and updates the signed-in user's notification preferences", async () => {
    const { app, database } = await createAuthTestApp();
    const viewerCookie = await loginAndReadCookie(app, "viewer@example.local");

    const defaultResponse = await app.handle(
      new Request("http://localhost/api/profile/notifications", {
        headers: { cookie: viewerCookie },
      }),
    );
    const defaultBody = await defaultResponse.json();

    expect(defaultResponse.status).toBe(200);
    expect(defaultBody).toEqual({ notificationPreferences: DEFAULT_NOTIFICATION_PREFERENCES });

    const updateResponse = await app.handle(
      csrfJsonPutRequest(
        "/api/profile/notifications",
        { toastsEnabled: false, frequency: "minimal" },
        { cookie: viewerCookie },
      ),
    );
    const updateBody = await updateResponse.json();

    expect(updateResponse.status).toBe(200);
    expect(updateBody).toEqual({
      notificationPreferences: { toastsEnabled: false, frequency: "minimal" },
    });
    expect(requireStoredUserByEmail(database, "viewer@example.local")).toMatchObject({
      toastNotificationsEnabled: false,
      toastNotificationFrequency: "minimal",
    });

    const meResponse = await app.handle(
      new Request("http://localhost/api/auth/me", { headers: { cookie: viewerCookie } }),
    );
    const meBody = await meResponse.json();

    expect(meResponse.status).toBe(200);
    expect(meBody.user.notificationPreferences).toEqual({
      toastsEnabled: false,
      frequency: "minimal",
    });

    const invalidResponse = await app.handle(
      csrfJsonPutRequest(
        "/api/profile/notifications",
        { toastsEnabled: true, frequency: "loud" },
        { cookie: viewerCookie },
      ),
    );
    const anonymousResponse = await app.handle(
      new Request("http://localhost/api/profile/notifications"),
    );

    expect(invalidResponse.status).toBe(422);
    expect(anonymousResponse.status).toBe(401);
  });

  it("lists, creates, marks read, and clears the signed-in user's notification history", async () => {
    const { app, database } = await createAuthTestApp();
    const viewerCookie = await loginAndReadCookie(app, "viewer@example.local");

    const emptyResponse = await app.handle(
      new Request("http://localhost/api/profile/notifications/history", {
        headers: { cookie: viewerCookie },
      }),
    );
    const emptyBody = await emptyResponse.json();

    expect(emptyResponse.status).toBe(200);
    expect(emptyBody).toEqual({
      notifications: [],
      unreadCount: 0,
      pagination: { page: 1, pageSize: 25, totalItems: 0, totalPages: 0 },
    });

    const createResponse = await app.handle(
      csrfJsonRequest(
        "/api/profile/notifications/history",
        {
          eventId: "profile.noop",
          title: "  Nothing changed.  ",
          description: "Already current.",
        },
        { cookie: viewerCookie },
      ),
    );
    const createBody = await createResponse.json();

    expect(createResponse.status).toBe(200);
    expect(createBody.notification).toMatchObject({
      eventId: "profile.noop",
      title: "Nothing changed.",
      description: "Already current.",
      severity: TOAST_NOTIFICATION_EVENTS["profile.noop"].severity,
      importance: TOAST_NOTIFICATION_EVENTS["profile.noop"].importance,
      readAt: null,
      createdAt: expect.any(String),
    });

    const [storedNotification] = database.db.select().from(notificationHistory).all();

    expect(storedNotification).toMatchObject({
      id: createBody.notification.id,
      eventId: "profile.noop",
      title: "Nothing changed.",
      readAt: null,
    });

    const listResponse = await app.handle(
      new Request("http://localhost/api/profile/notifications/history?page=1&pageSize=1", {
        headers: { cookie: viewerCookie },
      }),
    );
    const listBody = await listResponse.json();

    expect(listResponse.status).toBe(200);
    expect(listBody).toEqual({
      notifications: [createBody.notification],
      unreadCount: 1,
      pagination: { page: 1, pageSize: 1, totalItems: 1, totalPages: 1 },
    });

    const markReadResponse = await app.handle(
      csrfJsonPatchRequest(
        `/api/profile/notifications/history/${createBody.notification.id}`,
        { read: true },
        { cookie: viewerCookie },
      ),
    );
    const markReadBody = await markReadResponse.json();
    const firstReadAt = markReadBody.notification.readAt;

    expect(markReadResponse.status).toBe(200);
    expect(typeof firstReadAt).toBe("string");
    expect(markReadBody.notification).toMatchObject({
      id: createBody.notification.id,
      readAt: firstReadAt,
    });

    const secondMarkReadResponse = await app.handle(
      csrfJsonPatchRequest(
        `/api/profile/notifications/history/${createBody.notification.id}`,
        { read: true },
        { cookie: viewerCookie },
      ),
    );
    const secondMarkReadBody = await secondMarkReadResponse.json();

    expect(secondMarkReadResponse.status).toBe(200);
    expect(secondMarkReadBody.notification.readAt).toBe(firstReadAt);

    const clearResponse = await app.handle(
      csrfJsonDeleteRequest("/api/profile/notifications/history", { cookie: viewerCookie }),
    );
    const clearBody = await clearResponse.json();

    expect(clearResponse.status).toBe(200);
    expect(clearBody).toEqual({ status: "ok", deletedCount: 1 });
    expect(database.db.select().from(notificationHistory).all()).toHaveLength(0);
  });

  it("records sign-out notification history before deleting the session", async () => {
    const { app, database, viewer } = await createAuthTestApp();
    const viewerCookie = await loginAndReadCookie(app, "viewer@example.local");

    const logoutResponse = await app.handle(
      csrfJsonRequest("/api/auth/logout", {}, { cookie: viewerCookie }),
    );
    const logoutBody = await logoutResponse.json();
    const meResponse = await app.handle(
      new Request("http://localhost/api/auth/me", { headers: { cookie: viewerCookie } }),
    );
    const meBody = await meResponse.json();
    const viewerNotifications = database.db
      .select()
      .from(notificationHistory)
      .all()
      .filter((notification) => notification.userId === viewer.id);

    expect(logoutResponse.status).toBe(200);
    expect(logoutBody).toEqual({ status: "ok" });
    expect(meBody).toEqual({ user: null });
    expect(viewerNotifications).toHaveLength(1);
    expect(viewerNotifications[0]).toMatchObject({
      eventId: "auth.signed_out",
      title: "Signed out.",
      severity: TOAST_NOTIFICATION_EVENTS["auth.signed_out"].severity,
      importance: TOAST_NOTIFICATION_EVENTS["auth.signed_out"].importance,
      readAt: null,
    });
  });

  it("still signs out when sign-out notification history cannot be recorded", async () => {
    const { app, database } = await createAuthTestApp();
    const viewerCookie = await loginAndReadCookie(app, "viewer@example.local");
    const viewerSessionTokenHash = hashSessionToken(readCookieValue(viewerCookie));

    database.sqlite.run(`
      CREATE TRIGGER fail_logout_notification_history
      BEFORE INSERT ON notification_history
      WHEN NEW.event_id = 'auth.signed_out'
      BEGIN
        SELECT RAISE(ABORT, 'forced logout history failure');
      END;
    `);

    const logoutResponse = await app.handle(
      csrfJsonRequest("/api/auth/logout", {}, { cookie: viewerCookie }),
    );
    const meResponse = await app.handle(
      new Request("http://localhost/api/auth/me", { headers: { cookie: viewerCookie } }),
    );
    const auditLog = database.db
      .select()
      .from(auditLogs)
      .all()
      .find((log) => log.action === "auth.logout");

    expect(logoutResponse.status).toBe(200);
    expect((await meResponse.json()).user).toBeNull();
    expect(database.db.select().from(notificationHistory).all()).toHaveLength(0);
    expect(
      database.db
        .select()
        .from(sessions)
        .all()
        .some((session) => session.tokenHash === viewerSessionTokenHash),
    ).toBe(false);
    expect(auditLog?.metadataJson).toBe(JSON.stringify({ notificationHistoryRecorded: false }));
  });

  it("clears OAuth state cookies during local logout", async () => {
    const { app } = await createAuthTestApp();
    const viewerCookie = await loginAndReadCookie(app, "viewer@example.local");
    const logoutResponse = await app.handle(
      csrfJsonRequest(
        "/api/auth/logout",
        {},
        {
          cookie: `${viewerCookie}; ${OAUTH_STATE_COOKIE_NAME}=stale-state`,
        },
      ),
    );
    const setCookie = logoutResponse.headers.get("set-cookie") ?? "";

    expect(logoutResponse.status).toBe(200);
    expect(await logoutResponse.json()).toEqual({ status: "ok" });
    expect(setCookie).toContain(`${SESSION_COOKIE_NAME}=`);
    expect(setCookie).toContain(`${OAUTH_STATE_COOKIE_NAME}=`);
  });

  it("serves OAuth logout as a no-store POST continuation and deletes the local session", async () => {
    const { app, database } = await createEmptyAuthTestApp(
      new LoginRateLimiter(),
      OAUTH_TEST_ENCRYPTION_KEY,
    );
    await insertTestUser(database, {
      username: "oauth-user",
      email: "oauth-user@example.local",
      password: DEFAULT_PASSWORD,
    });
    const oauthUser = requireStoredUserByEmail(database, "oauth-user@example.local");
    let logoutIssuer = "";
    const discoveryServer = Bun.serve({
      port: 0,
      fetch: () =>
        Response.json({
          issuer: logoutIssuer,
          authorization_endpoint: `${logoutIssuer}authorize/`,
          token_endpoint: `${logoutIssuer}token/`,
          jwks_uri: `${logoutIssuer}jwks/`,
          end_session_endpoint: `${logoutIssuer}end-session/`,
          id_token_signing_alg_values_supported: ["RS256"],
        }),
    });

    logoutIssuer = new URL("/application/o/route-sso-logout/", discoveryServer.url).toString();
    insertAuthProvider(database, logoutIssuer);

    try {
      const sessionToken = generateSessionToken();
      const encryptedIdToken = await encryptOAuthIdToken(
        "test-id-token",
        OAUTH_TEST_ENCRYPTION_KEY,
      );
      const now = new Date();
      database.db
        .insert(sessions)
        .values({
          id: Bun.randomUUIDv7(),
          userId: oauthUser.id,
          tokenHash: hashSessionToken(sessionToken),
          expiresAt: createSessionExpiresAt(now).toISOString(),
          ipAddress: "127.0.0.1",
          userAgent: "route-test",
          oauthProvider: "authentik",
          oauthIdTokenEncrypted: encryptedIdToken.encrypted,
          oauthMasterKeyId: encryptedIdToken.masterKeyId,
          createdAt: now.toISOString(),
        })
        .run();

      const logoutResponse = await app.handle(
        csrfJsonRequest(
          "/api/auth/logout",
          {},
          {
            cookie: `${SESSION_COOKIE_NAME}=${sessionToken}; ${OAUTH_STATE_COOKIE_NAME}=stale-state`,
          },
        ),
      );
      const html = await logoutResponse.text();
      const setCookie = logoutResponse.headers.get("set-cookie") ?? "";
      const action = readFormAction(html);

      expect(logoutResponse.status).toBe(200);
      expect(logoutResponse.headers.get("content-type")).toStartWith("text/html");
      expect(logoutResponse.headers.get("cache-control")).toBe("no-store");
      expect(logoutResponse.headers.get("referrer-policy")).toBe("no-referrer");
      expect(action).toBe(`${logoutIssuer}end-session/`);
      expect(new URL(action).searchParams.has("id_token_hint")).toBe(false);
      expect(html).toContain('method="post"');
      expect(html).toContain('name="id_token_hint"');
      expect(html).toContain('name="post_logout_redirect_uri"');
      expect(html).toContain('name="client_id"');
      expect(html).toContain('name="state"');
      expect(setCookie).toContain(`${SESSION_COOKIE_NAME}=`);
      expect(setCookie).toContain(`${OAUTH_STATE_COOKIE_NAME}=`);
      expect(setCookie).toContain(`${OAUTH_LOGOUT_STATE_COOKIE_NAME}=`);
      expect(
        database.db
          .select()
          .from(sessions)
          .all()
          .some((session) => session.tokenHash === hashSessionToken(sessionToken)),
      ).toBe(false);
    } finally {
      discoveryServer.stop(true);
    }
  });

  it("validates OAuth logout callback state before redirecting to login", async () => {
    const { app } = await createEmptyAuthTestApp(new LoginRateLimiter(), OAUTH_TEST_ENCRYPTION_KEY);
    const state = "valid-logout-state";
    const stateCookie = await createLogoutStateCookieValue(state, OAUTH_TEST_ENCRYPTION_KEY);
    const response = await app.handle(
      new Request(`http://localhost/api/auth/logout/callback?state=${state}`, {
        headers: { cookie: `${OAUTH_LOGOUT_STATE_COOKIE_NAME}=${stateCookie}` },
      }),
    );
    const setCookie = response.headers.get("set-cookie") ?? "";

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe(`${TEST_WEB_ORIGIN}/login`);
    expect(setCookie).toContain(`${OAUTH_LOGOUT_STATE_COOKIE_NAME}=`);
  });

  it("rejects OAuth logout callbacks with missing or invalid state", async () => {
    const { app } = await createEmptyAuthTestApp(new LoginRateLimiter(), OAUTH_TEST_ENCRYPTION_KEY);
    const missingResponse = await app.handle(
      new Request("http://localhost/api/auth/logout/callback"),
    );
    const invalidResponse = await app.handle(
      new Request("http://localhost/api/auth/logout/callback?state=wrong", {
        headers: { cookie: `${OAUTH_LOGOUT_STATE_COOKIE_NAME}=not-a-valid-state-cookie` },
      }),
    );

    expect(missingResponse.status).toBe(400);
    expect(await missingResponse.json()).toEqual({
      error: {
        code: "OAUTH_LOGOUT_STATE_INVALID",
        message: "OAuth logout state is invalid or expired.",
      },
    });
    expect(invalidResponse.status).toBe(400);
  });

  it("keeps notification history self-only and validates history inputs", async () => {
    const { app, database, viewer } = await createAuthTestApp();
    const adminCookie = await loginAndReadCookie(app, "admin@example.local");
    const viewerCookie = await loginAndReadCookie(app, "viewer@example.local");

    const anonymousResponse = await app.handle(
      new Request("http://localhost/api/profile/notifications/history"),
    );
    const invalidEventResponse = await app.handle(
      csrfJsonRequest(
        "/api/profile/notifications/history",
        { eventId: "profile.unknown", title: "Invalid" },
        { cookie: viewerCookie },
      ),
    );
    const adminCreateResponse = await app.handle(
      csrfJsonRequest(
        "/api/profile/notifications/history",
        { eventId: "auth.signed_in", title: "Signed in." },
        { cookie: adminCookie },
      ),
    );
    const adminCreateBody = await adminCreateResponse.json();
    const viewerCreateResponse = await app.handle(
      csrfJsonRequest(
        "/api/profile/notifications/history",
        { eventId: "theme.changed", title: "Theme changed." },
        { cookie: viewerCookie },
      ),
    );
    const viewerCreateBody = await viewerCreateResponse.json();

    const foreignMarkResponse = await app.handle(
      csrfJsonPatchRequest(
        `/api/profile/notifications/history/${adminCreateBody.notification.id}`,
        { read: true },
        { cookie: viewerCookie },
      ),
    );
    const viewerClearResponse = await app.handle(
      csrfJsonDeleteRequest("/api/profile/notifications/history", { cookie: viewerCookie }),
    );
    const adminListResponse = await app.handle(
      new Request("http://localhost/api/profile/notifications/history", {
        headers: { cookie: adminCookie },
      }),
    );
    const adminListBody = await adminListResponse.json();

    expect(anonymousResponse.status).toBe(401);
    expect(invalidEventResponse.status).toBe(422);
    expect(adminCreateResponse.status).toBe(200);
    expect(viewerCreateResponse.status).toBe(200);
    expect(foreignMarkResponse.status).toBe(404);
    expect(viewerClearResponse.status).toBe(200);
    expect(adminListBody.notifications).toEqual([adminCreateBody.notification]);
    expect(adminListBody.unreadCount).toBe(1);
    expect(
      database.db
        .select()
        .from(notificationHistory)
        .all()
        .filter((notification) => notification.userId === viewer.id),
    ).toHaveLength(0);
    expect(viewerCreateBody.notification.id).not.toBe(adminCreateBody.notification.id);
  });

  it("stores only predetermined profile avatar and banner selections", async () => {
    const { app, database } = await createAuthTestApp();
    const viewerCookie = await loginAndReadCookie(app, "viewer@example.local");
    const avatarId = PROFILE_AVATAR_IDS.find((id) => id !== DEFAULT_PROFILE_AVATAR_ID);
    const bannerId = PROFILE_BANNER_IDS.find((id) => id !== DEFAULT_PROFILE_BANNER_ID);

    if (!avatarId || !bannerId) {
      throw new Error("Expected alternate profile media options for route tests.");
    }

    const updateResponse = await app.handle(
      csrfJsonPutRequest("/api/profile", { avatarId, bannerId }, { cookie: viewerCookie }),
    );
    const updateBody = await updateResponse.json();

    expect(updateResponse.status).toBe(200);
    expect(updateBody.user).toMatchObject({ avatarId, bannerId });
    expect(findStoredUserByPublicId(database, updateBody.user.id)).toMatchObject({
      avatarId,
      bannerId,
    });

    const profileResponse = await app.handle(
      new Request("http://localhost/api/profile", { headers: { cookie: viewerCookie } }),
    );
    const profileBody = await profileResponse.json();

    expect(profileResponse.status).toBe(200);
    expect(profileBody.user).toMatchObject({ avatarId, bannerId });

    const invalidResponse = await app.handle(
      csrfJsonPutRequest(
        "/api/profile",
        { avatarId: "custom-upload", bannerId },
        { cookie: viewerCookie },
      ),
    );

    expect(invalidResponse.status).toBe(422);
  });
});

async function createAuthTestApp(
  extraUsers: Array<{
    username: string;
    email: string;
    password: string;
    permissions?: UserPermission[];
  }> = [],
  rateLimiter = new LoginRateLimiter(),
): Promise<{
  app: TestAppContext["app"];
  database: DatabaseClient;
  admin: ReturnType<typeof requireStoredUserByEmail>;
  viewer: ReturnType<typeof requireStoredUserByEmail>;
  viewerCookie: string;
}> {
  const context = await createEmptyAuthTestApp(rateLimiter);
  const { app, database } = context;

  await insertTestUser(database, {
    username: "admin",
    email: "admin@example.local",
    password: DEFAULT_PASSWORD,
    permissions: [SYSTEM_ADMIN_PERMISSION],
  });
  await insertTestUser(database, {
    username: "viewer",
    email: "viewer@example.local",
    password: DEFAULT_PASSWORD,
  });

  for (const user of extraUsers) {
    await insertTestUser(database, user);
  }

  return {
    app,
    database,
    admin: requireStoredUserByEmail(database, "admin@example.local"),
    viewer: requireStoredUserByEmail(database, "viewer@example.local"),
    viewerCookie: await loginAndReadCookie(app, "viewer@example.local"),
  };
}

async function createEmptyAuthTestApp(
  rateLimiter = new LoginRateLimiter(),
  oauthClientSecretEncryptionKey?: string | null,
): Promise<TestAppContext> {
  return createServerTestApp(openDatabases, {
    loginRateLimiter: rateLimiter,
    ...(oauthClientSecretEncryptionKey !== undefined ? { oauthClientSecretEncryptionKey } : {}),
  });
}

async function insertTestUser(
  database: DatabaseClient,
  input: {
    username: string;
    email: string;
    password: string;
    permissions?: UserPermission[];
  },
): Promise<void> {
  const now = new Date().toISOString();
  const userId = Bun.randomUUIDv7();

  database.db
    .insert(users)
    .values({
      id: userId,
      publicId: generatePublicUserId(),
      username: input.username,
      email: input.email,
      passwordHash: await hashPassword(input.password),
      toastNotificationsEnabled: DEFAULT_NOTIFICATION_PREFERENCES.toastsEnabled,
      toastNotificationFrequency: DEFAULT_NOTIFICATION_PREFERENCES.frequency,
      disabledAt: null,
      createdAt: now,
      updatedAt: now,
      lastLoginAt: null,
    })
    .run();

  if (input.permissions && input.permissions.length > 0) {
    database.db
      .insert(userPermissionGrants)
      .values(
        input.permissions.map((permission) => ({
          id: Bun.randomUUIDv7(),
          userId,
          permission,
          grantedByUserId: userId,
          createdAt: now,
          updatedAt: now,
        })),
      )
      .run();
  }
}

async function loginAndReadCookie(
  app: TestAppContext["app"],
  email = "admin@example.local",
  password = DEFAULT_PASSWORD,
): Promise<string> {
  const loginResponse = await loginWithPassword(app, email, password);

  expect(loginResponse.status).toBe(200);

  return toCookieHeader(loginResponse.headers.get("set-cookie") ?? "");
}

async function loginWithPassword(
  app: TestAppContext["app"],
  email: string,
  password: string,
): Promise<Response> {
  return app.handle(csrfJsonRequest("/api/auth/login", { email, password }));
}

async function expectPasswordReplaced(
  app: TestAppContext["app"],
  email: string,
  newPassword: string,
): Promise<void> {
  const oldPasswordLogin = await loginWithPassword(app, email, DEFAULT_PASSWORD);
  const newPasswordLogin = await loginWithPassword(app, email, newPassword);

  expect(oldPasswordLogin.status).toBe(401);
  expect(newPasswordLogin.status).toBe(200);
}

async function expectSessionRejected(
  app: TestAppContext["app"],
  cookieHeader: string,
): Promise<void> {
  const meResponse = await app.handle(
    new Request("http://localhost/api/auth/me", { headers: { cookie: cookieHeader } }),
  );
  const meBody = await meResponse.json();
  const usersResponse = await app.handle(
    new Request("http://localhost/api/users", { headers: { cookie: cookieHeader } }),
  );

  expect(meResponse.status).toBe(200);
  expect(meBody).toEqual({ user: null });
  expect(usersResponse.status).toBe(401);
}

function toCookieHeader(setCookie: string): string {
  return setCookie.split(";")[0] ?? "";
}

function expectSecureSessionCookie(setCookie: string): void {
  expect(setCookie).toContain(`${SESSION_COOKIE_NAME}=`);
  expect(setCookie).toContain("HttpOnly");
  expect(setCookie).toContain("Secure");
  expect(setCookie).toContain("SameSite=Lax");
}

function readCookieValue(cookieHeader: string): string {
  return cookieHeader.slice(`${SESSION_COOKIE_NAME}=`.length);
}

function findStoredUserByPublicId(database: DatabaseClient, publicId: string) {
  return database.db
    .select()
    .from(users)
    .all()
    .find((user) => user.publicId === publicId);
}

function findStoredUserByEmail(database: DatabaseClient, email: string) {
  return database.db
    .select()
    .from(users)
    .all()
    .find((user) => user.email === email);
}

function insertAuthProvider(database: DatabaseClient, providerIssuer: string): void {
  const now = new Date().toISOString();

  database.db
    .insert(authProviders)
    .values({
      id: Bun.randomUUIDv7(),
      slug: "authentik",
      label: "Authentik",
      issuer: providerIssuer,
      clientId: "template-client",
      clientSecretEncrypted: "unused-by-logout",
      masterKeyId: "oauth-client-secret-v1",
      scopes: "openid profile email",
      redirectUris: JSON.stringify(["http://localhost/api/auth/callback/authentik"]),
      enabled: true,
      createdAt: now,
      updatedAt: now,
    })
    .run();
}

async function createOAuthCallbackStateCookie(
  mode: "login" | "link",
  state: string,
): Promise<{ cookie: string; state: string }> {
  const value = await createOAuthStateCookieValue(
    {
      provider: "authentik",
      state,
      nonce: `${mode}-nonce`,
      codeVerifier: `${mode}-code-verifier`,
      mode,
      returnTo: "/settings/auth",
      redirectUri: "http://localhost/api/auth/callback/authentik",
    },
    OAUTH_TEST_ENCRYPTION_KEY,
  );

  return { cookie: `${OAUTH_STATE_COOKIE_NAME}=${value}`, state };
}

function requireStoredUserByEmail(database: DatabaseClient, email: string) {
  const user = findStoredUserByEmail(database, email);

  if (!user) {
    throw new Error(`Expected test user ${email} to exist.`);
  }

  return user;
}

function csrfJsonPutRequest(
  path: string,
  body: unknown,
  headers: Record<string, string> = {},
): Request {
  return new Request(`http://localhost${path}`, {
    method: "PUT",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": "127.0.0.1",
      origin: TEST_WEB_ORIGIN,
      [CSRF_HEADER_NAME]: CSRF_HEADER_VALUE,
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

function csrfJsonPatchRequest(
  path: string,
  body: unknown,
  headers: Record<string, string> = {},
): Request {
  return new Request(`http://localhost${path}`, {
    method: "PATCH",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": "127.0.0.1",
      origin: TEST_WEB_ORIGIN,
      [CSRF_HEADER_NAME]: CSRF_HEADER_VALUE,
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

function csrfJsonDeleteRequest(path: string, headers: Record<string, string> = {}): Request {
  return new Request(`http://localhost${path}`, {
    method: "DELETE",
    headers: {
      "x-forwarded-for": "127.0.0.1",
      origin: TEST_WEB_ORIGIN,
      [CSRF_HEADER_NAME]: CSRF_HEADER_VALUE,
      ...headers,
    },
  });
}
