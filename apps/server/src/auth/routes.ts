import type {
  AuthSetupStatusResponse,
  AuthUserResponse,
  ChangePasswordResponse,
  ClearNotificationHistoryResponse,
  CreateAdminResponse,
  CreateLocalUserResponse,
  CreateNotificationHistoryRequest,
  CreateNotificationHistoryResponse,
  LoginResponse,
  LogoutResponse,
  ManagedUserProfileResponse,
  ManagedUsersListResponse,
  MarkNotificationReadResponse,
  NotificationHistoryListResponse,
  NotificationPreferencesResponse,
  PermissionCatalogResponse,
  PublicUser,
  UpdateNotificationPreferencesResponse,
  UpdateUserProfileRequest,
  UpdateUserProfileResponse,
  UserProfileResponse,
} from "@arrtemplar/shared";
import {
  isProfileAvatarId,
  isProfileBannerId,
  isToastNotificationId,
  isUserPermission,
  NOTIFICATION_FREQUENCY_VALUES,
  PERMISSION_CATALOG,
  PERMISSION_CATEGORIES,
  PERMISSION_DEFAULT_GRANTS,
  PERMISSION_RISK_VALUES,
  PERMISSION_ROUTE_SURFACES,
  PROFILE_AVATAR_IDS,
  PROFILE_BANNER_IDS,
  TOAST_NOTIFICATION_EVENT_IDS,
  TOAST_NOTIFICATION_IMPORTANCE_VALUES,
  TOAST_NOTIFICATION_SEVERITY_VALUES,
  USER_PERMISSION_VALUES,
} from "@arrtemplar/shared";
import { Elysia, t } from "elysia";
import type { DatabaseClient } from "../db/client";
import { AuthService } from "./auth.service";
import { MIN_PASSWORD_LENGTH } from "./password";
import type { LoginRateLimiter } from "./rate-limit";
import { SESSION_COOKIE_NAME, SESSION_DURATION_SECONDS } from "./session-token";

const publicUserIdSchema = t.String({ minLength: 9, maxLength: 9, pattern: "^[A-Za-z0-9]{9}$" });
const userPermissionSchema = t.Union(
  USER_PERMISSION_VALUES.map((permission) => t.Literal(permission)) as [
    ReturnType<typeof t.Literal>,
    ...ReturnType<typeof t.Literal>[],
  ],
);
const permissionCategorySchema = t.Union(
  PERMISSION_CATEGORIES.map((category) => t.Literal(category)) as [
    ReturnType<typeof t.Literal>,
    ...ReturnType<typeof t.Literal>[],
  ],
);
const permissionRiskSchema = t.Union(
  PERMISSION_RISK_VALUES.map((risk) => t.Literal(risk)) as [
    ReturnType<typeof t.Literal>,
    ...ReturnType<typeof t.Literal>[],
  ],
);
const permissionDefaultGrantSchema = t.Union(
  PERMISSION_DEFAULT_GRANTS.map((grant) => t.Literal(grant)) as [
    ReturnType<typeof t.Literal>,
    ...ReturnType<typeof t.Literal>[],
  ],
);
const permissionRouteSurfaceSchema = t.Union(
  PERMISSION_ROUTE_SURFACES.map((surface) => t.Literal(surface)) as [
    ReturnType<typeof t.Literal>,
    ...ReturnType<typeof t.Literal>[],
  ],
);
const profileAvatarIdSchema = t.Union(
  PROFILE_AVATAR_IDS.map((avatarId) => t.Literal(avatarId)) as [
    ReturnType<typeof t.Literal>,
    ...ReturnType<typeof t.Literal>[],
  ],
);
const profileBannerIdSchema = t.Union(
  PROFILE_BANNER_IDS.map((bannerId) => t.Literal(bannerId)) as [
    ReturnType<typeof t.Literal>,
    ...ReturnType<typeof t.Literal>[],
  ],
);
const notificationFrequencySchema = t.Union([
  t.Literal(NOTIFICATION_FREQUENCY_VALUES[0]),
  t.Literal(NOTIFICATION_FREQUENCY_VALUES[1]),
]);
const toastNotificationEventIdSchema = t.Union(
  TOAST_NOTIFICATION_EVENT_IDS.map((eventId) => t.Literal(eventId)) as [
    ReturnType<typeof t.Literal>,
    ...ReturnType<typeof t.Literal>[],
  ],
);
const toastNotificationSeveritySchema = t.Union(
  TOAST_NOTIFICATION_SEVERITY_VALUES.map((severity) => t.Literal(severity)) as [
    ReturnType<typeof t.Literal>,
    ...ReturnType<typeof t.Literal>[],
  ],
);
const toastNotificationImportanceSchema = t.Union(
  TOAST_NOTIFICATION_IMPORTANCE_VALUES.map((importance) => t.Literal(importance)) as [
    ReturnType<typeof t.Literal>,
    ...ReturnType<typeof t.Literal>[],
  ],
);

