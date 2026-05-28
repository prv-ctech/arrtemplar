import type {
  AdminChangeUserPasswordRequest,
  AdminChangeUserPasswordResponse,
  AdminChangeUserRoleRequest,
  AdminDisableUserRequest,
  AdminPermissionCatalogResponse,
  AdminUpdateUserPermissionsRequest,
  AdminUpdateUserStatusRequest,
  AdminUserResponse,
  AdminUsersListResponse,
  AuthSetupStatusResponse,
  AuthUserResponse,
  ChangePasswordResponse,
  CreateAdminResponse,
  CreateLocalUserResponse,
  LoginResponse,
  LogoutResponse,
  UpdateUserProfileResponse,
  UserProfileResponse,
} from "@arrtemplar/shared";
import { ADMIN_PERMISSION_CATALOG, USER_PERMISSION_VALUES } from "@arrtemplar/shared";
import { Elysia, t } from "elysia";
import type { DatabaseClient } from "../db/client";
import { AuthService } from "./auth.service";
import { MIN_PASSWORD_LENGTH } from "./password";
import type { LoginRateLimiter } from "./rate-limit";
import { SESSION_COOKIE_NAME, SESSION_DURATION_SECONDS } from "./session-token";

const userRoleSchema = t.Union([t.Literal("user"), t.Literal("mod"), t.Literal("admin")]);
const managedUserRoleSchema = t.Union([t.Literal("user"), t.Literal("mod")]);
const publicUserIdSchema = t.String({ minLength: 9, maxLength: 9, pattern: "^[A-Za-z0-9]{9}$" });
const userPermissionSchema = t.Union([
  t.Literal(USER_PERMISSION_VALUES[0]),
  t.Literal(USER_PERMISSION_VALUES[1]),
  t.Literal(USER_PERMISSION_VALUES[2]),
  t.Literal(USER_PERMISSION_VALUES[3]),
  t.Literal(USER_PERMISSION_VALUES[4]),
  t.Literal(USER_PERMISSION_VALUES[5]),
  t.Literal(USER_PERMISSION_VALUES[6]),
  t.Literal(USER_PERMISSION_VALUES[7]),
]);

const publicUserSchema = t.Object({
  id: publicUserIdSchema,
  username: t.String(),
  email: t.String({ format: "email" }),
  role: userRoleSchema,
  permissions: t.Array(userPermissionSchema),
  createdAt: t.String({ format: "date-time" }),
  lastLoginAt: t.Union([t.String({ format: "date-time" }), t.Null()]),
});

const adminUserSummarySchema = t.Object({
  id: publicUserIdSchema,
  username: t.String(),
  role: managedUserRoleSchema,
  disabledAt: t.Union([t.String({ format: "date-time" }), t.Null()]),
  createdAt: t.String({ format: "date-time" }),
  updatedAt: t.String({ format: "date-time" }),
  permissions: t.Array(userPermissionSchema),
});

const adminPermissionCatalogEntrySchema = t.Object({
  permission: userPermissionSchema,
  label: t.String(),
  description: t.String(),
  routeSlug: t.String(),
  sourceAdminRoute: t.String(),
  minimumRole: t.Union([t.Literal("mod"), t.Literal("admin")]),
  risk: t.Union([t.Literal("standard"), t.Literal("high")]),
  augmentsPersonalRoute: t.Boolean(),
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
  username: t.Optional(t.String({ minLength: 1, maxLength: 80, pattern: ".*\\S.*" })),
  email: t.Optional(t.String({ format: "email" })),
});

const changePasswordRequestSchema = t.Object({
  currentPassword: t.String({ minLength: 1, maxLength: 1024 }),
  newPassword: t.String({ minLength: MIN_PASSWORD_LENGTH, maxLength: 1024 }),
});

const adminUserParamsSchema = t.Object({
  id: publicUserIdSchema,
});

