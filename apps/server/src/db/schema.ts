import {
  AUTH_METHOD_VALUES,
  AUTH_PROVIDER_KIND_VALUES,
  AUTH_PROVIDER_SLUGS,
  CHALLENGE_SOLVER_VARIANT_VALUES,
  DEFAULT_PROFILE_AVATAR_ID,
  DEFAULT_PROFILE_BANNER_ID,
  DEFAULT_PROXY_REQUEST_TIMEOUT_MS,
  HELP_TICKET_MEDIA_KIND_VALUES,
  HELP_TICKET_STATUS_VALUES,
  HTTP_PROXY_SCHEME_VALUES,
  NOTIFICATION_FREQUENCY_VALUES,
  OIDC_PROFILE_SIGNING_ALGORITHM_VALUES,
  OIDC_SIGNING_ALGORITHM_VALUES,
  PROXY_PROFILE_KIND_VALUES,
  PROXY_PROFILE_TEST_OUTCOME_VALUES,
  SERVICE_INTEGRATION_AUTH_MODE_VALUES,
  SERVICE_INTEGRATION_KIND_VALUES,
  SERVICE_INTEGRATION_PROBE_OUTCOME_VALUES,
  TOAST_NOTIFICATION_EVENT_IDS,
  TOAST_NOTIFICATION_IMPORTANCE_VALUES,
  TOAST_NOTIFICATION_SEVERITY_VALUES,
  TOKEN_ENDPOINT_AUTH_METHOD_VALUES,
  USER_PERMISSION_VALUES,
} from "@arrtemplar/shared";
import { type InferInsertModel, type InferSelectModel, sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

const timestampNow = sql<string>`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`;
type NonEmptyEnum<T extends string> = [T, ...T[]];

function nonEmptyEnum<T extends string>(values: readonly T[]): NonEmptyEnum<T> {
  if (values.length === 0) {
    throw new Error("Drizzle enum values must not be empty.");
  }

  return [...values] as NonEmptyEnum<T>;
}

function createdAtColumn() {
  return text("created_at").notNull().default(timestampNow);
}

function timestampColumns() {
  return {
    createdAt: createdAtColumn(),
    updatedAt: text("updated_at").notNull().default(timestampNow),
  };
}

export const userPermissions = USER_PERMISSION_VALUES;
const userPermissionEnum = nonEmptyEnum(userPermissions);
const authMethodEnum = nonEmptyEnum(AUTH_METHOD_VALUES);
const authProviderSlugEnum = nonEmptyEnum(AUTH_PROVIDER_SLUGS);
const authProviderKindEnum = nonEmptyEnum(AUTH_PROVIDER_KIND_VALUES);
const tokenEndpointAuthMethodEnum = nonEmptyEnum(TOKEN_ENDPOINT_AUTH_METHOD_VALUES);
const oidcSigningAlgorithmEnum = nonEmptyEnum(OIDC_SIGNING_ALGORITHM_VALUES);
const oidcProfileSigningAlgorithmEnum = nonEmptyEnum(OIDC_PROFILE_SIGNING_ALGORITHM_VALUES);
const notificationFrequencyEnum = nonEmptyEnum(NOTIFICATION_FREQUENCY_VALUES);
const helpTicketStatusEnum = nonEmptyEnum(HELP_TICKET_STATUS_VALUES);
const helpTicketMediaKindEnum = nonEmptyEnum(HELP_TICKET_MEDIA_KIND_VALUES);
const serviceIntegrationKindEnum = nonEmptyEnum(SERVICE_INTEGRATION_KIND_VALUES);
const serviceIntegrationAuthModeEnum = nonEmptyEnum(SERVICE_INTEGRATION_AUTH_MODE_VALUES);
const serviceIntegrationProbeOutcomeEnum = nonEmptyEnum(SERVICE_INTEGRATION_PROBE_OUTCOME_VALUES);
const proxyProfileKindEnum = nonEmptyEnum(PROXY_PROFILE_KIND_VALUES);
const challengeSolverVariantEnum = nonEmptyEnum(CHALLENGE_SOLVER_VARIANT_VALUES);
const httpProxySchemeEnum = nonEmptyEnum(HTTP_PROXY_SCHEME_VALUES);
const proxyProfileTestOutcomeEnum = nonEmptyEnum(PROXY_PROFILE_TEST_OUTCOME_VALUES);
const toastNotificationIdEnum = nonEmptyEnum(TOAST_NOTIFICATION_EVENT_IDS);
const toastNotificationSeverityEnum = nonEmptyEnum(TOAST_NOTIFICATION_SEVERITY_VALUES);
const toastNotificationImportanceEnum = nonEmptyEnum(TOAST_NOTIFICATION_IMPORTANCE_VALUES);
const helpTicketScanStatusEnum = nonEmptyEnum([
  "not_configured",
  "clean",
  "infected",
  "failed",
] as const);

function permissionGrantMetadataColumns() {
  return {
    id: text("id").primaryKey(),
    permission: text("permission", { enum: userPermissionEnum }).notNull(),
    grantedByUserId: text("granted_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    ...timestampColumns(),
  };
}

export const users = sqliteTable(
  "users",
  {
    id: text("id").primaryKey(),
    publicId: text("public_id").notNull(),
    username: text("username").notNull(),
    email: text("email").notNull(),
    avatarId: text("avatar_id").notNull().default(DEFAULT_PROFILE_AVATAR_ID),
    bannerId: text("banner_id").notNull().default(DEFAULT_PROFILE_BANNER_ID),
    toastNotificationsEnabled: integer("toast_notifications_enabled", { mode: "boolean" })
      .notNull()
      .default(true),
    toastNotificationFrequency: text("toast_notification_frequency", {
      enum: notificationFrequencyEnum,
    })
      .notNull()
      .default("all"),
    authMethod: text("auth_method", { enum: authMethodEnum }).notNull().default("local"),
    passwordHash: text("password_hash").notNull(),
    disabledAt: text("disabled_at"),
    ...timestampColumns(),
    lastLoginAt: text("last_login_at"),
  },
  (table) => [
    uniqueIndex("users_public_id_unique").on(table.publicId),
    uniqueIndex("users_username_unique").on(table.username),
    uniqueIndex("users_email_unique").on(table.email),
  ],
);

export const authProviders = sqliteTable(
  "auth_providers",
  {
    id: text("id").primaryKey(),
    slug: text("slug", { enum: authProviderSlugEnum }).notNull(),
    providerKind: text("provider_kind", { enum: authProviderKindEnum }).notNull().default("custom"),
    label: text("label").notNull(),
    issuer: text("issuer").notNull(),
    clientId: text("client_id").notNull(),
    clientSecretEncrypted: text("client_secret_encrypted").notNull(),
    masterKeyId: text("master_key_id").notNull(),
    scopes: text("scopes").notNull(),
    redirectUris: text("redirect_uris").notNull(),
    enabled: integer("enabled", { mode: "boolean" }).notNull().default(false),
    buttonText: text("button_text").notNull().default("Continue with OIDC"),
    autoRegister: integer("auto_register", { mode: "boolean" }).notNull().default(true),
    tokenEndpointAuthMethod: text("token_endpoint_auth_method", {
      enum: tokenEndpointAuthMethodEnum,
    })
      .notNull()
      .default("client_secret_basic"),
    timeoutMs: integer("timeout_ms").notNull().default(10_000),
    prompt: text("prompt"),
    endSessionEndpoint: text("end_session_endpoint"),
    idTokenSigningAlgorithm: text("id_token_signing_algorithm", {
      enum: oidcSigningAlgorithmEnum,
    })
      .notNull()
      .default("RS256"),
    profileSigningAlgorithm: text("profile_signing_algorithm", {
      enum: oidcProfileSigningAlgorithmEnum,
    })
      .notNull()
      .default("none"),
    mobileRedirectEnabled: integer("mobile_redirect_enabled", { mode: "boolean" })
      .notNull()
      .default(false),
    mobileRedirectUri: text("mobile_redirect_uri"),
    ...timestampColumns(),
  },
  (table) => [uniqueIndex("auth_providers_slug_unique").on(table.slug)],
);

export const authIdentities = sqliteTable(
  "auth_identities",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    provider: text("provider", { enum: authProviderSlugEnum }).notNull(),
    issuer: text("issuer").notNull(),
    subject: text("subject").notNull(),
    preferredUsername: text("preferred_username"),
    name: text("name"),
    email: text("email"),
    createdAt: createdAtColumn(),
  },
  (table) => [
    uniqueIndex("auth_identities_provider_issuer_subject_unique").on(
      table.provider,
      table.issuer,
      table.subject,
    ),
    index("auth_identities_user_id_idx").on(table.userId),
  ],
);

export const notificationHistory = sqliteTable(
  "notification_history",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    eventId: text("event_id", { enum: toastNotificationIdEnum }).notNull(),
    title: text("title").notNull(),
    description: text("description"),
    severity: text("severity", { enum: toastNotificationSeverityEnum }).notNull(),
    importance: text("importance", { enum: toastNotificationImportanceEnum }).notNull(),
    readAt: text("read_at"),
    createdAt: createdAtColumn(),
  },
  (table) => [
    index("notification_history_user_created_at_idx").on(table.userId, sql`created_at DESC`),
    index("notification_history_user_unread_idx").on(table.userId, table.readAt),
  ],
);

