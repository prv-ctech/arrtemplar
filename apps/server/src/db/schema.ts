import {
  AUTH_METHOD_VALUES,
  AUTH_PROVIDER_SLUGS,
  DEFAULT_PROFILE_AVATAR_ID,
  DEFAULT_PROFILE_BANNER_ID,
  NOTIFICATION_FREQUENCY_VALUES,
  TOAST_NOTIFICATION_EVENT_IDS,
  TOAST_NOTIFICATION_IMPORTANCE_VALUES,
  TOAST_NOTIFICATION_SEVERITY_VALUES,
  USER_PERMISSION_VALUES,
} from "@arrtemplar/shared";
import { type InferInsertModel, type InferSelectModel, sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

const timestampNow = sql<string>`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`;

export const userPermissions = USER_PERMISSION_VALUES;
const userPermissionEnum = [...userPermissions] as [
  (typeof userPermissions)[number],
  ...(typeof userPermissions)[number][],
];
const authMethodEnum = [...AUTH_METHOD_VALUES] as [
  (typeof AUTH_METHOD_VALUES)[number],
  ...(typeof AUTH_METHOD_VALUES)[number][],
];
const authProviderSlugEnum = [...AUTH_PROVIDER_SLUGS] as [
  (typeof AUTH_PROVIDER_SLUGS)[number],
  ...(typeof AUTH_PROVIDER_SLUGS)[number][],
];
const notificationFrequencyEnum = [...NOTIFICATION_FREQUENCY_VALUES] as [
  (typeof NOTIFICATION_FREQUENCY_VALUES)[number],
  ...(typeof NOTIFICATION_FREQUENCY_VALUES)[number][],
];
const toastNotificationIdEnum = [...TOAST_NOTIFICATION_EVENT_IDS] as [
  (typeof TOAST_NOTIFICATION_EVENT_IDS)[number],
  ...(typeof TOAST_NOTIFICATION_EVENT_IDS)[number][],
];
const toastNotificationSeverityEnum = [...TOAST_NOTIFICATION_SEVERITY_VALUES] as [
  (typeof TOAST_NOTIFICATION_SEVERITY_VALUES)[number],
  ...(typeof TOAST_NOTIFICATION_SEVERITY_VALUES)[number][],
];
const toastNotificationImportanceEnum = [...TOAST_NOTIFICATION_IMPORTANCE_VALUES] as [
  (typeof TOAST_NOTIFICATION_IMPORTANCE_VALUES)[number],
  ...(typeof TOAST_NOTIFICATION_IMPORTANCE_VALUES)[number][],
];

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
    createdAt: text("created_at").notNull().default(timestampNow),
    updatedAt: text("updated_at").notNull().default(timestampNow),
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
    label: text("label").notNull(),
    issuer: text("issuer").notNull(),
    clientId: text("client_id").notNull(),
    clientSecretEncrypted: text("client_secret_encrypted").notNull(),
    masterKeyId: text("master_key_id").notNull(),
    scopes: text("scopes").notNull(),
    redirectUris: text("redirect_uris").notNull(),
    enabled: integer("enabled", { mode: "boolean" }).notNull().default(false),
    createdAt: text("created_at").notNull().default(timestampNow),
    updatedAt: text("updated_at").notNull().default(timestampNow),
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
    createdAt: text("created_at").notNull().default(timestampNow),
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
    createdAt: text("created_at").notNull().default(timestampNow),
  },
  (table) => [
    index("notification_history_user_created_at_idx").on(table.userId, table.createdAt),
    index("notification_history_user_unread_idx").on(table.userId, table.readAt),
  ],
);

export const userPermissionGrants = sqliteTable(
  "user_permission_grants",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    permission: text("permission", { enum: userPermissionEnum }).notNull(),
    grantedByUserId: text("granted_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: text("created_at").notNull().default(timestampNow),
    updatedAt: text("updated_at").notNull().default(timestampNow),
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
    createdAt: text("created_at").notNull().default(timestampNow),
  },
  (table) => [
    uniqueIndex("sessions_token_hash_unique").on(table.tokenHash),
    index("sessions_user_id_idx").on(table.userId),
    index("sessions_expires_at_idx").on(table.expiresAt),
  ],
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
    createdAt: text("created_at").notNull().default(timestampNow),
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
export type AuditLog = InferSelectModel<typeof auditLogs>;
export type NewAuditLog = InferInsertModel<typeof auditLogs>;