const adminChangeUserPasswordRequestSchema = t.Object({
  password: t.String({ minLength: MIN_PASSWORD_LENGTH, maxLength: 1024 }),
  currentAdminPassword: t.String({ minLength: 1, maxLength: 1024 }),
});

const adminChangeUserRoleRequestSchema = t.Object({
  role: managedUserRoleSchema,
  currentAdminPassword: t.String({ minLength: 1, maxLength: 1024 }),
});

const adminDisableUserRequestSchema = t.Object({
  currentAdminPassword: t.String({ minLength: 1, maxLength: 1024 }),
});

const adminUpdateUserStatusRequestSchema = t.Object({
  disabled: t.Literal(false),
  currentAdminPassword: t.String({ minLength: 1, maxLength: 1024 }),
});

const adminUpdateUserPermissionsRequestSchema = t.Object({
  permissions: t.Array(userPermissionSchema),
  currentAdminPassword: t.String({ minLength: 1, maxLength: 1024 }),
});

const loginResponseSchema = t.Object({ user: publicUserSchema });
const createAdminResponseSchema = t.Object({ user: publicUserSchema });
const createLocalUserResponseSchema = t.Object({ user: publicUserSchema });
const adminUsersListResponseSchema = t.Object({ users: t.Array(adminUserSummarySchema) });
const adminUserResponseSchema = t.Object({ user: adminUserSummarySchema });
const adminPermissionCatalogResponseSchema = t.Object({
  permissions: t.Array(adminPermissionCatalogEntrySchema),
});
const authSetupStatusResponseSchema = t.Object({ required: t.Boolean() });
const authUserResponseSchema = t.Object({ user: t.Union([publicUserSchema, t.Null()]) });
const userProfileResponseSchema = t.Object({ user: publicUserSchema });
const updateUserProfileResponseSchema = t.Object({ user: publicUserSchema });
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

const adminUserMutationResponseSchemas = {
  200: adminUserResponseSchema,
  401: apiErrorResponseSchema,
  403: apiErrorResponseSchema,
  404: apiErrorResponseSchema,
  409: apiErrorResponseSchema,
};

const adminUserMutationRouteSchemas = {
  params: adminUserParamsSchema,
  cookie: sessionCookieSchema,
  response: adminUserMutationResponseSchemas,
};

export type AuthRoutesOptions = {
  database: DatabaseClient;
  sessionCookieSecure: boolean;
  rateLimiter?: LoginRateLimiter;
};

type AdminRoleFailure = Extract<ReturnType<AuthService["requireRole"]>, { ok: false }>;
type AdminTargetMutationBase = { sessionCookieValue: unknown };
type AdminPasswordMutation = AdminTargetMutationBase & {
  body: AdminChangeUserPasswordRequest;
  kind: "password";
};
type AdminRoleMutation = AdminTargetMutationBase & {
  body: AdminChangeUserRoleRequest;
  kind: "role";
};
type AdminDisableMutation = AdminTargetMutationBase & {
  body: AdminDisableUserRequest;
  kind: "disable";
};
type AdminStatusMutation = AdminTargetMutationBase & {
  body: AdminUpdateUserStatusRequest;
  kind: "status";
};
type AdminPermissionsMutation = AdminTargetMutationBase & {
  body: AdminUpdateUserPermissionsRequest;
  kind: "permissions";
};
type AdminTargetMutation =
  | AdminPasswordMutation
  | AdminRoleMutation
  | AdminDisableMutation
  | AdminStatusMutation
  | AdminPermissionsMutation;
type AdminPasswordMutationResult = Awaited<
  ReturnType<AuthService["changeAdminManagedUserPassword"]>
>;
type AdminRoleMutationResult = Awaited<ReturnType<AuthService["changeAdminManagedUserRole"]>>;
type AdminDisableMutationResult = Awaited<ReturnType<AuthService["disableAdminManagedUser"]>>;
type AdminStatusMutationResult = Awaited<ReturnType<AuthService["updateAdminManagedUserStatus"]>>;
type AdminPermissionsMutationResult = Awaited<
  ReturnType<AuthService["updateAdminManagedUserPermissions"]>
