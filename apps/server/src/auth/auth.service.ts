import type {
  ApiErrorResponse,
  ChangePasswordRequest,
  ChangePasswordResponse,
  CreateAdminRequest,
  CreateLocalUserRequest,
  LoginRequest,
  PublicUser,
  UpdateUserProfileRequest,
  UserRole,
} from "@arrtemplar/shared";
import { eq, or, sql } from "drizzle-orm";
import type { DatabaseClient } from "../db/client";
import { auditLogs, sessions, type User, users } from "../db/schema";
import { hashPassword, verifyPassword } from "./password";
import { LoginRateLimiter } from "./rate-limit";
import { createSessionExpiresAt, generateSessionToken, hashSessionToken } from "./session-token";

export type AuthRequestContext = {
  ipAddress: string | null;
  userAgent: string | null;
};

export type LoginSuccess = {
  ok: true;
  user: PublicUser;
  sessionToken: string;
  expiresAt: Date;
};

export type LoginFailure = {
  ok: false;
  status: 401 | 429;
  body: ApiErrorResponse;
};

export type LoginResult = LoginSuccess | LoginFailure;

export type CreateAdminSuccess = {
  ok: true;
  user: PublicUser;
  sessionToken: string;
  expiresAt: Date;
};

export type CreateAdminFailure = {
  ok: false;
  status: 409;
  body: ApiErrorResponse;
};

export type CreateAdminResult = CreateAdminSuccess | CreateAdminFailure;

type CreateLocalUserSuccess = {
  ok: true;
  user: PublicUser;
};

type CreateLocalUserFailure = {
  ok: false;
  status: 409;
  body: ApiErrorResponse;
};

type CreateLocalUserResult = CreateLocalUserSuccess | CreateLocalUserFailure;

type UserProfileSuccess = {
  ok: true;
  user: PublicUser;
};

type UserProfileFailure = {
  ok: false;
  status: 401;
  body: ApiErrorResponse;
};

type UserProfileResult = UserProfileSuccess | UserProfileFailure;

type UpdateUserProfileFailure = {
  ok: false;
  status: 401 | 409;
  body: ApiErrorResponse;
};

type UpdateUserProfileResult = UserProfileSuccess | UpdateUserProfileFailure;

type ChangePasswordSuccess = {
  ok: true;
  body: ChangePasswordResponse;
};

type ChangePasswordFailure = {
  ok: false;
  status: 401;
  body: ApiErrorResponse;
};

type ChangePasswordResult = ChangePasswordSuccess | ChangePasswordFailure;

const invalidCredentialsError: ApiErrorResponse = {
  error: {
    code: "INVALID_CREDENTIALS",
    message: "Invalid email or password.",
  },
};

const rateLimitedError: ApiErrorResponse = {
  error: {
    code: "RATE_LIMITED",
    message: "Too many failed login attempts. Try again later.",
  },
};

const unauthenticatedError: ApiErrorResponse = {
  error: {
    code: "UNAUTHENTICATED",
    message: "Authentication is required.",
  },
};

const forbiddenError: ApiErrorResponse = {
  error: {
    code: "FORBIDDEN",
    message: "Admin role is required.",
  },
};

const setupAlreadyCompleteError: ApiErrorResponse = {
  error: {
    code: "SETUP_ALREADY_COMPLETE",
    message: "Admin setup is already complete.",
  },
};

const userAlreadyExistsError: ApiErrorResponse = {
  error: {
    code: "USER_ALREADY_EXISTS",
    message: "A user with that username or email already exists.",
  },
};

const invalidCurrentPasswordError: ApiErrorResponse = {
  error: {
    code: "INVALID_CURRENT_PASSWORD",
    message: "Current password is incorrect.",
  },
};

export class AuthService {
  constructor(
    private readonly database: DatabaseClient,
    private readonly rateLimiter = new LoginRateLimiter(),
  ) {}

  isSetupRequired(): boolean {
    return this.countUsers() === 0;
  }

