import {
  type AdminChangeUserPasswordRequest,
  type AdminChangeUserPasswordResponse,
  type AdminChangeUserRoleRequest,
  type AdminDisableUserRequest,
  type AdminUpdateUserPermissionsRequest,
  type AdminUpdateUserStatusRequest,
  type AdminUserSummary,
  type ApiErrorResponse,
  type ChangePasswordRequest,
  type ChangePasswordResponse,
  type CreateAdminRequest,
  type CreateLocalUserRequest,
  type LoginRequest,
  type PublicUser,
  type UpdateUserProfileRequest,
  USER_PERMISSION_VALUES,
  type UserPermission,
  type UserRole,
} from "@arrtemplar/shared";
import { and, eq, ne, or, sql } from "drizzle-orm";
import type { DatabaseClient } from "../db/client";
import { auditLogs, sessions, type User, userPermissionGrants, users } from "../db/schema";
import { hashPassword, verifyPassword } from "./password";
import { generatePublicUserId } from "./public-user-id";
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
  status: 401 | 403 | 409;
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

type AdminUsersListSuccess = {
  ok: true;
  users: AdminUserSummary[];
};

type AdminUserMutationSuccess = {
  ok: true;
  user: AdminUserSummary;
};

type AdminChangeUserPasswordSuccess = {
  ok: true;
  body: AdminChangeUserPasswordResponse;
};

type AdminUserMutationFailure = {
  ok: false;
  status: 401 | 403 | 404 | 409;
  body: ApiErrorResponse;
};

type AdminUsersListResult = AdminUsersListSuccess;
type AdminUserMutationResult = AdminUserMutationSuccess | AdminUserMutationFailure;
type AdminChangeUserPasswordResult = AdminChangeUserPasswordSuccess | AdminUserMutationFailure;

type DatabaseTransaction = Parameters<Parameters<DatabaseClient["db"]["transaction"]>[0]>[0];
type AdminUserUpdateValues = Partial<
  Pick<User, "disabledAt" | "passwordHash" | "role" | "updatedAt">
>;

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

const targetUserNotFoundError: ApiErrorResponse = {
  error: {
    code: "USER_NOT_FOUND",
    message: "User account was not found.",
  },
};

const invalidPermissionTargetError: ApiErrorResponse = {
  error: {
    code: "INVALID_PERMISSION_TARGET",
    message: "Permissions can only be granted to mod accounts.",
  },
};