const notificationPreferencesSchema = t.Object({
  toastsEnabled: t.Boolean(),
  frequency: notificationFrequencySchema,
});

const notificationHistoryItemSchema = t.Object({
  id: t.String({ minLength: 1, maxLength: 80 }),
  eventId: toastNotificationEventIdSchema,
  title: t.String({ minLength: 1, maxLength: 160 }),
  description: t.Union([t.String({ maxLength: 500 }), t.Null()]),
  severity: toastNotificationSeveritySchema,
  importance: toastNotificationImportanceSchema,
  readAt: t.Union([t.String(), t.Null()]),
  createdAt: t.String(),
});

const notificationHistoryPaginationSchema = t.Object({
  page: t.Number({ minimum: 1 }),
  pageSize: t.Number({ minimum: 1, maximum: 50 }),
  totalItems: t.Number({ minimum: 0 }),
  totalPages: t.Number({ minimum: 0 }),
});

const permissionRouteSchema = t.Object({
  surface: permissionRouteSurfaceSchema,
  path: t.String(),
});

const publicUserSchema = t.Object({
  id: publicUserIdSchema,
  username: t.String(),
  email: t.String({ format: "email" }),
  avatarId: profileAvatarIdSchema,
  bannerId: profileBannerIdSchema,
  notificationPreferences: notificationPreferencesSchema,
  permissions: t.Array(userPermissionSchema),
  createdAt: t.String({ format: "date-time" }),
  lastLoginAt: t.Union([t.String({ format: "date-time" }), t.Null()]),
});

const managedUserSummarySchema = t.Object({
  id: publicUserIdSchema,
  username: t.String(),
  disabledAt: t.Union([t.String({ format: "date-time" }), t.Null()]),
  createdAt: t.String({ format: "date-time" }),
  updatedAt: t.String({ format: "date-time" }),
  permissions: t.Array(userPermissionSchema),
});

const managedUserProfileSchema = t.Object({
  ...managedUserSummarySchema.properties,
  email: t.String({ format: "email" }),
  avatarId: profileAvatarIdSchema,
  bannerId: profileBannerIdSchema,
  lastLoginAt: t.Union([t.String({ format: "date-time" }), t.Null()]),
});

const permissionCatalogEntrySchema = t.Object({
  permission: userPermissionSchema,
  category: permissionCategorySchema,
  label: t.String(),
  description: t.String(),
  risk: permissionRiskSchema,
  defaultGrant: permissionDefaultGrantSchema,
  route: t.Union([permissionRouteSchema, t.Null()]),
});

const loginRequestSchema = t.Object({
  email: t.String({ format: "email" }),
  password: t.String({ minLength: 1, maxLength: 1024 }),
});

const createAdminRequestSchema = t.Object({
  username: t.String({ minLength: 1, maxLength: 80, pattern: ".*\\S.*" }),
  email: t.String({ format: "email" }),
  password: t.String({ minLength: MIN_PASSWORD_LENGTH, maxLength: 1024 }),
});

const createLocalUserRequestSchema = t.Object({
  username: t.String({ minLength: 1, maxLength: 80, pattern: ".*\\S.*" }),
  email: t.String({ format: "email" }),
  password: t.String({ minLength: MIN_PASSWORD_LENGTH, maxLength: 1024 }),
});

const updateUserProfileRequestSchema = t.Object({
  avatarId: t.Optional(profileAvatarIdSchema),
  bannerId: t.Optional(profileBannerIdSchema),
  username: t.Optional(t.String({ minLength: 1, maxLength: 80, pattern: ".*\\S.*" })),
  email: t.Optional(t.String({ format: "email" })),
});

const changePasswordRequestSchema = t.Object({
  currentPassword: t.String({ minLength: 1, maxLength: 1024 }),
  newPassword: t.String({ minLength: MIN_PASSWORD_LENGTH, maxLength: 1024 }),
});