  async createInitialAdmin(
    input: CreateAdminRequest,
    context: AuthRequestContext,
  ): Promise<CreateAdminResult> {
    if (!this.isSetupRequired()) {
      return { ok: false, status: 409, body: setupAlreadyCompleteError };
    }

    const now = new Date();
    const user = await createUserRecord(input, "admin", now);
    const created = this.insertInitialAdmin(user, context, now);

    if (!created) {
      return { ok: false, status: 409, body: setupAlreadyCompleteError };
    }

    const session = this.createSession(user, context, now);

    return {
      ok: true,
      user: toPublicUser(user),
      sessionToken: session.sessionToken,
      expiresAt: session.expiresAt,
    };
  }

  async createLocalUser(
    input: CreateLocalUserRequest,
    actor: PublicUser,
    context: AuthRequestContext,
  ): Promise<CreateLocalUserResult> {
    const now = new Date();
    const user = await createUserRecord(input, "user", now);
    const created = this.insertLocalUser(user, actor, context, now);

    if (!created) {
      return { ok: false, status: 409, body: userAlreadyExistsError };
    }

    return { ok: true, user: toPublicUser(user) };
  }

  async login(input: LoginRequest, context: AuthRequestContext): Promise<LoginResult> {
    const email = normalizeEmail(input.email);
    const rateLimitKey = createRateLimitKey(email, context.ipAddress);

    if (this.rateLimiter.isBlocked(rateLimitKey)) {
      this.writeAuditLog({
        action: "auth.login.rate_limited",
        metadata: { email },
        ipAddress: context.ipAddress,
      });

      return { ok: false, status: 429, body: rateLimitedError };
    }

    const user = this.database.db.select().from(users).where(eq(users.email, email)).get();
    const passwordMatches = user ? await verifyPassword(input.password, user.passwordHash) : false;

    if (!user || user.disabledAt || !passwordMatches) {
      this.rateLimiter.recordFailure(rateLimitKey);
      this.writeAuditLog({
        action: "auth.login.failed",
        actorUserId: user?.id ?? null,
        targetType: "user",
        targetId: user?.id ?? null,
        metadata: { email },
        ipAddress: context.ipAddress,
      });

      return { ok: false, status: 401, body: invalidCredentialsError };
    }

    this.rateLimiter.clear(rateLimitKey);

    const now = new Date();
    const session = this.createSession(user, context, now);

    this.database.db
      .update(users)
      .set({ lastLoginAt: now.toISOString(), updatedAt: now.toISOString() })
      .where(eq(users.id, user.id))
      .run();

    const updatedUser = { ...user, lastLoginAt: now.toISOString(), updatedAt: now.toISOString() };

    this.writeAuditLog({
      action: "auth.login.success",
      actorUserId: user.id,
      targetType: "session",
      targetId: session.sessionId,
      metadata: { email },
      ipAddress: context.ipAddress,
    });

    return {
      ok: true,
      user: toPublicUser(updatedUser),
      sessionToken: session.sessionToken,
      expiresAt: session.expiresAt,
    };
  }

  logout(sessionToken: string | null, context: AuthRequestContext): void {
    const currentSession = this.findSession(sessionToken);

    if (!currentSession) {
      return;
    }

    this.database.db.delete(sessions).where(eq(sessions.id, currentSession.session.id)).run();

    this.writeAuditLog({
      action: "auth.logout",
      actorUserId: currentSession.user.id,
      targetType: "session",
      targetId: currentSession.session.id,
      ipAddress: context.ipAddress,
    });
  }

  getCurrentUser(sessionToken: string | null): PublicUser | null {
    const currentSession = this.findSession(sessionToken);

    return currentSession ? toPublicUser(currentSession.user) : null;
  }

  getUserProfile(sessionToken: string | null): UserProfileResult {
    const user = this.getCurrentUser(sessionToken);

    if (!user) {
      return { ok: false, status: 401, body: unauthenticatedError };
    }

    return { ok: true, user };
  }

