import {
  type AdminChangeUserPasswordRequest,
  type AdminChangeUserPasswordResponse,
  type AdminDeleteUserResponse,
  type AdminUpdateUserPermissionsRequest,
  type AdminUpdateUserStatusRequest,
  type ApiErrorResponse,
  type CreateAdminRequest,
  type CreateLocalUserRequest,
  DEFAULT_NOTIFICATION_PREFERENCES,
  DEFAULT_PROFILE_AVATAR_ID,
  DEFAULT_PROFILE_BANNER_ID,
  hasPermissionGrant,
  isUserPermission,
  type ManagedUserProfile,
  type ManagedUserSummary,
  normalizePermissionList,
  type PublicUser,
  SYSTEM_ADMIN_PERMISSION,
  type UpdateManagedUserProfileRequest,
  type UserPermission,
} from "@arrtemplar/shared";
import { eq } from "drizzle-orm";
import { writeAuditLog } from "../audit/audit-log";
import type { DatabaseClient } from "../db/client";
import { sessions, type User, userPermissionGrants, users } from "../db/schema";
import { findUserByUsernameOrEmail, normalizeEmail } from "./oauth-identity.helpers";
import { hashPassword } from "./password";
import {
  countActiveSystemAdmins,
  hasExplicitPermissionGrant,
  readEffectivePermissions,
  readEffectivePermissionsByUserId,
} from "./permissions";
import { generatePublicUserId } from "./public-user-id";
import { toManagedUserProfile, toManagedUserSummary } from "./user-mappers";

type AuthRequestContext = {
  ipAddress: string | null;
  path: string;
  userAgent: string | null;
};

type DatabaseTransaction = Parameters<Parameters<DatabaseClient["db"]["transaction"]>[0]>[0];
type ManagedUserUpdateValues = Partial<Pick<User, "disabledAt" | "passwordHash" | "updatedAt">>;

type PermissionCheckFailure = {
  ok: false;
  status: 401 | 403;
  body: ApiErrorResponse;
};

type CreateLocalUserSuccess = {
  ok: true;
  user: ManagedUserSummary;
};

type CreateLocalUserFailure = {
  ok: false;
  status: 401 | 403 | 409;
  body: ApiErrorResponse;
};

export type CreateLocalUserResult = CreateLocalUserSuccess | CreateLocalUserFailure;

type ManagedUsersListSuccess = {
  ok: true;
  users: ManagedUserSummary[];
};

type ManagedUserProfileSuccess = {
  ok: true;
  user: ManagedUserProfile;
};

type ManagedUserProfileFailure = {
  ok: false;
  status: 401 | 403 | 404;
  body: ApiErrorResponse;
};

type ManagedUserMutationSuccess = {
  ok: true;
  user: ManagedUserSummary;
};

type ManagedUserPasswordSuccess = {
  ok: true;
  body: AdminChangeUserPasswordResponse;
};

type ManagedUserDeleteSuccess = {
  ok: true;
  body: AdminDeleteUserResponse;
};

type ManagedUserMutationFailure = {
  ok: false;
  status: 401 | 403 | 404 | 409;
  body: ApiErrorResponse;
};

export type ManagedUsersListResult = ManagedUsersListSuccess | PermissionCheckFailure;
export type ManagedUserProfileResult = ManagedUserProfileSuccess | ManagedUserProfileFailure;
export type ManagedUserProfileMutationResult =
  | ManagedUserProfileSuccess
  | ManagedUserMutationFailure;
export type ManagedUserMutationResult = ManagedUserMutationSuccess | ManagedUserMutationFailure;
export type ManagedUserPasswordResult = ManagedUserPasswordSuccess | ManagedUserMutationFailure;
export type ManagedUserDeleteResult = ManagedUserDeleteSuccess | ManagedUserMutationFailure;

const unauthenticatedError: ApiErrorResponse = {
  error: {
    code: "UNAUTHENTICATED",
    message: "Authentication is required.",
  },
};

export const userAlreadyExistsError: ApiErrorResponse = {
  error: {
    code: "USER_ALREADY_EXISTS",
    message: "A user with that username or email already exists.",
  },
};

const targetUserNotFoundError: ApiErrorResponse = {
  error: {
    code: "USER_NOT_FOUND",
    message: "User account was not found.",
  },
};

const selfServiceOnlyError: ApiErrorResponse = {
  error: {
    code: "SELF_SERVICE_ONLY",
    message: "Use the self-service profile endpoints for your own account.",
  },
};

export const lastSystemAdminRequiredError: ApiErrorResponse = {
  error: {
    code: "LAST_SYSTEM_ADMIN_REQUIRED",
    message: "At least one active user must keep the system:admin permission.",
  },
};