const updateNotificationPreferencesRequestSchema = notificationPreferencesSchema;
const createNotificationHistoryRequestSchema = t.Object({
  eventId: toastNotificationEventIdSchema,
  title: t.String({ minLength: 1, maxLength: 160, pattern: ".*\\S.*" }),
  description: t.Optional(t.String({ maxLength: 500 })),
});
const markNotificationReadRequestSchema = t.Object({
  read: t.Literal(true),
});
const notificationHistoryQuerySchema = t.Object({
  page: t.Optional(t.Numeric({ minimum: 1 })),
  pageSize: t.Optional(t.Numeric({ minimum: 1, maximum: 50 })),
});
const notificationHistoryParamsSchema = t.Object({
  notificationId: t.String({ minLength: 1, maxLength: 80 }),
});

const managedUserParamsSchema = t.Object({
  publicUserId: publicUserIdSchema,
});

const managedUserPasswordRequestSchema = t.Object({
  password: t.String({ minLength: MIN_PASSWORD_LENGTH, maxLength: 1024 }),
});

const managedUserPermissionsRequestSchema = t.Object({
  permissions: t.Array(userPermissionSchema),
});

const managedUserStatusRequestSchema = t.Object({
  disabled: t.Boolean(),
});

const loginResponseSchema = t.Object({ user: publicUserSchema });
const createAdminResponseSchema = t.Object({ user: publicUserSchema });
const createLocalUserResponseSchema = t.Object({ user: managedUserSummarySchema });
const managedUsersListResponseSchema = t.Object({ users: t.Array(managedUserSummarySchema) });
const managedUserResponseSchema = t.Object({ user: managedUserSummarySchema });
const managedUserProfileResponseSchema = t.Object({ user: managedUserProfileSchema });
const permissionCatalogResponseSchema = t.Object({
  permissions: t.Array(permissionCatalogEntrySchema),
});
const authSetupStatusResponseSchema = t.Object({ required: t.Boolean() });
const authUserResponseSchema = t.Object({ user: t.Union([publicUserSchema, t.Null()]) });
const userProfileResponseSchema = t.Object({ user: publicUserSchema });
const updateUserProfileResponseSchema = t.Object({ user: publicUserSchema });
const notificationPreferencesResponseSchema = t.Object({
  notificationPreferences: notificationPreferencesSchema,
});
const notificationHistoryListResponseSchema = t.Object({
  notifications: t.Array(notificationHistoryItemSchema),
  unreadCount: t.Number({ minimum: 0 }),
  pagination: notificationHistoryPaginationSchema,
});
const createNotificationHistoryResponseSchema = t.Object({
  notification: notificationHistoryItemSchema,
});
const markNotificationReadResponseSchema = t.Object({
  notification: notificationHistoryItemSchema,
});
const clearNotificationHistoryResponseSchema = t.Object({
  status: t.Literal("ok"),
  deletedCount: t.Number({ minimum: 0 }),
});
const logoutResponseSchema = t.Object({ status: t.Literal("ok") });
const changePasswordResponseSchema = t.Object({ status: t.Literal("ok") });
const sessionCookieSchema = t.Cookie({
  [SESSION_COOKIE_NAME]: t.Optional(t.String()),
});
const apiErrorResponseSchema = t.Object({
  error: t.Object({
    code: t.String(),
    message: t.String(),
  }),
});

export type AuthRoutesOptions = {
  database: DatabaseClient;
  sessionCookieSecure: boolean;
  rateLimiter?: LoginRateLimiter;
};

export function createAuthRoutes(options: AuthRoutesOptions) {
  const authService = new AuthService(options.database, options.rateLimiter);

  return new Elysia({ prefix: "/api" })
    .use(createSetupRoutes(authService, options))
    .use(createSessionRoutes(authService, options))
    .use(createProfileRoutes(authService))
    .use(createPermissionRoutes(authService))
    .use(createUsersRoutes(authService));
}

function createSetupRoutes(authService: AuthService, options: AuthRoutesOptions) {
  return new Elysia()
    .get(
      "/auth/setup",
      (): AuthSetupStatusResponse => ({ required: authService.isSetupRequired() }),
      {
        response: authSetupStatusResponseSchema,
        detail: {
          summary: "Check first-run admin setup",
          description: "Returns whether the app needs the first admin account to be created.",
          tags: ["Auth"],
        },
      },
    )
    .post(
      "/auth/setup",
      async ({ body, cookie, request, status }) => {
        const result = await authService.createInitialAdmin(body, createRequestContext(request));

        if (!result.ok) {
          return status(result.status, result.body);
        }

        return writeSessionUserResponse(cookie[SESSION_COOKIE_NAME], options, result);
      },
      {
        body: createAdminRequestSchema,
        cookie: sessionCookieSchema,
        response: {
          200: createAdminResponseSchema,
          409: apiErrorResponseSchema,
        },
        detail: {
          summary: "Create first admin account",
          description:
            "Creates the first user, grants system:admin, and signs the user in. Disabled after any user exists.",
          tags: ["Auth"],
        },
      },
    );
}