export const userPermissionGrants = sqliteTable(
  "user_permission_grants",
  {
    ...permissionGrantMetadataColumns(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
  },
  (table) => [
    uniqueIndex("user_permission_grants_user_permission_unique").on(table.userId, table.permission),
    index("user_permission_grants_user_id_idx").on(table.userId),
    index("user_permission_grants_permission_idx").on(table.permission),
  ],
);

export const sessions = sqliteTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    expiresAt: text("expires_at").notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    oauthProvider: text("oauth_provider", { enum: authProviderSlugEnum }),
    oauthIdTokenEncrypted: text("oauth_id_token_encrypted"),
    oauthMasterKeyId: text("oauth_master_key_id"),
    oauthSid: text("oauth_sid"),
    createdAt: createdAtColumn(),
  },
  (table) => [
    uniqueIndex("sessions_token_hash_unique").on(table.tokenHash),
    index("sessions_user_id_idx").on(table.userId),
    index("sessions_expires_at_idx").on(table.expiresAt),
    index("sessions_oauth_provider_sid_idx").on(table.oauthProvider, table.oauthSid),
  ],
);

export const apiKeys = sqliteTable(
  "api_keys",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    description: text("description"),
    secretHash: text("secret_hash").notNull(),
    keyPrefix: text("key_prefix").notNull().default(""),
    fingerprint: text("fingerprint").notNull().default(""),
    maskedKey: text("masked_key").notNull(),
    createdByUserId: text("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    lastUsedAt: text("last_used_at"),
    lastUsedIpAddress: text("last_used_ip_address"),
    lastUsedUserAgent: text("last_used_user_agent"),
    rotatedAt: text("rotated_at"),
    deletedAt: text("deleted_at"),
    ...timestampColumns(),
  },
  (table) => [
    uniqueIndex("api_keys_secret_hash_unique").on(table.secretHash),
    index("api_keys_created_by_user_id_idx").on(table.createdByUserId),
    index("api_keys_deleted_at_idx").on(table.deletedAt),
  ],
);

