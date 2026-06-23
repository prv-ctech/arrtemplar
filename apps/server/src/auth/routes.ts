import type {
  ApiErrorResponse,
  AuthPatchProviderRequest,
  AuthProviderSlug,
  AuthProvidersListResponse,
  AuthSetupStatusResponse,
  AuthUnlinkAllIdentitiesResponse,
  AuthUpsertProviderRequest,
  AuthUserResponse,
  ChangePasswordResponse,
  ClearNotificationHistoryResponse,
  CreateAdminResponse,
  CreateLocalUserResponse,
  CreateNotificationHistoryRequest,
  CreateNotificationHistoryResponse,
  DeleteManagedUserResponse,
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
  AUTH_METHOD_VALUES,
  AUTH_PROVIDER_KIND_VALUES,
  AUTH_PROVIDER_SLUGS,
  isProfileAvatarId,
  isProfileBannerId,
  isToastNotificationId,
  isUserPermission,
  NOTIFICATION_FREQUENCY_VALUES,
  OIDC_PROFILE_SIGNING_ALGORITHM_VALUES,
  OIDC_SIGNING_ALGORITHM_VALUES,
  PERMISSION_CATALOG,
  PERMISSION_CATEGORIES,
  PERMISSION_DEFAULT_GRANTS,
  PERMISSION_RISK_VALUES,
  PERMISSION_ROUTE_SURFACES,
  PROFILE_AVATAR_IDS,
  PROFILE_BANNER_IDS,
  SYSTEM_ADMIN_PERMISSION,
  TOAST_NOTIFICATION_EVENT_IDS,
  TOAST_NOTIFICATION_IMPORTANCE_VALUES,
  TOAST_NOTIFICATION_SEVERITY_VALUES,
  TOKEN_ENDPOINT_AUTH_METHOD_VALUES,
  USER_PERMISSION_VALUES,
} from "@arrtemplar/shared";
import { Elysia, t } from "elysia";
import { env } from "../config/env";
import type { DatabaseClient } from "../db/client";
import {
  OAUTH_STATE_COOKIE_MAX_AGE_SECONDS,
  OAUTH_STATE_COOKIE_NAME,
} from "../security/oauth-state";
import { AuthService } from "./auth.service";
import { OAuthService } from "./oauth/oauth.service";
import { MIN_PASSWORD_LENGTH } from "./password";
import type { LoginRateLimiter } from "./rate-limit";
import { SESSION_COOKIE_NAME, SESSION_DURATION_SECONDS } from "./session-token";

const publicUserIdSchema = t.String({ minLength: 9, maxLength: 9, pattern: "^[A-Za-z0-9]{9}$" });
const authMethodSchema = t.Union(
  AUTH_METHOD_VALUES.map((authMethod) => t.Literal(authMethod)) as [
    ReturnType<typeof t.Literal>,
    ...ReturnType<typeof t.Literal>[],
  ],
);
const authProviderSlugSchema = t.Union(
  AUTH_PROVIDER_SLUGS.map((slug) => t.Literal(slug)) as [
    ReturnType<typeof t.Literal>,
    ...ReturnType<typeof t.Literal>[],
  ],
);
const authProviderKindSchema = t.Union(
  AUTH_PROVIDER_KIND_VALUES.map((providerKind) => t.Literal(providerKind)) as [
    ReturnType<typeof t.Literal>,
    ...ReturnType<typeof t.Literal>[],
  ],
);
const tokenEndpointAuthMethodSchema = t.Union(
  TOKEN_ENDPOINT_AUTH_METHOD_VALUES.map((method) => t.Literal(method)) as [
    ReturnType<typeof t.Literal>,
    ...ReturnType<typeof t.Literal>[],
  ],
);
const oidcSigningAlgorithmSchema = t.Union(
  OIDC_SIGNING_ALGORITHM_VALUES.map((algorithm) => t.Literal(algorithm)) as [
    ReturnType<typeof t.Literal>,
    ...ReturnType<typeof t.Literal>[],
  ],
);
const oidcProfileSigningAlgorithmSchema = t.Union(
  OIDC_PROFILE_SIGNING_ALGORITHM_VALUES.map((algorithm) => t.Literal(algorithm)) as [
    ReturnType<typeof t.Literal>,
    ...ReturnType<typeof t.Literal>[],
  ],
);
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
  authMethod: t.Optional(authMethodSchema),
  disabledAt: t.Union([t.String({ format: "date-time" }), t.Null()]),
  createdAt: t.String({ format: "date-time" }),
  updatedAt: t.String({ format: "date-time" }),
  permissions: t.Array(userPermissionSchema),
});

const authProviderSummarySchema = t.Object({
  slug: authProviderSlugSchema,
  providerKind: authProviderKindSchema,
  label: t.String(),
  issuer: t.String({ format: "uri" }),
  clientId: t.String(),
  scopes: t.String(),
  redirectUris: t.Array(t.String({ format: "uri" })),
  enabled: t.Boolean(),
  buttonText: t.String(),
  autoRegister: t.Boolean(),
  tokenEndpointAuthMethod: tokenEndpointAuthMethodSchema,
  timeoutMs: t.Number({ minimum: 1 }),
  prompt: t.Union([t.String(), t.Null()]),
  endSessionEndpoint: t.Union([t.String({ format: "uri" }), t.Null()]),
  idTokenSigningAlgorithm: oidcSigningAlgorithmSchema,
  profileSigningAlgorithm: oidcProfileSigningAlgorithmSchema,
  mobileRedirectEnabled: t.Boolean(),
  mobileRedirectUri: t.Union([t.String({ format: "uri" }), t.Null()]),
  hasClientSecret: t.Boolean(),
  createdAt: t.String({ format: "date-time" }),
  updatedAt: t.String({ format: "date-time" }),
});