>;
type AdminTargetMutationResult =
  | AdminPasswordMutationResult
  | AdminRoleMutationResult
  | AdminDisableMutationResult
  | AdminStatusMutationResult
  | AdminPermissionsMutationResult;

export function createAuthRoutes(options: AuthRoutesOptions) {
  const authService = new AuthService(options.database, options.rateLimiter);

  return new Elysia({ prefix: "/api" })
    .use(createSetupRoutes(authService, options))
    .use(createSessionRoutes(authService, options))
    .use(createUserRoutes(authService))
    .use(createAdminRoutes(authService));
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

        writeSessionCookie(
          cookie[SESSION_COOKIE_NAME],
          result.sessionToken,
          result.expiresAt,
          options,
        );

        return { user: result.user } satisfies CreateAdminResponse;
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
            "Creates the first user as an admin account and signs them in. Disabled after any user exists.",
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
          if (result.status === 429) {
            return status(429, result.body);
          }

          return status(401, result.body);
        }

        writeSessionCookie(
          cookie[SESSION_COOKIE_NAME],
          result.sessionToken,
          result.expiresAt,
          options,
        );

        return { user: result.user } satisfies LoginResponse;
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

function createUserRoutes(authService: AuthService) {
  return new Elysia()
    .get(
      "/user/profile",
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
          summary: "Get user profile",
          description: "Returns the authenticated user's own profile.",
          tags: ["Auth"],
        },
      },
    )
    .put(
      "/user/profile",
      ({ body, cookie, request, status }) => {
        const result = authService.updateUserProfile(
          readSessionToken(cookie[SESSION_COOKIE_NAME].value),
          body,
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
          summary: "Update user profile",
          description: "Updates username and email for the authenticated user only.",
          tags: ["Auth"],
        },
      },
    )
    .put(
      "/user/password",
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
          summary: "Change user password",
          description:
            "Changes the authenticated user's password after verifying the current password.",
          tags: ["Auth"],
        },
      },
    );
}