function createSessionRoutes(authService: AuthService, options: AuthRoutesOptions) {
  return new Elysia()
    .post(
      "/auth/login",
      async ({ body, cookie, request, status }) => {
        const result = await authService.login(body, createRequestContext(request));

        if (!result.ok) {
          return status(result.status, result.body);
        }

        return writeSessionUserResponse(cookie[SESSION_COOKIE_NAME], options, result);
      },
      {
        body: loginRequestSchema,
        response: {
          200: loginResponseSchema,
          401: apiErrorResponseSchema,
          429: apiErrorResponseSchema,
        },
        cookie: sessionCookieSchema,
        detail: {
          summary: "Log in",
          description: "Creates a server-side session and sets a secure HttpOnly cookie.",
          tags: ["Auth"],
        },
      },
    )
    .post(
      "/auth/logout",
      ({ cookie, request }) => {
        const sessionCookie = cookie[SESSION_COOKIE_NAME];
        authService.logout(readSessionToken(sessionCookie.value), createRequestContext(request));
        sessionCookie.remove();

        return { status: "ok" } satisfies LogoutResponse;
      },
      {
        cookie: sessionCookieSchema,
        response: logoutResponseSchema,
        detail: {
          summary: "Log out",
          description: "Deletes the current server-side session and clears the session cookie.",
          tags: ["Auth"],
        },
      },
    )
    .get(
      "/auth/me",
      ({ cookie }) => {
        const user = authService.getCurrentUser(
          readSessionToken(cookie[SESSION_COOKIE_NAME].value),
        );

        return { user } satisfies AuthUserResponse;
      },
      {
        cookie: sessionCookieSchema,
        response: authUserResponseSchema,
        detail: {
          summary: "Get current user",
          description: "Returns the current authenticated user or null for anonymous clients.",
          tags: ["Auth"],
        },
      },
    );
}

