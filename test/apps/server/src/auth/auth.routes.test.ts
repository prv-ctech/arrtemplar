import { afterEach, describe, expect, it } from "bun:test";
import { hashPassword } from "../../../../../apps/server/src/auth/password";
import { generatePublicUserId } from "../../../../../apps/server/src/auth/public-user-id";
import { LoginRateLimiter } from "../../../../../apps/server/src/auth/rate-limit";
import {
  hashSessionToken,
  SESSION_COOKIE_NAME,
} from "../../../../../apps/server/src/auth/session-token";
import type { DatabaseClient } from "../../../../../apps/server/src/db/client";
import { sessions, userPermissionGrants, users } from "../../../../../apps/server/src/db/schema";
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
  USER_PERMISSION_VALUES,
  type UserPermission,
} from "../../../../../packages/shared/src";
import {
  closeServerTestDatabases,
  createServerTestApp,
  csrfJsonRequest,
  TEST_WEB_ORIGIN,
  type TestAppContext,
} from "../../../../helpers/server";

const DEFAULT_PASSWORD = "correct-horse-battery-staple";
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
): Promise<TestAppContext> {
  return createServerTestApp(openDatabases, { loginRateLimiter: rateLimiter });
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
