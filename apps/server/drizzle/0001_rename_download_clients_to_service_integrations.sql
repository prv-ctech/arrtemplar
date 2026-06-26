DROP INDEX IF EXISTS `download_clients_kind_idx`;--> statement-breakpoint
DROP INDEX IF EXISTS `download_clients_default_kind_unique`;--> statement-breakpoint
ALTER TABLE `download_clients` RENAME TO `service_integrations`;--> statement-breakpoint
CREATE INDEX `service_integrations_kind_idx` ON `service_integrations` (`kind`);--> statement-breakpoint
CREATE UNIQUE INDEX `service_integrations_default_kind_unique` ON `service_integrations` (`kind`) WHERE "service_integrations"."is_default" = 1;