  updateUserProfile(
    sessionToken: string | null,
    input: UpdateUserProfileRequest,
    context: AuthRequestContext,
  ): UpdateUserProfileResult {
    const currentSession = this.findSession(sessionToken);

    if (!currentSession) {
      return { ok: false, status: 401, body: unauthenticatedError };
    }

    const username = input.username?.trim();
    const email = input.email ? normalizeEmail(input.email) : undefined;
    const existingUser = this.findUserByUsernameOrEmail(username, email);

    if (existingUser && existingUser.id !== currentSession.user.id) {
      return { ok: false, status: 409, body: userAlreadyExistsError };
    }

    if (!username && !email) {
      return { ok: true, user: toPublicUser(currentSession.user) };
    }

    const now = new Date().toISOString();
    this.database.db
      .update(users)
      .set({
        ...(username ? { username } : {}),
        ...(email ? { email } : {}),
        updatedAt: now,
      })
      .where(eq(users.id, currentSession.user.id))
      .run();

    const updatedUser = this.database.db
      .select()
      .from(users)
      .where(eq(users.id, currentSession.user.id))
      .get();

    if (!updatedUser) {
      return { ok: false, status: 401, body: unauthenticatedError };
    }

    this.writeAuditLog({
      action: "user.profile.updated",
      actorUserId: currentSession.user.id,
      targetType: "user",
      targetId: currentSession.user.id,
      metadata: { username: updatedUser.username, email: updatedUser.email },
      ipAddress: context.ipAddress,
    });

    return { ok: true, user: toPublicUser(updatedUser) };
  }

  async changePassword(
    sessionToken: string | null,
    input: ChangePasswordRequest,
    context: AuthRequestContext,
  ): Promise<ChangePasswordResult> {
    const currentSession = this.findSession(sessionToken);

    if (!currentSession) {
      return { ok: false, status: 401, body: unauthenticatedError };
    }

    const passwordMatches = await verifyPassword(
      input.currentPassword,
      currentSession.user.passwordHash,
    );

    if (!passwordMatches) {
      this.writeAuditLog({
        action: "user.password.change_failed",
        actorUserId: currentSession.user.id,
        targetType: "user",
        targetId: currentSession.user.id,
        ipAddress: context.ipAddress,
      });

      return { ok: false, status: 401, body: invalidCurrentPasswordError };
    }

    const now = new Date().toISOString();
    this.database.db
      .update(users)
      .set({ passwordHash: await hashPassword(input.newPassword), updatedAt: now })
      .where(eq(users.id, currentSession.user.id))
      .run();

    this.writeAuditLog({
      action: "user.password.changed",
      actorUserId: currentSession.user.id,
      targetType: "user",
      targetId: currentSession.user.id,
      ipAddress: context.ipAddress,
    });

    return { ok: true, body: { status: "ok" } };
  }

  requireUser(
    sessionToken: string | null,
  ): { ok: true; user: PublicUser } | { ok: false; body: ApiErrorResponse } {
    const user = this.getCurrentUser(sessionToken);

    if (!user) {
      return { ok: false, body: unauthenticatedError };
    }

    return { ok: true, user };
  }

  requireRole(
    sessionToken: string | null,
    role: UserRole,
  ): { ok: true; user: PublicUser } | { ok: false; status: 401 | 403; body: ApiErrorResponse } {
    const userResult = this.requireUser(sessionToken);

    if (!userResult.ok) {
      return { ok: false, status: 401, body: userResult.body };
    }

    if (userResult.user.role !== role) {
      this.writeAuditLog({
        action: "admin.auth.denied",
        actorUserId: userResult.user.id,
        targetType: "role",
        targetId: role,
      });

      return { ok: false, status: 403, body: forbiddenError };
    }

    return { ok: true, user: userResult.user };
  }

  recordAdminAuthCheck(user: PublicUser, context: AuthRequestContext): void {
    this.writeAuditLog({
      action: "admin.auth.check",
      actorUserId: user.id,
      targetType: "user",
      targetId: user.id,
      ipAddress: context.ipAddress,
    });
  }

  private findSession(
    sessionToken: string | null,
  ): { session: typeof sessions.$inferSelect; user: User } | null {
    if (!sessionToken) {
      return null;
    }

    const tokenHash = hashSessionToken(sessionToken);
    const session = this.database.db
      .select()
      .from(sessions)
      .where(eq(sessions.tokenHash, tokenHash))
      .get();

    if (!session) {
      return null;
    }

    if (new Date(session.expiresAt).getTime() <= Date.now()) {
      this.database.db.delete(sessions).where(eq(sessions.id, session.id)).run();
      return null;
    }

    const user = this.database.db.select().from(users).where(eq(users.id, session.userId)).get();

    if (!user || user.disabledAt) {
      return null;
    }

    return { session, user };
  }

