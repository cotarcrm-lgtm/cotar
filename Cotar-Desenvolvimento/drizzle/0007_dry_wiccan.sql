CREATE TABLE `whatsapp_accounts` (
	`company_id` text PRIMARY KEY NOT NULL,
	`account_sid` text NOT NULL,
	`token_cipher` text NOT NULL,
	`from_number` text NOT NULL,
	`mode` text NOT NULL,
	`enabled` integer DEFAULT 0 NOT NULL,
	`webhook_key` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `whatsapp_webhook_unique` ON `whatsapp_accounts` (`webhook_key`);--> statement-breakpoint
CREATE TABLE `whatsapp_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`lead_id` text NOT NULL,
	`phone` text NOT NULL,
	`sender_id` text NOT NULL,
	`client_id` text NOT NULL,
	`direction` text NOT NULL,
	`body` text NOT NULL,
	`status` text NOT NULL,
	`created_at` text NOT NULL,
	`twilio_sid` text,
	`error_code` text,
	`opt_in` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `whatsapp_message_request_unique` ON `whatsapp_messages` (`company_id`,`sender_id`,`client_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `whatsapp_sid_unique` ON `whatsapp_messages` (`twilio_sid`);--> statement-breakpoint
CREATE INDEX `whatsapp_lead_time` ON `whatsapp_messages` (`company_id`,`lead_id`,`phone`,`created_at`);--> statement-breakpoint
CREATE INDEX `whatsapp_phone_time` ON `whatsapp_messages` (`company_id`,`phone`,`direction`,`created_at`);