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
INSERT INTO `__new_download_clients` (`id`, `kind`, `display_name`, `is_default`, `enabled`, `use_ssl`, `host`, `port`, `url_base`, `auth_mode`, `username`, `api_key_encrypted`, `password_encrypted`, `master_key_id`, `last_tested_at`, `last_test_outcome`, `last_test_message`, `last_status_checked_at`, `last_status_outcome`, `last_status_message`, `created_at`, `updated_at`)
SELECT
	`kind`,
	`kind`,
	CASE `kind` WHEN 'qbittorrent' THEN 'qBittorrent' WHEN 'sabnzbd' THEN 'SABnzbd' ELSE `kind` END,
	true,
	`enabled`,
	`use_ssl`,
	`host`,
	`port`,
	`url_base`,
	`auth_mode`,
	`username`,
	`api_key_encrypted`,
	`password_encrypted`,
	`master_key_id`,
	`last_tested_at`,
	`last_test_outcome`,
	`last_test_message`,
	`last_status_checked_at`,
	`last_status_outcome`,
	`last_status_message`,
	`created_at`,
	`updated_at`
FROM `download_clients`;
--> statement-breakpoint
DROP TABLE `download_clients`;
--> statement-breakpoint
ALTER TABLE `__new_download_clients` RENAME TO `download_clients`;
--> statement-breakpoint
CREATE INDEX `download_clients_kind_idx` ON `download_clients` (`kind`);
--> statement-breakpoint
CREATE INDEX `download_clients_enabled_idx` ON `download_clients` (`enabled`);