export const helpTickets = sqliteTable(
  "help_tickets",
  {
    id: text("id").primaryKey(),
    createdByUserId: text("created_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description").notNull(),
    status: text("status", { enum: helpTicketStatusEnum }).notNull().default("new"),
    statusUpdatedAt: text("status_updated_at").notNull().default(timestampNow),
    statusUpdatedByUserId: text("status_updated_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    ...timestampColumns(),
  },
  (table) => [
    index("help_tickets_created_by_user_id_created_at_idx").on(
      table.createdByUserId,
      sql`created_at DESC`,
    ),
    index("help_tickets_status_created_at_idx").on(table.status, sql`created_at DESC`),
  ],
);

export const helpTicketAttachments = sqliteTable(
  "help_ticket_attachments",
  {
    id: text("id").primaryKey(),
    ticketId: text("ticket_id")
      .notNull()
      .references(() => helpTickets.id, { onDelete: "cascade" }),
    uploadedByUserId: text("uploaded_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    originalFileName: text("original_file_name").notNull(),
    storedFileName: text("stored_file_name").notNull(),
    mediaKind: text("media_kind", { enum: helpTicketMediaKindEnum }).notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    storedSizeBytes: integer("stored_size_bytes").notNull(),
    width: integer("width"),
    height: integer("height"),
    sha256: text("sha256").notNull(),
    scanStatus: text("scan_status", { enum: helpTicketScanStatusEnum })
      .notNull()
      .default("not_configured"),
    scanEngine: text("scan_engine"),
    scanResult: text("scan_result"),
    createdAt: createdAtColumn(),
  },
  (table) => [index("help_ticket_attachments_ticket_id_idx").on(table.ticketId)],
);

export const serviceIntegrations = sqliteTable(
  "service_integrations",
  {
    id: text("id").primaryKey(),
    kind: text("kind", { enum: serviceIntegrationKindEnum }).notNull(),
    displayName: text("display_name").notNull(),
    isDefault: integer("is_default", { mode: "boolean" }).notNull().default(false),
    enabled: integer("enabled", { mode: "boolean" }).notNull().default(false),
    useSsl: integer("use_ssl", { mode: "boolean" }).notNull().default(false),
    host: text("host").notNull(),
    port: integer("port").notNull(),
    urlBase: text("url_base"),
    authMode: text("auth_mode", { enum: serviceIntegrationAuthModeEnum }).notNull(),
    username: text("username"),
    apiKeyEncrypted: text("api_key_encrypted"),
    passwordEncrypted: text("password_encrypted"),
    masterKeyId: text("master_key_id"),
    lastTestedAt: text("last_tested_at"),
    lastTestOutcome: text("last_test_outcome", { enum: serviceIntegrationProbeOutcomeEnum }),
    lastTestMessage: text("last_test_message"),
    lastStatusCheckedAt: text("last_status_checked_at"),
    lastStatusOutcome: text("last_status_outcome", {
      enum: serviceIntegrationProbeOutcomeEnum,
    }),
    lastStatusMessage: text("last_status_message"),
    ...timestampColumns(),
  },
  (table) => [
    index("service_integrations_kind_idx").on(table.kind),
    uniqueIndex("service_integrations_default_kind_unique")
      .on(table.kind)
      .where(sql`${table.isDefault} = 1`),
  ],
);

export const proxyProfiles = sqliteTable(
  "proxy_profiles",
  {
    id: text("id").primaryKey(),
    kind: text("kind", { enum: proxyProfileKindEnum }).notNull(),
    variant: text("variant", { enum: challengeSolverVariantEnum }),
    name: text("name").notNull(),
    description: text("description"),
    enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
    scheme: text("scheme", { enum: httpProxySchemeEnum }).notNull(),
    host: text("host").notNull(),
    port: integer("port").notNull(),
    path: text("path"),
    requestTimeoutMs: integer("request_timeout_ms")
      .notNull()
      .default(DEFAULT_PROXY_REQUEST_TIMEOUT_MS),
    sessionName: text("session_name"),
    sessionTtlMinutes: integer("session_ttl_minutes"),
    username: text("username"),
    passwordEncrypted: text("password_encrypted"),
    masterKeyId: text("master_key_id"),
    lastTestedAt: text("last_tested_at"),
    lastTestOutcome: text("last_test_outcome", { enum: proxyProfileTestOutcomeEnum }),
    lastTestMessage: text("last_test_message"),
    ...timestampColumns(),
  },
  (table) => [uniqueIndex("proxy_profiles_kind_unique").on(table.kind)],
);

export const auditLogs = sqliteTable(
  "audit_logs",
  {
    id: text("id").primaryKey(),
    actorUserId: text("actor_user_id").references(() => users.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    targetType: text("target_type"),
    targetId: text("target_id"),
    metadataJson: text("metadata_json"),
    ipAddress: text("ip_address"),
    createdAt: createdAtColumn(),
  },
  (table) => [
    index("audit_logs_actor_user_id_idx").on(table.actorUserId),
    index("audit_logs_action_idx").on(table.action),
    index("audit_logs_target_idx").on(table.targetType, table.targetId),
    index("audit_logs_created_at_idx").on(table.createdAt),
  ],
);

export type User = InferSelectModel<typeof users>;
export type NewUser = InferInsertModel<typeof users>;
export type AuthProvider = InferSelectModel<typeof authProviders>;
export type NewAuthProvider = InferInsertModel<typeof authProviders>;
export type AuthIdentity = InferSelectModel<typeof authIdentities>;
export type NewAuthIdentity = InferInsertModel<typeof authIdentities>;
export type NotificationHistory = InferSelectModel<typeof notificationHistory>;
export type NewNotificationHistory = InferInsertModel<typeof notificationHistory>;
export type UserPermissionGrant = InferSelectModel<typeof userPermissionGrants>;
export type NewUserPermissionGrant = InferInsertModel<typeof userPermissionGrants>;
export type Session = InferSelectModel<typeof sessions>;
export type NewSession = InferInsertModel<typeof sessions>;
export type ApiKey = InferSelectModel<typeof apiKeys>;
export type NewApiKey = InferInsertModel<typeof apiKeys>;
export type HelpTicket = InferSelectModel<typeof helpTickets>;
export type NewHelpTicket = InferInsertModel<typeof helpTickets>;
export type HelpTicketAttachment = InferSelectModel<typeof helpTicketAttachments>;
export type NewHelpTicketAttachment = InferInsertModel<typeof helpTicketAttachments>;
export type ServiceIntegration = InferSelectModel<typeof serviceIntegrations>;
export type NewServiceIntegration = InferInsertModel<typeof serviceIntegrations>;
export type ProxyProfile = InferSelectModel<typeof proxyProfiles>;
export type NewProxyProfile = InferInsertModel<typeof proxyProfiles>;
export type AuditLog = InferSelectModel<typeof auditLogs>;
export type NewAuditLog = InferInsertModel<typeof auditLogs>;
