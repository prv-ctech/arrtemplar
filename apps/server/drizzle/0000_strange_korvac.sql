CREATE TABLE `anime_aliases` (
	`id` text PRIMARY KEY NOT NULL,
	`anime_id` text NOT NULL,
	`alias` text NOT NULL,
	`normalized_alias` text NOT NULL,
	`source` text DEFAULT 'manual' NOT NULL,
	`confidence` integer DEFAULT 100 NOT NULL,
	`created_by_user_id` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`anime_id`) REFERENCES `anime_titles`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `anime_aliases_anime_id_idx` ON `anime_aliases` (`anime_id`);--> statement-breakpoint
CREATE INDEX `anime_aliases_normalized_alias_idx` ON `anime_aliases` (`normalized_alias`);--> statement-breakpoint
CREATE UNIQUE INDEX `anime_aliases_anime_normalized_alias_unique` ON `anime_aliases` (`anime_id`,`normalized_alias`);--> statement-breakpoint
CREATE TABLE `anime_external_ids` (
	`id` text PRIMARY KEY NOT NULL,
	`anime_id` text NOT NULL,
	`provider` text NOT NULL,
	`external_id` text NOT NULL,
	`confidence` integer DEFAULT 100 NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`anime_id`) REFERENCES `anime_titles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `anime_external_ids_anime_id_idx` ON `anime_external_ids` (`anime_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `anime_external_ids_provider_external_id_unique` ON `anime_external_ids` (`provider`,`external_id`);--> statement-breakpoint
CREATE TABLE `anime_titles` (
	`id` text PRIMARY KEY NOT NULL,
	`canonical_title` text NOT NULL,
	`english_title` text,
	`native_title` text,
	`romaji_title` text,
	`type` text DEFAULT 'unknown' NOT NULL,
	`status` text DEFAULT 'unknown' NOT NULL,
	`year` integer,
	`season` text,
	`synopsis` text,
	`poster_url` text,
	`banner_url` text,
	`source_provider` text,
	`source_id` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `anime_titles_canonical_title_idx` ON `anime_titles` (`canonical_title`);--> statement-breakpoint
CREATE UNIQUE INDEX `anime_titles_source_unique` ON `anime_titles` (`source_provider`,`source_id`);--> statement-breakpoint
CREATE TABLE `audit_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`actor_user_id` text,
	`action` text NOT NULL,
	`target_type` text,
	`target_id` text,
	`metadata_json` text,
	`ip_address` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`actor_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `audit_logs_actor_user_id_idx` ON `audit_logs` (`actor_user_id`);--> statement-breakpoint
CREATE INDEX `audit_logs_action_idx` ON `audit_logs` (`action`);--> statement-breakpoint
CREATE INDEX `audit_logs_target_idx` ON `audit_logs` (`target_type`,`target_id`);--> statement-breakpoint
CREATE INDEX `audit_logs_created_at_idx` ON `audit_logs` (`created_at`);--> statement-breakpoint
CREATE TABLE `episodes` (
	`id` text PRIMARY KEY NOT NULL,
	`anime_id` text NOT NULL,
	`season_number` integer,
	`episode_number` integer,
	`absolute_number` integer,
	`title` text,
	`synopsis` text,
	`air_date` text,
	`runtime_minutes` integer,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`anime_id`) REFERENCES `anime_titles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `episodes_anime_id_idx` ON `episodes` (`anime_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `episodes_anime_season_episode_unique` ON `episodes` (`anime_id`,`season_number`,`episode_number`);--> statement-breakpoint
CREATE UNIQUE INDEX `episodes_anime_absolute_unique` ON `episodes` (`anime_id`,`absolute_number`);--> statement-breakpoint
CREATE TABLE `metadata_cache` (
	`id` text PRIMARY KEY NOT NULL,
	`provider` text NOT NULL,
	`cache_key` text NOT NULL,
	`response_json` text NOT NULL,
	`expires_at` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `metadata_cache_provider_cache_key_unique` ON `metadata_cache` (`provider`,`cache_key`);--> statement-breakpoint
CREATE INDEX `metadata_cache_expires_at_idx` ON `metadata_cache` (`expires_at`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`expires_at` text NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sessions_token_hash_unique` ON `sessions` (`token_hash`);--> statement-breakpoint
CREATE INDEX `sessions_user_id_idx` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE INDEX `sessions_expires_at_idx` ON `sessions` (`expires_at`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`username` text NOT NULL,
	`email` text NOT NULL,
	`password_hash` text NOT NULL,
	`role` text DEFAULT 'user' NOT NULL,
	`disabled_at` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`last_login_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_unique` ON `users` (`username`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE INDEX `users_role_idx` ON `users` (`role`);