function createProfileRoutes(authService: AuthService) {
  return new Elysia()
    .get(
      "/profile",
      ({ cookie, status }) => {
        const result = authService.getUserProfile(
          readSessionToken(cookie[SESSION_COOKIE_NAME].value),
        );

        if (!result.ok) {
          return status(result.status, result.body);
        }

        return { user: result.user } satisfies UserProfileResponse;
      },
      {
        cookie: sessionCookieSchema,
        response: {
          200: userProfileResponseSchema,
          401: apiErrorResponseSchema,
        },
        detail: {
          summary: "Get profile",
          description: "Returns the authenticated user's own profile.",
          tags: ["Auth"],
        },
      },
    )
    .get(
      "/profile/notifications",
      ({ cookie, status }) => {
        const result = authService.getNotificationPreferences(
          readSessionToken(cookie[SESSION_COOKIE_NAME].value),
        );

        if (!result.ok) {
          return status(result.status, result.body);
        }

        return {
          notificationPreferences: result.notificationPreferences,
        } satisfies NotificationPreferencesResponse;
      },
      {
        cookie: sessionCookieSchema,
        response: {
          200: notificationPreferencesResponseSchema,
          401: apiErrorResponseSchema,
        },
        detail: {
          summary: "Get notification preferences",
          description: "Returns the authenticated user's own toast notification preferences.",
          tags: ["Auth"],
        },
      },
    )
    .put(
      "/profile/notifications",
      ({ body, cookie, request, status }) => {
        const result = authService.updateNotificationPreferences(
          readSessionToken(cookie[SESSION_COOKIE_NAME].value),
          body,
          createRequestContext(request),
        );

        if (!result.ok) {
          return status(result.status, result.body);
        }

        return {
          notificationPreferences: result.notificationPreferences,
        } satisfies UpdateNotificationPreferencesResponse;
      },
      {
        body: updateNotificationPreferencesRequestSchema,
        cookie: sessionCookieSchema,
        response: {
          200: notificationPreferencesResponseSchema,
          401: apiErrorResponseSchema,
        },
        detail: {
          summary: "Update notification preferences",
          description: "Replaces the authenticated user's own toast notification preferences.",
          tags: ["Auth"],
        },
      },
    )
    .get(
      "/profile/notifications/history",
      ({ cookie, query, status }) => {
        const result = authService.listNotificationHistory(
          readSessionToken(cookie[SESSION_COOKIE_NAME].value),
          query,
        );

        if (!result.ok) {
          return status(result.status, result.body);
        }

        return result.body satisfies NotificationHistoryListResponse;
      },
      {
        cookie: sessionCookieSchema,
        query: notificationHistoryQuerySchema,
        response: {
          200: notificationHistoryListResponseSchema,
          401: apiErrorResponseSchema,
        },
        detail: {
          summary: "List notification history",
          description: "Returns paginated notification history for the authenticated user only.",
          tags: ["Auth"],
        },
      },
    )
    .post(
      "/profile/notifications/history",
      ({ body, cookie, status }) => {
        const input = normalizeCreateNotificationHistoryRequest(body);

        if (!input) {
          return status(422, {
            error: {
              code: "INVALID_NOTIFICATION_HISTORY_INPUT",
              message: "Notification history input is invalid.",
            },
          });
        }

        const result = authService.createNotificationHistory(
          readSessionToken(cookie[SESSION_COOKIE_NAME].value),
          input,
        );

        if (!result.ok) {
          return status(result.status, result.body);
        }

        return result.body satisfies CreateNotificationHistoryResponse;
      },
      {
        body: createNotificationHistoryRequestSchema,
        cookie: sessionCookieSchema,
        response: {
          200: createNotificationHistoryResponseSchema,
          401: apiErrorResponseSchema,
          422: apiErrorResponseSchema,
        },
        detail: {
          summary: "Create notification history item",
          description:
            "Creates a notification history item for the authenticated user and derives classification server-side.",
          tags: ["Auth"],
        },
      },
    )
    .patch(
      "/profile/notifications/history/:notificationId",
      ({ cookie, params, status }) => {
        const result = authService.markNotificationHistoryRead(
          readSessionToken(cookie[SESSION_COOKIE_NAME].value),
          params.notificationId,
        );

        if (!result.ok) {
          return status(result.status, result.body);
        }

        return result.body satisfies MarkNotificationReadResponse;
      },
      {
        body: markNotificationReadRequestSchema,
        cookie: sessionCookieSchema,
        params: notificationHistoryParamsSchema,
        response: {
          200: markNotificationReadResponseSchema,
          401: apiErrorResponseSchema,
          404: apiErrorResponseSchema,
        },
        detail: {
          summary: "Mark notification read",
          description: "Marks one authenticated-user notification history item read.",
          tags: ["Auth"],
        },
      },
    )
    .delete(
      "/profile/notifications/history",
      ({ cookie, status }) => {
        const result = authService.clearNotificationHistory(
          readSessionToken(cookie[SESSION_COOKIE_NAME].value),
        );

        if (!result.ok) {
          return status(result.status, result.body);
        }

        return result.body satisfies ClearNotificationHistoryResponse;
      },
      {
        cookie: sessionCookieSchema,
        response: {
          200: clearNotificationHistoryResponseSchema,
          401: apiErrorResponseSchema,
        },
        detail: {
          summary: "Clear notification history",
          description: "Deletes notification history for the authenticated user only.",
          tags: ["Auth"],
        },
      },
    )
    .put(
      "/profile",
      ({ body, cookie, request, status }) => {
        const result = authService.updateUserProfile(
          readSessionToken(cookie[SESSION_COOKIE_NAME].value),
          normalizeUpdateUserProfileRequest(body),
          createRequestContext(request),
        );

        if (!result.ok) {
          return status(result.status, result.body);
        }

        return { user: result.user } satisfies UpdateUserProfileResponse;
      },
      {
        body: updateUserProfileRequestSchema,
        cookie: sessionCookieSchema,
        response: {
          200: updateUserProfileResponseSchema,
          401: apiErrorResponseSchema,
          409: apiErrorResponseSchema,
        },
        detail: {
          summary: "Update profile",
          description: "Updates username and email for the authenticated user only.",
          tags: ["Auth"],
        },
      },
    )
    .put(
      "/profile/password",
      async ({ body, cookie, request, status }) => {
        const result = await authService.changePassword(
          readSessionToken(cookie[SESSION_COOKIE_NAME].value),
          body,
          createRequestContext(request),
        );

        if (!result.ok) {
          return status(result.status, result.body);
        }

        return result.body satisfies ChangePasswordResponse;
      },
      {
        body: changePasswordRequestSchema,
        cookie: sessionCookieSchema,
        response: {
          200: changePasswordResponseSchema,
          401: apiErrorResponseSchema,
        },
        detail: {
          summary: "Change own password",
          description:
            "Changes the authenticated user's password after verifying the current password.",
          tags: ["Auth"],
        },
      },
    );
}

