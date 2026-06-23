ALTER TABLE `sessions` ADD `oauth_sid` text;--> statement-breakpoint
CREATE INDEX `sessions_oauth_provider_sid_idx` ON `sessions` (`oauth_provider`,`oauth_sid`);