CREATE TABLE `help_ticket_attachments` (
	`id` text PRIMARY KEY NOT NULL,
	`ticket_id` text NOT NULL,
	`uploaded_by_user_id` text NOT NULL,
	`original_file_name` text NOT NULL,
	`stored_file_name` text NOT NULL,
	`media_kind` text NOT NULL,
	`mime_type` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`stored_size_bytes` integer NOT NULL,
	`width` integer,
	`height` integer,
	`sha256` text NOT NULL,
	`scan_status` text DEFAULT 'not_configured' NOT NULL,
	`scan_engine` text,
	`scan_result` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`ticket_id`) REFERENCES `help_tickets`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`uploaded_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `help_ticket_attachments_ticket_id_idx` ON `help_ticket_attachments` (`ticket_id`);--> statement-breakpoint
CREATE TABLE `help_tickets` (
	`id` text PRIMARY KEY NOT NULL,
	`created_by_user_id` text NOT NULL,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`status` text DEFAULT 'new' NOT NULL,
	`status_updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`status_updated_by_user_id` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`status_updated_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `help_tickets_created_by_user_id_created_at_idx` ON `help_tickets` (`created_by_user_id`,created_at DESC);--> statement-breakpoint
CREATE INDEX `help_tickets_status_created_at_idx` ON `help_tickets` (`status`,created_at DESC);