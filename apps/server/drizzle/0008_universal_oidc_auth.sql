ALTER TABLE `auth_identities` ADD `preferred_username` text;--> statement-breakpoint
ALTER TABLE `auth_identities` ADD `name` text;--> statement-breakpoint
ALTER TABLE `auth_identities` ADD `email` text;--> statement-breakpoint
ALTER TABLE `auth_providers` ADD `provider_kind` text DEFAULT 'custom' NOT NULL;--> statement-breakpoint
ALTER TABLE `auth_providers` ADD `button_text` text DEFAULT 'Continue with OIDC' NOT NULL;--> statement-breakpoint
ALTER TABLE `auth_providers` ADD `auto_register` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `auth_providers` ADD `token_endpoint_auth_method` text DEFAULT 'client_secret_basic' NOT NULL;--> statement-breakpoint
ALTER TABLE `auth_providers` ADD `timeout_ms` integer DEFAULT 10000 NOT NULL;--> statement-breakpoint
ALTER TABLE `auth_providers` ADD `prompt` text;--> statement-breakpoint
ALTER TABLE `auth_providers` ADD `end_session_endpoint` text;--> statement-breakpoint
ALTER TABLE `auth_providers` ADD `id_token_signing_algorithm` text DEFAULT 'RS256' NOT NULL;--> statement-breakpoint
ALTER TABLE `auth_providers` ADD `profile_signing_algorithm` text DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE `auth_providers` ADD `mobile_redirect_enabled` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `auth_providers` ADD `mobile_redirect_uri` text;--> statement-breakpoint
UPDATE `auth_providers` SET `provider_kind` = 'authentik' WHERE `slug` = 'authentik';--> statement-breakpoint
UPDATE `auth_providers` SET `token_endpoint_auth_method` = 'client_secret_post' WHERE `slug` = 'authentik';--> statement-breakpoint
UPDATE `auth_providers` SET `redirect_uris` = replace(`redirect_uris`, '/callback/authentik', '/callback/oidc') WHERE `slug` = 'authentik';--> statement-breakpoint
UPDATE `auth_providers` SET `slug` = 'oidc' WHERE `slug` = 'authentik';--> statement-breakpoint
UPDATE `auth_identities` SET `provider` = 'oidc' WHERE `provider` = 'authentik';--> statement-breakpoint
UPDATE `sessions` SET `oauth_provider` = 'oidc' WHERE `oauth_provider` = 'authentik';