ALTER TABLE `sessions` ADD `oauth_provider` text;--> statement-breakpoint
ALTER TABLE `sessions` ADD `oauth_id_token_encrypted` text;--> statement-breakpoint
ALTER TABLE `sessions` ADD `oauth_master_key_id` text;