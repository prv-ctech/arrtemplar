import {
  type AdminChangeUserPasswordRequest,
  type AdminChangeUserPasswordResponse,
  type AdminDeleteUserResponse,
  type AdminUpdateUserPermissionsRequest,
  type AdminUpdateUserStatusRequest,
  type ApiErrorResponse,
  type AuthIdentitiesResponse,
  type AuthProviderSlug,
  type ChangePasswordRequest,
  type ChangePasswordResponse,
  type ClearNotificationHistoryResponse,
  type CreateAdminRequest,
  type CreateLocalUserRequest,
  type CreateNotificationHistoryRequest,
  type CreateNotificationHistoryResponse,
  DEFAULT_NOTIFICATION_PREFERENCES,
  DEFAULT_PROFILE_AVATAR_ID,
  DEFAULT_PROFILE_BANNER_ID,
  DEFAULT_SIGNED_IN_USER_PERMISSIONS,
  hasPermissionGrant,
  isProfileAvatarId,
  isProfileBannerId,
  isToastNotificationId,
  isUserPermission,
  type LoginRequest,
  type ManagedUserProfile,
  type ManagedUserSummary,
  type MarkNotificationReadResponse,
  NOTIFICATION_FREQUENCY_VALUES,
  type NotificationFrequency,
  type NotificationHistoryItem,
  type NotificationHistoryListResponse,
  type NotificationPreferences,
  OAUTH_LOCAL_EMAIL_DOMAIN,
  type PublicUser,
  type AuthIdentity as SharedAuthIdentity,
  SYSTEM_ADMIN_PERMISSION,
  TOAST_NOTIFICATION_EVENTS,
  type ToastNotificationId,
  type UpdateManagedUserProfileRequest,
  type UpdateNotificationPreferencesRequest,
  type UpdateUserProfileRequest,
  USER_PERMISSION_VALUES,
  type UserPermission,
} from "@arrtemplar/shared";
import { and, desc, eq, isNull, or, sql } from "drizzle-orm";
import type { DatabaseClient } from "../db/client";
import {
  auditLogs,
  authIdentities,
  type NewNotificationHistory,
  type NotificationHistory,
  notificationHistory,
  type AuthIdentity as StoredAuthIdentity,
  sessions,
  type User,
  userPermissionGrants,
  users,
} from "../db/schema";
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

type PermissionCheckSuccess = {
  ok: true;
  user: PublicUser;
};

type PermissionCheckFailure = {
  ok: false;
  status: 401 | 403;
  body: ApiErrorResponse;
};

type PermissionCheckResult = PermissionCheckSuccess | PermissionCheckFailure;