  private countUsers(): number {
    const { count } = this.database.db
      .select({ count: sql<number>`count(*)`.mapWith(Number) })
      .from(users)
      .get() ?? { count: 0 };

    return count;
  }

  private findUserByUsernameOrEmail(
    username: string | undefined,
    email: string | undefined,
  ): User | undefined {
    if (username && email) {
      return this.database.db
        .select()
        .from(users)
        .where(or(eq(users.username, username), eq(users.email, email)))
        .get();
    }

    if (username) {
      return this.database.db.select().from(users).where(eq(users.username, username)).get();
    }

    if (email) {
      return this.database.db.select().from(users).where(eq(users.email, email)).get();
    }

    return undefined;
  }

  private insertInitialAdmin(user: User, context: AuthRequestContext, now: Date): boolean {
    return this.database.db.transaction((tx) => {
      const { count } = tx
        .select({ count: sql<number>`count(*)`.mapWith(Number) })
        .from(users)
        .get() ?? { count: 0 };

      if (count !== 0) {
        return false;
      }

      tx.insert(users).values(user).run();
      tx.insert(auditLogs)
        .values({
          id: Bun.randomUUIDv7(),
          actorUserId: user.id,
          action: "auth.setup.admin_created",
          targetType: "user",
          targetId: user.id,
          metadataJson: JSON.stringify({ username: user.username, email: user.email }),
          ipAddress: context.ipAddress,
          createdAt: now.toISOString(),
        })
        .run();

      return true;
    });
  }

  private insertLocalUser(
    user: User,
    actor: PublicUser,
    context: AuthRequestContext,
    now: Date,
  ): boolean {
    return this.database.db.transaction((tx) => {
      const existingUser = tx
        .select({ id: users.id })
        .from(users)
        .where(or(eq(users.username, user.username), eq(users.email, user.email)))
        .get();

      if (existingUser) {
        return false;
      }

      tx.insert(users).values(user).run();
      tx.insert(auditLogs)
        .values({
          id: Bun.randomUUIDv7(),
          actorUserId: actor.id,
          action: "admin.users.created",
          targetType: "user",
          targetId: user.id,
          metadataJson: JSON.stringify({ username: user.username, email: user.email }),
          ipAddress: context.ipAddress,
          createdAt: now.toISOString(),
        })
        .run();

      return true;
    });
  }

  private createSession(
    user: User,
    context: AuthRequestContext,
    now = new Date(),
  ): { sessionId: string; sessionToken: string; expiresAt: Date } {
    const expiresAt = createSessionExpiresAt(now);
    const sessionToken = generateSessionToken();
    const sessionId = Bun.randomUUIDv7();

    this.database.db
      .insert(sessions)
      .values({
        id: sessionId,
        userId: user.id,
        tokenHash: hashSessionToken(sessionToken),
        expiresAt: expiresAt.toISOString(),
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        createdAt: now.toISOString(),
      })
      .run();

    return { sessionId, sessionToken, expiresAt };
  }

  private writeAuditLog(input: {
    action: string;
    actorUserId?: string | null;
    targetType?: string | null;
    targetId?: string | null;
    metadata?: Record<string, unknown>;
    ipAddress?: string | null;
  }): void {
    this.database.db
      .insert(auditLogs)
      .values({
        id: Bun.randomUUIDv7(),
        actorUserId: input.actorUserId ?? null,
        action: input.action,
        targetType: input.targetType ?? null,
        targetId: input.targetId ?? null,
        metadataJson: input.metadata ? JSON.stringify(input.metadata) : null,
        ipAddress: input.ipAddress ?? null,
        createdAt: new Date().toISOString(),
      })
      .run();
  }
}

function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt,
  };
}

async function createUserRecord(
  input: CreateAdminRequest | CreateLocalUserRequest,
  role: UserRole,
  now: Date,
): Promise<User> {
  return {
    id: Bun.randomUUIDv7(),
    username: input.username.trim(),
    email: normalizeEmail(input.email),
    passwordHash: await hashPassword(input.password),
    role,
    disabledAt: null,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    lastLoginAt: null,
  };
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function createRateLimitKey(email: string, ipAddress: string | null): string {
  return `${ipAddress ?? "unknown"}:${email}`;
}
