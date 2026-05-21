import { afterEach, describe, expect, it } from "bun:test";
import { hashPassword } from "../../../../../apps/server/src/auth/password";
import { LoginRateLimiter } from "../../../../../apps/server/src/auth/rate-limit";
import {
  hashSessionToken,
  SESSION_COOKIE_NAME,
} from "../../../../../apps/server/src/auth/session-token";
import type { DatabaseClient } from "../../../../../apps/server/src/db/client";
import { auditLogs, sessions, users } from "../../../../../apps/server/src/db/schema";
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
        createdAt: expect.any(String),
        lastLoginAt: null,
      },
    });
    expect(JSON.stringify(body)).not.toContain("passwordHash");
    expectSecureSessionCookie(setCookie);

    const [storedUser] = database.db.select().from(users).all();
    const [storedSession] = database.db.select().from(sessions).all();
    const auditActions = database.db
      .select()
      .from(auditLogs)
      .all()
      .map((entry) => entry.action);

    expect(storedUser?.role).toBe("admin");
    expect(storedUser?.passwordHash).toStartWith("$argon2id$");
    expect(storedUser?.passwordHash).not.toBe("correct-horse-battery-staple");
    expect(
      await Bun.password.verify("correct-horse-battery-staple", storedUser?.passwordHash ?? ""),
    ).toBe(true);
    expect(storedSession?.userId).toBe(storedUser?.id);
    expect(storedSession?.tokenHash).toBe(hashSessionToken(sessionToken));
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
    expect(createdUser?.passwordHash).toStartWith("$argon2id$");
    expect(createdUser?.passwordHash).not.toBe("correct-horse-battery-staple");
    expect(auditActions).toContain("admin.users.created");
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
      username: input.username,
      email: input.email,
      passwordHash: await hashPassword(input.password),
      role: input.role,
      createdAt: now,
      updatedAt: now,
    })
    .run();
}

async function loginAndReadCookie(app: TestAppContext["app"]): Promise<string> {
  const loginResponse = await app.handle(
    csrfJsonRequest("/api/auth/login", {
      email: "admin@example.local",
      password: "correct-horse-battery-staple",
    }),
  );

  expect(loginResponse.status).toBe(200);

  return toCookieHeader(loginResponse.headers.get("set-cookie") ?? "");
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
