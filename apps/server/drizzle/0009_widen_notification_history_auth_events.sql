CREATE TABLE `__new_notification_history` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`event_id` text NOT NULL CHECK (`event_id` IN ('auth.admin.created', 'auth.provider.save.failed', 'auth.provider.saved', 'auth.sign_out.failed', 'auth.signed_in', 'auth.signed_out', 'managed_user.identity.failed', 'managed_user.identity.updated', 'managed_user.media.failed', 'managed_user.media.updated', 'managed_user.password.changed', 'managed_user.password.failed', 'managed_user.permissions.failed', 'managed_user.permissions.updated', 'profile.identity.update.failed', 'profile.identity.updated', 'profile.media.failed', 'profile.media.updated', 'profile.noop', 'profile.password.changed', 'profile.password.mismatch', 'profile.password.update.failed', 'theme.changed', 'users.create.failed', 'users.created', 'users.password.changed', 'users.password.failed', 'users.permissions.failed', 'users.permissions.updated', 'users.status.disabled', 'users.status.failed', 'users.status.restored', 'users.deleted', 'users.delete.failed')),
	`title` text NOT NULL,
	`description` text,
	`severity` text NOT NULL CHECK (`severity` IN ('success', 'info', 'warning', 'error')),
	`importance` text NOT NULL CHECK (`importance` IN ('standard', 'important')),
	`read_at` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_notification_history` (`id`, `user_id`, `event_id`, `title`, `description`, `severity`, `importance`, `read_at`, `created_at`)
SELECT `id`, `user_id`, `event_id`, `title`, `description`, `severity`, `importance`, `read_at`, `created_at` FROM `notification_history`;
--> statement-breakpoint
DROP TABLE `notification_history`;
--> statement-breakpoint
ALTER TABLE `__new_notification_history` RENAME TO `notification_history`;
--> statement-breakpoint
CREATE INDEX `notification_history_user_created_at_idx` ON `notification_history` (`user_id`,`created_at` DESC);
--> statement-breakpoint
CREATE INDEX `notification_history_user_unread_idx` ON `notification_history` (`user_id`,`read_at`);