export class ManagedUserService {
  constructor(private readonly database: DatabaseClient) {}

  async createLocalUser(
    input: CreateLocalUserRequest,
    actor: PublicUser,
    context: AuthRequestContext,
  ): Promise<CreateLocalUserResult> {
    const actorResult = this.readActiveManagedActor(actor, "users:create");

    if (!actorResult.ok) {
      return actorResult;
    }

    const now = new Date();
    const user = await createUserRecord(input, now);
    const created = this.insertLocalUser(user, actorResult.actor, context, now);

    if (!created) {
      return { ok: false, status: 409, body: userAlreadyExistsError };
    }

    return {
      ok: true,
      user: toManagedUserSummary(user, readEffectivePermissions(this.database.db, user)),
    };
  }

  listUsers(actor: PublicUser): ManagedUsersListResult {
    const actorResult = this.readActiveManagedActor(actor);

    if (!actorResult.ok) {
      return actorResult;
    }

    return { ok: true, users: this.readManagedUserSummaries() };
  }

  listUsersForApiKey(): ManagedUsersListResult {
    return { ok: true, users: this.readManagedUserSummaries() };
  }

  getManagedUserProfile(targetUserId: string, actor: PublicUser): ManagedUserProfileResult {
    const actorResult = this.readActiveManagedActor(actor);

    if (!actorResult.ok) {
      return actorResult;
    }

    return this.readManagedUserProfileByPublicId(targetUserId);
  }

  getManagedUserProfileForApiKey(targetUserId: string): ManagedUserProfileResult {
    return this.readManagedUserProfileByPublicId(targetUserId);
  }

  updateManagedUserProfile(
    targetUserId: string,
    input: UpdateManagedUserProfileRequest,
    actor: PublicUser,
    context: AuthRequestContext,
  ): ManagedUserProfileMutationResult {
    return this.runManagedUserMutation({
      actor,
      context,
      requiredPermission: "users:update",
      targetUserId,
      mutate: (tx, targetUser, actorUser, now) => {
        const username = input.username?.trim();
        const email = input.email ? normalizeEmail(input.email) : undefined;
        const avatarId = input.avatarId;
        const bannerId = input.bannerId;
        const existingUser = findUserByUsernameOrEmail(tx, username, email);

        if (existingUser && existingUser.id !== targetUser.id) {
          return { ok: false, status: 409, body: userAlreadyExistsError };
        }

        if (!username && !email && !avatarId && !bannerId) {
          return {
            ok: true,
            user: toManagedUserProfile(targetUser, readEffectivePermissions(tx, targetUser)),
          };
        }

        tx.update(users)
          .set({
            ...(username ? { username } : {}),
            ...(email ? { email } : {}),
            ...(avatarId ? { avatarId } : {}),
            ...(bannerId ? { bannerId } : {}),
            updatedAt: now,
          })
          .where(eq(users.id, targetUser.id))
          .run();

        const updatedUser = tx.select().from(users).where(eq(users.id, targetUser.id)).get();

        if (!updatedUser) {
          return { ok: false, status: 404, body: targetUserNotFoundError };
        }

        writeAuditLog(tx, {
          action: "users.profile.updated",
          actorUserId: actorUser.id,
          targetType: "user",
          targetId: updatedUser.id,
          ipAddress: context.ipAddress,
          createdAt: now,
          metadata: {
            username: updatedUser.username,
            email: updatedUser.email,
            avatarId: updatedUser.avatarId,
            bannerId: updatedUser.bannerId,
          },
        });

        return {
          ok: true,
          user: toManagedUserProfile(updatedUser, readEffectivePermissions(tx, updatedUser)),
        };
      },
    });
  }

  updateManagedUserPermissions(
    targetUserId: string,
    input: AdminUpdateUserPermissionsRequest,
    actor: PublicUser,
    context: AuthRequestContext,
  ): ManagedUserMutationResult {
    return this.runManagedUserMutation({
      actor,
      context,
      requiredPermission: "users:permissions",
      targetUserId,
      mutate: (tx, targetUser, actorUser, now) => {
        const permissions = normalizePermissionList(input.permissions.filter(isUserPermission));

        if (
          !permissions.includes(SYSTEM_ADMIN_PERMISSION) &&
          hasExplicitPermissionGrant(tx, targetUser.id, SYSTEM_ADMIN_PERMISSION) &&
          countActiveSystemAdmins(tx) <= 1
        ) {
          return { ok: false, status: 409, body: lastSystemAdminRequiredError };
        }

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
        writeAuditLog(tx, {
          action: "users.permissions.updated",
          actorUserId: actorUser.id,
          targetType: "user",
          targetId: targetUser.id,
          ipAddress: context.ipAddress,
          createdAt: now,
          metadata: { username: targetUser.username, permissions },
        });

        return readManagedUserSummarySuccess(tx, targetUser.id);
      },
    });
  }

