CREATE TABLE `proxy_profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`variant` text,
	`name` text NOT NULL,
	`description` text,
	`enabled` integer DEFAULT true NOT NULL,
	`scheme` text NOT NULL,
	`host` text NOT NULL,
	`port` integer NOT NULL,
	`path` text,
	`request_timeout_ms` integer DEFAULT 60000 NOT NULL,
	`session_name` text,
	`session_ttl_minutes` integer,
	`username` text,
	`password_encrypted` text,
	`master_key_id` text,
	`last_tested_at` text,
	`last_test_outcome` text,
	`last_test_message` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `proxy_profiles_kind_unique` ON `proxy_profiles` (`kind`);