function createPermissionRoutes(authService: AuthService) {
  return new Elysia().get(
    "/permissions/catalog",
    ({ cookie, status }) => {
      return withUsersManage(
        authService,
        cookie[SESSION_COOKIE_NAME].value,
        status,
        () => ({ permissions: [...PERMISSION_CATALOG] }) satisfies PermissionCatalogResponse,
      );
    },
    {
      cookie: sessionCookieSchema,
      response: {
        200: permissionCatalogResponseSchema,
        401: apiErrorResponseSchema,
        403: apiErrorResponseSchema,
      },
      detail: {
        summary: "List permission catalog",
        description:
          "Returns the shared permission catalog for user-management surfaces guarded by users:manage.",
        tags: ["Auth"],
      },
    },
  );
}

function createUsersRoutes(authService: AuthService) {
  return new Elysia()
    .get(
      "/users",
      ({ cookie, status }) => {
        return withUsersManage(authService, cookie[SESSION_COOKIE_NAME].value, status, (user) => {
          const result = authService.listUsers(user);

          return result.ok
            ? ({ users: result.users } satisfies ManagedUsersListResponse)
            : status(result.status, result.body);
        });
      },
      {
        cookie: sessionCookieSchema,
        response: {
          200: managedUsersListResponseSchema,
          401: apiErrorResponseSchema,
          403: apiErrorResponseSchema,
        },
        detail: {
          summary: "List users",
          description: "Returns safe user summaries for actors with users:manage or system:admin.",
          tags: ["Auth"],
        },
      },
    )
    .post(
      "/users",
      async ({ body, cookie, request, status }) => {
        return withUsersManageAsync(
          authService,
          cookie[SESSION_COOKIE_NAME].value,
          status,
          async (user) => {
            const result = await authService.createLocalUser(
              body,
              user,
              createRequestContext(request),
            );

            return result.ok
              ? ({ user: result.user } satisfies CreateLocalUserResponse)
              : status(result.status, result.body);
          },
        );
      },
      {
        body: createLocalUserRequestSchema,
        cookie: sessionCookieSchema,
        response: {
          200: createLocalUserResponseSchema,
          401: apiErrorResponseSchema,
          403: apiErrorResponseSchema,
          409: apiErrorResponseSchema,
        },
        detail: {
          summary: "Create user",
          description:
            "Creates a local user account when the actor has users:manage plus users:create.",
          tags: ["Auth"],
        },
      },
    )
    .get(
      "/users/:publicUserId",
      ({ cookie, params, status }) => {
        return withUsersManage(authService, cookie[SESSION_COOKIE_NAME].value, status, (user) => {
          const result = authService.getManagedUserProfile(params.publicUserId, user);

          return result.ok
            ? ({ user: result.user } satisfies ManagedUserProfileResponse)
            : status(result.status, result.body);
        });
      },
      {
        params: managedUserParamsSchema,
        cookie: sessionCookieSchema,
        response: {
          200: managedUserProfileResponseSchema,
          401: apiErrorResponseSchema,
          403: apiErrorResponseSchema,
          404: apiErrorResponseSchema,
        },
        detail: {
          summary: "Get managed user profile",
          description:
            "Returns a managed user's profile for actors with users:manage or system:admin.",
          tags: ["Auth"],
        },
      },
    )
    .put(
      "/users/:publicUserId/settings/main",
      ({ body, cookie, params, request, status }) =>
        runManagedUserMutation(
          authService,
          cookie[SESSION_COOKIE_NAME].value,
          params.publicUserId,
          normalizeUpdateUserProfileRequest(body),
          request,
          status,
          (publicUserId, input, user, context) =>
            authService.updateManagedUserProfile(publicUserId, input, user, context),
        ),
      {
        params: managedUserParamsSchema,
        body: updateUserProfileRequestSchema,
        cookie: sessionCookieSchema,
        response: {
          200: managedUserProfileResponseSchema,
          401: apiErrorResponseSchema,
          403: apiErrorResponseSchema,
          404: apiErrorResponseSchema,
          409: apiErrorResponseSchema,
        },
        detail: {
          summary: "Update managed user profile",
          description:
            "Updates another user's identity when the actor has users:manage plus users:update.",
          tags: ["Auth"],
        },
      },
    )
    .put(
      "/users/:publicUserId/settings/password",
      async ({ body, cookie, params, request, status }) => {
        return withUsersManageAsync(
          authService,
          cookie[SESSION_COOKIE_NAME].value,
          status,
          async (user) => {
            const result = await authService.changeManagedUserPassword(
              params.publicUserId,
              body,
              user,
              createRequestContext(request),
            );

            return result.ok
              ? (result.body satisfies ChangePasswordResponse)
              : status(result.status, result.body);
          },
        );
      },
      {
        params: managedUserParamsSchema,
        body: managedUserPasswordRequestSchema,
        cookie: sessionCookieSchema,
        response: {
          200: changePasswordResponseSchema,
          401: apiErrorResponseSchema,
          403: apiErrorResponseSchema,
          404: apiErrorResponseSchema,
          409: apiErrorResponseSchema,
        },
        detail: {
          summary: "Change managed user password",
          description:
            "Changes another user's password when the actor has users:manage plus users:password.",
          tags: ["Auth"],
        },
      },
    )
    .put(
      "/users/:publicUserId/settings/permissions",
      ({ body, cookie, params, request, status }) => {
        return runManagedUserMutation<Parameters<AuthService["updateManagedUserPermissions"]>[1]>(
          authService,
          cookie[SESSION_COOKIE_NAME].value,
          params.publicUserId,
          {
            permissions: body.permissions.filter(
              (permission): permission is (typeof USER_PERMISSION_VALUES)[number] =>
                typeof permission === "string" && isUserPermission(permission),
            ),
          },
          request,
          status,
          (publicUserId, input, user, context) =>
            authService.updateManagedUserPermissions(publicUserId, input, user, context),
        );
      },
      {
        params: managedUserParamsSchema,
        body: managedUserPermissionsRequestSchema,
        cookie: sessionCookieSchema,
        response: {
          200: managedUserResponseSchema,
          401: apiErrorResponseSchema,
          403: apiErrorResponseSchema,
          404: apiErrorResponseSchema,
          409: apiErrorResponseSchema,
        },
        detail: {
          summary: "Replace managed user permissions",
          description:
            "Replaces explicit permission grants when the actor has users:manage plus users:permissions.",
          tags: ["Auth"],
        },
      },
    )
    .patch(
      "/users/:publicUserId/status",
      createManagedUserMutationHandler<Parameters<AuthService["updateManagedUserStatus"]>[1]>(
        authService,
        (publicUserId, input, user, context) =>
          authService.updateManagedUserStatus(publicUserId, input, user, context),
      ),
      {
        params: managedUserParamsSchema,
        body: managedUserStatusRequestSchema,
        cookie: sessionCookieSchema,
        response: {
          200: managedUserResponseSchema,
          401: apiErrorResponseSchema,
          403: apiErrorResponseSchema,
          404: apiErrorResponseSchema,
          409: apiErrorResponseSchema,
        },
        detail: {
          summary: "Update managed user status",
          description:
            "Disables or restores another user when the actor has users:manage plus users:disable.",
          tags: ["Auth"],
        },
      },
    );
}

