import type {
  ApiErrorResponse,
  CreateAdminRequest,
  LoginRequest,
  PublicUser,
  UserRole,
} from "@arrweeb-anime/shared";
import { eq, sql } from "drizzle-orm";
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
    const user = await createInitialAdminUser(input, now);
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
          id: crypto.randomUUID(),
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

  private createSession(
    user: User,
    context: AuthRequestContext,
    now = new Date(),
  ): { sessionId: string; sessionToken: string; expiresAt: Date } {
    const expiresAt = createSessionExpiresAt(now);
    const sessionToken = generateSessionToken();
    const sessionId = crypto.randomUUID();

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
        id: crypto.randomUUID(),
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

async function createInitialAdminUser(input: CreateAdminRequest, now: Date): Promise<User> {
  return {
    id: crypto.randomUUID(),
    username: input.username.trim(),
    email: normalizeEmail(input.email),
    passwordHash: await hashPassword(input.password),
    role: "admin",
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
