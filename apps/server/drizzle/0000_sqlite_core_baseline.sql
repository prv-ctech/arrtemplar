CREATE TABLE `api_keys` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`secret_hash` text NOT NULL,
	`key_prefix` text DEFAULT '' NOT NULL,
	`fingerprint` text DEFAULT '' NOT NULL,
	`masked_key` text NOT NULL,
	`created_by_user_id` text,
	`last_used_at` text,
	`last_used_ip_address` text,
	`last_used_user_agent` text,
	`rotated_at` text,
	`deleted_at` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `api_keys_secret_hash_unique` ON `api_keys` (`secret_hash`);--> statement-breakpoint
CREATE INDEX `api_keys_created_by_user_id_idx` ON `api_keys` (`created_by_user_id`);--> statement-breakpoint
CREATE INDEX `api_keys_deleted_at_idx` ON `api_keys` (`deleted_at`);--> statement-breakpoint
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
CREATE TABLE `auth_identities` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`provider` text NOT NULL,
	`issuer` text NOT NULL,
	`subject` text NOT NULL,
	`preferred_username` text,
	`name` text,
	`email` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `auth_identities_provider_issuer_subject_unique` ON `auth_identities` (`provider`,`issuer`,`subject`);--> statement-breakpoint
CREATE INDEX `auth_identities_user_id_idx` ON `auth_identities` (`user_id`);--> statement-breakpoint
CREATE TABLE `auth_providers` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`provider_kind` text DEFAULT 'custom' NOT NULL,
	`label` text NOT NULL,
	`issuer` text NOT NULL,
	`client_id` text NOT NULL,
	`client_secret_encrypted` text NOT NULL,
	`master_key_id` text NOT NULL,
	`scopes` text NOT NULL,
	`redirect_uris` text NOT NULL,
	`enabled` integer DEFAULT false NOT NULL,
	`button_text` text DEFAULT 'Continue with OIDC' NOT NULL,
	`auto_register` integer DEFAULT true NOT NULL,
	`token_endpoint_auth_method` text DEFAULT 'client_secret_basic' NOT NULL,
	`timeout_ms` integer DEFAULT 10000 NOT NULL,
	`prompt` text,
	`end_session_endpoint` text,
	`id_token_signing_algorithm` text DEFAULT 'RS256' NOT NULL,
	`profile_signing_algorithm` text DEFAULT 'none' NOT NULL,
	`mobile_redirect_enabled` integer DEFAULT false NOT NULL,
	`mobile_redirect_uri` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `auth_providers_slug_unique` ON `auth_providers` (`slug`);--> statement-breakpoint
CREATE TABLE `download_clients` (
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
CREATE INDEX `download_clients_kind_idx` ON `download_clients` (`kind`);--> statement-breakpoint
CREATE UNIQUE INDEX `download_clients_default_kind_unique` ON `download_clients` (`kind`) WHERE "download_clients"."is_default" = 1;--> statement-breakpoint
CREATE TABLE `notification_history` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`event_id` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`severity` text NOT NULL,
	`importance` text NOT NULL,
	`read_at` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `notification_history_user_created_at_idx` ON `notification_history` (`user_id`,created_at DESC);--> statement-breakpoint
CREATE INDEX `notification_history_user_unread_idx` ON `notification_history` (`user_id`,`read_at`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`expires_at` text NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`oauth_provider` text,
	`oauth_id_token_encrypted` text,
	`oauth_master_key_id` text,
	`oauth_sid` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sessions_token_hash_unique` ON `sessions` (`token_hash`);--> statement-breakpoint
CREATE INDEX `sessions_user_id_idx` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE INDEX `sessions_expires_at_idx` ON `sessions` (`expires_at`);--> statement-breakpoint
CREATE INDEX `sessions_oauth_provider_sid_idx` ON `sessions` (`oauth_provider`,`oauth_sid`);--> statement-breakpoint
CREATE TABLE `user_permission_grants` (
	`id` text PRIMARY KEY NOT NULL,
	`permission` text NOT NULL,
	`granted_by_user_id` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`user_id` text NOT NULL,
	FOREIGN KEY (`granted_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_permission_grants_user_permission_unique` ON `user_permission_grants` (`user_id`,`permission`);--> statement-breakpoint
CREATE INDEX `user_permission_grants_user_id_idx` ON `user_permission_grants` (`user_id`);--> statement-breakpoint
CREATE INDEX `user_permission_grants_permission_idx` ON `user_permission_grants` (`permission`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`public_id` text NOT NULL,
	`username` text NOT NULL,
	`email` text NOT NULL,
	`avatar_id` text DEFAULT 'demon-slayer-tanjiro' NOT NULL,
	`banner_id` text DEFAULT 'aurora-hills' NOT NULL,
	`toast_notifications_enabled` integer DEFAULT true NOT NULL,
	`toast_notification_frequency` text DEFAULT 'all' NOT NULL,
	`auth_method` text DEFAULT 'local' NOT NULL,
	`password_hash` text NOT NULL,
	`disabled_at` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`last_login_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_public_id_unique` ON `users` (`public_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_unique` ON `users` (`username`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);