type CreateLocalUserSuccess = {
  ok: true;
  user: ManagedUserSummary;
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

type NotificationPreferencesSuccess = {
  ok: true;
  notificationPreferences: NotificationPreferences;
};

type NotificationPreferencesFailure = {
  ok: false;
  status: 401;
  body: ApiErrorResponse;
};

type NotificationPreferencesResult =
  | NotificationPreferencesSuccess
  | NotificationPreferencesFailure;

type NotificationHistoryAuthFailure = {
  ok: false;
  status: 401;
  body: ApiErrorResponse;
};

type NotificationHistoryCreateFailure =
  | NotificationHistoryAuthFailure
  | {
      ok: false;
      status: 422;
      body: ApiErrorResponse;
    };

type NotificationHistoryReadFailure =
  | NotificationHistoryAuthFailure
  | {
      ok: false;
      status: 404;
      body: ApiErrorResponse;
    };

type NotificationHistoryListSuccess = {
  ok: true;
  body: NotificationHistoryListResponse;
};

type CreateNotificationHistorySuccess = {
  ok: true;
  body: CreateNotificationHistoryResponse;
};

type MarkNotificationReadSuccess = {
  ok: true;
  body: MarkNotificationReadResponse;
};

type ClearNotificationHistorySuccess = {
  ok: true;
  body: ClearNotificationHistoryResponse;
};

type NotificationHistoryListResult =
  | NotificationHistoryListSuccess
  | NotificationHistoryAuthFailure;
type CreateNotificationHistoryResult =
  | CreateNotificationHistorySuccess
  | NotificationHistoryCreateFailure;
type MarkNotificationReadResult = MarkNotificationReadSuccess | NotificationHistoryReadFailure;
type ClearNotificationHistoryResult =
  | ClearNotificationHistorySuccess
  | NotificationHistoryAuthFailure;

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

type ManagedUsersListResult = ManagedUsersListSuccess | PermissionCheckFailure;
type ManagedUserProfileResult = ManagedUserProfileSuccess | ManagedUserProfileFailure;
type ManagedUserProfileMutationResult = ManagedUserProfileSuccess | ManagedUserMutationFailure;
type ManagedUserMutationResult = ManagedUserMutationSuccess | ManagedUserMutationFailure;
type ManagedUserPasswordResult = ManagedUserPasswordSuccess | ManagedUserMutationFailure;
type ManagedUserDeleteResult = ManagedUserDeleteSuccess | ManagedUserMutationFailure;

type OAuthIdentityInput = {
  provider: AuthProviderSlug;
  issuer: string;
  subject: string;
  preferredUsername?: string;
  name?: string;
  email?: string;
};

type OAuthLoginResult =
  | LoginSuccess
  | {
      ok: false;
      status: 401 | 409;
      body: ApiErrorResponse;
    };

type OAuthIdentityLinkResult =
  | {
      ok: true;
      identity: SharedAuthIdentity;
    }
  | {
      ok: false;
      status: 401 | 403 | 409;
      body: ApiErrorResponse;
    };

type OAuthIdentitiesResult =
  | {
      ok: true;
      body: AuthIdentitiesResponse;
    }
  | UserProfileFailure;

type DatabaseTransaction = Parameters<Parameters<DatabaseClient["db"]["transaction"]>[0]>[0];
type DatabaseReader = DatabaseClient["db"] | DatabaseTransaction;
type ManagedUserUpdateValues = Partial<Pick<User, "disabledAt" | "passwordHash" | "updatedAt">>;
type CurrentUserUpdateValues = Partial<
  Pick<
    User,
    | "avatarId"
    | "bannerId"
    | "email"
    | "toastNotificationFrequency"
    | "toastNotificationsEnabled"
    | "updatedAt"
    | "username"
  >
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

const invalidNotificationHistoryInputError: ApiErrorResponse = {
  error: {
    code: "INVALID_NOTIFICATION_HISTORY_INPUT",
    message: "Notification history input is invalid.",
  },
};

const notificationHistoryNotFoundError: ApiErrorResponse = {
  error: {
    code: "NOTIFICATION_NOT_FOUND",
    message: "Notification history item was not found.",
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

const lastSystemAdminRequiredError: ApiErrorResponse = {
  error: {
    code: "LAST_SYSTEM_ADMIN_REQUIRED",
    message: "At least one active user must keep the system:admin permission.",
  },
};

const oauthIdentityAlreadyLinkedError: ApiErrorResponse = {
  error: {
    code: "OAUTH_IDENTITY_ALREADY_LINKED",
    message: "That OAuth identity is already linked to another user.",
  },
};

const oauthUserUnavailableError: ApiErrorResponse = {
  error: {
    code: "OAUTH_USER_UNAVAILABLE",
    message: "The linked user account is unavailable.",
  },
};

const permissionOrder = new Map<UserPermission, number>(
  USER_PERMISSION_VALUES.map((permission, index) => [permission, index]),
);
const notificationHistoryTitleMaxLength = 160;
const notificationHistoryDescriptionMaxLength = 500;

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
    const user = await createUserRecord(input, now);
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

    const userRows = this.database.db.select().from(users).all();
    const permissionsByUserId = readEffectivePermissionsByUserId(this.database.db, userRows);
    const summaries = userRows
      .map((user) =>
        toManagedUserSummary(user, permissionsByUserId.get(user.id) ?? [], {
          includeAuthMethod: true,
        }),
      )
      .sort((left, right) => left.username.localeCompare(right.username));

    return { ok: true, users: summaries };
  }

  getManagedUserProfile(targetUserId: string, actor: PublicUser): ManagedUserProfileResult {
    const actorResult = this.readActiveManagedActor(actor);

    if (!actorResult.ok) {
      return actorResult;
    }

    const targetUser = this.findUserByPublicId(targetUserId);

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

        writeManagedUserAuditLog(tx, {
          action: "users.profile.updated",
          actorUserId: actorUser.id,
          context,
          createdAt: now,
          metadata: {
            username: updatedUser.username,
            email: updatedUser.email,
            avatarId: updatedUser.avatarId,
            bannerId: updatedUser.bannerId,
          },
          targetUser: updatedUser,
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
        const permissions = normalizePermissions(input.permissions.filter(isUserPermission));

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
        writeManagedUserAuditLog(tx, {
          action: "users.permissions.updated",
          actorUserId: actorUser.id,
          context,
          createdAt: now,
          metadata: { permissions },
          targetUser,
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

        writeManagedUserAuditLog(tx, {
          action: "users.deleted",
          actorUserId: actorUser.id,
          context,
          createdAt: now,
          metadata: {
            authMethod: targetUser.authMethod,
            email: targetUser.email,
            publicId: targetUser.publicId,
          },
          targetUser,
        });
        tx.delete(users).where(eq(users.id, targetUser.id)).run();

        return { ok: true, body: { status: "ok", deletedUserId: targetUser.publicId } };
      },
    });
  }

  async login(input: LoginRequest, context: AuthRequestContext): Promise<LoginResult> {
    const email = normalizeEmail(input.email);
    const rateLimitKey = createRateLimitKey(email);

    if (this.rateLimiter.isBlocked(rateLimitKey)) {
      this.writeAuditLog({
        action: "auth.login.rate_limited",
        metadata: { email },
        ipAddress: context.ipAddress,
      });

      return { ok: false, status: 429, body: rateLimitedError };
    }

    const user = this.database.db.select().from(users).where(eq(users.email, email)).get();
    const passwordMatches =
      user?.authMethod === "local"
        ? await verifyPassword(input.password, user.passwordHash)
        : false;

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

  completeOAuthLogin(input: OAuthIdentityInput, context: AuthRequestContext): OAuthLoginResult {
    const now = new Date();
    const nowIso = now.toISOString();

    return this.database.db.transaction((tx) => {
      const existingIdentity = findOAuthIdentity(tx, input);

      if (existingIdentity) {
        const existingUser = tx
          .select()
          .from(users)
          .where(eq(users.id, existingIdentity.userId))
          .get();

        if (!existingUser || existingUser.disabledAt) {
          return { ok: false, status: 401, body: oauthUserUnavailableError };
        }

        tx.update(users)
          .set({ lastLoginAt: nowIso, updatedAt: nowIso })
          .where(eq(users.id, existingUser.id))
          .run();

        const updatedUser = { ...existingUser, lastLoginAt: nowIso, updatedAt: nowIso };
        const session = this.createSession(updatedUser, context, now, tx);

        writeOAuthAuditLog(tx, {
          action: "auth.oauth.login.success",
          actorUserId: updatedUser.id,
          context,
          createdAt: nowIso,
          metadata: {
            provider: input.provider,
            issuer: input.issuer,
            subject: input.subject,
          },
        });

        return {
          ok: true,
          user: toPublicUser(updatedUser, readEffectivePermissions(tx, updatedUser)),
          sessionToken: session.sessionToken,
          expiresAt: session.expiresAt,
        };
      }

      const publicId = generatePublicUserId();
      const user = {
        id: Bun.randomUUIDv7(),
        publicId,
        username: createOAuthUsername(tx, input),
        email: createOAuthEmail(tx, input.email, publicId),
        avatarId: DEFAULT_PROFILE_AVATAR_ID,
        bannerId: DEFAULT_PROFILE_BANNER_ID,
        toastNotificationsEnabled: DEFAULT_NOTIFICATION_PREFERENCES.toastsEnabled,
        toastNotificationFrequency: DEFAULT_NOTIFICATION_PREFERENCES.frequency,
        authMethod: "oauth",
        passwordHash: "!oauth",
        disabledAt: null,
        createdAt: nowIso,
        updatedAt: nowIso,
        lastLoginAt: nowIso,
      } satisfies User;

      tx.insert(users).values(user).run();
      tx.insert(authIdentities)
        .values({
          id: Bun.randomUUIDv7(),
          userId: user.id,
          provider: input.provider,
          issuer: input.issuer,
          subject: input.subject,
          createdAt: nowIso,
        })
        .run();

      if (DEFAULT_SIGNED_IN_USER_PERMISSIONS.length > 0) {
        tx.insert(userPermissionGrants)
          .values(
            DEFAULT_SIGNED_IN_USER_PERMISSIONS.map((permission) => ({
              id: Bun.randomUUIDv7(),
              userId: user.id,
              permission,
              grantedByUserId: null,
              createdAt: nowIso,
              updatedAt: nowIso,
            })),
          )
          .run();
      }

      const session = this.createSession(user, context, now, tx);

      writeOAuthAuditLog(tx, {
        action: "auth.oauth.user_created",
        actorUserId: user.id,
        context,
        createdAt: nowIso,
        metadata: {
          provider: input.provider,
          issuer: input.issuer,
          subject: input.subject,
          username: user.username,
        },
      });

      return {
        ok: true,
        user: toPublicUser(user, readEffectivePermissions(tx, user)),
        sessionToken: session.sessionToken,
        expiresAt: session.expiresAt,
      };
    });
  }

  linkOAuthIdentityToAdmin(
    input: OAuthIdentityInput,
    actor: PublicUser,
    context: AuthRequestContext,
  ): OAuthIdentityLinkResult {
    const nowIso = new Date().toISOString();

    return this.database.db.transaction((tx) => {
      const actorUser = tx.select().from(users).where(eq(users.publicId, actor.id)).get();

      if (!actorUser || actorUser.disabledAt) {
        return { ok: false, status: 401, body: unauthenticatedError };
      }

      if (!hasPermissionGrant(readEffectivePermissions(tx, actorUser), SYSTEM_ADMIN_PERMISSION)) {
        return { ok: false, status: 403, body: forbiddenError(SYSTEM_ADMIN_PERMISSION) };
      }

      const existingIdentity = findOAuthIdentity(tx, input);

      if (existingIdentity) {
        if (existingIdentity.userId !== actorUser.id) {
          return { ok: false, status: 409, body: oauthIdentityAlreadyLinkedError };
        }

        return { ok: true, identity: toSharedAuthIdentity(existingIdentity) };
      }

      const identity = {
        id: Bun.randomUUIDv7(),
        userId: actorUser.id,
        provider: input.provider,
        issuer: input.issuer,
        subject: input.subject,
        createdAt: nowIso,
      } satisfies StoredAuthIdentity;

      tx.insert(authIdentities).values(identity).run();
      writeOAuthAuditLog(tx, {
        action: "auth.oauth.identity.linked",
        actorUserId: actorUser.id,
        context,
        createdAt: nowIso,
        metadata: {
          provider: input.provider,
          issuer: input.issuer,
          subject: input.subject,
        },
      });

      return { ok: true, identity: toSharedAuthIdentity(identity) };
    });
  }

  listOAuthIdentities(sessionToken: string | null): OAuthIdentitiesResult {
    const currentSession = this.findSession(sessionToken);

    if (!currentSession) {
      return { ok: false, status: 401, body: unauthenticatedError };
    }

    const identities = this.database.db
      .select()
      .from(authIdentities)
      .where(eq(authIdentities.userId, currentSession.user.id))
      .all()
      .map(toSharedAuthIdentity);

    return { ok: true, body: { identities } };
  }

  logout(sessionToken: string | null, context: AuthRequestContext): void {
    const currentSession = this.findSession(sessionToken);

    if (!currentSession) {
      return;
    }

    const notificationHistoryRecorded = this.tryInsertNotificationHistoryItem({
      userId: currentSession.user.id,
      eventId: "auth.signed_out",
      title: "Signed out.",
      description: null,
    });

    this.database.db.delete(sessions).where(eq(sessions.id, currentSession.session.id)).run();

    this.writeAuditLog({
      action: "auth.logout",
      actorUserId: currentSession.user.id,
      targetType: "session",
      targetId: currentSession.session.id,
      metadata: { notificationHistoryRecorded },
      ipAddress: context.ipAddress,
    });
  }

  getCurrentUser(sessionToken: string | null): PublicUser | null {
    const currentSession = this.findSession(sessionToken);

    if (!currentSession) {
      return null;
    }

    return toPublicUser(
      currentSession.user,
      readEffectivePermissions(this.database.db, currentSession.user),
    );
  }

  getUserProfile(sessionToken: string | null): UserProfileResult {
    const user = this.getCurrentUser(sessionToken);

    if (!user) {
      return { ok: false, status: 401, body: unauthenticatedError };
    }

    return { ok: true, user };
  }

  getNotificationPreferences(sessionToken: string | null): NotificationPreferencesResult {
    const currentSession = this.findSession(sessionToken);

    if (!currentSession) {
      return { ok: false, status: 401, body: unauthenticatedError };
    }

    return {
      ok: true,
      notificationPreferences: toNotificationPreferences(currentSession.user),
    };
  }

  updateNotificationPreferences(
    sessionToken: string | null,
    input: UpdateNotificationPreferencesRequest,
    context: AuthRequestContext,
  ): NotificationPreferencesResult {
    const currentSession = this.findSession(sessionToken);

    if (!currentSession) {
      return { ok: false, status: 401, body: unauthenticatedError };
    }

    const now = new Date().toISOString();

    const updatedUser = this.updateCurrentUser(currentSession.user.id, {
      toastNotificationsEnabled: input.toastsEnabled,
      toastNotificationFrequency: input.frequency,
      updatedAt: now,
    });

    if (!updatedUser) {
      return { ok: false, status: 401, body: unauthenticatedError };
    }

    const notificationPreferences = toNotificationPreferences(updatedUser);

    this.writeAuditLog({
      action: "profile.notifications.updated",
      actorUserId: currentSession.user.id,
      targetType: "user",
      targetId: currentSession.user.id,
      metadata: notificationPreferences,
      ipAddress: context.ipAddress,
    });

    return { ok: true, notificationPreferences };
  }

  listNotificationHistory(
    sessionToken: string | null,
    input: { page?: number; pageSize?: number } = {},
  ): NotificationHistoryListResult {
    const currentSession = this.findSession(sessionToken);

    if (!currentSession) {
      return { ok: false, status: 401, body: unauthenticatedError };
    }

    const page = normalizeNotificationHistoryPage(input.page);
    const pageSize = normalizeNotificationHistoryPageSize(input.pageSize);
    const totalItems = countNotificationHistoryRows(this.database.db, currentSession.user.id);
    const unreadCount = countNotificationHistoryRows(this.database.db, currentSession.user.id, {
      unreadOnly: true,
    });
    const rows = this.database.db
      .select()
      .from(notificationHistory)
      .where(eq(notificationHistory.userId, currentSession.user.id))
      .orderBy(desc(notificationHistory.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize)
      .all();

    return {
      ok: true,
      body: {
        notifications: rows.map(toNotificationHistoryItem),
        unreadCount,
        pagination: {
          page,
          pageSize,
          totalItems,
          totalPages: Math.ceil(totalItems / pageSize),
        },
      },
    };
  }

  createNotificationHistory(
    sessionToken: string | null,
    input: CreateNotificationHistoryRequest,
  ): CreateNotificationHistoryResult {
    const currentSession = this.findSession(sessionToken);

    if (!currentSession) {
      return { ok: false, status: 401, body: unauthenticatedError };
    }

    if (!isToastNotificationId(input.eventId)) {
      return { ok: false, status: 422, body: invalidNotificationHistoryInputError };
    }

    const title = normalizeNotificationHistoryText(input.title, notificationHistoryTitleMaxLength);

    if (!title) {
      return { ok: false, status: 422, body: invalidNotificationHistoryInputError };
    }

    const description = normalizeOptionalNotificationHistoryText(
      input.description,
      notificationHistoryDescriptionMaxLength,
    );

    return {
      ok: true,
      body: {
        notification: this.insertNotificationHistoryItem({
          userId: currentSession.user.id,
          eventId: input.eventId,
          title,
          description,
        }),
      },
    };
  }

  markNotificationHistoryRead(
    sessionToken: string | null,
    notificationId: string,
  ): MarkNotificationReadResult {
    const currentSession = this.findSession(sessionToken);

    if (!currentSession) {
      return { ok: false, status: 401, body: unauthenticatedError };
    }

    const existingNotification = readNotificationHistoryItem(
      this.database.db,
      currentSession.user.id,
      notificationId,
    );

    if (!existingNotification) {
      return { ok: false, status: 404, body: notificationHistoryNotFoundError };
    }

    if (!existingNotification.readAt) {
      this.database.db
        .update(notificationHistory)
        .set({ readAt: new Date().toISOString() })
        .where(
          and(
            eq(notificationHistory.id, notificationId),
            eq(notificationHistory.userId, currentSession.user.id),
          ),
        )
        .run();
    }

    const notification = readNotificationHistoryItem(
      this.database.db,
      currentSession.user.id,
      notificationId,
    );

    if (!notification) {
      return { ok: false, status: 404, body: notificationHistoryNotFoundError };
    }

    return { ok: true, body: { notification: toNotificationHistoryItem(notification) } };
  }

  clearNotificationHistory(sessionToken: string | null): ClearNotificationHistoryResult {
    const currentSession = this.findSession(sessionToken);

    if (!currentSession) {
      return { ok: false, status: 401, body: unauthenticatedError };
    }

    return this.database.db.transaction((tx) => {
      const deletedCount = countNotificationHistoryRows(tx, currentSession.user.id);

      tx.delete(notificationHistory)
        .where(eq(notificationHistory.userId, currentSession.user.id))
        .run();

      return { ok: true, body: { status: "ok", deletedCount } };
    });
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
    const avatarId = input.avatarId;
    const bannerId = input.bannerId;
    const existingUser = this.findUserByUsernameOrEmail(username, email);

    if (existingUser && existingUser.id !== currentSession.user.id) {
      return { ok: false, status: 409, body: userAlreadyExistsError };
    }

    if (!username && !email && !avatarId && !bannerId) {
      return {
        ok: true,
        user: toPublicUser(
          currentSession.user,
          readEffectivePermissions(this.database.db, currentSession.user),
        ),
      };
    }

    const now = new Date().toISOString();
    const updatedUser = this.updateCurrentUser(currentSession.user.id, {
      ...(username ? { username } : {}),
      ...(email ? { email } : {}),
      ...(avatarId ? { avatarId } : {}),
      ...(bannerId ? { bannerId } : {}),
      updatedAt: now,
    });

    if (!updatedUser) {
      return { ok: false, status: 401, body: unauthenticatedError };
    }

    this.writeAuditLog({
      action: "profile.updated",
      actorUserId: currentSession.user.id,
      targetType: "user",
      targetId: currentSession.user.id,
      metadata: {
        username: updatedUser.username,
        email: updatedUser.email,
        avatarId: updatedUser.avatarId,
        bannerId: updatedUser.bannerId,
      },
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
        action: "profile.password.change_failed",
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
      action: "profile.password.changed",
      actorUserId: currentSession.user.id,
      targetType: "user",
      targetId: currentSession.user.id,
      ipAddress: context.ipAddress,
    });

    return { ok: true, body: { status: "ok" } };
  }

  requirePermission(
    sessionToken: string | null,
    permission: UserPermission,
  ): PermissionCheckResult {
    const currentSession = this.findSession(sessionToken);

    if (!currentSession) {
      return { ok: false, status: 401, body: unauthenticatedError };
    }

    const permissions = readEffectivePermissions(this.database.db, currentSession.user);

    if (!hasPermissionGrant(permissions, permission)) {
      this.writeAuditLog({
        action: "auth.permission.denied",
        actorUserId: currentSession.user.id,
        targetType: "permission",
        targetId: permission,
      });

      return { ok: false, status: 403, body: forbiddenError(permission) };
    }

    return { ok: true, user: toPublicUser(currentSession.user, permissions) };
  }

  private readActiveManagedActor(
    actor: PublicUser,
    requiredPermission?: UserPermission,
  ): { ok: true; actor: User } | PermissionCheckFailure {
    const actorUser = this.findUserByPublicId(actor.id);

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
    return findUserByUsernameOrEmail(this.database.db, username, email);
  }

  private findUserByPublicId(publicUserId: string): User | undefined {
    return this.database.db.select().from(users).where(eq(users.publicId, publicUserId)).get();
  }

  private findUserById(userId: string): User | undefined {
    return this.database.db.select().from(users).where(eq(users.id, userId)).get();
  }

  private updateCurrentUser(userId: string, values: CurrentUserUpdateValues): User | undefined {
    this.database.db.update(users).set(values).where(eq(users.id, userId)).run();
    return this.findUserById(userId);
  }

  private insertNotificationHistoryItem(input: {
    description: string | null;
    eventId: ToastNotificationId;
    title: string;
    userId: string;
  }): NotificationHistoryItem {
    const classification = TOAST_NOTIFICATION_EVENTS[input.eventId];
    const now = new Date().toISOString();
    const notificationId = Bun.randomUUIDv7();
    const notification = {
      id: notificationId,
      userId: input.userId,
      eventId: input.eventId,
      title: input.title,
      description: input.description,
      severity: classification.severity,
      importance: classification.importance,
      readAt: null,
      createdAt: now,
    } satisfies NewNotificationHistory;

    this.database.db.insert(notificationHistory).values(notification).run();

    return toNotificationHistoryItem(notification);
  }

  private tryInsertNotificationHistoryItem(
    input: Parameters<AuthService["insertNotificationHistoryItem"]>[0],
  ): boolean {
    try {
      this.insertNotificationHistoryItem(input);
      return true;
    } catch {
      return false;
    }
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
      tx.insert(userPermissionGrants)
        .values({
          id: Bun.randomUUIDv7(),
          userId: user.id,
          permission: SYSTEM_ADMIN_PERMISSION,
          grantedByUserId: user.id,
          createdAt: now.toISOString(),
          updatedAt: now.toISOString(),
        })
        .run();
      tx.insert(auditLogs)
        .values({
          id: Bun.randomUUIDv7(),
          actorUserId: user.id,
          action: "auth.setup.admin_created",
          targetType: "user",
          targetId: user.id,
          metadataJson: JSON.stringify({
            username: user.username,
            email: user.email,
            permissions: [SYSTEM_ADMIN_PERMISSION],
          }),
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
      const existingUser = findUserByUsernameOrEmail(tx, user.username, user.email);

      if (existingUser) {
        return false;
      }

      tx.insert(users).values(user).run();
      tx.insert(auditLogs)
        .values({
          id: Bun.randomUUIDv7(),
          actorUserId: actor.id,
          action: "users.created",
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
    tx: DatabaseReader = this.database.db,
  ): { sessionId: string; sessionToken: string; expiresAt: Date } {
    const expiresAt = createSessionExpiresAt(now);
    const sessionToken = generateSessionToken();
    const sessionId = Bun.randomUUIDv7();

    tx.insert(sessions)
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
    avatarId: isProfileAvatarId(user.avatarId) ? user.avatarId : DEFAULT_PROFILE_AVATAR_ID,
    bannerId: isProfileBannerId(user.bannerId) ? user.bannerId : DEFAULT_PROFILE_BANNER_ID,
    notificationPreferences: toNotificationPreferences(user),
    permissions,
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt,
  };
}

function toManagedUserSummary(
  user: User,
  permissions: UserPermission[],
  options: { includeAuthMethod?: boolean } = {},
): ManagedUserSummary {
  return {
    id: user.publicId,
    username: user.username,
    ...(options.includeAuthMethod ? { authMethod: user.authMethod } : {}),
    disabledAt: user.disabledAt,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    permissions,
  };
}

function toManagedUserProfile(user: User, permissions: UserPermission[]): ManagedUserProfile {
  return {
    ...toManagedUserSummary(user, permissions),
    email: user.email,
    avatarId: isProfileAvatarId(user.avatarId) ? user.avatarId : DEFAULT_PROFILE_AVATAR_ID,
    bannerId: isProfileBannerId(user.bannerId) ? user.bannerId : DEFAULT_PROFILE_BANNER_ID,
    lastLoginAt: user.lastLoginAt,
  };
}

function toNotificationPreferences(user: User): NotificationPreferences {
  return {
    toastsEnabled: user.toastNotificationsEnabled,
    frequency: isNotificationFrequency(user.toastNotificationFrequency)
      ? user.toastNotificationFrequency
      : DEFAULT_NOTIFICATION_PREFERENCES.frequency,
  };
}

function toNotificationHistoryItem(row: NotificationHistory): NotificationHistoryItem {
  return {
    id: row.id,
    eventId: row.eventId,
    title: row.title,
    description: row.description,
    severity: row.severity,
    importance: row.importance,
    readAt: row.readAt,
    createdAt: row.createdAt,
  };
}

function readNotificationHistoryItem(
  tx: DatabaseReader,
  userId: string,
  notificationId: string,
): NotificationHistory | undefined {
  return tx
    .select()
    .from(notificationHistory)
    .where(and(eq(notificationHistory.id, notificationId), eq(notificationHistory.userId, userId)))
    .get();
}

function countNotificationHistoryRows(
  tx: DatabaseReader,
  userId: string,
  options: { unreadOnly?: boolean } = {},
): number {
  const result = tx
    .select({ count: sql<number>`count(*)`.mapWith(Number) })
    .from(notificationHistory)
    .where(
      options.unreadOnly
        ? and(eq(notificationHistory.userId, userId), isNull(notificationHistory.readAt))
        : eq(notificationHistory.userId, userId),
    )
    .get();

  return result?.count ?? 0;
}

function normalizeNotificationHistoryPage(page: number | undefined): number {
  if (!page || !Number.isInteger(page) || page < 1) {
    return 1;
  }

  return page;
}

function normalizeNotificationHistoryPageSize(pageSize: number | undefined): number {
  if (!pageSize || !Number.isInteger(pageSize) || pageSize < 1) {
    return 25;
  }

  return Math.min(pageSize, 50);
}

function normalizeNotificationHistoryText(value: string, maxLength: number): string {
  return value.trim().slice(0, maxLength);
}

function normalizeOptionalNotificationHistoryText(
  value: string | undefined,
  maxLength: number,
): string | null {
  if (!value) {
    return null;
  }

  const normalized = normalizeNotificationHistoryText(value, maxLength);

  return normalized || null;
}

function isNotificationFrequency(value: string): value is NotificationFrequency {
  return NOTIFICATION_FREQUENCY_VALUES.some((frequency) => frequency === value);
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

function readExplicitPermissionGrantsByUserId(
  tx: DatabaseTransaction | DatabaseClient["db"],
): Map<string, UserPermission[]> {
  const permissionsByUserId = new Map<string, UserPermission[]>();

  for (const grant of tx
    .select({ permission: userPermissionGrants.permission, userId: userPermissionGrants.userId })
    .from(userPermissionGrants)
    .all()) {
    if (!isUserPermission(grant.permission)) {
      continue;
    }

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

function readEffectivePermissionsByUserId(
  tx: DatabaseTransaction | DatabaseClient["db"],
  userRows: readonly User[],
): Map<string, UserPermission[]> {
  const explicitPermissionsByUserId = readExplicitPermissionGrantsByUserId(tx);
  const effectivePermissionsByUserId = new Map<string, UserPermission[]>();

  for (const user of userRows) {
    effectivePermissionsByUserId.set(
      user.id,
      computeEffectivePermissions(explicitPermissionsByUserId.get(user.id) ?? []),
    );
  }

  return effectivePermissionsByUserId;
}

function readExplicitPermissionGrants(
  tx: DatabaseTransaction | DatabaseClient["db"],
  userId: string,
): UserPermission[] {
  return normalizePermissions(
    tx
      .select({ permission: userPermissionGrants.permission })
      .from(userPermissionGrants)
      .where(eq(userPermissionGrants.userId, userId))
      .all()
      .map((grant) => grant.permission)
      .filter(isUserPermission),
  );
}

function readEffectivePermissions(
  tx: DatabaseTransaction | DatabaseClient["db"],
  user: User,
): UserPermission[] {
  return computeEffectivePermissions(readExplicitPermissionGrants(tx, user.id));
}

function computeEffectivePermissions(
  explicitPermissions: readonly UserPermission[],
): UserPermission[] {
  if (explicitPermissions.includes(SYSTEM_ADMIN_PERMISSION)) {
    return [...USER_PERMISSION_VALUES];
  }

  return normalizePermissions([...DEFAULT_SIGNED_IN_USER_PERMISSIONS, ...explicitPermissions]);
}

function normalizePermissions(permissions: readonly UserPermission[]): UserPermission[] {
  return [...new Set(permissions)].sort(
    (left, right) => (permissionOrder.get(left) ?? 0) - (permissionOrder.get(right) ?? 0),
  );
}

function hasExplicitPermissionGrant(
  tx: DatabaseTransaction,
  userId: string,
  permission: UserPermission,
): boolean {
  const grant = tx
    .select({ id: userPermissionGrants.id })
    .from(userPermissionGrants)
    .where(
      and(eq(userPermissionGrants.userId, userId), eq(userPermissionGrants.permission, permission)),
    )
    .get();

  return Boolean(grant);
}

function countActiveSystemAdmins(tx: DatabaseTransaction): number {
  const result = tx
    .select({ count: sql<number>`count(*)`.mapWith(Number) })
    .from(userPermissionGrants)
    .innerJoin(users, eq(users.id, userPermissionGrants.userId))
    .where(
      and(eq(userPermissionGrants.permission, SYSTEM_ADMIN_PERMISSION), isNull(users.disabledAt)),
    )
    .get();

  return result?.count ?? 0;
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
  writeManagedUserAuditLog(tx, { ...auditLog, targetUser });
}

function revokeUserSessions(tx: DatabaseTransaction, targetUserId: string): void {
  tx.delete(sessions).where(eq(sessions.userId, targetUserId)).run();
}

function writeManagedUserAuditLog(
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

function findOAuthIdentity(
  tx: DatabaseReader,
  input: Pick<OAuthIdentityInput, "issuer" | "provider" | "subject">,
): StoredAuthIdentity | undefined {
  return tx
    .select()
    .from(authIdentities)
    .where(
      and(
        eq(authIdentities.provider, input.provider),
        eq(authIdentities.issuer, input.issuer),
        eq(authIdentities.subject, input.subject),
      ),
    )
    .get();
}

function toSharedAuthIdentity(identity: StoredAuthIdentity): SharedAuthIdentity {
  return {
    id: identity.id,
    provider: identity.provider,
    issuer: identity.issuer,
    subject: identity.subject,
    createdAt: identity.createdAt,
  };
}

function createOAuthUsername(tx: DatabaseReader, input: OAuthIdentityInput): string {
  const subjectHash = createSubjectHash(input.subject);
  const baseUsername = normalizeOAuthUsername(input.preferredUsername ?? input.name) ?? "authentik";
  const baseCandidate = baseUsername.slice(0, 80);

  if (!findUserByUsername(tx, baseCandidate)) {
    return baseCandidate;
  }

  const suffix = `-${subjectHash.slice(0, 8)}`;
  const suffixedCandidate = `${baseUsername.slice(0, 80 - suffix.length)}${suffix}`;

  if (!findUserByUsername(tx, suffixedCandidate)) {
    return suffixedCandidate;
  }

  const fallbackBase = `authentik-${subjectHash.slice(0, 16)}`;

  for (let attempt = 0; attempt < 20; attempt += 1) {
    const candidate = attempt === 0 ? fallbackBase : `${fallbackBase}-${attempt}`;

    if (!findUserByUsername(tx, candidate)) {
      return candidate;
    }
  }

  throw new Error("Unable to create a unique OAuth username.");
}

function createOAuthEmail(tx: DatabaseReader, email: string | undefined, publicId: string): string {
  const normalizedEmail = email ? normalizeEmail(email) : null;

  if (normalizedEmail && isUsableEmail(normalizedEmail) && !findUserByEmail(tx, normalizedEmail)) {
    return normalizedEmail;
  }

  return `${publicId.toLowerCase()}@${OAUTH_LOCAL_EMAIL_DOMAIN}`;
}

function normalizeOAuthUsername(value: string | undefined): string | null {
  const normalized = value?.trim().replace(/\s+/gu, "-");

  return normalized || null;
}

function createSubjectHash(subject: string): string {
  const hasher = new Bun.CryptoHasher("sha256");
  hasher.update(subject);

  return hasher.digest("hex");
}

function isUsableEmail(value: string): boolean {
  return value.length <= 320 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(value);
}

function findUserByUsername(tx: DatabaseReader, username: string): Pick<User, "id"> | undefined {
  return tx.select({ id: users.id }).from(users).where(eq(users.username, username)).get();
}

function findUserByEmail(tx: DatabaseReader, email: string): Pick<User, "id"> | undefined {
  return tx.select({ id: users.id }).from(users).where(eq(users.email, email)).get();
}

function writeOAuthAuditLog(
  tx: DatabaseReader,
  input: {
    action: string;
    actorUserId: string;
    context: AuthRequestContext;
    createdAt: string;
    metadata: Record<string, unknown>;
  },
): void {
  tx.insert(auditLogs)
    .values({
      id: Bun.randomUUIDv7(),
      actorUserId: input.actorUserId,
      action: input.action,
      targetType: "oauth_identity",
      targetId: null,
      metadataJson: JSON.stringify(input.metadata),
      ipAddress: input.context.ipAddress,
      createdAt: input.createdAt,
    })
    .run();
}

async function createUserRecord(
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

function findUserByUsernameOrEmail(
  tx: DatabaseTransaction | DatabaseClient["db"],
  username: string | undefined,
  email: string | undefined,
): User | undefined {
  if (username && email) {
    return tx
      .select()
      .from(users)
      .where(or(eq(users.username, username), eq(users.email, email)))
      .get();
  }

  if (username) {
    return tx.select().from(users).where(eq(users.username, username)).get();
  }

  if (email) {
    return tx.select().from(users).where(eq(users.email, email)).get();
  }

  return undefined;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function createRateLimitKey(email: string): string {
  return email;
}

function forbiddenError(permission: UserPermission): ApiErrorResponse {
  return {
    error: {
      code: "FORBIDDEN",
      message: `${permission} permission is required.`,
    },
  };
}