function createAdminRoutes(authService: AuthService) {
  return new Elysia()
    .get(
      "/admin/auth/check",
      ({ cookie, request, status }) => {
        const result = requireAdmin(authService, cookie[SESSION_COOKIE_NAME].value);

        if (!result.ok) return status(result.status, result.body);

        authService.recordAdminAuthCheck(result.user, createRequestContext(request));

        return { user: result.user } satisfies AuthUserResponse;
      },
      {
        cookie: sessionCookieSchema,
        response: {
          200: authUserResponseSchema,
          401: apiErrorResponseSchema,
          403: apiErrorResponseSchema,
        },
        detail: {
          summary: "Check admin authentication",
          description:
            "Protected admin endpoint used to verify session and admin-role enforcement.",
          tags: ["Auth"],
        },
      },
    )
    .get(
      "/admin/permission-catalog",
      ({ cookie, status }) => {
        const adminResult = requireAdmin(authService, cookie[SESSION_COOKIE_NAME].value);

        if (!adminResult.ok) return status(adminResult.status, adminResult.body);

        return {
          permissions: [...ADMIN_PERMISSION_CATALOG],
        } satisfies AdminPermissionCatalogResponse;
      },
      {
        cookie: sessionCookieSchema,
        response: {
          200: adminPermissionCatalogResponseSchema,
          401: apiErrorResponseSchema,
          403: apiErrorResponseSchema,
        },
        detail: {
          summary: "List grantable admin sections",
          description:
            "Admin-only endpoint returning the shared permission catalog for mod grants.",
          tags: ["Auth"],
        },
      },
    )
    .get(
      "/admin/users",
      ({ cookie, status }) => {
        const adminResult = requireAdmin(authService, cookie[SESSION_COOKIE_NAME].value);

        if (!adminResult.ok) {
          return status(adminResult.status, adminResult.body);
        }

        const result = authService.listAdminUsers();

        return { users: result.users } satisfies AdminUsersListResponse;
      },
      {
        cookie: sessionCookieSchema,
        response: {
          200: adminUsersListResponseSchema,
          401: apiErrorResponseSchema,
          403: apiErrorResponseSchema,
        },
        detail: {
          summary: "List local user accounts",
          description:
            "Admin-only endpoint returning safe local-account summaries without password hashes or session secrets.",
          tags: ["Auth"],
        },
      },
    )
    .post(
      "/admin/users",
      async ({ body, cookie, request, status }) => {
        const adminResult = requireAdmin(authService, cookie[SESSION_COOKIE_NAME].value);

        if (!adminResult.ok) return status(adminResult.status, adminResult.body);

        const result = await authService.createLocalUser(
          body,
          adminResult.user,
          createRequestContext(request),
        );

        if (!result.ok) {
          return status(result.status, result.body);
        }

        return { user: result.user } satisfies CreateLocalUserResponse;
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
          summary: "Create local user account",
          description:
            "Admin-only endpoint for creating local user accounts. Accounts created here always receive the user role.",
          tags: ["Auth"],
        },
      },
    )
    .patch(
      "/admin/users/:id/password",
      async ({ body, cookie, params, request, status }) => {
        const result = await runAdminTargetMutation(authService, request, params.id, {
          body,
          kind: "password",
          sessionCookieValue: cookie[SESSION_COOKIE_NAME].value,
        });

        return result.ok
          ? (result.body satisfies AdminChangeUserPasswordResponse)
          : status(result.status, result.body);
      },
      {
        body: adminChangeUserPasswordRequestSchema,
        params: adminUserParamsSchema,
        cookie: sessionCookieSchema,
        response: {
          200: changePasswordResponseSchema,
          401: apiErrorResponseSchema,
          403: apiErrorResponseSchema,
          404: apiErrorResponseSchema,
          409: apiErrorResponseSchema,
        },
        detail: {
          summary: "Change a local account password",
          description:
            "Admin-only high-risk endpoint that requires acting-admin password confirmation and revokes the target user's sessions.",
          tags: ["Auth"],
        },
      },
    )
    .patch(
      "/admin/users/:id/role",
      async ({ body, cookie, params, request, status }) => {
        const result = await runAdminTargetMutation(authService, request, params.id, {
          body,
          kind: "role",
          sessionCookieValue: cookie[SESSION_COOKIE_NAME].value,
        });

        return result.ok
          ? ({ user: result.user } satisfies AdminUserResponse)
          : status(result.status, result.body);
      },
      {
        ...adminUserMutationRouteSchemas,
        body: adminChangeUserRoleRequestSchema,
        detail: {
          summary: "Change a local account role",
          description:
            "Admin-only high-risk endpoint that requires acting-admin password confirmation, revokes target sessions, and protects the last active admin.",
          tags: ["Auth"],
        },
      },
    )
    .delete(
      "/admin/users/:id",
      async ({ body, cookie, params, request, status }) => {
        const result = await runAdminTargetMutation(authService, request, params.id, {
          body,
          kind: "disable",
          sessionCookieValue: cookie[SESSION_COOKIE_NAME].value,
        });

        return result.ok
          ? ({ user: result.user } satisfies AdminUserResponse)
          : status(result.status, result.body);
      },
      {
        ...adminUserMutationRouteSchemas,
        body: adminDisableUserRequestSchema,
        detail: {
          summary: "Remove local account access",
          description:
            "Admin-only high-risk endpoint that soft-deletes a local account by setting disabledAt, revokes target sessions, and protects the last active admin.",
          tags: ["Auth"],
        },
      },
    )
    .patch(
      "/admin/users/:id/permissions",
      async ({ body, cookie, params, request, status }) => {
        const result = await runAdminTargetMutation(authService, request, params.id, {
          body,
          kind: "permissions",
          sessionCookieValue: cookie[SESSION_COOKIE_NAME].value,
        });

        return result.ok
          ? ({ user: result.user } satisfies AdminUserResponse)
          : status(result.status, result.body);
      },
      {
        ...adminUserMutationRouteSchemas,
        body: adminUpdateUserPermissionsRequestSchema,
        detail: {
          summary: "Replace local account permission grants",
          description:
            "Admin-only high-risk endpoint that requires acting-admin password confirmation, validates grants against the shared catalog, and revokes target sessions.",
          tags: ["Auth"],
        },
      },
    )
    .patch(
      "/admin/users/:id/status",
      async ({ body, cookie, params, request, status }) => {
        const result = await runAdminTargetMutation(authService, request, params.id, {
          body,
          kind: "status",
          sessionCookieValue: cookie[SESSION_COOKIE_NAME].value,
        });

        return result.ok
          ? ({ user: result.user } satisfies AdminUserResponse)
          : status(result.status, result.body);
      },
      {
        ...adminUserMutationRouteSchemas,
        body: adminUpdateUserStatusRequestSchema,
        detail: {
          summary: "Restore local account access",
          description:
            "Admin-only high-risk endpoint that requires acting-admin password confirmation before re-enabling a disabled local account.",
          tags: ["Auth"],
        },
      },
    );
}

