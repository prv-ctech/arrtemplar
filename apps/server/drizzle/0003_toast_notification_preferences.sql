ALTER TABLE `users` ADD `toast_notifications_enabled` integer DEFAULT 1 NOT NULL CHECK (`toast_notifications_enabled` IN (0, 1));--> statement-breakpoint
ALTER TABLE `users` ADD `toast_notification_frequency` text DEFAULT 'all' NOT NULL CHECK (`toast_notification_frequency` IN ('all', 'minimal'));
