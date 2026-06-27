import {
  type AdminChangeUserPasswordRequest,
  type AdminUpdateUserPermissionsRequest,
  type AdminUpdateUserStatusRequest,
  type ApiErrorResponse,
  type AuthIdentitiesResponse,
  type AuthProviderSlug,
  type AuthUnlinkAllIdentitiesResponse,
  type ChangePasswordRequest,
  type ChangePasswordResponse,
  type CreateAdminRequest,
  type CreateLocalUserRequest,
  type CreateNotificationHistoryRequest,
  DEFAULT_NOTIFICATION_PREFERENCES,
  DEFAULT_PROFILE_AVATAR_ID,
  DEFAULT_PROFILE_BANNER_ID,
  DEFAULT_SIGNED_IN_USER_PERMISSIONS,
  hasPermissionGrant,
  type LoginRequest,
  type PublicUser,
  type AuthIdentity as SharedAuthIdentity,
  SYSTEM_ADMIN_PERMISSION,
  type UpdateManagedUserProfileRequest,
  type UpdateNotificationPreferencesRequest,
  type UpdateUserProfileRequest,
  type UserPermission,
} from "@arrtemplar/shared";
import { and, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { writeAuditLog } from "../audit/audit-log";
import type { DatabaseClient } from "../db/client";
import {
  authIdentities,
  authProviders,
  sessions,
  type User,
  userPermissionGrants,
  users,
} from "../db/schema";
import {
  type CreateLocalUserResult,
  createUserRecord,
  lastSystemAdminRequiredError,
  type ManagedUserDeleteResult,
  type ManagedUserMutationResult,
  type ManagedUserPasswordResult,
  type ManagedUserProfileMutationResult,
  type ManagedUserProfileResult,
  ManagedUserService,
  type ManagedUsersListResult,
  userAlreadyExistsError,
} from "./managed-user.service";
import {
  type ClearNotificationHistoryResult,
  type CreateNotificationHistoryResult,
  type MarkNotificationReadResult,
  type NotificationHistoryListResult,
  NotificationHistoryService,
  type NotificationPreferencesResult,
} from "./notification-history.service";
import {
  countOAuthIdentityRows,
  countOAuthSessionRows,
  createOAuthEmail,
  createOAuthUsername,
  createStoredOAuthIdentity,
  findOAuthIdentity,
  findUserByUsernameOrEmail,
  normalizeEmail,
  type OAuthIdentityInput,
  readOAuthIdentityUserIds,
  updateOAuthIdentityDisplayMetadata,
  withActiveSystemAdminActor,
} from "./oauth-identity.helpers";
import { hashPassword, verifyPassword } from "./password";
import { countActiveLocalSystemAdmins, readEffectivePermissions } from "./permissions";
import { generatePublicUserId } from "./public-user-id";
import {
  createOAuthRouteRateLimitKey,
  LoginRateLimiter,
  type OAuthRouteRateLimitInput,
} from "./rate-limit";
import { createSessionExpiresAt, generateSessionToken, hashSessionToken } from "./session-token";
import { readProviderKind, toPublicUser, toSharedAuthIdentity } from "./user-mappers";

export type AuthRequestContext = {
  ipAddress: string | null;
  path: string;
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
  status: 401 | 403 | 429;
  body: ApiErrorResponse;
};

export type LoginResult = LoginSuccess | LoginFailure;

type OAuthRouteRateLimitResult =
  | { ok: true; key: string }
  | { ok: false; status: 429; body: ApiErrorResponse };

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

type OAuthSessionToken = {
  provider: AuthProviderSlug;
  idTokenEncrypted: string;
  masterKeyId: string;
  sid?: string;
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

type OAuthUnlinkAllIdentitiesResult =
  | {
      ok: true;
      body: AuthUnlinkAllIdentitiesResponse;
    }
  | {
      ok: false;
      status: 401 | 403 | 409;
      body: ApiErrorResponse;
    };
type DatabaseTransaction = Parameters<Parameters<DatabaseClient["db"]["transaction"]>[0]>[0];
type DatabaseReader = DatabaseClient["db"] | DatabaseTransaction;
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

const oauthRouteRateLimitedError: ApiErrorResponse = {
  error: {
    code: "RATE_LIMITED",
    message: "Too many OAuth requests. Try again later.",
  },
};

const passwordLoginDisabledError: ApiErrorResponse = {
  error: {
    code: "AUTH_MODE_PASSWORD_DISABLED",
    message: "Password login is disabled while OAuth/OIDC is enabled.",
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

const invalidCurrentPasswordError: ApiErrorResponse = {
  error: {
    code: "INVALID_CURRENT_PASSWORD",
    message: "Current password is incorrect.",
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

const oauthAutoRegisterDisabledError: ApiErrorResponse = {
  error: {
    code: "OAUTH_AUTO_REGISTER_DISABLED",
    message: "OAuth auto-registration is disabled.",
  },
};

export class AuthService {
  private readonly managedUsers: ManagedUserService;
  private readonly notificationHistory: NotificationHistoryService;

  constructor(
    private readonly database: DatabaseClient,
    private readonly rateLimiter = new LoginRateLimiter(),
  ) {
    this.managedUsers = new ManagedUserService(database);
    this.notificationHistory = new NotificationHistoryService(
      database,
      (sessionToken) => this.findSession(sessionToken),
      (userId, values) => this.updateCurrentUser(userId, values),
    );
  }

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
    return this.managedUsers.createLocalUser(input, actor, context);
  }

  listUsers(actor: PublicUser): ManagedUsersListResult {
    return this.managedUsers.listUsers(actor);
  }

  listUsersForApiKey(): ManagedUsersListResult {
    return this.managedUsers.listUsersForApiKey();
  }

  getManagedUserProfile(targetUserId: string, actor: PublicUser): ManagedUserProfileResult {
    return this.managedUsers.getManagedUserProfile(targetUserId, actor);
  }

  getManagedUserProfileForApiKey(targetUserId: string): ManagedUserProfileResult {
    return this.managedUsers.getManagedUserProfileForApiKey(targetUserId);
  }

  updateManagedUserProfile(
    targetUserId: string,
    input: UpdateManagedUserProfileRequest,
    actor: PublicUser,
    context: AuthRequestContext,
  ): ManagedUserProfileMutationResult {
    return this.managedUsers.updateManagedUserProfile(targetUserId, input, actor, context);
  }

  updateManagedUserPermissions(
    targetUserId: string,
    input: AdminUpdateUserPermissionsRequest,
    actor: PublicUser,
    context: AuthRequestContext,
  ): ManagedUserMutationResult {
    return this.managedUsers.updateManagedUserPermissions(targetUserId, input, actor, context);
  }

  async changeManagedUserPassword(
    targetUserId: string,
    input: AdminChangeUserPasswordRequest,
    actor: PublicUser,
    context: AuthRequestContext,
  ): Promise<ManagedUserPasswordResult> {
    return this.managedUsers.changeManagedUserPassword(targetUserId, input, actor, context);
  }

  updateManagedUserStatus(
    targetUserId: string,
    input: AdminUpdateUserStatusRequest,
    actor: PublicUser,
    context: AuthRequestContext,
  ): ManagedUserMutationResult {
    return this.managedUsers.updateManagedUserStatus(targetUserId, input, actor, context);
  }

  deleteManagedUser(
    targetUserId: string,
    actor: PublicUser,
    context: AuthRequestContext,
  ): ManagedUserDeleteResult {
    return this.managedUsers.deleteManagedUser(targetUserId, actor, context);
  }

  async login(input: LoginRequest, context: AuthRequestContext): Promise<LoginResult> {
    const email = normalizeEmail(input.email);
    const rateLimitKey = createRateLimitKey(email);

    if (this.isOAuthLoginEnabled()) {
      writeAuditLog(this.database.db, {
        action: "auth.login.password_disabled",
        metadata: { email },
        ipAddress: context.ipAddress,
      });

      return { ok: false, status: 403, body: passwordLoginDisabledError };
    }

    if (this.rateLimiter.isBlocked(rateLimitKey)) {
      writeAuditLog(this.database.db, {
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
      writeAuditLog(this.database.db, {
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

    writeAuditLog(this.database.db, {
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

  checkOAuthRouteRateLimit(
    input: Omit<OAuthRouteRateLimitInput, "ipAddress"> & { context: AuthRequestContext },
  ): OAuthRouteRateLimitResult {
    const key = createOAuthRouteRateLimitKey({
      provider: input.provider,
      route: input.route,
      ...(input.mode ? { mode: input.mode } : {}),
      ipAddress: input.context.ipAddress,
    });

    if (!this.rateLimiter.isBlocked(key)) {
      return { ok: true, key };
    }

    writeAuditLog(this.database.db, {
      action: "auth.oauth.route_rate_limited",
      metadata: {
        provider: input.provider,
        route: input.route,
        mode: input.mode ?? null,
      },
      ipAddress: input.context.ipAddress,
    });

    return { ok: false, status: 429, body: oauthRouteRateLimitedError };
  }

  recordOAuthRouteAttempt(key: string): void {
    this.rateLimiter.recordFailure(key);
  }

  clearOAuthRouteRateLimit(key: string): void {
    this.rateLimiter.clear(key);
  }

  invalidateOAuthSessions(input: {
    context: AuthRequestContext;
    issuer: string;
    provider: AuthProviderSlug;
    sid?: string;
    subject?: string;
  }): { deletedCount: number } {
    const deletedCount = this.database.db.transaction((tx) => {
      const identityUserIds = input.subject
        ? readOAuthIdentityUserIds(tx, {
            issuer: input.issuer,
            provider: input.provider,
            subject: input.subject,
          })
        : null;

      if (identityUserIds?.length === 0) {
        return 0;
      }

      const rows = tx
        .select({ id: sessions.id })
        .from(sessions)
        .where(
          and(
            eq(sessions.oauthProvider, input.provider),
            ...(input.sid ? [eq(sessions.oauthSid, input.sid)] : []),
            ...(identityUserIds ? [inArray(sessions.userId, identityUserIds)] : []),
          ),
        )
        .all();
      const sessionIds = rows.map((row) => row.id);

      if (sessionIds.length > 0) {
        tx.delete(sessions).where(inArray(sessions.id, sessionIds)).run();
      }

      return sessionIds.length;
    });

    writeAuditLog(this.database.db, {
      action: "auth.oauth.backchannel_logout",
      metadata: {
        provider: input.provider,
        issuer: input.issuer,
        hasSubject: Boolean(input.subject),
        hasSid: Boolean(input.sid),
        deletedCount,
      },
      ipAddress: input.context.ipAddress,
    });

    return { deletedCount };
  }

  completeOAuthLogin(
    input: OAuthIdentityInput,
    context: AuthRequestContext,
    oauthSessionToken?: OAuthSessionToken,
    options: { autoRegister?: boolean } = {},
  ): OAuthLoginResult {
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
        updateOAuthIdentityDisplayMetadata(tx, existingIdentity.id, input);

        const updatedUser = { ...existingUser, lastLoginAt: nowIso, updatedAt: nowIso };
        const session = this.createSession(updatedUser, context, now, tx, oauthSessionToken);

        writeAuditLog(tx, {
          action: "auth.oauth.login.success",
          actorUserId: updatedUser.id,
          targetType: "oauth_identity",
          targetId: null,
          ipAddress: context.ipAddress,
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

      if (options.autoRegister === false) {
        writeAuditLog(tx, {
          action: "auth.oauth.auto_register_disabled",
          actorUserId: null,
          targetType: "oauth_identity",
          targetId: null,
          ipAddress: context.ipAddress,
          createdAt: nowIso,
          metadata: {
            provider: input.provider,
            issuer: input.issuer,
          },
        });

        return { ok: false, status: 401, body: oauthAutoRegisterDisabledError };
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
        .values(createStoredOAuthIdentity(input, user.id, nowIso))
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

      const session = this.createSession(user, context, now, tx, oauthSessionToken);

      writeAuditLog(tx, {
        action: "auth.oauth.user_created",
        actorUserId: user.id,
        targetType: "oauth_identity",
        targetId: null,
        ipAddress: context.ipAddress,
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

    return this.database.db.transaction((tx) =>
      withActiveSystemAdminActor(tx, actor, (actorUser) => {
        const existingIdentity = findOAuthIdentity(tx, input);

        if (existingIdentity) {
          if (existingIdentity.userId !== actorUser.id) {
            return { ok: false, status: 409, body: oauthIdentityAlreadyLinkedError };
          }

          return {
            ok: true,
            identity: toSharedAuthIdentity(existingIdentity, readProviderKind(tx, input.provider)),
          };
        }

        const identity = createStoredOAuthIdentity(input, actorUser.id, nowIso);

        tx.insert(authIdentities).values(identity).run();
        writeAuditLog(tx, {
          action: "auth.oauth.identity.linked",
          actorUserId: actorUser.id,
          targetType: "oauth_identity",
          targetId: null,
          ipAddress: context.ipAddress,
          createdAt: nowIso,
          metadata: {
            provider: input.provider,
            issuer: input.issuer,
            subject: input.subject,
          },
        });

        return {
          ok: true,
          identity: toSharedAuthIdentity(identity, readProviderKind(tx, input.provider)),
        };
      }),
    );
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
      .map((identity) =>
        toSharedAuthIdentity(identity, readProviderKind(this.database.db, identity.provider)),
      );

    return { ok: true, body: { identities } };
  }

  unlinkAllOAuthIdentities(
    actor: PublicUser,
    context: AuthRequestContext,
  ): OAuthUnlinkAllIdentitiesResult {
    const nowIso = new Date().toISOString();

    return this.database.db.transaction((tx) =>
      withActiveSystemAdminActor(tx, actor, (actorUser) => {
        if (countActiveLocalSystemAdmins(tx) === 0) {
          return { ok: false, status: 409, body: lastSystemAdminRequiredError };
        }

        const deletedIdentityCount = countOAuthIdentityRows(tx);
        const revokedOAuthSessionCount = countOAuthSessionRows(tx);

        tx.delete(authIdentities).run();
        tx.delete(sessions).where(isNotNull(sessions.oauthProvider)).run();

        writeAuditLog(tx, {
          action: "auth.oauth.identities_unlinked_all",
          actorUserId: actorUser.id,
          targetType: "oauth_identity",
          targetId: null,
          ipAddress: context.ipAddress,
          createdAt: nowIso,
          metadata: {
            deletedIdentityCount,
            revokedOAuthSessionCount,
          },
        });

        return {
          ok: true,
          body: { status: "ok", deletedIdentityCount, revokedOAuthSessionCount },
        };
      }),
    );
  }

  logout(sessionToken: string | null, context: AuthRequestContext): void {
    const currentSession = this.findSession(sessionToken);

    if (!currentSession) {
      return;
    }

    const notificationHistoryRecorded = this.notificationHistory.tryInsertNotificationHistoryItem({
      userId: currentSession.user.id,
      eventId: "auth.signed_out",
      title: "Signed out.",
      description: null,
    });

    this.database.db.delete(sessions).where(eq(sessions.id, currentSession.session.id)).run();

    writeAuditLog(this.database.db, {
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

  getOAuthSessionProvider(sessionToken: string | null): AuthProviderSlug | null {
    const currentSession = this.findSession(sessionToken);

    return currentSession?.session.oauthProvider ?? null;
  }

  getUserProfile(sessionToken: string | null): UserProfileResult {
    const user = this.getCurrentUser(sessionToken);

    if (!user) {
      return { ok: false, status: 401, body: unauthenticatedError };
    }

    return { ok: true, user };
  }

  getNotificationPreferences(sessionToken: string | null): NotificationPreferencesResult {
    return this.notificationHistory.getNotificationPreferences(sessionToken);
  }

  updateNotificationPreferences(
    sessionToken: string | null,
    input: UpdateNotificationPreferencesRequest,
    context: AuthRequestContext,
  ): NotificationPreferencesResult {
    return this.notificationHistory.updateNotificationPreferences(sessionToken, input, context);
  }

  listNotificationHistory(
    sessionToken: string | null,
    input: { page?: number; pageSize?: number } = {},
  ): NotificationHistoryListResult {
    return this.notificationHistory.listNotificationHistory(sessionToken, input);
  }

  createNotificationHistory(
    sessionToken: string | null,
    input: CreateNotificationHistoryRequest,
  ): CreateNotificationHistoryResult {
    return this.notificationHistory.createNotificationHistory(sessionToken, input);
  }

  markNotificationHistoryRead(
    sessionToken: string | null,
    notificationId: string,
  ): MarkNotificationReadResult {
    return this.notificationHistory.markNotificationHistoryRead(sessionToken, notificationId);
  }

  clearNotificationHistory(sessionToken: string | null): ClearNotificationHistoryResult {
    return this.notificationHistory.clearNotificationHistory(sessionToken);
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
    const existingUser = findUserByUsernameOrEmail(this.database.db, username, email);

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

    writeAuditLog(this.database.db, {
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
      writeAuditLog(this.database.db, {
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

    writeAuditLog(this.database.db, {
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
      writeAuditLog(this.database.db, {
        action: "auth.permission.denied",
        actorUserId: currentSession.user.id,
        targetType: "permission",
        targetId: permission,
      });

      return { ok: false, status: 403, body: forbiddenError(permission) };
    }

    return { ok: true, user: toPublicUser(currentSession.user, permissions) };
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

  private isOAuthLoginEnabled(): boolean {
    const provider = this.database.db
      .select({ id: authProviders.id })
      .from(authProviders)
      .where(eq(authProviders.enabled, true))
      .get();

    return Boolean(provider);
  }

  private findUserById(userId: string): User | undefined {
    return this.database.db.select().from(users).where(eq(users.id, userId)).get();
  }

  private updateCurrentUser(userId: string, values: CurrentUserUpdateValues): User | undefined {
    this.database.db.update(users).set(values).where(eq(users.id, userId)).run();
    return this.findUserById(userId);
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
      writeAuditLog(tx, {
        actorUserId: user.id,
        action: "auth.setup.admin_created",
        targetType: "user",
        targetId: user.id,
        metadata: {
          username: user.username,
          email: user.email,
          permissions: [SYSTEM_ADMIN_PERMISSION],
        },
        ipAddress: context.ipAddress,
        createdAt: now.toISOString(),
      });

      return true;
    });
  }

  private createSession(
    user: User,
    context: AuthRequestContext,
    now = new Date(),
    tx: DatabaseReader = this.database.db,
    oauthSessionToken?: OAuthSessionToken,
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
        ...(oauthSessionToken
          ? {
              oauthProvider: oauthSessionToken.provider,
              oauthIdTokenEncrypted: oauthSessionToken.idTokenEncrypted,
              oauthMasterKeyId: oauthSessionToken.masterKeyId,
              oauthSid: oauthSessionToken.sid ?? null,
            }
          : {}),
        createdAt: now.toISOString(),
      })
      .run();

    return { sessionId, sessionToken, expiresAt };
  }
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
