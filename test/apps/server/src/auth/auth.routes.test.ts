import { afterEach, describe, expect, it } from "bun:test";
import { createApp } from "../../../../../apps/server/src/app";
import { hashPassword } from "../../../../../apps/server/src/auth/password";
import { LoginRateLimiter } from "../../../../../apps/server/src/auth/rate-limit";
import {
  hashSessionToken,
  SESSION_COOKIE_NAME,
} from "../../../../../apps/server/src/auth/session-token";
import type { DatabaseClient } from "../../../../../apps/server/src/db/client";
import { auditLogs, sessions, users } from "../../../../../apps/server/src/db/schema";
import { seedAdminUserWithDatabase } from "../../../../../apps/server/src/db/seed";
import { resetAndOpenTestDatabase } from "../../../../helpers/database";

const openDatabases: DatabaseClient[] = [];

afterEach(() => {
  for (const database of openDatabases.splice(0)) {
    database.close();
  }
});

describe("auth routes", () => {
  it("logs in an admin, sets a secure HttpOnly cookie, exposes /me, and logs out", async () => {
    const { app, database } = await createAuthTestApp();

    const loginResponse = await app.handle(
      jsonRequest("/api/auth/login", {
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
    expect(setCookie).toContain(`${SESSION_COOKIE_NAME}=`);
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("Secure");
    expect(setCookie).toContain("SameSite=Lax");
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
      new Request("http://localhost/api/auth/logout", {
        method: "POST",
        headers: { cookie: cookieHeader },
      }),
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
      jsonRequest("/api/auth/login", {
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
    expect(
      database.db
        .select()
        .from(auditLogs)
        .all()
        .map((entry) => entry.action),
    ).toContain("auth.login.failed");
  });

  it("rate-limits repeated failed logins", async () => {
    const { app } = await createAuthTestApp(new LoginRateLimiter(2, 15 * 60 * 1000));
    const body = { email: "admin@example.local", password: "wrong-password" };

    const first = await app.handle(jsonRequest("/api/auth/login", body));
    const second = await app.handle(jsonRequest("/api/auth/login", body));
    const third = await app.handle(jsonRequest("/api/auth/login", body));
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
      jsonRequest("/api/auth/login", {
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
});

async function createAuthTestApp(rateLimiter = new LoginRateLimiter()): Promise<{
  app: ReturnType<typeof createApp>;
  database: DatabaseClient;
}> {
  const database = await resetAndOpenTestDatabase();
  openDatabases.push(database);

  await seedAdminUserWithDatabase(
    {
      username: "admin",
      email: "admin@example.local",
      password: "correct-horse-battery-staple",
    },
    database,
  );

  const now = new Date().toISOString();
  database.db
    .insert(users)
    .values({
      id: crypto.randomUUID(),
      username: "viewer",
      email: "viewer@example.local",
      passwordHash: await hashPassword("correct-horse-battery-staple"),
      role: "user",
      createdAt: now,
      updatedAt: now,
    })
    .run();

  return {
    app: createApp({ database, sessionCookieSecure: true, loginRateLimiter: rateLimiter }),
    database,
  };
}

function jsonRequest(path: string, body: unknown): Request {
  return new Request(`http://localhost${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": "127.0.0.1" },
    body: JSON.stringify(body),
  });
}

function toCookieHeader(setCookie: string): string {
  return setCookie.split(";")[0] ?? "";
}

function readCookieValue(cookieHeader: string): string {
  return cookieHeader.slice(`${SESSION_COOKIE_NAME}=`.length);
}
