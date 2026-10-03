CREATE TABLE `chat_lists` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`owner_id` text NOT NULL,
	`name` text NOT NULL,
	`team_ids` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `chat_lists_owner` ON `chat_lists` (`company_id`,`owner_id`);--> statement-breakpoint
CREATE TABLE `chat_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`sender_id` text NOT NULL,
	`client_id` text NOT NULL,
	`kind` text NOT NULL,
	`body` text NOT NULL,
	`attachments` text DEFAULT '[]' NOT NULL,
	`audience` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`sender_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `chat_sender_request_unique` ON `chat_messages` (`sender_id`,`client_id`);--> statement-breakpoint
CREATE INDEX `chat_company_time` ON `chat_messages` (`company_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `chat_recipients` (
	`message_id` text NOT NULL,
	`recipient_id` text NOT NULL,
	`read_at` text,
	PRIMARY KEY(`message_id`, `recipient_id`),
	FOREIGN KEY (`message_id`) REFERENCES `chat_messages`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`recipient_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `chat_recipient_read` ON `chat_recipients` (`recipient_id`,`read_at`);