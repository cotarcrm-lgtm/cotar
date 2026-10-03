CREATE TABLE `accounts` (
	`user_id` text PRIMARY KEY NOT NULL,
	`cpf` text NOT NULL,
	`password_hash` text NOT NULL,
	`must_change` integer DEFAULT 1 NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `accounts_cpf_unique` ON `accounts` (`cpf`);--> statement-breakpoint
CREATE TABLE `auth_limits` (
	`key` text PRIMARY KEY NOT NULL,
	`count` integer NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `companies` (
	`company_id` text,
	`created_by` text,
	`id` text PRIMARY KEY NOT NULL,
	`data` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `groups` (
	`company_id` text,
	`created_by` text,
	`id` text PRIMARY KEY NOT NULL,
	`data` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `regions` (
	`company_id` text,
	`created_by` text,
	`id` text PRIMARY KEY NOT NULL,
	`data` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`expires_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `teams` (
	`company_id` text,
	`created_by` text,
	`id` text PRIMARY KEY NOT NULL,
	`data` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`store_id` text NOT NULL,
	FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
ALTER TABLE `assessments` ADD `company_id` text;--> statement-breakpoint
ALTER TABLE `assessments` ADD `created_by` text;--> statement-breakpoint
ALTER TABLE `leads` ADD `company_id` text;--> statement-breakpoint
ALTER TABLE `leads` ADD `created_by` text;--> statement-breakpoint
ALTER TABLE `sales` ADD `company_id` text;--> statement-breakpoint
ALTER TABLE `sales` ADD `created_by` text;--> statement-breakpoint
ALTER TABLE `stores` ADD `company_id` text;--> statement-breakpoint
ALTER TABLE `stores` ADD `created_by` text;--> statement-breakpoint
ALTER TABLE `users` ADD `company_id` text;--> statement-breakpoint
ALTER TABLE `users` ADD `created_by` text;--> statement-breakpoint
ALTER TABLE `vehicles` ADD `company_id` text;--> statement-breakpoint
ALTER TABLE `vehicles` ADD `created_by` text;