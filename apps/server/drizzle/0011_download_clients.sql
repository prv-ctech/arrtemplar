CREATE TABLE `download_clients` (
	`kind` text PRIMARY KEY NOT NULL,
	`enabled` integer DEFAULT false NOT NULL,
	`use_ssl` integer DEFAULT false NOT NULL,
	`host` text NOT NULL,
	`port` integer NOT NULL,
	`url_base` text,
	`auth_mode` text NOT NULL,
	`username` text,
	`api_key_encrypted` text,
	`password_encrypted` text,
	`master_key_id` text,
	`last_tested_at` text,
	`last_test_outcome` text,
	`last_test_message` text,
	`last_status_checked_at` text,
	`last_status_outcome` text,
	`last_status_message` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `download_clients_enabled_idx` ON `download_clients` (`enabled`);