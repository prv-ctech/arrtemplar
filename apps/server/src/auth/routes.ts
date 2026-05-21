import type {
  AuthSetupStatusResponse,
  AuthUserResponse,
  CreateAdminResponse,
  CreateLocalUserResponse,
  LoginResponse,
  LogoutResponse,
} from "@arrtemplar/shared";
import { Elysia, t } from "elysia";
import type { DatabaseClient } from "../db/client";
import { AuthService } from "./auth.service";
import { MIN_PASSWORD_LENGTH } from "./password";
import type { LoginRateLimiter } from "./rate-limit";
import { SESSION_COOKIE_NAME, SESSION_DURATION_SECONDS } from "./session-token";

const userRoleSchema = t.Union([t.Literal("admin"), t.Literal("user")]);

const publicUserSchema = t.Object({
  id: t.String(),
  username: t.String(),
  email: t.String({ format: "email" }),
  role: userRoleSchema,
  createdAt: t.String({ format: "date-time" }),
  lastLoginAt: t.Union([t.String({ format: "date-time" }), t.Null()]),
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

const loginResponseSchema = t.Object({ user: publicUserSchema });
const createAdminResponseSchema = t.Object({ user: publicUserSchema });
const createLocalUserResponseSchema = t.Object({ user: publicUserSchema });
const authSetupStatusResponseSchema = t.Object({ required: t.Boolean() });
const authUserResponseSchema = t.Object({ user: t.Union([publicUserSchema, t.Null()]) });
const logoutResponseSchema = t.Object({ status: t.Literal("ok") });
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

function createAdminRoutes(authService: AuthService) {
  return new Elysia()
    .get(
      "/admin/auth/check",
      ({ cookie, request, status }) => {
        const result = authService.requireRole(
          readSessionToken(cookie[SESSION_COOKIE_NAME].value),
          "admin",
        );

        if (!result.ok) {
          if (result.status === 403) {
            return status(403, result.body);
          }

          return status(401, result.body);
        }

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
    .post(
      "/admin/users",
      async ({ body, cookie, request, status }) => {
        const context = createRequestContext(request);
        const adminResult = authService.requireRole(
          readSessionToken(cookie[SESSION_COOKIE_NAME].value),
          "admin",
        );

        if (!adminResult.ok) {
          return status(adminResult.status, adminResult.body);
        }

        const result = await authService.createLocalUser(body, adminResult.user, context);

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
    );
}

function readSessionToken(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
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
