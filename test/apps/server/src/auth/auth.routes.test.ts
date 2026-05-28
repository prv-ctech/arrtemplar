import { afterEach, describe, expect, it } from "bun:test";
import { hashPassword } from "../../../../../apps/server/src/auth/password";
import { generatePublicUserId } from "../../../../../apps/server/src/auth/public-user-id";
import { LoginRateLimiter } from "../../../../../apps/server/src/auth/rate-limit";
import {
  hashSessionToken,
  SESSION_COOKIE_NAME,
} from "../../../../../apps/server/src/auth/session-token";
import type { DatabaseClient } from "../../../../../apps/server/src/db/client";
import {
  auditLogs,
  sessions,
  userPermissionGrants,
  users,
} from "../../../../../apps/server/src/db/schema";
import {
  CSRF_HEADER_NAME,
  CSRF_HEADER_VALUE,
  USER_PERMISSION_VALUES,
} from "../../../../../packages/shared/src";
import {
  closeServerTestDatabases,
  createServerTestApp,
  csrfJsonRequest,
  type TestAppContext,
} from "../../../../helpers/server";

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

  it("creates the first account as admin, signs it in, and never returns the password hash", async () => {
    const { app, database } = await createEmptyAuthTestApp();

    const response = await app.handle(
      csrfJsonRequest("/api/auth/setup", {
        username: "owner",
        email: "owner@example.local",
        password: "correct-horse-battery-staple",
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
        role: "admin",
        permissions: [...USER_PERMISSION_VALUES],
        createdAt: expect.any(String),
        lastLoginAt: null,
      },
    });
    expect(JSON.stringify(body)).not.toContain("passwordHash");
    expectSecureSessionCookie(setCookie);

    const [storedUser] = database.db.select().from(users).all();
    const [storedSession] = database.db.select().from(sessions).all();
    const storedAuditLogs = database.db.select().from(auditLogs).all();
    const auditActions = storedAuditLogs.map((entry) => entry.action);

    expect(storedUser?.role).toBe("admin");
    expectUuidv7(storedUser?.id);
    expectPublicUserId(storedUser?.publicId);
    expect(body.user.id).toBe(storedUser?.publicId);
    expect(body.user.id).not.toBe(storedUser?.id);
    expect(JSON.stringify(body)).not.toContain(storedUser?.id ?? "missing-user-id");
    expect(storedUser?.passwordHash).toStartWith("$argon2id$");
    expect(storedUser?.passwordHash).not.toBe("correct-horse-battery-staple");
    expect(
      await Bun.password.verify("correct-horse-battery-staple", storedUser?.passwordHash ?? ""),
    ).toBe(true);
    expectUuidv7(storedSession?.id);
    expect(storedSession?.userId).toBe(storedUser?.id);
    expect(storedSession?.tokenHash).toBe(hashSessionToken(sessionToken));
    for (const auditLog of storedAuditLogs) {
      expectUuidv7(auditLog.id);
    }
    expect(
      storedAuditLogs.find((entry) => entry.action === "auth.setup.admin_created")?.actorUserId,
    ).toBe(storedUser?.id);
    expect(auditActions).toContain("auth.setup.admin_created");

    const adminResponse = await app.handle(
      new Request("http://localhost/api/admin/auth/check", { headers: { cookie: cookieHeader } }),
    );

    expect(adminResponse.status).toBe(200);
  });

  it("blocks setup after any user exists", async () => {
    const { app, database } = await createAuthTestApp();

    const statusResponse = await app.handle(new Request("http://localhost/api/auth/setup"));
    const statusBody = await statusResponse.json();
    const createResponse = await app.handle(
      csrfJsonRequest("/api/auth/setup", {
        username: "second-admin",
        email: "second-admin@example.local",
        password: "correct-horse-battery-staple",
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

  it("lets only an admin create later local accounts and always stores them as users", async () => {
    const { app, database } = await createAuthTestApp();
    const adminCookie = await loginAndReadCookie(app);

    const response = await app.handle(
      csrfJsonRequest(
        "/api/admin/users",
        {
          username: "watcher",
          email: "watcher@example.local",
          password: "correct-horse-battery-staple",
          role: "admin",
        },
        { cookie: adminCookie },
      ),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      user: {
        id: expect.any(String),
        username: "watcher",
        email: "watcher@example.local",
        role: "user",
        permissions: [],
        createdAt: expect.any(String),
        lastLoginAt: null,
      },
    });

    const createdUser = database.db
      .select()
      .from(users)
      .all()
      .find((user) => user.email === "watcher@example.local");
    const auditActions = database.db
      .select()
      .from(auditLogs)
      .all()
      .map((entry) => entry.action);

    expect(createdUser?.role).toBe("user");
    expectPublicUserId(createdUser?.publicId);
    expect(body.user.id).toBe(createdUser?.publicId);
    expect(body.user.id).not.toBe(createdUser?.id);
    expect(JSON.stringify(body)).not.toContain(createdUser?.id ?? "missing-user-id");
    expect(createdUser?.passwordHash).toStartWith("$argon2id$");
    expect(createdUser?.passwordHash).not.toBe("correct-horse-battery-staple");
    expect(auditActions).toContain("admin.users.created");
  });

  it("lists safe managed non-admin user summaries only for admins", async () => {
    const { admin, adminCookie, app, viewer, viewerCookie } = await createAdminViewerTestContext();

    const anonymousResponse = await app.handle(new Request("http://localhost/api/admin/users"));
    const viewerResponse = await app.handle(
      new Request("http://localhost/api/admin/users", { headers: { cookie: viewerCookie } }),
    );
    const adminResponse = await app.handle(
      new Request("http://localhost/api/admin/users", { headers: { cookie: adminCookie } }),
    );
    const adminBody = await adminResponse.json();

    expect(anonymousResponse.status).toBe(401);
    expect(viewerResponse.status).toBe(403);
    expect(adminResponse.status).toBe(200);
    expect(adminBody.users).toEqual([expectedAdminUserSummary(viewer, "user")]);
    expect(adminBody.users.map((user: { id: string }) => user.id)).not.toContain(admin.publicId);
    expect(JSON.stringify(adminBody)).not.toContain("passwordHash");
    expect(JSON.stringify(adminBody)).not.toContain(admin.passwordHash);
    expect(JSON.stringify(adminBody)).not.toContain(admin.id);
    expect(JSON.stringify(adminBody)).not.toContain(viewer.id);
    for (const listedUser of adminBody.users) {
      expect("email" in listedUser).toBe(false);
      expect("lastLoginAt" in listedUser).toBe(false);
      expect("passwordHash" in listedUser).toBe(false);
    }
  });

  it("lets admins inspect the grant catalog and replace mod permissions after reauth", async () => {
    const { admin, adminCookie, app, database, viewer, viewerCookie } =
      await createAdminViewerTestContext();

    const anonymousCatalogResponse = await app.handle(
      new Request("http://localhost/api/admin/permission-catalog"),
    );
    const viewerCatalogResponse = await app.handle(
      new Request("http://localhost/api/admin/permission-catalog", {
        headers: { cookie: viewerCookie },
      }),
    );
    const adminCatalogResponse = await app.handle(
      new Request("http://localhost/api/admin/permission-catalog", {
        headers: { cookie: adminCookie },
      }),
    );
    const catalogBody = await adminCatalogResponse.json();

    expect(anonymousCatalogResponse.status).toBe(401);
    expect(viewerCatalogResponse.status).toBe(403);
    expect(adminCatalogResponse.status).toBe(200);
    expect(
      catalogBody.permissions.map((entry: { permission: string }) => entry.permission),
    ).toEqual([
      "admin:general",
      "admin:library",
      "admin:users",
      "admin:import",
      "admin:notifications",
      "admin:services",
      "admin:logs",
      "admin:about",
    ]);

    const grantUserPermissionsResponse = await adminPatch(
      app,
      `/api/admin/users/${viewer.publicId}/permissions`,
      { permissions: ["admin:import"], currentAdminPassword: "correct-horse-battery-staple" },
      adminCookie,
    );
    const grantUserPermissionsBody = await grantUserPermissionsResponse.json();

    expect(grantUserPermissionsResponse.status).toBe(409);
    expect(grantUserPermissionsBody.error.code).toBe("INVALID_PERMISSION_TARGET");

    const promoteResponse = await adminPatch(
      app,
      `/api/admin/users/${viewer.publicId}/role`,
      { role: "mod", currentAdminPassword: "correct-horse-battery-staple" },
      adminCookie,
    );

    expect(promoteResponse.status).toBe(200);

    const modCookie = await loginAndReadCookie(app, "viewer@example.local");
    const modGrantResponse = await adminPatch(
      app,
      `/api/admin/users/${viewer.publicId}/permissions`,
      { permissions: ["admin:import"], currentAdminPassword: "correct-horse-battery-staple" },
      modCookie,
    );
    const invalidPermissionResponse = await adminPatch(
      app,
      `/api/admin/users/${viewer.publicId}/permissions`,
      {
        permissions: ["admin:logs", "admin:unknown"],
        currentAdminPassword: "correct-horse-battery-staple",
      },
      adminCookie,
    );
    await expectAdminConfirmationValidation(
      app,
      `/api/admin/users/${viewer.publicId}/permissions`,
      { permissions: ["admin:import"] },
      { permissions: ["admin:import"], currentAdminPassword: "wrong-password" },
      adminCookie,
    );

    expect(modGrantResponse.status).toBe(403);
    expect(invalidPermissionResponse.status).toBe(422);

    const grantResponse = await adminPatch(
      app,
      `/api/admin/users/${viewer.publicId}/permissions`,
      {
        permissions: ["admin:logs", "admin:import", "admin:logs"],
        currentAdminPassword: "correct-horse-battery-staple",
      },
      adminCookie,
    );
    const grantBody = await grantResponse.json();

    expect(grantResponse.status).toBe(200);
    expect(grantBody.user).toMatchObject({
      id: viewer.publicId,
      username: "viewer",
      role: "mod",
      permissions: ["admin:import", "admin:logs"],
    });
    expect(JSON.stringify(grantBody)).not.toContain(viewer.id);
    await expectSessionRejected(app, modCookie);

    const storedGrants = database.db.select().from(userPermissionGrants).all();
    expect(storedGrants).toHaveLength(2);
    expect(storedGrants.map((grant) => grant.userId).every((userId) => userId === viewer.id)).toBe(
      true,
    );
    expect(storedGrants.map((grant) => grant.permission).sort()).toEqual([
      "admin:import",
      "admin:logs",
    ]);

    const listResponse = await app.handle(
      new Request("http://localhost/api/admin/users", { headers: { cookie: adminCookie } }),
    );
    const listBody = await listResponse.json();
    const listedViewer = listBody.users.find((user: { id: string }) => user.id === viewer.publicId);
    const auditEntries = database.db.select().from(auditLogs).all();
    const permissionsAudit = auditEntries.find(
      (entry) => entry.action === "admin.users.permissions_changed",
    );

    expect(listedViewer.permissions).toEqual(["admin:import", "admin:logs"]);
    expect(permissionsAudit?.actorUserId).toBe(admin.id);
    expect(permissionsAudit?.targetId).toBe(viewer.id);
    expect(JSON.stringify(permissionsAudit)).not.toContain("correct-horse-battery-staple");

    const grantedModCookie = await loginAndReadCookie(app, "viewer@example.local");
    const grantedModMeResponse = await app.handle(
      new Request("http://localhost/api/auth/me", { headers: { cookie: grantedModCookie } }),
    );
    const grantedModMeBody = await grantedModMeResponse.json();

    expect(grantedModMeResponse.status).toBe(200);
    expect(grantedModMeBody.user).toMatchObject({
      id: viewer.publicId,
      role: "mod",
      permissions: ["admin:import", "admin:logs"],
    });

    const revokeResponse = await adminPatch(
      app,
      `/api/admin/users/${viewer.publicId}/permissions`,
      { permissions: [], currentAdminPassword: "correct-horse-battery-staple" },
      adminCookie,
    );
    const revokeBody = await revokeResponse.json();

    expect(revokeResponse.status).toBe(200);
    expect(revokeBody.user.permissions).toEqual([]);
    expect(database.db.select().from(userPermissionGrants).all()).toHaveLength(0);
  });

  it("lets admins change target passwords after reauth and revokes target sessions", async () => {
    const { adminCookie, app, database, viewer, viewerCookie } =
      await createAdminViewerTestContext();
    const newPassword = "updated-correct-horse-battery-staple";

    const passwordPath = `/api/admin/users/${viewer.publicId}/password`;
    await expectAdminConfirmationValidation(
      app,
      passwordPath,
      { password: newPassword },
      { password: newPassword, currentAdminPassword: "wrong-password" },
      adminCookie,
    );
    const tooShortPasswordResponse = await adminPatch(
      app,
      passwordPath,
      { password: "short", currentAdminPassword: "correct-horse-battery-staple" },
      adminCookie,
    );

    expect(tooShortPasswordResponse.status).toBe(422);

    const response = await adminPatch(
      app,
      passwordPath,
      { password: newPassword, currentAdminPassword: "correct-horse-battery-staple" },
      adminCookie,
    );
    const body = await response.json();
    const storedViewer = requireStoredUserByEmail(database, "viewer@example.local");

    expect(response.status).toBe(200);
    expect(body).toEqual({ status: "ok" });
    await expectPasswordHashReplaced(storedViewer.passwordHash, newPassword);
    await expectSessionRejected(app, viewerCookie);
    await expectPasswordReplaced(app, "viewer@example.local", newPassword);

    const auditJson = JSON.stringify(database.db.select().from(auditLogs).all());

    expect(auditJson).not.toContain(newPassword);
    expect(auditJson).not.toContain("correct-horse-battery-staple");
  });

  it("changes managed account roles only between user and mod after reauth", async () => {
    const { adminCookie, app, viewer, viewerCookie } = await createAdminViewerTestContext();

    const rolePath = `/api/admin/users/${viewer.publicId}/role`;
    await expectAdminConfirmationValidation(
      app,
      rolePath,
      { role: "mod" },
      { role: "mod", currentAdminPassword: "wrong-password" },
      adminCookie,
    );

    const adminPromotionResponse = await adminPatch(
      app,
      rolePath,
      { role: "admin", currentAdminPassword: "correct-horse-battery-staple" },
      adminCookie,
    );
    expect(adminPromotionResponse.status).toBe(422);

    const promoteResponse = await adminPatch(
      app,
      rolePath,
      { role: "mod", currentAdminPassword: "correct-horse-battery-staple" },
      adminCookie,
    );
    const promoteBody = await promoteResponse.json();

    expect(promoteResponse.status).toBe(200);
    expect(promoteBody.user).toMatchObject({
      id: viewer.publicId,
      username: "viewer",
      role: "mod",
    });
    expect(JSON.stringify(promoteBody)).not.toContain(viewer.id);
    await expectSessionRejected(app, viewerCookie);

    const promotedViewerCookie = await loginAndReadCookie(app, "viewer@example.local");

    const demoteViewerResponse = await adminPatch(
      app,
      rolePath,
      { role: "user", currentAdminPassword: "correct-horse-battery-staple" },
      adminCookie,
    );
    const demoteViewerBody = await demoteViewerResponse.json();

    expect(demoteViewerResponse.status).toBe(200);
    expect(demoteViewerBody.user.role).toBe("user");
    await expectSessionRejected(app, promotedViewerCookie);
  });

  it("does not manage admin targets through admin users endpoints", async () => {
    const { admin, adminCookie, app } = await createAdminViewerTestContext();
    const adminPath = `/api/admin/users/${admin.publicId}`;
    const confirmation = { currentAdminPassword: "correct-horse-battery-staple" };

    const roleResponse = await adminPatch(
      app,
      `${adminPath}/role`,
      { ...confirmation, role: "mod" },
      adminCookie,
    );
    const passwordResponse = await adminPatch(
      app,
      `${adminPath}/password`,
      { ...confirmation, password: "updated-correct-horse-battery-staple" },
      adminCookie,
    );
    const permissionsResponse = await adminPatch(
      app,
      `${adminPath}/permissions`,
      { ...confirmation, permissions: ["admin:logs"] },
      adminCookie,
    );
    const disableResponse = await adminDelete(app, adminPath, confirmation, adminCookie);

    expect(roleResponse.status).toBe(404);
    expect(passwordResponse.status).toBe(404);
    expect(permissionsResponse.status).toBe(404);
    expect(disableResponse.status).toBe(404);
  });

  it("soft-deletes, re-enables, and revokes sessions for target users without locking out the last admin", async () => {
    const { admin, adminCookie, app, database, viewer, viewerCookie } =
      await createAdminViewerTestContext();

    const missingCsrfResponse = await app.handle(
      jsonDeleteRequest(`/api/admin/users/${viewer.id}`, {
        currentAdminPassword: "correct-horse-battery-staple",
      }),
    );
    const viewerPath = `/api/admin/users/${viewer.publicId}`;
    const wrongConfirmationResponse = await adminDelete(
      app,
      viewerPath,
      { currentAdminPassword: "wrong-password" },
      adminCookie,
    );

    expect(missingCsrfResponse.status).toBe(403);
    expect(wrongConfirmationResponse.status).toBe(401);

    const disableResponse = await adminDelete(
      app,
      viewerPath,
      { currentAdminPassword: "correct-horse-battery-staple" },
      adminCookie,
    );
    const disableBody = await disableResponse.json();
    const disabledViewer = requireStoredUserByEmail(database, "viewer@example.local");

    expect(disableResponse.status).toBe(200);
    expect(disableBody.user).toMatchObject({
      id: viewer.publicId,
      username: "viewer",
      role: "user",
    });
    expect(JSON.stringify(disableBody)).not.toContain(viewer.id);
    expect(disableBody.user.disabledAt).toEqual(expect.any(String));
    expect(disabledViewer.disabledAt).toEqual(expect.any(String));
    await expectSessionRejected(app, viewerCookie);

    const disabledLoginResponse = await loginWithPassword(
      app,
      "viewer@example.local",
      "correct-horse-battery-staple",
    );

    expect(disabledLoginResponse.status).toBe(401);

    const enableResponse = await adminPatch(
      app,
      `${viewerPath}/status`,
      { disabled: false, currentAdminPassword: "correct-horse-battery-staple" },
      adminCookie,
    );
    const enableBody = await enableResponse.json();

    expect(enableResponse.status).toBe(200);
    expect(enableBody.user.disabledAt).toBeNull();

    const enabledLoginResponse = await loginWithPassword(
      app,
      "viewer@example.local",
      "correct-horse-battery-staple",
    );

    expect(enabledLoginResponse.status).toBe(200);

    const disableAdminResponse = await adminDelete(
      app,
      `/api/admin/users/${admin.publicId}`,
      { currentAdminPassword: "correct-horse-battery-staple" },
      adminCookie,
    );

    expect(disableAdminResponse.status).toBe(404);
  });

  it("validates admin user-management request bodies and path ids", async () => {
    const { app } = await createAuthTestApp();
    const adminCookie = await loginAndReadCookie(app);

    const invalidCreateUsernameResponse = await app.handle(
      csrfJsonRequest(
        "/api/admin/users",
        {
          username: "   ",
          email: "invalid-create@example.local",
          password: "correct-horse-battery-staple",
        },
        { cookie: adminCookie },
      ),
    );
    const invalidCreatePasswordResponse = await app.handle(
      csrfJsonRequest(
        "/api/admin/users",
        { username: "short-pass", email: "short-pass@example.local", password: "short" },
        { cookie: adminCookie },
      ),
    );
    const invalidPathResponse = await app.handle(
      csrfJsonPatchRequest(
        "/api/admin/users/not-a-uuid/role",
        { role: "admin", currentAdminPassword: "correct-horse-battery-staple" },
        { cookie: adminCookie },
      ),
    );
    const invalidRoleResponse = await app.handle(
      csrfJsonPatchRequest(
        `/api/admin/users/${crypto.randomUUID()}/role`,
        { role: "owner", currentAdminPassword: "correct-horse-battery-staple" },
        { cookie: adminCookie },
      ),
    );

    expect(invalidCreateUsernameResponse.status).toBe(422);
    expect(invalidCreatePasswordResponse.status).toBe(422);
    expect(invalidPathResponse.status).toBe(422);
    expect(invalidRoleResponse.status).toBe(422);
  });

  it("blocks anonymous and non-admin clients from creating local accounts", async () => {
    const { app } = await createAuthTestApp();
    const requestBody = {
      username: "blocked-viewer",
      email: "blocked-viewer@example.local",
      password: "correct-horse-battery-staple",
    };

    const anonymousResponse = await app.handle(csrfJsonRequest("/api/admin/users", requestBody));
    const viewerLoginResponse = await app.handle(
      csrfJsonRequest("/api/auth/login", {
        email: "viewer@example.local",
        password: "correct-horse-battery-staple",
      }),
    );
    const viewerCookie = toCookieHeader(viewerLoginResponse.headers.get("set-cookie") ?? "");
    const viewerResponse = await app.handle(
      csrfJsonRequest("/api/admin/users", requestBody, { cookie: viewerCookie }),
    );

    expect(anonymousResponse.status).toBe(401);
    expect(viewerLoginResponse.status).toBe(200);
    expect(viewerResponse.status).toBe(403);
  });

  it("logs in an admin, sets a secure HttpOnly cookie, exposes /me, and logs out", async () => {
    const { app, database } = await createAuthTestApp();

    const loginResponse = await app.handle(
      csrfJsonRequest("/api/auth/login", {
        email: "admin@example.local",
        password: "correct-horse-battery-staple",
      }),
    );
    const loginBody = await loginResponse.json();
    const setCookie = loginResponse.headers.get("set-cookie") ?? "";
    const cookieHeader = toCookieHeader(setCookie);
    const sessionToken = readCookieValue(cookieHeader);

    expect(loginResponse.status).toBe(200);
    expect(loginBody).toEqual({
      user: {
        id: expect.any(String),
        username: "admin",
        email: "admin@example.local",
        role: "admin",
        permissions: [...USER_PERMISSION_VALUES],
        createdAt: expect.any(String),
        lastLoginAt: expect.any(String),
      },
    });
    expect(JSON.stringify(loginBody)).not.toContain("passwordHash");
    expectSecureSessionCookie(setCookie);
    expect(setCookie).toContain("Max-Age=2592000");

    const [storedSession] = database.db.select().from(sessions).all();
    expect(storedSession?.tokenHash).toBe(hashSessionToken(sessionToken));
    expect(storedSession?.tokenHash).not.toBe(sessionToken);

    const meResponse = await app.handle(
      new Request("http://localhost/api/auth/me", { headers: { cookie: cookieHeader } }),
    );
    const meBody = await meResponse.json();

    expect(meResponse.status).toBe(200);
    expect(meBody.user.email).toBe("admin@example.local");
    expect(JSON.stringify(meBody)).not.toContain("passwordHash");

    const adminResponse = await app.handle(
      new Request("http://localhost/api/admin/auth/check", { headers: { cookie: cookieHeader } }),
    );
    expect(adminResponse.status).toBe(200);

    const logoutResponse = await app.handle(
      csrfJsonRequest("/api/auth/logout", undefined, { cookie: cookieHeader }),
    );
    const logoutBody = await logoutResponse.json();

    expect(logoutResponse.status).toBe(200);
    expect(logoutBody).toEqual({ status: "ok" });
    expect(logoutResponse.headers.get("set-cookie") ?? "").toContain(`${SESSION_COOKIE_NAME}=`);
    expect(database.db.select().from(sessions).all()).toHaveLength(0);

    const anonymousMeResponse = await app.handle(
      new Request("http://localhost/api/auth/me", { headers: { cookie: cookieHeader } }),
    );
    const anonymousMeBody = await anonymousMeResponse.json();
    const auditActions = database.db
      .select()
      .from(auditLogs)
      .all()
      .map((entry) => entry.action);

    expect(anonymousMeResponse.status).toBe(200);
    expect(anonymousMeBody).toEqual({ user: null });
    expect(auditActions).toContain("auth.login.success");
    expect(auditActions).toContain("admin.auth.check");
    expect(auditActions).toContain("auth.logout");
  });

  it("rejects bad credentials without creating a session or returning sensitive data", async () => {
    const { app, database } = await createAuthTestApp();

    const response = await app.handle(
      csrfJsonRequest("/api/auth/login", {
        email: "admin@example.local",
        password: "wrong-password",
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toEqual({
      error: {
        code: "INVALID_CREDENTIALS",
        message: "Invalid email or password.",
      },
    });
    expect(JSON.stringify(body)).not.toContain("passwordHash");
    expect(JSON.stringify(body)).not.toContain("wrong-password");
    expect(database.db.select().from(sessions).all()).toHaveLength(0);
    const failedLoginAudit = database.db
      .select()
      .from(auditLogs)
      .all()
      .find((entry) => entry.action === "auth.login.failed");

    expect(failedLoginAudit).toBeDefined();
    expect(failedLoginAudit?.metadataJson).toBe(JSON.stringify({ email: "admin@example.local" }));
    expect(JSON.stringify(failedLoginAudit)).not.toContain("wrong-password");
    expect(JSON.stringify(failedLoginAudit)).not.toContain("arrtemplar_session");
  });

  it("rate-limits repeated failed logins", async () => {
    const { app } = await createAuthTestApp(new LoginRateLimiter(2, 15 * 60 * 1000));
    const body = { email: "admin@example.local", password: "wrong-password" };

    const first = await app.handle(csrfJsonRequest("/api/auth/login", body));
    const second = await app.handle(csrfJsonRequest("/api/auth/login", body));
    const third = await app.handle(csrfJsonRequest("/api/auth/login", body));
    const thirdBody = await third.json();

    expect(first.status).toBe(401);
    expect(second.status).toBe(401);
    expect(third.status).toBe(429);
    expect(thirdBody).toEqual({
      error: {
        code: "RATE_LIMITED",
        message: "Too many failed login attempts. Try again later.",
      },
    });
  });

  it("blocks anonymous and normal users from admin-only APIs", async () => {
    const { app } = await createAuthTestApp();

    const anonymousResponse = await app.handle(
      new Request("http://localhost/api/admin/auth/check"),
    );

    expect(anonymousResponse.status).toBe(401);

    const loginResponse = await app.handle(
      csrfJsonRequest("/api/auth/login", {
        email: "viewer@example.local",
        password: "correct-horse-battery-staple",
      }),
    );
    const cookieHeader = toCookieHeader(loginResponse.headers.get("set-cookie") ?? "");
    const userAdminResponse = await app.handle(
      new Request("http://localhost/api/admin/auth/check", { headers: { cookie: cookieHeader } }),
    );
    const userAdminBody = await userAdminResponse.json();

    expect(loginResponse.status).toBe(200);
    expect(userAdminResponse.status).toBe(403);
    expect(userAdminBody).toEqual({
      error: {
        code: "FORBIDDEN",
        message: "Admin role is required.",
      },
    });
  });

  it("returns only the authenticated user's profile from /api/user/profile", async () => {
    const { app } = await createAuthTestApp();
    const anonymousResponse = await app.handle(new Request("http://localhost/api/user/profile"));
    const viewerCookie = await loginAndReadCookie(app, "viewer@example.local");
    const viewerResponse = await app.handle(
      new Request("http://localhost/api/user/profile", { headers: { cookie: viewerCookie } }),
    );
    const viewerBody = await viewerResponse.json();

    expect(anonymousResponse.status).toBe(401);
    expect(viewerResponse.status).toBe(200);
    expect(viewerBody).toEqual({
      user: {
        id: expect.any(String),
        username: "viewer",
        email: "viewer@example.local",
        role: "user",
        permissions: [],
        createdAt: expect.any(String),
        lastLoginAt: expect.any(String),
      },
    });
    expect(JSON.stringify(viewerBody)).not.toContain("passwordHash");
  });

  it("updates only the authenticated user's username and email", async () => {
    const { app, database } = await createAuthTestApp();
    const viewerCookie = await loginAndReadCookie(app, "viewer@example.local");

    const response = await app.handle(
      csrfJsonPutRequest(
        "/api/user/profile",
        { username: "reader", email: "reader@example.local" },
        { cookie: viewerCookie },
      ),
    );
    const body = await response.json();
    const storedViewer = findStoredUserByPublicId(database, body.user.id);

    expect(response.status).toBe(200);
    expect(body.user).toMatchObject({
      username: "reader",
      email: "reader@example.local",
      role: "user",
    });
    expect(storedViewer?.username).toBe("reader");
    expect(storedViewer?.email).toBe("reader@example.local");

    const duplicateResponse = await app.handle(
      csrfJsonPutRequest(
        "/api/user/profile",
        { username: "admin", email: "admin@example.local" },
        { cookie: viewerCookie },
      ),
    );
    const duplicateBody = await duplicateResponse.json();

    expect(duplicateResponse.status).toBe(409);
    expect(duplicateBody).toEqual({
      error: {
        code: "USER_ALREADY_EXISTS",
        message: "A user with that username or email already exists.",
      },
    });
  });

  it("changes the authenticated user's password after verifying the current password", async () => {
    const { app, database } = await createAuthTestApp();
    const viewerCookie = await loginAndReadCookie(app, "viewer@example.local");

    const wrongCurrentResponse = await app.handle(
      csrfJsonPutRequest(
        "/api/user/password",
        {
          currentPassword: "wrong-password",
          newPassword: "correct-horse-battery-staple-updated",
        },
        { cookie: viewerCookie },
      ),
    );

    expect(wrongCurrentResponse.status).toBe(401);

    const tooShortResponse = await app.handle(
      csrfJsonPutRequest(
        "/api/user/password",
        { currentPassword: "correct-horse-battery-staple", newPassword: "short" },
        { cookie: viewerCookie },
      ),
    );

    expect(tooShortResponse.status).toBe(422);

    const response = await app.handle(
      csrfJsonPutRequest(
        "/api/user/password",
        {
          currentPassword: "correct-horse-battery-staple",
          newPassword: "correct-horse-battery-staple-updated",
        },
        { cookie: viewerCookie },
      ),
    );
    const body = await response.json();
    const storedViewer = findStoredUserByEmail(database, "viewer@example.local");

    expect(response.status).toBe(200);
    expect(body).toEqual({ status: "ok" });
    await expectPasswordHashReplaced(
      storedViewer?.passwordHash,
      "correct-horse-battery-staple-updated",
    );

    await expectPasswordReplaced(
      app,
      "viewer@example.local",
      "correct-horse-battery-staple-updated",
    );
  });

  it("treats deleted sessions as anonymous for current-user and admin checks", async () => {
    const { app, database } = await createAuthTestApp();
    const cookieHeader = await loginAndReadCookie(app);

    database.db.delete(sessions).run();

    await expectSessionRejected(app, cookieHeader);
  });

  it("expires sessions before current-user and admin checks", async () => {
    const { app, database } = await createAuthTestApp();
    const cookieHeader = await loginAndReadCookie(app);
    const expiredAt = new Date(Date.now() - 60_000).toISOString();

    database.db.update(sessions).set({ expiresAt: expiredAt }).run();

    await expectSessionRejected(app, cookieHeader);
    expect(database.db.select().from(sessions).all()).toHaveLength(0);
  });

  it("blocks disabled users even when they still have a session", async () => {
    const { app, database } = await createAuthTestApp();
    const cookieHeader = await loginAndReadCookie(app);

    database.db.update(users).set({ disabledAt: new Date().toISOString() }).run();

    await expectSessionRejected(app, cookieHeader);
  });
});

async function createAdminViewerTestContext(): Promise<{
  admin: ReturnType<typeof requireStoredUserByEmail>;
  adminCookie: string;
  app: TestAppContext["app"];
  database: DatabaseClient;
  viewer: ReturnType<typeof requireStoredUserByEmail>;
  viewerCookie: string;
}> {
  const { app, database } = await createAuthTestApp();

  return {
    admin: requireStoredUserByEmail(database, "admin@example.local"),
    adminCookie: await loginAndReadCookie(app),
    app,
    database,
    viewer: requireStoredUserByEmail(database, "viewer@example.local"),
    viewerCookie: await loginAndReadCookie(app, "viewer@example.local"),
  };
}

async function createAuthTestApp(rateLimiter = new LoginRateLimiter()): Promise<{
  app: TestAppContext["app"];
  database: DatabaseClient;
}> {
  const context = await createEmptyAuthTestApp(rateLimiter);
  const { database } = context;

  await insertTestUser(database, {
    username: "admin",
    email: "admin@example.local",
    password: "correct-horse-battery-staple",
    role: "admin",
  });
  await insertTestUser(database, {
    username: "viewer",
    email: "viewer@example.local",
    password: "correct-horse-battery-staple",
    role: "user",
  });

  return context;
}

async function createEmptyAuthTestApp(
  rateLimiter = new LoginRateLimiter(),
): Promise<TestAppContext> {
  return createServerTestApp(openDatabases, { loginRateLimiter: rateLimiter });
}

async function insertTestUser(
  database: DatabaseClient,
  input: { username: string; email: string; password: string; role: "admin" | "user" },
): Promise<void> {
  const now = new Date().toISOString();
  database.db
    .insert(users)
    .values({
      id: crypto.randomUUID(),
      publicId: generatePublicUserId(),
      username: input.username,
      email: input.email,
      passwordHash: await hashPassword(input.password),
      role: input.role,
      createdAt: now,
      updatedAt: now,
    })
    .run();
}

async function loginAndReadCookie(
  app: TestAppContext["app"],
  email = "admin@example.local",
): Promise<string> {
  const loginResponse = await loginWithPassword(app, email, "correct-horse-battery-staple");

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
  const oldPasswordLogin = await loginWithPassword(app, email, "correct-horse-battery-staple");
  const newPasswordLogin = await loginWithPassword(app, email, newPassword);

  expect(oldPasswordLogin.status).toBe(401);
  expect(newPasswordLogin.status).toBe(200);
}

async function expectPasswordHashReplaced(
  passwordHash: string | undefined,
  newPassword: string,
): Promise<void> {
  expect(passwordHash).toStartWith("$argon2id$");
  expect(passwordHash).not.toContain(newPassword);
  expect(await Bun.password.verify(newPassword, passwordHash ?? "")).toBe(true);
}

async function expectSessionRejected(
  app: TestAppContext["app"],
  cookieHeader: string,
): Promise<void> {
  const meResponse = await app.handle(
    new Request("http://localhost/api/auth/me", { headers: { cookie: cookieHeader } }),
  );
  const meBody = await meResponse.json();
  const adminResponse = await app.handle(
    new Request("http://localhost/api/admin/auth/check", { headers: { cookie: cookieHeader } }),
  );

  expect(meResponse.status).toBe(200);
  expect(meBody).toEqual({ user: null });
  expect(adminResponse.status).toBe(401);
}

async function adminPatch(
  app: TestAppContext["app"],
  path: string,
  body: unknown,
  cookie: string,
): Promise<Response> {
  return app.handle(csrfJsonPatchRequest(path, body, { cookie }));
}

async function expectAdminConfirmationValidation(
  app: TestAppContext["app"],
  path: string,
  missingConfirmationBody: unknown,
  wrongConfirmationBody: unknown,
  cookie: string,
): Promise<void> {
  const missingConfirmationResponse = await adminPatch(app, path, missingConfirmationBody, cookie);
  const wrongConfirmationResponse = await adminPatch(app, path, wrongConfirmationBody, cookie);

  expect(missingConfirmationResponse.status).toBe(422);
  expect(wrongConfirmationResponse.status).toBe(401);
}

async function adminDelete(
  app: TestAppContext["app"],
  path: string,
  body: unknown,
  cookie: string,
): Promise<Response> {
  return app.handle(csrfJsonDeleteRequest(path, body, { cookie }));
}

function expectedAdminUserSummary(
  user: ReturnType<typeof requireStoredUserByEmail>,
  role: "admin" | "user",
) {
  return expect.objectContaining({
    id: user.publicId,
    username: user.username,
    role,
    disabledAt: null,
    createdAt: expect.any(String),
    updatedAt: expect.any(String),
    permissions: [],
  });
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
      origin: "http://localhost:5173",
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
      origin: "http://localhost:5173",
      [CSRF_HEADER_NAME]: CSRF_HEADER_VALUE,
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

function csrfJsonDeleteRequest(
  path: string,
  body: unknown,
  headers: Record<string, string> = {},
): Request {
  return new Request(`http://localhost${path}`, {
    method: "DELETE",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": "127.0.0.1",
      origin: "http://localhost:5173",
      [CSRF_HEADER_NAME]: CSRF_HEADER_VALUE,
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

function jsonDeleteRequest(path: string, body: unknown): Request {
  return new Request(`http://localhost${path}`, {
    method: "DELETE",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": "127.0.0.1",
      origin: "http://localhost:5173",
    },
    body: JSON.stringify(body),
  });
}

function expectUuidv7(id: string | undefined): void {
  expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
}

function expectPublicUserId(id: string | undefined): void {
  expect(id).toMatch(/^[A-Za-z0-9]{9}$/);
}
