CREATE TABLE `api_key_permission_grants` (
	`id` text PRIMARY KEY NOT NULL,
	`api_key_id` text NOT NULL,
	`permission` text NOT NULL,
	`granted_by_user_id` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`api_key_id`) REFERENCES `api_keys`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`granted_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `api_key_permission_grants_key_permission_unique` ON `api_key_permission_grants` (`api_key_id`,`permission`);--> statement-breakpoint
CREATE INDEX `api_key_permission_grants_api_key_id_idx` ON `api_key_permission_grants` (`api_key_id`);--> statement-breakpoint
CREATE INDEX `api_key_permission_grants_permission_idx` ON `api_key_permission_grants` (`permission`);--> statement-breakpoint
CREATE TABLE `api_keys` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`secret_hash` text NOT NULL,
	`prefix` text NOT NULL,
	`masked_key` text NOT NULL,
	`created_by_user_id` text,
	`expires_at` text,
	`ip_allowlist_json` text,
	`last_used_at` text,
	`last_used_ip_address` text,
	`last_used_user_agent` text,
	`revoked_at` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `api_keys_secret_hash_unique` ON `api_keys` (`secret_hash`);--> statement-breakpoint
CREATE INDEX `api_keys_created_by_user_id_idx` ON `api_keys` (`created_by_user_id`);--> statement-breakpoint
CREATE INDEX `api_keys_expires_at_idx` ON `api_keys` (`expires_at`);--> statement-breakpoint
CREATE INDEX `api_keys_revoked_at_idx` ON `api_keys` (`revoked_at`);