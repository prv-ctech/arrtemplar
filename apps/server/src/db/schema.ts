import { USER_PERMISSION_VALUES, USER_ROLES } from "@arrtemplar/shared";
import { type InferInsertModel, type InferSelectModel, sql } from "drizzle-orm";
import { index, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

const timestampNow = sql<string>`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`;

export const userRoles = USER_ROLES;
export const userPermissions = USER_PERMISSION_VALUES;

export const users = sqliteTable(
  "users",
  {
    id: text("id").primaryKey(),
    publicId: text("public_id").notNull(),
    username: text("username").notNull(),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    role: text("role", { enum: userRoles }).notNull().default("user"),
    disabledAt: text("disabled_at"),
    createdAt: text("created_at").notNull().default(timestampNow),
    updatedAt: text("updated_at").notNull().default(timestampNow),
    lastLoginAt: text("last_login_at"),
  },
  (table) => [
    uniqueIndex("users_public_id_unique").on(table.publicId),
    uniqueIndex("users_username_unique").on(table.username),
    uniqueIndex("users_email_unique").on(table.email),
    index("users_role_idx").on(table.role),
  ],
);

export const userPermissionGrants = sqliteTable(
  "user_permission_grants",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    permission: text("permission", { enum: userPermissions }).notNull(),
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

export type UserRole = (typeof userRoles)[number];
export type User = InferSelectModel<typeof users>;
export type NewUser = InferInsertModel<typeof users>;
export type UserPermissionGrant = InferSelectModel<typeof userPermissionGrants>;
export type NewUserPermissionGrant = InferInsertModel<typeof userPermissionGrants>;
export type Session = InferSelectModel<typeof sessions>;
export type NewSession = InferInsertModel<typeof sessions>;
export type AuditLog = InferSelectModel<typeof auditLogs>;
export type NewAuditLog = InferInsertModel<typeof auditLogs>;
