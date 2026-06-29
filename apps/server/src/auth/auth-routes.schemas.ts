import {
  API_KEY_STATUS_VALUES,
  AUTH_METHOD_VALUES,
  AUTH_PROVIDER_KIND_VALUES,
  AUTH_PROVIDER_SLUGS,
  NOTIFICATION_FREQUENCY_VALUES,
  OIDC_PROFILE_SIGNING_ALGORITHM_VALUES,
  OIDC_SIGNING_ALGORITHM_VALUES,
  PERMISSION_CATEGORIES,
  PERMISSION_DEFAULT_GRANTS,
  PERMISSION_RISK_VALUES,
  PERMISSION_ROUTE_SURFACES,
  PROFILE_AVATAR_IDS,
  PROFILE_BANNER_IDS,
  TOAST_NOTIFICATION_EVENT_IDS,
  TOAST_NOTIFICATION_IMPORTANCE_VALUES,
  TOAST_NOTIFICATION_SEVERITY_VALUES,
  TOKEN_ENDPOINT_AUTH_METHOD_VALUES,
  USER_PERMISSION_VALUES,
} from "@arrtemplar/shared";
import { t } from "elysia";
import { OAUTH_STATE_COOKIE_NAME } from "../security/oauth-state";
import { MIN_PASSWORD_LENGTH } from "./password";
import { SESSION_COOKIE_NAME } from "./session-token";

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
const apiKeyStatusSchema = t.Union(
  API_KEY_STATUS_VALUES.map((status) => t.Literal(status)) as [
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

const apiKeyCreatedBySchema = t.Object({
  id: publicUserIdSchema,
  username: t.String(),
});

const apiKeySummarySchema = t.Object({
  id: t.String({ minLength: 1, maxLength: 80 }),
  name: t.String(),
  description: t.Union([t.String(), t.Null()]),
  keyPrefix: t.String(),
  fingerprint: t.String(),
  maskedKey: t.String(),
  status: apiKeyStatusSchema,
  lastUsedAt: t.Union([t.String({ format: "date-time" }), t.Null()]),
  lastUsedIpAddress: t.Union([t.String(), t.Null()]),
  lastUsedUserAgent: t.Union([t.String(), t.Null()]),
  createdBy: t.Union([apiKeyCreatedBySchema, t.Null()]),
  createdAt: t.String({ format: "date-time" }),
  updatedAt: t.String({ format: "date-time" }),
  rotatedAt: t.Union([t.String({ format: "date-time" }), t.Null()]),
  deletedAt: t.Union([t.String({ format: "date-time" }), t.Null()]),
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

export const loginRequestSchema = t.Object({
  email: t.String({ format: "email" }),
  password: t.String({ minLength: 1, maxLength: 1024 }),
});

export const createAdminRequestSchema = t.Object({
  username: t.String({ minLength: 1, maxLength: 80, pattern: ".*\\S.*" }),
  email: t.String({ format: "email" }),
  password: t.String({ minLength: MIN_PASSWORD_LENGTH, maxLength: 1024 }),
});

export const createLocalUserRequestSchema = t.Object({
  username: t.String({ minLength: 1, maxLength: 80, pattern: ".*\\S.*" }),
  email: t.String({ format: "email" }),
  password: t.String({ minLength: MIN_PASSWORD_LENGTH, maxLength: 1024 }),
});

export const updateUserProfileRequestSchema = t.Object({
  avatarId: t.Optional(profileAvatarIdSchema),
  bannerId: t.Optional(profileBannerIdSchema),
  username: t.Optional(t.String({ minLength: 1, maxLength: 80, pattern: ".*\\S.*" })),
  email: t.Optional(t.String({ format: "email" })),
});

export const changePasswordRequestSchema = t.Object({
  currentPassword: t.String({ minLength: 1, maxLength: 1024 }),
  newPassword: t.String({ minLength: MIN_PASSWORD_LENGTH, maxLength: 1024 }),
});

export const updateNotificationPreferencesRequestSchema = notificationPreferencesSchema;
export const createNotificationHistoryRequestSchema = t.Object({
  eventId: toastNotificationEventIdSchema,
  title: t.String({ minLength: 1, maxLength: 160, pattern: ".*\\S.*" }),
  description: t.Optional(t.String({ maxLength: 500 })),
});
export const markNotificationReadRequestSchema = t.Object({
  read: t.Literal(true),
});
export const oauthStartQuerySchema = t.Object({
  mode: t.Optional(t.Union([t.Literal("login"), t.Literal("link")])),
  returnTo: t.Optional(t.String({ maxLength: 2048 })),
});
export const oauthCallbackQuerySchema = t.Object({
  code: t.Optional(t.String({ minLength: 1, maxLength: 4096 })),
  state: t.Optional(t.String({ minLength: 1, maxLength: 4096 })),
  error: t.Optional(t.String({ maxLength: 200 })),
});
export const authProviderParamsSchema = t.Object({
  provider: authProviderSlugSchema,
});
export const authProviderSlugParamsSchema = t.Object({
  slug: authProviderSlugSchema,
});
const redirectUrisSchema = t.Array(t.String({ format: "uri" }), { minItems: 1, maxItems: 10 });
const nullableUriSchema = t.Union([t.String({ format: "uri", maxLength: 2048 }), t.Null()]);
export const upsertAuthProviderRequestSchema = t.Object({
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
export const patchAuthProviderRequestSchema = t.Object({
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
export const oauthBackChannelLogoutBodySchema = t.Object({
  logout_token: t.Optional(t.String({ minLength: 1, maxLength: 20_000 })),
});
export const notificationHistoryQuerySchema = t.Object({
  page: t.Optional(t.Numeric({ minimum: 1 })),
  pageSize: t.Optional(t.Numeric({ minimum: 1, maximum: 50 })),
});
export const notificationHistoryParamsSchema = t.Object({
  notificationId: t.String({ minLength: 1, maxLength: 80 }),
});

export const managedUserParamsSchema = t.Object({
  publicUserId: publicUserIdSchema,
});

export const managedUserPasswordRequestSchema = t.Object({
  password: t.String({ minLength: MIN_PASSWORD_LENGTH, maxLength: 1024 }),
});

export const managedUserPermissionsRequestSchema = t.Object({
  permissions: t.Array(userPermissionSchema),
});

export const apiKeyIdParamsSchema = t.Object({
  apiKeyId: t.String({ minLength: 1, maxLength: 80 }),
});

const apiKeyNameSchema = t.String({ minLength: 1, maxLength: 80, pattern: ".*\\S.*" });
const apiKeyDescriptionSchema = t.Optional(t.Union([t.String({ maxLength: 500 }), t.Null()]));

export const createApiKeyRequestSchema = t.Object({
  name: apiKeyNameSchema,
  description: apiKeyDescriptionSchema,
});

export const managedUserStatusRequestSchema = t.Object({
  disabled: t.Boolean(),
});

export const loginResponseSchema = t.Object({ user: publicUserSchema });
export const createAdminResponseSchema = t.Object({ user: publicUserSchema });
export const createLocalUserResponseSchema = t.Object({ user: managedUserSummarySchema });
export const managedUsersListResponseSchema = t.Object({
  users: t.Array(managedUserSummarySchema),
});
export const managedUserResponseSchema = t.Object({ user: managedUserSummarySchema });
export const deleteManagedUserResponseSchema = t.Object({
  status: t.Literal("ok"),
  deletedUserId: publicUserIdSchema,
});
export const managedUserProfileResponseSchema = t.Object({ user: managedUserProfileSchema });
export const permissionCatalogResponseSchema = t.Object({
  permissions: t.Array(permissionCatalogEntrySchema),
});
export const apiKeyListResponseSchema = t.Object({ apiKeys: t.Array(apiKeySummarySchema) });
export const apiKeyResponseSchema = t.Object({ apiKey: apiKeySummarySchema });
export const apiKeyRevealResponseSchema = t.Object({
  apiKey: apiKeySummarySchema,
  secret: t.String({ minLength: 1 }),
});
export const apiKeyMutationResponseSchema = t.Object({
  status: t.Literal("ok"),
  apiKey: apiKeySummarySchema,
});
export const authSetupStatusResponseSchema = t.Object({ required: t.Boolean() });
export const authUserResponseSchema = t.Object({ user: t.Union([publicUserSchema, t.Null()]) });
export const authProvidersListResponseSchema = t.Object({
  providers: t.Array(authProviderSummarySchema),
});
const authProviderResponseSchema = t.Object({ provider: authProviderSummarySchema });
export const authIdentitiesResponseSchema = t.Object({ identities: t.Array(authIdentitySchema) });
export const authUnlinkAllIdentitiesResponseSchema = t.Object({
  status: t.Literal("ok"),
  deletedIdentityCount: t.Number({ minimum: 0 }),
  revokedOAuthSessionCount: t.Number({ minimum: 0 }),
});
export const userProfileResponseSchema = t.Object({ user: publicUserSchema });
export const updateUserProfileResponseSchema = t.Object({ user: publicUserSchema });
export const notificationPreferencesResponseSchema = t.Object({
  notificationPreferences: notificationPreferencesSchema,
});
export const notificationHistoryListResponseSchema = t.Object({
  notifications: t.Array(notificationHistoryItemSchema),
  unreadCount: t.Number({ minimum: 0 }),
  pagination: notificationHistoryPaginationSchema,
});
export const createNotificationHistoryResponseSchema = t.Object({
  notification: notificationHistoryItemSchema,
});
export const markNotificationReadResponseSchema = t.Object({
  notification: notificationHistoryItemSchema,
});
export const clearNotificationHistoryResponseSchema = t.Object({
  status: t.Literal("ok"),
  deletedCount: t.Number({ minimum: 0 }),
});
export const logoutResponseSchema = t.Object({
  status: t.Literal("ok"),
  redirectUri: t.Optional(t.String({ format: "uri" })),
});
export const changePasswordResponseSchema = t.Object({ status: t.Literal("ok") });
export const sessionCookieSchema = t.Cookie({
  [SESSION_COOKIE_NAME]: t.Optional(t.String()),
});
export const oauthCookieSchema = t.Cookie({
  [SESSION_COOKIE_NAME]: t.Optional(t.String()),
  [OAUTH_STATE_COOKIE_NAME]: t.Optional(t.String()),
});
export const logoutCookieSchema = t.Cookie({
  [SESSION_COOKIE_NAME]: t.Optional(t.String()),
  [OAUTH_STATE_COOKIE_NAME]: t.Optional(t.String()),
});
export const apiErrorResponseSchema = t.Object({
  error: t.Object({
    code: t.String(),
    message: t.String(),
  }),
});
export const oauthRedirectResponseSchema = {
  302: t.Void(),
  400: apiErrorResponseSchema,
  401: apiErrorResponseSchema,
  403: apiErrorResponseSchema,
  404: apiErrorResponseSchema,
  429: apiErrorResponseSchema,
  502: apiErrorResponseSchema,
  503: apiErrorResponseSchema,
};
export const oauthCallbackResponseSchema = {
  ...oauthRedirectResponseSchema,
  409: apiErrorResponseSchema,
};
export const authProviderMutationResponseSchema = {
  200: authProviderResponseSchema,
  400: apiErrorResponseSchema,
  401: apiErrorResponseSchema,
  403: apiErrorResponseSchema,
  404: apiErrorResponseSchema,
  503: apiErrorResponseSchema,
};
export const authProviderDeleteResponseSchema = {
  200: logoutResponseSchema,
  400: apiErrorResponseSchema,
  401: apiErrorResponseSchema,
  403: apiErrorResponseSchema,
  404: apiErrorResponseSchema,
};
export const apiKeyErrorResponseSchemas = {
  401: apiErrorResponseSchema,
  403: apiErrorResponseSchema,
  404: apiErrorResponseSchema,
  422: apiErrorResponseSchema,
  429: apiErrorResponseSchema,
};
