import { type InferInsertModel, type InferSelectModel, sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

const timestampNow = sql<string>`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`;

export const userRoles = ["admin", "user"] as const;
export const animeTypes = ["tv", "movie", "ova", "ona", "special", "unknown"] as const;
export const animeStatuses = [
  "airing",
  "completed",
  "upcoming",
  "hiatus",
  "cancelled",
  "unknown",
] as const;
export const animeSeasons = ["winter", "spring", "summer", "fall", "unknown"] as const;

export const users = sqliteTable(
  "users",
  {
    id: text("id").primaryKey(),
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
    uniqueIndex("users_username_unique").on(table.username),
    uniqueIndex("users_email_unique").on(table.email),
    index("users_role_idx").on(table.role),
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

export const animeTitles = sqliteTable(
  "anime_titles",
  {
    id: text("id").primaryKey(),
    canonicalTitle: text("canonical_title").notNull(),
    englishTitle: text("english_title"),
    nativeTitle: text("native_title"),
    romajiTitle: text("romaji_title"),
    type: text("type", { enum: animeTypes }).notNull().default("unknown"),
    status: text("status", { enum: animeStatuses }).notNull().default("unknown"),
    year: integer("year"),
    season: text("season", { enum: animeSeasons }),
    synopsis: text("synopsis"),
    posterUrl: text("poster_url"),
    bannerUrl: text("banner_url"),
    sourceProvider: text("source_provider"),
    sourceId: text("source_id"),
    createdAt: text("created_at").notNull().default(timestampNow),
    updatedAt: text("updated_at").notNull().default(timestampNow),
  },
  (table) => [
    index("anime_titles_canonical_title_idx").on(table.canonicalTitle),
    uniqueIndex("anime_titles_source_unique").on(table.sourceProvider, table.sourceId),
  ],
);

export const animeExternalIds = sqliteTable(
  "anime_external_ids",
  {
    id: text("id").primaryKey(),
    animeId: text("anime_id")
      .notNull()
      .references(() => animeTitles.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    externalId: text("external_id").notNull(),
    confidence: integer("confidence").notNull().default(100),
    createdAt: text("created_at").notNull().default(timestampNow),
  },
  (table) => [
    index("anime_external_ids_anime_id_idx").on(table.animeId),
    uniqueIndex("anime_external_ids_provider_external_id_unique").on(
      table.provider,
      table.externalId,
    ),
  ],
);

export const animeAliases = sqliteTable(
  "anime_aliases",
  {
    id: text("id").primaryKey(),
    animeId: text("anime_id")
      .notNull()
      .references(() => animeTitles.id, { onDelete: "cascade" }),
    alias: text("alias").notNull(),
    normalizedAlias: text("normalized_alias").notNull(),
    source: text("source").notNull().default("manual"),
    confidence: integer("confidence").notNull().default(100),
    createdByUserId: text("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: text("created_at").notNull().default(timestampNow),
  },
  (table) => [
    index("anime_aliases_anime_id_idx").on(table.animeId),
    index("anime_aliases_normalized_alias_idx").on(table.normalizedAlias),
    uniqueIndex("anime_aliases_anime_normalized_alias_unique").on(
      table.animeId,
      table.normalizedAlias,
    ),
  ],
);

export const episodes = sqliteTable(
  "episodes",
  {
    id: text("id").primaryKey(),
    animeId: text("anime_id")
      .notNull()
      .references(() => animeTitles.id, { onDelete: "cascade" }),
    seasonNumber: integer("season_number"),
    episodeNumber: integer("episode_number"),
    absoluteNumber: integer("absolute_number"),
    title: text("title"),
    synopsis: text("synopsis"),
    airDate: text("air_date"),
    runtimeMinutes: integer("runtime_minutes"),
    createdAt: text("created_at").notNull().default(timestampNow),
    updatedAt: text("updated_at").notNull().default(timestampNow),
  },
  (table) => [
    index("episodes_anime_id_idx").on(table.animeId),
    uniqueIndex("episodes_anime_season_episode_unique").on(
      table.animeId,
      table.seasonNumber,
      table.episodeNumber,
    ),
    uniqueIndex("episodes_anime_absolute_unique").on(table.animeId, table.absoluteNumber),
  ],
);

export const metadataCache = sqliteTable(
  "metadata_cache",
  {
    id: text("id").primaryKey(),
    provider: text("provider").notNull(),
    cacheKey: text("cache_key").notNull(),
    responseJson: text("response_json").notNull(),
    expiresAt: text("expires_at"),
    createdAt: text("created_at").notNull().default(timestampNow),
    updatedAt: text("updated_at").notNull().default(timestampNow),
  },
  (table) => [
    uniqueIndex("metadata_cache_provider_cache_key_unique").on(table.provider, table.cacheKey),
    index("metadata_cache_expires_at_idx").on(table.expiresAt),
  ],
);

export type UserRole = (typeof userRoles)[number];
export type User = InferSelectModel<typeof users>;
export type NewUser = InferInsertModel<typeof users>;
export type Session = InferSelectModel<typeof sessions>;
export type NewSession = InferInsertModel<typeof sessions>;
export type AuditLog = InferSelectModel<typeof auditLogs>;
export type NewAuditLog = InferInsertModel<typeof auditLogs>;
export type AnimeTitle = InferSelectModel<typeof animeTitles>;
export type NewAnimeTitle = InferInsertModel<typeof animeTitles>;
export type AnimeExternalId = InferSelectModel<typeof animeExternalIds>;
export type NewAnimeExternalId = InferInsertModel<typeof animeExternalIds>;
export type AnimeAlias = InferSelectModel<typeof animeAliases>;
export type NewAnimeAlias = InferInsertModel<typeof animeAliases>;
export type Episode = InferSelectModel<typeof episodes>;
export type NewEpisode = InferInsertModel<typeof episodes>;
export type MetadataCacheEntry = InferSelectModel<typeof metadataCache>;
export type NewMetadataCacheEntry = InferInsertModel<typeof metadataCache>;