  async changeManagedUserPassword(
    targetUserId: string,
    input: AdminChangeUserPasswordRequest,
    actor: PublicUser,
    context: AuthRequestContext,
  ): Promise<ManagedUserPasswordResult> {
    const passwordHash = await hashPassword(input.password);

    return this.runManagedUserMutation({
      actor,
      context,
      requiredPermission: "users:password",
      targetUserId,
      mutate: (tx, targetUser, actorUser, now) => {
        updateManagedUserAndRevokeSessions(
          tx,
          targetUser,
          { passwordHash, updatedAt: now },
          {
            action: "users.password.changed",
            actorUserId: actorUser.id,
            context,
            createdAt: now,
          },
        );

        return { ok: true, body: { status: "ok" } };
      },
    });
  }

  updateManagedUserStatus(
    targetUserId: string,
    input: AdminUpdateUserStatusRequest,
    actor: PublicUser,
    context: AuthRequestContext,
  ): ManagedUserMutationResult {
    return this.runManagedUserMutation({
      actor,
      context,
      requiredPermission: "users:disable",
      targetUserId,
      mutate: (tx, targetUser, actorUser, now) => {
        if (
          input.disabled &&
          hasExplicitPermissionGrant(tx, targetUser.id, SYSTEM_ADMIN_PERMISSION)
        ) {
          if (countActiveSystemAdmins(tx) <= 1) {
            return { ok: false, status: 409, body: lastSystemAdminRequiredError };
          }
        }

        updateManagedUserAndRevokeSessions(
          tx,
          targetUser,
          { disabledAt: input.disabled ? now : null, updatedAt: now },
          {
            action: input.disabled ? "users.disabled" : "users.restored",
            actorUserId: actorUser.id,
            context,
            createdAt: now,
          },
        );

        return readManagedUserSummarySuccess(tx, targetUser.id);
      },
    });
  }

  deleteManagedUser(
    targetUserId: string,
    actor: PublicUser,
    context: AuthRequestContext,
  ): ManagedUserDeleteResult {
    return this.runManagedUserMutation({
      actor,
      context,
      requiredPermission: "users:delete",
      targetUserId,
      mutate: (tx, targetUser, actorUser, now) => {
        if (
          !targetUser.disabledAt &&
          hasExplicitPermissionGrant(tx, targetUser.id, SYSTEM_ADMIN_PERMISSION) &&
          countActiveSystemAdmins(tx) <= 1
        ) {
          return { ok: false, status: 409, body: lastSystemAdminRequiredError };
        }

        writeAuditLog(tx, {
          action: "users.deleted",
          actorUserId: actorUser.id,
          targetType: "user",
          targetId: targetUser.id,
          ipAddress: context.ipAddress,
          createdAt: now,
          metadata: {
            username: targetUser.username,
            authMethod: targetUser.authMethod,
            email: targetUser.email,
            publicId: targetUser.publicId,
          },
        });
        tx.delete(users).where(eq(users.id, targetUser.id)).run();

        return { ok: true, body: { status: "ok", deletedUserId: targetUser.publicId } };
      },
    });
  }

  private readManagedUserSummaries(): ManagedUserSummary[] {
    const userRows = this.database.db.select().from(users).all();
    const permissionsByUserId = readEffectivePermissionsByUserId(this.database.db, userRows);

    return userRows
      .map((user) =>
        toManagedUserSummary(user, permissionsByUserId.get(user.id) ?? [], {
          includeAuthMethod: true,
        }),
      )
      .sort((left, right) => left.username.localeCompare(right.username));
  }

  private readManagedUserProfileByPublicId(targetUserId: string): ManagedUserProfileResult {
    const targetUser = this.readUserByPublicId(targetUserId);

    if (!targetUser) {
      return { ok: false, status: 404, body: targetUserNotFoundError };
    }

    return {
      ok: true,
      user: toManagedUserProfile(
        targetUser,
        readEffectivePermissions(this.database.db, targetUser),
      ),
    };
  }