function readSessionToken(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function requireAdmin(authService: AuthService, sessionCookieValue: unknown) {
  return authService.requireRole(readSessionToken(sessionCookieValue), "admin");
}

function runAdminTargetMutation(
  authService: AuthService,
  request: Request,
  targetUserId: string,
  input: AdminPasswordMutation,
): Promise<AdminRoleFailure | AdminPasswordMutationResult>;
function runAdminTargetMutation(
  authService: AuthService,
  request: Request,
  targetUserId: string,
  input: AdminRoleMutation,
): Promise<AdminRoleFailure | AdminRoleMutationResult>;
function runAdminTargetMutation(
  authService: AuthService,
  request: Request,
  targetUserId: string,
  input: AdminDisableMutation,
): Promise<AdminRoleFailure | AdminDisableMutationResult>;
function runAdminTargetMutation(
  authService: AuthService,
  request: Request,
  targetUserId: string,
  input: AdminStatusMutation,
): Promise<AdminRoleFailure | AdminStatusMutationResult>;
function runAdminTargetMutation(
  authService: AuthService,
  request: Request,
  targetUserId: string,
  input: AdminPermissionsMutation,
): Promise<AdminRoleFailure | AdminPermissionsMutationResult>;
async function runAdminTargetMutation(
  authService: AuthService,
  request: Request,
  targetUserId: string,
  input: AdminTargetMutation,
): Promise<AdminRoleFailure | AdminTargetMutationResult> {
  const adminResult = requireAdmin(authService, input.sessionCookieValue);

  if (!adminResult.ok) return adminResult;

  const context = createRequestContext(request);

  switch (input.kind) {
    case "password":
      return authService.changeAdminManagedUserPassword(
        targetUserId,
        input.body,
        adminResult.user,
        context,
      );
    case "role":
      return authService.changeAdminManagedUserRole(
        targetUserId,
        input.body,
        adminResult.user,
        context,
      );
    case "disable":
      return authService.disableAdminManagedUser(
        targetUserId,
        input.body,
        adminResult.user,
        context,
      );
    case "status":
      return authService.updateAdminManagedUserStatus(
        targetUserId,
        input.body,
        adminResult.user,
        context,
      );
    case "permissions":
      return authService.updateAdminManagedUserPermissions(
        targetUserId,
        input.body,
        adminResult.user,
        context,
      );
  }
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
