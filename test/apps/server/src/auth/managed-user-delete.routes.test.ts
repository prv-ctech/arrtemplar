import { afterEach, describe, expect, it } from "bun:test";
import { hashPassword } from "../../../../../apps/server/src/auth/password";
import { generatePublicUserId } from "../../../../../apps/server/src/auth/public-user-id";
import type { DatabaseClient } from "../../../../../apps/server/src/db/client";
import {
  auditLogs,
  notificationHistory,
  sessions,
  userPermissionGrants,
  users,
} from "../../../../../apps/server/src/db/schema";
import {
  CSRF_HEADER_NAME,
  CSRF_HEADER_VALUE,
  DEFAULT_NOTIFICATION_PREFERENCES,
  SYSTEM_ADMIN_PERMISSION,
  TOAST_NOTIFICATION_EVENTS,
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

describe("managed user delete routes", () => {
  it("requires users:delete in addition to users:manage when deleting users", async () => {
    const { app, viewer } = await createManagedDeleteTestApp([
      {
        username: "manager",
        email: "manager@example.local",
        password: DEFAULT_PASSWORD,
        permissions: ["users:manage"],
      },
    ]);

    const managerCookie = await loginAndReadCookie(app, "manager@example.local");
    const response = await app.handle(
      csrfJsonDeleteRequest(`/api/users/${viewer.publicId}`, { cookie: managerCookie }),
    );
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body).toEqual({
      error: {
        code: "FORBIDDEN",
        message: "users:delete permission is required.",
      },
    });
  });

  it("protects the last active system admin from delete operations", async () => {
    const { admin, app } = await createManagedDeleteTestApp([
      {
        username: "operator",
        email: "operator@example.local",
        password: DEFAULT_PASSWORD,
        permissions: ["users:manage", "users:delete"],
      },
    ]);

    const operatorCookie = await loginAndReadCookie(app, "operator@example.local");
    const response = await app.handle(
      csrfJsonDeleteRequest(`/api/users/${admin.publicId}`, { cookie: operatorCookie }),
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

  it("deletes managed users and cascades their sessions, grants, and notifications", async () => {
    const { app, database, viewer, viewerCookie } = await createManagedDeleteTestApp([
      {
        username: "operator",
        email: "operator@example.local",
        password: DEFAULT_PASSWORD,
        permissions: ["users:manage", "users:delete"],
      },
    ]);
    const operator = requireStoredUserByEmail(database, "operator@example.local");

    insertCascadeProbeRows(database, viewer.id, operator.id);

    const operatorCookie = await loginAndReadCookie(app, "operator@example.local");
    const response = await app.handle(
      csrfJsonDeleteRequest(`/api/users/${viewer.publicId}`, { cookie: operatorCookie }),
    );
    const body = await response.json();
    const deleteAuditLog = database.db
      .select()
      .from(auditLogs)
      .all()
      .find((log) => log.action === "users.deleted");

    expect(response.status).toBe(200);
    expect(body).toEqual({ status: "ok", deletedUserId: viewer.publicId });
    expect(findStoredUserByPublicId(database, viewer.publicId)).toBeUndefined();
    expect(readSessionsForUser(database, viewer.id)).toEqual([]);
    expect(readPermissionGrantsForUser(database, viewer.id)).toEqual([]);
    expect(readNotificationsForUser(database, viewer.id)).toEqual([]);
    expect(deleteAuditLog).toMatchObject({
      actorUserId: operator.id,
      targetType: "user",
      targetId: viewer.id,
    });
    expect(deleteAuditLog?.metadataJson).toContain(`"username":"${viewer.username}"`);
    await expectSessionRejected(app, viewerCookie);
  });
});

async function createManagedDeleteTestApp(
  extraUsers: Array<{
    username: string;
    email: string;
    password: string;
    permissions?: UserPermission[];
  }> = [],
): Promise<{
  app: TestAppContext["app"];
  database: DatabaseClient;
  admin: ReturnType<typeof requireStoredUserByEmail>;
  viewer: ReturnType<typeof requireStoredUserByEmail>;
  viewerCookie: string;
}> {
  const { app, database } = await createServerTestApp(openDatabases);

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

function insertCascadeProbeRows(
  database: DatabaseClient,
  targetUserId: string,
  operatorUserId: string,
): void {
  const now = new Date().toISOString();

  database.db
    .insert(userPermissionGrants)
    .values({
      id: Bun.randomUUIDv7(),
      userId: targetUserId,
      permission: "settings:services",
      grantedByUserId: operatorUserId,
      createdAt: now,
      updatedAt: now,
    })
    .run();
  database.db
    .insert(notificationHistory)
    .values({
      id: Bun.randomUUIDv7(),
      userId: targetUserId,
      eventId: "profile.noop",
      title: "Delete cascade probe.",
      description: null,
      severity: TOAST_NOTIFICATION_EVENTS["profile.noop"].severity,
      importance: TOAST_NOTIFICATION_EVENTS["profile.noop"].importance,
      readAt: null,
      createdAt: now,
    })
    .run();
}

async function loginAndReadCookie(
  app: TestAppContext["app"],
  email = "admin@example.local",
): Promise<string> {
  const response = await app.handle(
    csrfJsonRequest("/api/auth/login", { email, password: DEFAULT_PASSWORD }),
  );

  expect(response.status).toBe(200);

  return toCookieHeader(response.headers.get("set-cookie") ?? "");
}

async function expectSessionRejected(
  app: TestAppContext["app"],
  cookieHeader: string,
): Promise<void> {
  const meResponse = await app.handle(
    new Request("http://localhost/api/auth/me", { headers: { cookie: cookieHeader } }),
  );
  const usersResponse = await app.handle(
    new Request("http://localhost/api/users", { headers: { cookie: cookieHeader } }),
  );

  expect(meResponse.status).toBe(200);
  expect(await meResponse.json()).toEqual({ user: null });
  expect(usersResponse.status).toBe(401);
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

function readSessionsForUser(database: DatabaseClient, userId: string) {
  return database.db
    .select()
    .from(sessions)
    .all()
    .filter((session) => session.userId === userId);
}

function readPermissionGrantsForUser(database: DatabaseClient, userId: string) {
  return database.db
    .select()
    .from(userPermissionGrants)
    .all()
    .filter((grant) => grant.userId === userId);
}

function readNotificationsForUser(database: DatabaseClient, userId: string) {
  return database.db
    .select()
    .from(notificationHistory)
    .all()
    .filter((notification) => notification.userId === userId);
}

function toCookieHeader(setCookie: string): string {
  return setCookie.split(";")[0] ?? "";
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