  private readActiveManagedActor(
    actor: PublicUser,
    requiredPermission?: UserPermission,
  ): { ok: true; actor: User } | PermissionCheckFailure {
    const actorUser = this.readUserByPublicId(actor.id);

    if (!actorUser || actorUser.disabledAt) {
      return { ok: false, status: 401, body: unauthenticatedError };
    }

    const permissions = readEffectivePermissions(this.database.db, actorUser);

    if (!hasPermissionGrant(permissions, "users:manage")) {
      return { ok: false, status: 403, body: forbiddenError("users:manage") };
    }

    if (requiredPermission && !hasPermissionGrant(permissions, requiredPermission)) {
      return { ok: false, status: 403, body: forbiddenError(requiredPermission) };
    }

    return { ok: true, actor: actorUser };
  }

  private readUserByPublicId(publicUserId: string): User | undefined {
    return this.database.db.select().from(users).where(eq(users.publicId, publicUserId)).get();
  }

  private runManagedUserMutation<TSuccess>(input: {
    actor: PublicUser;
    context: AuthRequestContext;
    mutate: (
      tx: DatabaseTransaction,
      targetUser: User,
      actorUser: User,
      now: string,
    ) => TSuccess | ManagedUserMutationFailure;
    requiredPermission: UserPermission;
    targetUserId: string;
  }): TSuccess | ManagedUserMutationFailure {
    const actorResult = this.readActiveManagedActor(input.actor, input.requiredPermission);

    if (!actorResult.ok) {
      return actorResult;
    }

    const now = new Date().toISOString();

    return this.database.db.transaction((tx) => {
      const targetUser = readManagedTargetUser(tx, input.targetUserId);

      if (!targetUser) {
        return { ok: false, status: 404, body: targetUserNotFoundError };
      }

      if (targetUser.id === actorResult.actor.id) {
        return { ok: false, status: 409, body: selfServiceOnlyError };
      }

      return input.mutate(tx, targetUser, actorResult.actor, now);
    });
  }

  private insertLocalUser(
    user: User,
    actor: User,
    context: AuthRequestContext,
    now: Date,
  ): boolean {
    return this.database.db.transaction((tx) => {
      const existingUser = findUserByUsernameOrEmail(tx, user.username, user.email);

      if (existingUser) {
        return false;
      }

      tx.insert(users).values(user).run();
      writeAuditLog(tx, {
        actorUserId: actor.id,
        action: "users.created",
        targetType: "user",
        targetId: user.id,
        metadata: { username: user.username, email: user.email },
        ipAddress: context.ipAddress,
        createdAt: now.toISOString(),
      });

      return true;
    });
  }
}

export async function createUserRecord(
  input: CreateAdminRequest | CreateLocalUserRequest,
  now: Date,
): Promise<User> {
  return {
    id: Bun.randomUUIDv7(),
    publicId: generatePublicUserId(),
    username: input.username.trim(),
    email: normalizeEmail(input.email),
    avatarId: DEFAULT_PROFILE_AVATAR_ID,
    bannerId: DEFAULT_PROFILE_BANNER_ID,
    toastNotificationsEnabled: DEFAULT_NOTIFICATION_PREFERENCES.toastsEnabled,
    toastNotificationFrequency: DEFAULT_NOTIFICATION_PREFERENCES.frequency,
    authMethod: "local",
    passwordHash: await hashPassword(input.password),
    disabledAt: null,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    lastLoginAt: null,
  };
}

function readManagedTargetUser(tx: DatabaseTransaction, targetUserId: string): User | null {
  return tx.select().from(users).where(eq(users.publicId, targetUserId)).get() ?? null;
}

function readManagedUserSummarySuccess(
  tx: DatabaseTransaction,
  targetInternalUserId: string,
): ManagedUserMutationResult {
  const updatedUser = tx.select().from(users).where(eq(users.id, targetInternalUserId)).get();

  if (!updatedUser) {
    return { ok: false, status: 404, body: targetUserNotFoundError };
  }

  return {
    ok: true,
    user: toManagedUserSummary(updatedUser, readEffectivePermissions(tx, updatedUser)),
  };
}

function updateManagedUserAndRevokeSessions(
  tx: DatabaseTransaction,
  targetUser: User,
  values: ManagedUserUpdateValues,
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
  writeAuditLog(tx, {
    action: auditLog.action,
    actorUserId: auditLog.actorUserId,
    targetType: "user",
    targetId: targetUser.id,
    metadata: { username: targetUser.username, ...(auditLog.metadata ?? {}) },
    ipAddress: auditLog.context.ipAddress,
    createdAt: auditLog.createdAt,
  });
}

function revokeUserSessions(tx: DatabaseTransaction, targetUserId: string): void {
  tx.delete(sessions).where(eq(sessions.userId, targetUserId)).run();
}

function forbiddenError(permission: UserPermission): ApiErrorResponse {
  return {
    error: {
      code: "FORBIDDEN",
      message: `${permission} permission is required.`,
    },
  };
}