const authIdentitySchema = t.Object({
  id: t.String(),
  provider: authProviderSlugSchema,
  providerKind: authProviderKindSchema,
  issuer: t.String({ format: "uri" }),
  subjectPreview: t.String(),
  displayName: t.String(),
  preferredUsername: t.Union([t.String(), t.Null()]),
  name: t.Union([t.String(), t.Null()]),
  email: t.Union([t.String({ format: "email" }), t.Null()]),
  createdAt: t.String({ format: "date-time" }),
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
const oauthStartQuerySchema = t.Object({
  mode: t.Optional(t.Union([t.Literal("login"), t.Literal("link")])),
  returnTo: t.Optional(t.String({ maxLength: 2048 })),
});
const oauthCallbackQuerySchema = t.Object({
  code: t.Optional(t.String({ minLength: 1, maxLength: 4096 })),
  state: t.Optional(t.String({ minLength: 1, maxLength: 4096 })),
  error: t.Optional(t.String({ maxLength: 200 })),
});
const authProviderParamsSchema = t.Object({
  provider: authProviderSlugSchema,
});
const authProviderSlugParamsSchema = t.Object({
  slug: authProviderSlugSchema,
});
const redirectUrisSchema = t.Array(t.String({ format: "uri" }), { minItems: 1, maxItems: 10 });
const nullableUriSchema = t.Union([t.String({ format: "uri", maxLength: 2048 }), t.Null()]);
const upsertAuthProviderRequestSchema = t.Object({
  providerKind: authProviderKindSchema,
  label: t.String({ minLength: 1, maxLength: 80, pattern: ".*\\S.*" }),
  issuer: t.String({ format: "uri", maxLength: 2048 }),
  clientId: t.String({ minLength: 1, maxLength: 512, pattern: ".*\\S.*" }),
  clientSecret: t.Optional(t.String({ minLength: 1, maxLength: 4096 })),
  scopes: t.String({ minLength: 1, maxLength: 500, pattern: ".*\\S.*" }),
  redirectUris: redirectUrisSchema,
  enabled: t.Boolean(),
  buttonText: t.String({ minLength: 1, maxLength: 80, pattern: ".*\\S.*" }),
  autoRegister: t.Boolean(),
  tokenEndpointAuthMethod: tokenEndpointAuthMethodSchema,
  timeoutMs: t.Number({ minimum: 1, maximum: 120_000 }),
  prompt: t.Optional(t.Union([t.String({ maxLength: 200 }), t.Null()])),
  endSessionEndpoint: t.Optional(nullableUriSchema),
  idTokenSigningAlgorithm: oidcSigningAlgorithmSchema,
  profileSigningAlgorithm: oidcProfileSigningAlgorithmSchema,
  mobileRedirectEnabled: t.Boolean(),
  mobileRedirectUri: t.Optional(nullableUriSchema),
});
const patchAuthProviderRequestSchema = t.Object({
  providerKind: t.Optional(authProviderKindSchema),
  label: t.Optional(t.String({ minLength: 1, maxLength: 80, pattern: ".*\\S.*" })),
  issuer: t.Optional(t.String({ format: "uri", maxLength: 2048 })),
  clientId: t.Optional(t.String({ minLength: 1, maxLength: 512, pattern: ".*\\S.*" })),
  clientSecret: t.Optional(t.String({ minLength: 1, maxLength: 4096 })),
  scopes: t.Optional(t.String({ minLength: 1, maxLength: 500, pattern: ".*\\S.*" })),
  redirectUris: t.Optional(redirectUrisSchema),
  enabled: t.Optional(t.Boolean()),
  buttonText: t.Optional(t.String({ minLength: 1, maxLength: 80, pattern: ".*\\S.*" })),
  autoRegister: t.Optional(t.Boolean()),
  tokenEndpointAuthMethod: t.Optional(tokenEndpointAuthMethodSchema),
  timeoutMs: t.Optional(t.Number({ minimum: 1, maximum: 120_000 })),
  prompt: t.Optional(t.Union([t.String({ maxLength: 200 }), t.Null()])),
  endSessionEndpoint: t.Optional(nullableUriSchema),
  idTokenSigningAlgorithm: t.Optional(oidcSigningAlgorithmSchema),
  profileSigningAlgorithm: t.Optional(oidcProfileSigningAlgorithmSchema),
  mobileRedirectEnabled: t.Optional(t.Boolean()),
  mobileRedirectUri: t.Optional(nullableUriSchema),
});
const oauthBackChannelLogoutBodySchema = t.Object({
  logout_token: t.Optional(t.String({ minLength: 1, maxLength: 20_000 })),
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
const deleteManagedUserResponseSchema = t.Object({
  status: t.Literal("ok"),
  deletedUserId: publicUserIdSchema,
});
const managedUserProfileResponseSchema = t.Object({ user: managedUserProfileSchema });
const permissionCatalogResponseSchema = t.Object({
  permissions: t.Array(permissionCatalogEntrySchema),
});
const authSetupStatusResponseSchema = t.Object({ required: t.Boolean() });
const authUserResponseSchema = t.Object({ user: t.Union([publicUserSchema, t.Null()]) });
const authProvidersListResponseSchema = t.Object({ providers: t.Array(authProviderSummarySchema) });
const authProviderResponseSchema = t.Object({ provider: authProviderSummarySchema });
const authIdentitiesResponseSchema = t.Object({ identities: t.Array(authIdentitySchema) });
const authUnlinkAllIdentitiesResponseSchema = t.Object({
  status: t.Literal("ok"),
  deletedIdentityCount: t.Number({ minimum: 0 }),
  revokedOAuthSessionCount: t.Number({ minimum: 0 }),
});
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
const logoutResponseSchema = t.Object({
  status: t.Literal("ok"),
  redirectUri: t.Optional(t.String({ format: "uri" })),
});
const changePasswordResponseSchema = t.Object({ status: t.Literal("ok") });
const sessionCookieSchema = t.Cookie({
  [SESSION_COOKIE_NAME]: t.Optional(t.String()),
});
const oauthCookieSchema = t.Cookie({
  [SESSION_COOKIE_NAME]: t.Optional(t.String()),
  [OAUTH_STATE_COOKIE_NAME]: t.Optional(t.String()),
});
const logoutCookieSchema = t.Cookie({
  [SESSION_COOKIE_NAME]: t.Optional(t.String()),
  [OAUTH_STATE_COOKIE_NAME]: t.Optional(t.String()),
});
const apiErrorResponseSchema = t.Object({
  error: t.Object({
    code: t.String(),
    message: t.String(),
  }),
});
const oauthRedirectResponseSchema = {
  302: t.Void(),
  400: apiErrorResponseSchema,
  401: apiErrorResponseSchema,
  403: apiErrorResponseSchema,
  404: apiErrorResponseSchema,
  429: apiErrorResponseSchema,
  502: apiErrorResponseSchema,
  503: apiErrorResponseSchema,
};
const oauthCallbackResponseSchema = {
  ...oauthRedirectResponseSchema,
  409: apiErrorResponseSchema,
};
const authProviderMutationResponseSchema = {
  200: authProviderResponseSchema,
  400: apiErrorResponseSchema,
  401: apiErrorResponseSchema,
  403: apiErrorResponseSchema,
  404: apiErrorResponseSchema,
  503: apiErrorResponseSchema,
};
const authProviderDeleteResponseSchema = {
  200: logoutResponseSchema,
  400: apiErrorResponseSchema,
  401: apiErrorResponseSchema,
  403: apiErrorResponseSchema,
  404: apiErrorResponseSchema,
};

export type AuthRoutesOptions = {
  database: DatabaseClient;
  oauthClientSecretEncryptionKey: string | null;
  sessionCookieSecure: boolean;
  rateLimiter?: LoginRateLimiter;
};

type OAuthLinkActorResult =
  | { ok: true; linkToUserId?: string }
  | { ok: false; status: 401 | 403; body: ApiErrorResponse };
type AuthProviderSlugResult =
  | { ok: true; slug: AuthProviderSlug }
  | { ok: false; status: 400; body: ApiErrorResponse };
type AuthProviderParamResult =
  | { ok: true; provider: AuthProviderSlug }
  | { ok: false; response: ReturnType<StatusHandler> };
type ProviderMutationResult =
  | { ok: true; body: unknown }
  | { ok: false; status: number; body: ApiErrorResponse };
type ProviderMutationContext = {
  body: unknown;
  cookie: Record<string, { value?: unknown } | undefined>;
  params: { slug: unknown };
  status: StatusHandler;
};

export function createAuthRoutes(options: AuthRoutesOptions) {
  const authService = new AuthService(options.database, options.rateLimiter);
  const oauthService = new OAuthService(options.database, authService, {
    encryptionKey: options.oauthClientSecretEncryptionKey,
    webOrigin: env.webOrigin,
  });

  return new Elysia({ prefix: "/api" })
    .use(createOAuthRoutes(authService, oauthService, options))
    .use(createSetupRoutes(authService, options))
    .use(createSessionRoutes(authService, oauthService, options))
    .use(createProfileRoutes(authService))
    .use(createPermissionRoutes(authService))
    .use(createUsersRoutes(authService));
}

function createOAuthRoutes(
  authService: AuthService,
  oauthService: OAuthService,
  options: AuthRoutesOptions,
) {
  return new Elysia()
    .use(createOAuthProviderListRoute(oauthService))
    .use(createOAuthStartRoute(authService, oauthService, options))
    .use(createOAuthCallbackRoute(authService, oauthService, options))
    .use(createOAuthBackChannelLogoutRoute(oauthService))
    .use(createOAuthProviderUpsertRoute(authService, oauthService))
    .use(createOAuthProviderPatchRoute(authService, oauthService))
    .use(createOAuthProviderDeleteRoute(authService, oauthService))
    .use(createOAuthIdentitiesRoute(authService))
    .use(createOAuthUnlinkAllIdentitiesRoute(authService));
}

function createOAuthBackChannelLogoutRoute(oauthService: OAuthService) {
  return new Elysia().post(
    "/auth/oauth/backchannel-logout",
    async ({ body, request, server }) => {
      if (!body.logout_token) {
        return noStoreJsonResponse(400, oauthLogoutTokenInvalidResponse());
      }

      const result = await oauthService.handleBackChannelLogout({
        logoutToken: body.logout_token,
        context: createRequestContext(request, server),
      });

      return result.ok
        ? noStoreJsonResponse(200, { status: "ok" } satisfies LogoutResponse)
        : noStoreJsonResponse(result.status, result.body);
    },
    {
      body: oauthBackChannelLogoutBodySchema,
      response: {
        200: logoutResponseSchema,
        400: apiErrorResponseSchema,
        502: apiErrorResponseSchema,
      },
      detail: {
        summary: "Accept OAuth back-channel logout",
        description:
          "Accepts an OIDC Back-Channel Logout logout_token form post and revokes matching local OAuth sessions.",
        tags: ["Auth"],
      },
    },
  );
}

function createOAuthProviderListRoute(oauthService: OAuthService) {
  return new Elysia().get(
    "/auth/providers",
    (): AuthProvidersListResponse => oauthService.listProviders(),
    {
      response: authProvidersListResponseSchema,
      detail: {
        summary: "List OAuth providers",
        description: "Returns configured OAuth providers without exposing client secrets.",
        tags: ["Auth"],
      },
    },
  );
}

function createOAuthStartRoute(
  authService: AuthService,
  oauthService: OAuthService,
  options: AuthRoutesOptions,
) {
  return new Elysia().get(
    "/auth/oauth/:provider/start",
    async ({ cookie, params, query, request, server, status }) => {
      const providerResult = readAuthProviderParam(params.provider, status);

      if (!providerResult.ok) {
        return providerResult.response;
      }

      const requestContext = createRequestContext(request, server);
      const routeLimit = authService.checkOAuthRouteRateLimit({
        provider: providerResult.provider,
        route: "start",
        mode: query.mode ?? "login",
        context: requestContext,
      });

      if (!routeLimit.ok) {
        return status(routeLimit.status, routeLimit.body);
      }

      authService.recordOAuthRouteAttempt(routeLimit.key);

      const linkActorResult = readOAuthLinkActor(
        authService,
        query.mode,
        cookie[SESSION_COOKIE_NAME].value,
      );

      if (!linkActorResult.ok) {
        return status(linkActorResult.status, linkActorResult.body);
      }

      const result = await oauthService.buildAuthorizationRedirect({
        provider: providerResult.provider,
        mode: query.mode ?? "login",
        ...(linkActorResult.linkToUserId ? { linkToUserId: linkActorResult.linkToUserId } : {}),
        ...(query.returnTo ? { returnTo: query.returnTo } : {}),
        requestUrl: request.url,
      });

      if (!result.ok) {
        return status(result.status, result.body);
      }

      writeOAuthStateCookie(cookie[OAUTH_STATE_COOKIE_NAME], result.stateCookieValue, options);

      return redirectResponse(result.authorizationUrl);
    },
    {
      params: authProviderParamsSchema,
      query: oauthStartQuerySchema,
      cookie: oauthCookieSchema,
      response: oauthRedirectResponseSchema,
      detail: {
        summary: "Start OAuth login",
        description: "Creates signed OAuth state and redirects to the configured OIDC provider.",
        tags: ["Auth"],
      },
    },
  );
}

function createOAuthCallbackRoute(
  authService: AuthService,
  oauthService: OAuthService,
  options: AuthRoutesOptions,
) {
  return new Elysia().get(
    "/auth/callback/:provider",
    async (context) => {
      const { cookie, params, query, request, server, status } = context;
      const providerResult = readAuthProviderParam(params.provider, status);

      if (!providerResult.ok) {
        return providerResult.response;
      }

      const requestContext = createRequestContext(request, server);
      const callbackMode = query.state
        ? await oauthService.readCallbackStateMode({
            provider: providerResult.provider,
            requestUrl: request.url,
            state: query.state,
            stateCookieValue: cookie[OAUTH_STATE_COOKIE_NAME].value,
          })
        : null;
      const routeLimit = authService.checkOAuthRouteRateLimit({
        provider: providerResult.provider,
        route: "callback",
        ...(callbackMode ? { mode: callbackMode } : {}),
        context: requestContext,
      });

      if (!routeLimit.ok) {
        return status(routeLimit.status, routeLimit.body);
      }

      if (query.error || !query.code || !query.state) {
        authService.recordOAuthRouteAttempt(routeLimit.key);
        return status(400, oauthCallbackInvalidResponse());
      }

      const result = await oauthService.completeCallback({
        provider: providerResult.provider,
        code: query.code,
        state: query.state,
        stateCookieValue: cookie[OAUTH_STATE_COOKIE_NAME].value,
        sessionToken: readSessionToken(cookie[SESSION_COOKIE_NAME].value),
        requestUrl: request.url,
        context: requestContext,
      });

      cookie[OAUTH_STATE_COOKIE_NAME].remove();

      if (!result.ok) {
        authService.recordOAuthRouteAttempt(routeLimit.key);
        return status(result.status, result.body);
      }

      authService.clearOAuthRouteRateLimit(routeLimit.key);

      if (result.sessionToken && result.expiresAt) {
        writeSessionCookie(
          cookie[SESSION_COOKIE_NAME],
          result.sessionToken,
          result.expiresAt,
          options,
        );
      }

      return redirectResponse(result.location);
    },
    {
      params: authProviderParamsSchema,
      query: oauthCallbackQuerySchema,
      cookie: oauthCookieSchema,
      response: oauthCallbackResponseSchema,
      detail: {
        summary: "Complete OAuth callback",
        description: "Validates OAuth state and ID token, then logs in or links the identity.",
        tags: ["Auth"],
      },
    },
  );
}

function createOAuthProviderUpsertRoute(authService: AuthService, oauthService: OAuthService) {
  return new Elysia().put(
    "/auth/providers/:slug",
    createOAuthProviderMutationHandler(
      authService,
      normalizeAuthUpsertProviderRequest,
      (slug, input) => oauthService.upsertProvider(slug, input),
    ),
    {
      params: authProviderSlugParamsSchema,
      body: upsertAuthProviderRequestSchema,
      cookie: sessionCookieSchema,
      response: authProviderMutationResponseSchema,
      detail: {
        summary: "Create or replace OAuth provider",
        description: "Stores OAuth provider configuration and encrypts the client secret at rest.",
        tags: ["Auth"],
      },
    },
  );
}

function createOAuthProviderPatchRoute(authService: AuthService, oauthService: OAuthService) {
  return new Elysia().patch(
    "/auth/providers/:slug",
    createOAuthProviderMutationHandler(
      authService,
      normalizeAuthPatchProviderRequest,
      (slug, input) => oauthService.patchProvider(slug, input),
    ),
    {
      params: authProviderSlugParamsSchema,
      body: patchAuthProviderRequestSchema,
      cookie: sessionCookieSchema,
      response: authProviderMutationResponseSchema,
      detail: {
        summary: "Patch OAuth provider",
        description: "Updates OAuth provider configuration while preserving write-only secrets.",
        tags: ["Auth"],
      },
    },
  );
}

function createOAuthProviderDeleteRoute(authService: AuthService, oauthService: OAuthService) {
  return new Elysia().delete(
    "/auth/providers/:slug",
    ({ cookie, params, status }) =>
      withSystemAdmin(authService, cookie[SESSION_COOKIE_NAME].value, status, () => {
        const slug = readAuthProviderSlug(params.slug);

        if (!slug) {
          return status(400, invalidAuthProviderResponse());
        }

        const result = oauthService.deleteProvider(slug);

        return result.ok ? result.body : status(result.status, result.body);
      }),
    {
      params: authProviderSlugParamsSchema,
      cookie: sessionCookieSchema,
      response: authProviderDeleteResponseSchema,
      detail: {
        summary: "Delete OAuth provider",
        description: "Deletes an OAuth provider and its linked OAuth identities.",
        tags: ["Auth"],
      },
    },
  );
}

function createOAuthIdentitiesRoute(authService: AuthService) {
  return new Elysia().get(
    "/auth/identities/me",
    ({ cookie, status }) => {
      const result = authService.listOAuthIdentities(
        readSessionToken(cookie[SESSION_COOKIE_NAME].value),
      );

      return result.ok ? result.body : status(result.status, result.body);
    },
    {
      cookie: sessionCookieSchema,
      response: {
        200: authIdentitiesResponseSchema,
        401: apiErrorResponseSchema,
      },
      detail: {
        summary: "List current OAuth identities",
        description: "Returns OAuth identities linked to the current session user.",
        tags: ["Auth"],
      },
    },
  );
}

function createOAuthUnlinkAllIdentitiesRoute(authService: AuthService) {
  return new Elysia().delete(
    "/auth/identities",
    ({ cookie, request, server, status }) =>
      withSystemAdmin(authService, cookie[SESSION_COOKIE_NAME].value, status, (user) => {
        const result = authService.unlinkAllOAuthIdentities(
          user,
          createRequestContext(request, server),
        );

        return result.ok
          ? (result.body satisfies AuthUnlinkAllIdentitiesResponse)
          : status(result.status, result.body);
      }),
    {
      cookie: sessionCookieSchema,
      response: {
        200: authUnlinkAllIdentitiesResponseSchema,
        401: apiErrorResponseSchema,
        403: apiErrorResponseSchema,
        409: apiErrorResponseSchema,
      },
      detail: {
        summary: "Unlink all OAuth identities",
        description:
          "Deletes all OAuth identity links and revokes OAuth sessions while preserving users.",
        tags: ["Auth"],
      },
    },
  );
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
      async ({ body, cookie, request, server, status }) => {
        const result = await authService.createInitialAdmin(
          body,
          createRequestContext(request, server),
        );

        return writeSessionRouteResponse(cookie[SESSION_COOKIE_NAME], options, status, result);
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

function createSessionRoutes(
  authService: AuthService,
  oauthService: OAuthService,
  options: AuthRoutesOptions,
) {
  return new Elysia()
    .post(
      "/auth/login",
      async ({ body, cookie, request, server, status }) => {
        const result = await authService.login(body, createRequestContext(request, server));

        return writeSessionRouteResponse(cookie[SESSION_COOKIE_NAME], options, status, result);
      },
      {
        body: loginRequestSchema,
        response: {
          200: loginResponseSchema,
          401: apiErrorResponseSchema,
          403: apiErrorResponseSchema,
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
      async ({ cookie, request, server }) => {
        const sessionCookie = cookie[SESSION_COOKIE_NAME];
        const sessionToken = readSessionToken(sessionCookie.value);
        const logoutResult = await oauthService.buildLogout({
          sessionToken,
        });

        authService.logout(sessionToken, createRequestContext(request, server));

        sessionCookie.remove();
        cookie[OAUTH_STATE_COOKIE_NAME].remove();

        return noStoreJsonResponse(
          200,
          logoutResult.kind === "sso"
            ? ({ status: "ok", redirectUri: logoutResult.redirectUri } satisfies LogoutResponse)
            : ({ status: "ok" } satisfies LogoutResponse),
        );
      },
      {
        cookie: logoutCookieSchema,
        response: logoutResponseSchema,
        detail: {
          summary: "Log out",
          description:
            "Deletes the current server-side session. OAuth sessions return a discovered provider end-session redirect URI for top-level GET navigation.",
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
      ({ body, cookie, request, server, status }) => {
        const result = authService.updateNotificationPreferences(
          readSessionToken(cookie[SESSION_COOKIE_NAME].value),
          body,
          createRequestContext(request, server),
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
      ({ body, cookie, request, server, status }) => {
        const result = authService.updateUserProfile(
          readSessionToken(cookie[SESSION_COOKIE_NAME].value),
          normalizeUpdateUserProfileRequest(body),
          createRequestContext(request, server),
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
      async ({ body, cookie, request, server, status }) => {
        const result = await authService.changePassword(
          readSessionToken(cookie[SESSION_COOKIE_NAME].value),
          body,
          createRequestContext(request, server),
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
      async ({ body, cookie, request, server, status }) => {
        return withUsersManageAsync(
          authService,
          cookie[SESSION_COOKIE_NAME].value,
          status,
          async (user) => {
            const result = await authService.createLocalUser(
              body,
              user,
              createRequestContext(request, server),
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
      ({ body, cookie, params, request, server, status }) =>
        runManagedUserMutation(
          authService,
          cookie[SESSION_COOKIE_NAME].value,
          params.publicUserId,
          normalizeUpdateUserProfileRequest(body),
          request,
          server,
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
      async ({ body, cookie, params, request, server, status }) => {
        return withUsersManageAsync(
          authService,
          cookie[SESSION_COOKIE_NAME].value,
          status,
          async (user) => {
            const result = await authService.changeManagedUserPassword(
              params.publicUserId,
              body,
              user,
              createRequestContext(request, server),
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
      ({ body, cookie, params, request, server, status }) => {
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
          server,
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
    )
    .delete(
      "/users/:publicUserId",
      ({ cookie, params, request, server, status }) =>
        withUsersManage(authService, cookie[SESSION_COOKIE_NAME].value, status, (user) => {
          const result = authService.deleteManagedUser(
            params.publicUserId,
            user,
            createRequestContext(request, server),
          );

          return result.ok
            ? (result.body satisfies DeleteManagedUserResponse)
            : status(result.status, result.body);
        }),
      {
        params: managedUserParamsSchema,
        cookie: sessionCookieSchema,
        response: {
          200: deleteManagedUserResponseSchema,
          401: apiErrorResponseSchema,
          403: apiErrorResponseSchema,
          404: apiErrorResponseSchema,
          409: apiErrorResponseSchema,
        },
        detail: {
          summary: "Delete managed user",
          description:
            "Permanently deletes another user when the actor has users:manage plus users:delete.",
          tags: ["Auth"],
        },
      },
    );
}

function readSessionToken(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function readOAuthLinkActor(
  authService: AuthService,
  mode: "link" | "login" | undefined,
  sessionCookieValue: unknown,
): OAuthLinkActorResult {
  if (mode !== "link") {
    return { ok: true };
  }

  const permissionResult = authService.requirePermission(
    readSessionToken(sessionCookieValue),
    SYSTEM_ADMIN_PERMISSION,
  );

  return permissionResult.ok
    ? { ok: true, linkToUserId: permissionResult.user.id }
    : permissionResult;
}

function readAuthProviderSlug(value: unknown): AuthProviderSlug | null {
  if (typeof value !== "string") {
    return null;
  }

  for (const slug of AUTH_PROVIDER_SLUGS) {
    if (slug === value) {
      return slug;
    }
  }

  return null;
}

function readAuthProviderSlugResult(value: unknown): AuthProviderSlugResult {
  const slug = readAuthProviderSlug(value);

  return slug
    ? { ok: true, slug }
    : { ok: false, status: 400, body: invalidAuthProviderResponse() };
}

function readAuthProviderParam(value: unknown, status: StatusHandler): AuthProviderParamResult {
  const result = readAuthProviderSlugResult(value);

  return result.ok
    ? { ok: true, provider: result.slug }
    : { ok: false, response: status(result.status, result.body) };
}

function invalidAuthProviderResponse(): ApiErrorResponse {
  return {
    error: {
      code: "OAUTH_PROVIDER_INVALID",
      message: "OAuth provider is invalid.",
    },
  };
}

function oauthCallbackInvalidResponse(): ApiErrorResponse {
  return {
    error: {
      code: "OAUTH_CALLBACK_INVALID",
      message: "OAuth callback is missing required parameters.",
    },
  };
}

function oauthLogoutTokenInvalidResponse(): ApiErrorResponse {
  return {
    error: {
      code: "OAUTH_LOGOUT_TOKEN_INVALID",
      message: "OAuth logout token is invalid.",
    },
  };
}

function requireUsersManage(authService: AuthService, sessionCookieValue: unknown) {
  return authService.requirePermission(readSessionToken(sessionCookieValue), "users:manage");
}

function requireSystemAdmin(authService: AuthService, sessionCookieValue: unknown) {
  return authService.requirePermission(
    readSessionToken(sessionCookieValue),
    SYSTEM_ADMIN_PERMISSION,
  );
}

type WritableRouteCookie = {
  value: string | undefined;
  httpOnly?: boolean | undefined;
  secure?: boolean | undefined;
  sameSite?: boolean | "none" | "lax" | "strict" | undefined;
  path?: string | undefined;
  maxAge?: number | undefined;
  expires?: Date | undefined;
};

type SessionRouteResult =
  | { ok: false; status: number; body: ApiErrorResponse }
  | { ok: true; expiresAt: Date; sessionToken: string; user: PublicUser };

function writeSessionRouteResponse(
  sessionCookie: WritableRouteCookie,
  options: AuthRoutesOptions,
  status: StatusHandler,
  result: SessionRouteResult,
): CreateAdminResponse | LoginResponse | ReturnType<StatusHandler> {
  if (!result.ok) {
    return status(result.status, result.body);
  }

  return writeSessionUserResponse(sessionCookie, options, result);
}

function writeSessionUserResponse(
  sessionCookie: WritableRouteCookie,
  options: AuthRoutesOptions,
  result: { expiresAt: Date; sessionToken: string; user: PublicUser },
): CreateAdminResponse | LoginResponse {
  writeSessionCookie(sessionCookie, result.sessionToken, result.expiresAt, options);

  return { user: result.user };
}

// biome-ignore lint/suspicious/noExplicitAny: Elysia's SelectiveStatus callback type varies per route and is impractical to model precisely for these shared helpers.
type StatusHandler = (...args: any[]) => any;
type RequestIpReader = {
  requestIP(request: Request): { address: string } | null;
};

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

function withSystemAdmin<T>(
  authService: AuthService,
  sessionCookieValue: unknown,
  status: StatusHandler,
  onAllowed: (user: PublicUser) => T,
): T | ReturnType<StatusHandler> {
  const permissionResult = requireSystemAdmin(authService, sessionCookieValue);

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

async function withSystemAdminAsync<T>(
  authService: AuthService,
  sessionCookieValue: unknown,
  status: StatusHandler,
  onAllowed: (user: PublicUser) => Promise<T>,
): Promise<T | ReturnType<StatusHandler>> {
  const permissionResult = requireSystemAdmin(authService, sessionCookieValue);

  if (!permissionResult.ok) {
    return status(permissionResult.status, permissionResult.body);
  }

  return onAllowed(permissionResult.user);
}

async function withSystemAdminProviderSlug<T>(
  authService: AuthService,
  sessionCookieValue: unknown,
  rawSlug: unknown,
  status: StatusHandler,
  onAllowed: (slug: AuthProviderSlug) => Promise<T>,
): Promise<T | ReturnType<StatusHandler>> {
  return withSystemAdminAsync(authService, sessionCookieValue, status, async () => {
    const slugResult = readAuthProviderSlugResult(rawSlug);

    return slugResult.ok ? onAllowed(slugResult.slug) : status(slugResult.status, slugResult.body);
  });
}

function createOAuthProviderMutationHandler<TInput>(
  authService: AuthService,
  normalizeInput: (input: unknown) => TInput | null,
  mutate: (slug: AuthProviderSlug, input: TInput) => Promise<ProviderMutationResult>,
) {
  return ({ body, cookie, params, status }: ProviderMutationContext) => {
    const input = normalizeInput(body);

    if (!input) {
      return status(400, invalidAuthProviderResponse());
    }

    return withSystemAdminProviderSlug(
      authService,
      cookie[SESSION_COOKIE_NAME]?.value,
      params.slug,
      status,
      async (slug) => {
        const result = await mutate(slug, input);

        return result.ok ? result.body : status(result.status, result.body);
      },
    );
  };
}

function normalizeAuthUpsertProviderRequest(input: unknown): AuthUpsertProviderRequest | null {
  if (!isRecord(input) || !isCompleteProviderRequest(input)) {
    return null;
  }

  return {
    providerKind: input.providerKind,
    label: input.label,
    issuer: input.issuer,
    clientId: input.clientId,
    ...(typeof input.clientSecret === "string" ? { clientSecret: input.clientSecret } : {}),
    scopes: input.scopes,
    redirectUris: input.redirectUris,
    enabled: input.enabled,
    buttonText: input.buttonText,
    autoRegister: input.autoRegister,
    tokenEndpointAuthMethod: input.tokenEndpointAuthMethod,
    timeoutMs: input.timeoutMs,
    prompt: typeof input.prompt === "string" || input.prompt === null ? input.prompt : null,
    endSessionEndpoint:
      typeof input.endSessionEndpoint === "string" || input.endSessionEndpoint === null
        ? input.endSessionEndpoint
        : null,
    idTokenSigningAlgorithm: input.idTokenSigningAlgorithm,
    profileSigningAlgorithm: input.profileSigningAlgorithm,
    mobileRedirectEnabled: input.mobileRedirectEnabled,
    mobileRedirectUri:
      typeof input.mobileRedirectUri === "string" || input.mobileRedirectUri === null
        ? input.mobileRedirectUri
        : null,
  };
}

function normalizeAuthPatchProviderRequest(input: unknown): AuthPatchProviderRequest | null {
  if (!isRecord(input)) {
    return null;
  }

  return {
    ...normalizeAuthPatchCore(input),
    ...normalizeAuthPatchAdvanced(input),
  };
}

function normalizeAuthPatchCore(input: Record<string, unknown>): AuthPatchProviderRequest {
  return {
    ...(isAuthProviderKind(input.providerKind) ? { providerKind: input.providerKind } : {}),
    ...(typeof input.label === "string" ? { label: input.label } : {}),
    ...(typeof input.issuer === "string" ? { issuer: input.issuer } : {}),
    ...(typeof input.clientId === "string" ? { clientId: input.clientId } : {}),
    ...(typeof input.clientSecret === "string" ? { clientSecret: input.clientSecret } : {}),
    ...(typeof input.scopes === "string" ? { scopes: input.scopes } : {}),
    ...(isStringArray(input.redirectUris) ? { redirectUris: input.redirectUris } : {}),
    ...(typeof input.enabled === "boolean" ? { enabled: input.enabled } : {}),
  };
}

function normalizeAuthPatchAdvanced(input: Record<string, unknown>): AuthPatchProviderRequest {
  return {
    ...(typeof input.buttonText === "string" ? { buttonText: input.buttonText } : {}),
    ...(typeof input.autoRegister === "boolean" ? { autoRegister: input.autoRegister } : {}),
    ...(isTokenEndpointAuthMethod(input.tokenEndpointAuthMethod)
      ? { tokenEndpointAuthMethod: input.tokenEndpointAuthMethod }
      : {}),
    ...(typeof input.timeoutMs === "number" ? { timeoutMs: input.timeoutMs } : {}),
    ...(typeof input.prompt === "string" || input.prompt === null ? { prompt: input.prompt } : {}),
    ...(typeof input.endSessionEndpoint === "string" || input.endSessionEndpoint === null
      ? { endSessionEndpoint: input.endSessionEndpoint }
      : {}),
    ...(isOidcSigningAlgorithm(input.idTokenSigningAlgorithm)
      ? { idTokenSigningAlgorithm: input.idTokenSigningAlgorithm }
      : {}),
    ...(isOidcProfileSigningAlgorithm(input.profileSigningAlgorithm)
      ? { profileSigningAlgorithm: input.profileSigningAlgorithm }
      : {}),
    ...(typeof input.mobileRedirectEnabled === "boolean"
      ? { mobileRedirectEnabled: input.mobileRedirectEnabled }
      : {}),
    ...(typeof input.mobileRedirectUri === "string" || input.mobileRedirectUri === null
      ? { mobileRedirectUri: input.mobileRedirectUri }
      : {}),
  };
}

function isCompleteProviderRequest(
  input: Record<string, unknown>,
): input is AuthUpsertProviderRequest {
  return (
    isAuthProviderKind(input.providerKind) &&
    typeof input.label === "string" &&
    typeof input.issuer === "string" &&
    typeof input.clientId === "string" &&
    typeof input.scopes === "string" &&
    isStringArray(input.redirectUris) &&
    typeof input.enabled === "boolean" &&
    typeof input.buttonText === "string" &&
    typeof input.autoRegister === "boolean" &&
    isTokenEndpointAuthMethod(input.tokenEndpointAuthMethod) &&
    typeof input.timeoutMs === "number" &&
    isOidcSigningAlgorithm(input.idTokenSigningAlgorithm) &&
    isOidcProfileSigningAlgorithm(input.profileSigningAlgorithm) &&
    typeof input.mobileRedirectEnabled === "boolean"
  );
}

function isAuthProviderKind(value: unknown): value is AuthUpsertProviderRequest["providerKind"] {
  return AUTH_PROVIDER_KIND_VALUES.some((providerKind) => providerKind === value);
}

function isTokenEndpointAuthMethod(
  value: unknown,
): value is AuthUpsertProviderRequest["tokenEndpointAuthMethod"] {
  return TOKEN_ENDPOINT_AUTH_METHOD_VALUES.some((method) => method === value);
}

function isOidcSigningAlgorithm(
  value: unknown,
): value is AuthUpsertProviderRequest["idTokenSigningAlgorithm"] {
  return OIDC_SIGNING_ALGORITHM_VALUES.some((algorithm) => algorithm === value);
}

function isOidcProfileSigningAlgorithm(
  value: unknown,
): value is AuthUpsertProviderRequest["profileSigningAlgorithm"] {
  return OIDC_PROFILE_SIGNING_ALGORITHM_VALUES.some((algorithm) => algorithm === value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string");
}

function runManagedUserMutation<TBody>(
  authService: AuthService,
  sessionCookieValue: unknown,
  publicUserId: string,
  input: TBody,
  request: Request,
  server: RequestIpReader | null,
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
      mutate(publicUserId, input, user, createRequestContext(request, server)),
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
    server,
    status,
  }: {
    body: TBody;
    cookie: Record<string, { value?: unknown } | undefined>;
    params: { publicUserId: string };
    request: Request;
    server: RequestIpReader | null;
    status: StatusHandler;
  }) =>
    runManagedUserMutation(
      authService,
      cookie[SESSION_COOKIE_NAME]?.value,
      params.publicUserId,
      body,
      request,
      server,
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
  sessionCookie: WritableRouteCookie,
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

function writeOAuthStateCookie(
  stateCookie: WritableRouteCookie,
  value: string,
  options: AuthRoutesOptions,
): void {
  writeOAuthFlowStateCookie(stateCookie, value, OAUTH_STATE_COOKIE_MAX_AGE_SECONDS, options);
}

function writeOAuthFlowStateCookie(
  stateCookie: WritableRouteCookie,
  value: string,
  maxAgeSeconds: number,
  options: AuthRoutesOptions,
): void {
  stateCookie.value = value;
  stateCookie.httpOnly = true;
  stateCookie.secure = options.sessionCookieSecure;
  stateCookie.sameSite = "lax";
  stateCookie.path = "/api/auth";
  stateCookie.maxAge = maxAgeSeconds;
  stateCookie.expires = new Date(Date.now() + maxAgeSeconds * 1000);
}

function redirectResponse(location: string): Response {
  return new Response(null, {
    status: 302,
    headers: { location },
  });
}

function noStoreJsonResponse(statusCode: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: statusCode,
    headers: {
      "cache-control": "no-store",
      "content-type": "application/json",
    },
  });
}

export function createRequestContext(
  request: Request,
  server: RequestIpReader | null = null,
): {
  ipAddress: string | null;
  userAgent: string | null;
} {
  return {
    ipAddress: server?.requestIP(request)?.address ?? null,
    userAgent: request.headers.get("user-agent"),
  };
}