const permissionOrder = new Map<UserPermission, number>(
  USER_PERMISSION_VALUES.map((permission, index) => [permission, index]),
);

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
      user: toPublicUser(user, readEffectivePermissions(this.database.db, user)),
      sessionToken: session.sessionToken,
      expiresAt: session.expiresAt,
    };
  }

  async createLocalUser(
    input: CreateLocalUserRequest,
    actor: PublicUser,
    context: AuthRequestContext,
  ): Promise<CreateLocalUserResult> {
    const actorResult = this.readActiveAdminActor(actor);

    if (!actorResult.ok) {
      return actorResult;
    }

    const now = new Date();
    const user = await createUserRecord(input, "user", now);
    const created = this.insertLocalUser(user, actorResult.actor, context, now);

    if (!created) {
      return { ok: false, status: 409, body: userAlreadyExistsError };
    }

    return { ok: true, user: toPublicUser(user, readEffectivePermissions(this.database.db, user)) };
  }

  listAdminUsers(): AdminUsersListResult {
    const userSummaries = this.database.db
      .select({
        internalId: users.id,
        id: users.publicId,
        username: users.username,
        role: users.role,
        disabledAt: users.disabledAt,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      })
      .from(users)
      .where(ne(users.role, "admin"))
      .all();
    const permissionsByUserId = readPermissionGrantsByUserId(this.database.db);
    const summaries = userSummaries
      .map((user): AdminUserSummary => {
        if (user.role === "admin") {
          throw new Error("Admin accounts cannot be listed as managed users.");
        }

        return {
          id: user.id,
          username: user.username,
          role: user.role,
          disabledAt: user.disabledAt,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
          permissions: permissionsByUserId.get(user.internalId) ?? [],
        };
      })
      .sort((left, right) => left.username.localeCompare(right.username));

    return { ok: true, users: summaries };
  }

  updateAdminManagedUserPermissions(
    targetUserId: string,
    input: AdminUpdateUserPermissionsRequest,
    actor: PublicUser,
    context: AuthRequestContext,
  ): AdminUserMutationResult {
    return this.runAdminUserMutation({
      actor,
      context,
      targetUserId,
      mutate: (tx, targetUser, actorUser, now) => {
        if (targetUser.role !== "mod") {
          return { ok: false, status: 409, body: invalidPermissionTargetError };
        }

        const permissions = normalizePermissions(input.permissions);

        tx.delete(userPermissionGrants).where(eq(userPermissionGrants.userId, targetUser.id)).run();

        if (permissions.length > 0) {
          tx.insert(userPermissionGrants)
            .values(
              permissions.map((permission) => ({
                id: Bun.randomUUIDv7(),
                userId: targetUser.id,
                permission,
                grantedByUserId: actorUser.id,
                createdAt: now,
                updatedAt: now,
              })),
            )
            .run();
        }

        tx.update(users).set({ updatedAt: now }).where(eq(users.id, targetUser.id)).run();
        revokeUserSessions(tx, targetUser.id);
        writeAdminUserAuditLog(tx, {
          action: "admin.users.permissions_changed",
          actorUserId: actorUser.id,
          context,
          createdAt: now,
          metadata: { permissions },
          targetUser,
        });

        return readAdminUserMutationSuccess(tx, targetUserId);
      },
    });
  }

  async changeAdminManagedUserPassword(
    targetUserId: string,
    input: AdminChangeUserPasswordRequest,
    actor: PublicUser,
    context: AuthRequestContext,
  ): Promise<AdminChangeUserPasswordResult> {
    const passwordHash = await hashPassword(input.password);

    return this.runAdminUserMutation({
      actor,
      context,
      targetUserId,
      mutate: (tx, targetUser, actorUser, now) => {
        updateAdminUserAndRevokeSessions(
          tx,
          targetUser,
          { passwordHash, updatedAt: now },
          {
            action: "admin.users.password_changed",
            actorUserId: actorUser.id,
            context,
            createdAt: now,
          },
        );

        return { ok: true, body: { status: "ok" } };
      },
    });
  }

  changeAdminManagedUserRole(
    targetUserId: string,
    input: AdminChangeUserRoleRequest,
    actor: PublicUser,
    context: AuthRequestContext,
  ): AdminUserMutationResult {
    return this.runAdminUserMutation({
      actor,
      context,
      targetUserId,
      mutate: (tx, targetUser, actorUser, now) => {
        if (targetUser.role !== input.role) {
          updateAdminUserAndRevokeSessions(
            tx,
            targetUser,
            { role: input.role, updatedAt: now },
            {
              action: "admin.users.role_changed",
              actorUserId: actorUser.id,
              context,
              createdAt: now,
              metadata: { previousRole: targetUser.role, role: input.role },
            },
          );
        }

        return readAdminUserMutationSuccess(tx, targetUserId);
      },
    });
  }

  disableAdminManagedUser(
    targetUserId: string,
    _input: AdminDisableUserRequest,
    actor: PublicUser,
    context: AuthRequestContext,
  ): AdminUserMutationResult {
    return this.runAdminUserMutation({
      actor,
      context,
      targetUserId,
      mutate: (tx, targetUser, actorUser, now) => {
        if (!targetUser.disabledAt) {
          updateAdminUserAndRevokeSessions(
            tx,
            targetUser,
            { disabledAt: now, updatedAt: now },
            {
              action: "admin.users.disabled",
              actorUserId: actorUser.id,
              context,
              createdAt: now,
            },
          );
        }

        return readAdminUserMutationSuccess(tx, targetUserId);
      },
    });
  }

  updateAdminManagedUserStatus(
    targetUserId: string,
    input: AdminUpdateUserStatusRequest,
    actor: PublicUser,
    context: AuthRequestContext,
  ): AdminUserMutationResult {
    return this.runAdminUserMutation({
      actor,
      context,
      targetUserId,
      mutate: (tx, targetUser, actorUser, now) => {
        if (!input.disabled && targetUser.disabledAt) {
          updateAdminUserAndRevokeSessions(
            tx,
            targetUser,
            { disabledAt: null, updatedAt: now },
            {
              action: "admin.users.enabled",
              actorUserId: actorUser.id,
              context,
              createdAt: now,
            },
          );
        }

        return readAdminUserMutationSuccess(tx, targetUserId);
      },
    });
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
      user: toPublicUser(updatedUser, readEffectivePermissions(this.database.db, updatedUser)),
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

    return currentSession
      ? toPublicUser(
          currentSession.user,
          readEffectivePermissions(this.database.db, currentSession.user),
        )
      : null;
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
      return {
        ok: true,
        user: toPublicUser(
          currentSession.user,
          readEffectivePermissions(this.database.db, currentSession.user),
        ),
      };
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

    return {
      ok: true,
      user: toPublicUser(updatedUser, readEffectivePermissions(this.database.db, updatedUser)),
    };
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

  requireRole(
    sessionToken: string | null,
    role: UserRole,
  ): { ok: true; user: PublicUser } | { ok: false; status: 401 | 403; body: ApiErrorResponse } {
    const currentSession = this.findSession(sessionToken);

    if (!currentSession) {
      return { ok: false, status: 401, body: unauthenticatedError };
    }

    if (currentSession.user.role !== role) {
      this.writeAuditLog({
        action: "admin.auth.denied",
        actorUserId: currentSession.user.id,
        targetType: "role",
        targetId: role,
      });

      return { ok: false, status: 403, body: forbiddenError };
    }

    return {
      ok: true,
      user: toPublicUser(
        currentSession.user,
        readEffectivePermissions(this.database.db, currentSession.user),
      ),
    };
  }

  recordAdminAuthCheck(user: PublicUser, context: AuthRequestContext): void {
    const actorUser = this.findUserByPublicId(user.id);

    this.writeAuditLog({
      action: "admin.auth.check",
      actorUserId: actorUser?.id ?? null,
      targetType: "user",
      targetId: actorUser?.id ?? null,
      ipAddress: context.ipAddress,
    });
  }

  private readActiveAdminActor(
    actor: PublicUser,
  ): { ok: true; actor: User } | { ok: false; status: 401 | 403; body: ApiErrorResponse } {
    const actorUser = this.findUserByPublicId(actor.id);

    if (!actorUser || actorUser.disabledAt) {
      return { ok: false, status: 401, body: unauthenticatedError };
    }

    if (actorUser.role !== "admin") {
      return { ok: false, status: 403, body: forbiddenError };
    }

    return { ok: true, actor: actorUser };
  }

  private runAdminUserMutation<
    T extends AdminChangeUserPasswordSuccess | AdminUserMutationSuccess,
  >(input: {
    actor: PublicUser;
    context: AuthRequestContext;
    mutate: (
      tx: DatabaseTransaction,
      targetUser: User,
      actorUser: User,
      now: string,
    ) => T | AdminUserMutationFailure;
    targetUserId: string;
  }): T | AdminUserMutationFailure {
    const actorResult = this.readActiveAdminActor(input.actor);

    if (!actorResult.ok) {
      return actorResult;
    }

    const now = new Date().toISOString();

    return this.database.db.transaction((tx) => {
      const targetUser = readManagedTargetUser(tx, input.targetUserId);

      if (!targetUser) {
        return { ok: false, status: 404, body: targetUserNotFoundError };
      }

      return input.mutate(tx, targetUser, actorResult.actor, now);
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

  private findUserByPublicId(publicUserId: string): User | undefined {
    return this.database.db.select().from(users).where(eq(users.publicId, publicUserId)).get();
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
    actor: User,
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

function toPublicUser(user: User, permissions: UserPermission[]): PublicUser {
  return {
    id: user.publicId,
    username: user.username,
    email: user.email,
    role: user.role,
    permissions,
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt,
  };
}

function toAdminUserSummary(user: User): AdminUserSummary {
  if (user.role === "admin") {
    throw new Error("Admin accounts cannot be summarized as managed users.");
  }

  return {
    id: user.publicId,
    username: user.username,
    role: user.role,
    disabledAt: user.disabledAt,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    permissions: [],
  };
}

function readManagedTargetUser(tx: DatabaseTransaction, targetUserId: string): User | null {
  return (
    tx
      .select()
      .from(users)
      .where(and(eq(users.publicId, targetUserId), ne(users.role, "admin")))
      .get() ?? null
  );
}

function readAdminUserMutationSuccess(
  tx: DatabaseTransaction,
  targetUserId: string,
): AdminUserMutationResult {
  const updatedUser = readManagedTargetUser(tx, targetUserId);

  if (!updatedUser) {
    return { ok: false, status: 404, body: targetUserNotFoundError };
  }

  return {
    ok: true,
    user: {
      ...toAdminUserSummary(updatedUser),
      permissions: readPermissionGrants(tx, updatedUser.id),
    },
  };
}

function readPermissionGrantsByUserId(
  tx: DatabaseTransaction | DatabaseClient["db"],
): Map<string, UserPermission[]> {
  const permissionsByUserId = new Map<string, UserPermission[]>();

  for (const grant of tx
    .select({ permission: userPermissionGrants.permission, userId: userPermissionGrants.userId })
    .from(userPermissionGrants)
    .all()) {
    permissionsByUserId.set(grant.userId, [
      ...(permissionsByUserId.get(grant.userId) ?? []),
      grant.permission,
    ]);
  }

  for (const [userId, permissions] of permissionsByUserId) {
    permissionsByUserId.set(userId, normalizePermissions(permissions));
  }

  return permissionsByUserId;
}

function readPermissionGrants(
  tx: DatabaseTransaction | DatabaseClient["db"],
  userId: string,
): UserPermission[] {
  return normalizePermissions(
    tx
      .select({ permission: userPermissionGrants.permission })
      .from(userPermissionGrants)
      .where(eq(userPermissionGrants.userId, userId))
      .all()
      .map((grant) => grant.permission),
  );
}

function readEffectivePermissions(
  tx: DatabaseTransaction | DatabaseClient["db"],
  user: User,
): UserPermission[] {
  if (user.role === "admin") {
    return [...USER_PERMISSION_VALUES];
  }

  if (user.role !== "mod") {
    return [];
  }

  return readPermissionGrants(tx, user.id);
}

function normalizePermissions(permissions: UserPermission[]): UserPermission[] {
  return [...new Set(permissions)].sort(
    (left, right) => (permissionOrder.get(left) ?? 0) - (permissionOrder.get(right) ?? 0),
  );
}

function updateAdminUserAndRevokeSessions(
  tx: DatabaseTransaction,
  targetUser: User,
  values: AdminUserUpdateValues,
  auditLog: {
    action: string;
    actorUserId: string;
    context: AuthRequestContext;
    createdAt: string;
    metadata?: Record<string, unknown>;
  },
): void {
  tx.update(users).set(values).where(eq(users.id, targetUser.id)).run();
  revokeUserSessions(tx, targetUser.id);
  writeAdminUserAuditLog(tx, { ...auditLog, targetUser });
}

function revokeUserSessions(tx: DatabaseTransaction, targetUserId: string): void {
  tx.delete(sessions).where(eq(sessions.userId, targetUserId)).run();
}

function writeAdminUserAuditLog(
  tx: DatabaseTransaction,
  input: {
    action: string;
    actorUserId: string;
    context: AuthRequestContext;
    createdAt: string;
    metadata?: Record<string, unknown>;
    targetUser: User;
  },
): void {
  tx.insert(auditLogs)
    .values({
      id: Bun.randomUUIDv7(),
      actorUserId: input.actorUserId,
      action: input.action,
      targetType: "user",
      targetId: input.targetUser.id,
      metadataJson: JSON.stringify({
        username: input.targetUser.username,
        ...(input.metadata ?? {}),
      }),
      ipAddress: input.context.ipAddress,
      createdAt: input.createdAt,
    })
    .run();
}

async function createUserRecord(
  input: CreateAdminRequest | CreateLocalUserRequest,
  role: UserRole,
  now: Date,
): Promise<User> {
  return {
    id: Bun.randomUUIDv7(),
    publicId: generatePublicUserId(),
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
