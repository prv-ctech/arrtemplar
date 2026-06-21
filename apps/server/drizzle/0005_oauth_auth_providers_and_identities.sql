CREATE TABLE `auth_identities` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`provider` text NOT NULL,
	`issuer` text NOT NULL,
	`subject` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `auth_identities_provider_issuer_subject_unique` ON `auth_identities` (`provider`,`issuer`,`subject`);--> statement-breakpoint
CREATE INDEX `auth_identities_user_id_idx` ON `auth_identities` (`user_id`);--> statement-breakpoint
CREATE TABLE `auth_providers` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`label` text NOT NULL,
	`issuer` text NOT NULL,
	`client_id` text NOT NULL,
	`client_secret_encrypted` text NOT NULL,
	`master_key_id` text NOT NULL,
	`scopes` text NOT NULL,
	`redirect_uris` text NOT NULL,
	`enabled` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `auth_providers_slug_unique` ON `auth_providers` (`slug`);--> statement-breakpoint
ALTER TABLE `users` ADD `auth_method` text DEFAULT 'local' NOT NULL;