function readSessionToken(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function requireUsersManage(authService: AuthService, sessionCookieValue: unknown) {
  return authService.requirePermission(readSessionToken(sessionCookieValue), "users:manage");
}

function writeSessionUserResponse(
  sessionCookie: {
    value: string | undefined;
    httpOnly?: boolean | undefined;
    secure?: boolean | undefined;
    sameSite?: boolean | "none" | "lax" | "strict" | undefined;
    path?: string | undefined;
    maxAge?: number | undefined;
    expires?: Date | undefined;
  },
  options: AuthRoutesOptions,
  result: { expiresAt: Date; sessionToken: string; user: PublicUser },
): CreateAdminResponse | LoginResponse {
  writeSessionCookie(sessionCookie, result.sessionToken, result.expiresAt, options);

  return { user: result.user };
}

// biome-ignore lint/suspicious/noExplicitAny: Elysia's SelectiveStatus callback type varies per route and is impractical to model precisely for these shared helpers.
type StatusHandler = (...args: any[]) => any;

function withUsersManage<T>(
  authService: AuthService,
  sessionCookieValue: unknown,
  status: StatusHandler,
  onAllowed: (user: PublicUser) => T,
): T | ReturnType<StatusHandler> {
  const permissionResult = requireUsersManage(authService, sessionCookieValue);

  if (!permissionResult.ok) {
    return status(permissionResult.status, permissionResult.body);
  }

  return onAllowed(permissionResult.user);
}

async function withUsersManageAsync<T>(
  authService: AuthService,
  sessionCookieValue: unknown,
  status: StatusHandler,
  onAllowed: (user: PublicUser) => Promise<T>,
): Promise<T | ReturnType<StatusHandler>> {
  const permissionResult = requireUsersManage(authService, sessionCookieValue);

  if (!permissionResult.ok) {
    return status(permissionResult.status, permissionResult.body);
  }

  return onAllowed(permissionResult.user);
}

function runManagedUserMutation<TBody>(
  authService: AuthService,
  sessionCookieValue: unknown,
  publicUserId: string,
  input: TBody,
  request: Request,
  status: StatusHandler,
  mutate: (
    publicUserId: string,
    input: TBody,
    user: PublicUser,
    context: ReturnType<typeof createRequestContext>,
  ) => { ok: false; status: 401 | 403 | 404 | 409; body: unknown } | { ok: true; user: unknown },
): { user: unknown } | ReturnType<StatusHandler> {
  return withUsersManage(authService, sessionCookieValue, status, (user) =>
    managedUserResponseOrStatus(
      mutate(publicUserId, input, user, createRequestContext(request)),
      status,
    ),
  );
}

function managedUserResponseOrStatus(
  result: { ok: false; status: 401 | 403 | 404 | 409; body: unknown } | { ok: true; user: unknown },
  status: StatusHandler,
) {
  return result.ok ? { user: result.user } : status(result.status, result.body);
}

function createManagedUserMutationHandler<TBody>(
  authService: AuthService,
  mutate: (
    publicUserId: string,
    input: TBody,
    user: PublicUser,
    context: ReturnType<typeof createRequestContext>,
  ) => { ok: false; status: 401 | 403 | 404 | 409; body: unknown } | { ok: true; user: unknown },
) {
  return ({
    body,
    cookie,
    params,
    request,
    status,
  }: {
    body: TBody;
    cookie: Record<string, { value?: unknown } | undefined>;
    params: { publicUserId: string };
    request: Request;
    status: StatusHandler;
  }) =>
    runManagedUserMutation(
      authService,
      cookie[SESSION_COOKIE_NAME]?.value,
      params.publicUserId,
      body,
      request,
      status,
      mutate,
    );
}

function normalizeUpdateUserProfileRequest(input: {
  avatarId?: unknown;
  bannerId?: unknown;
  email?: string;
  username?: string;
}): UpdateUserProfileRequest {
  return {
    ...(isProfileAvatarId(input.avatarId) ? { avatarId: input.avatarId } : {}),
    ...(isProfileBannerId(input.bannerId) ? { bannerId: input.bannerId } : {}),
    ...(input.email ? { email: input.email } : {}),
    ...(input.username ? { username: input.username } : {}),
  };
}

function normalizeCreateNotificationHistoryRequest(input: {
  description?: string;
  eventId: unknown;
  title: string;
}): CreateNotificationHistoryRequest | null {
  if (!isToastNotificationId(input.eventId)) {
    return null;
  }

  return {
    eventId: input.eventId,
    title: input.title,
    ...(typeof input.description === "string" ? { description: input.description } : {}),
  };
}

function writeSessionCookie(
  sessionCookie: {
    value: string | undefined;
    httpOnly?: boolean | undefined;
    secure?: boolean | undefined;
    sameSite?: boolean | "none" | "lax" | "strict" | undefined;
    path?: string | undefined;
    maxAge?: number | undefined;
    expires?: Date | undefined;
  },
  sessionToken: string,
  expiresAt: Date,
  options: AuthRoutesOptions,
): void {
  sessionCookie.value = sessionToken;
  sessionCookie.httpOnly = true;
  sessionCookie.secure = options.sessionCookieSecure;
  sessionCookie.sameSite = "lax";
  sessionCookie.path = "/";
  sessionCookie.maxAge = SESSION_DURATION_SECONDS;
  sessionCookie.expires = expiresAt;
}

function createRequestContext(request: Request): {
  ipAddress: string | null;
  userAgent: string | null;
} {
  return {
    ipAddress: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null,
    userAgent: request.headers.get("user-agent"),
  };
}
