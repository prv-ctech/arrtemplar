DROP TABLE IF EXISTS `api_key_permission_grants`;--> statement-breakpoint
DROP INDEX IF EXISTS `api_keys_expires_at_idx`;--> statement-breakpoint
DROP INDEX IF EXISTS `api_keys_revoked_at_idx`;--> statement-breakpoint
ALTER TABLE `api_keys` ADD `key_prefix` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `api_keys` ADD `fingerprint` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `api_keys` ADD `rotated_at` text;--> statement-breakpoint
ALTER TABLE `api_keys` ADD `deleted_at` text;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `api_keys_deleted_at_idx` ON `api_keys` (`deleted_at`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `api_keys_name_idx` ON `api_keys` (`name`);--> statement-breakpoint
ALTER TABLE `api_keys` DROP COLUMN `prefix`;--> statement-breakpoint
ALTER TABLE `api_keys` DROP COLUMN `expires_at`;--> statement-breakpoint
ALTER TABLE `api_keys` DROP COLUMN `ip_allowlist_json`;--> statement-breakpoint
ALTER TABLE `api_keys` DROP COLUMN `revoked_at`;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_download_clients` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`display_name` text NOT NULL,
	`is_default` integer DEFAULT false NOT NULL,
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
INSERT INTO `__new_download_clients`("id", "kind", "display_name", "is_default", "enabled", "use_ssl", "host", "port", "url_base", "auth_mode", "username", "api_key_encrypted", "password_encrypted", "master_key_id", "last_tested_at", "last_test_outcome", "last_test_message", "last_status_checked_at", "last_status_outcome", "last_status_message", "created_at", "updated_at") SELECT "id", "kind", "display_name", "is_default", "enabled", "use_ssl", "host", "port", "url_base", "auth_mode", "username", "api_key_encrypted", "password_encrypted", "master_key_id", "last_tested_at", "last_test_outcome", "last_test_message", "last_status_checked_at", "last_status_outcome", "last_status_message", "created_at", "updated_at" FROM `download_clients`;--> statement-breakpoint
DROP TABLE `download_clients`;--> statement-breakpoint
ALTER TABLE `__new_download_clients` RENAME TO `download_clients`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `download_clients_kind_idx` ON `download_clients` (`kind`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `download_clients_enabled_idx` ON `download_clients` (`enabled`);