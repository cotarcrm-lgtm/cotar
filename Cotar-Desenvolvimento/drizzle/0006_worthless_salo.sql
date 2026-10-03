CREATE TABLE `crm_billing_payments` (
	`id` text PRIMARY KEY NOT NULL,
	`subscription_id` text NOT NULL,
	`status` text NOT NULL,
	`valid_until` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`subscription_id`) REFERENCES `crm_subscriptions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `crm_payment_subscription` ON `crm_billing_payments` (`subscription_id`,`status`,`valid_until`);--> statement-breakpoint
CREATE TABLE `crm_subscriptions` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text,
	`email` text NOT NULL,
	`cpf` text NOT NULL,
	`document` text NOT NULL,
	`plan` text NOT NULL,
	`registration` text NOT NULL,
	`password_hash` text NOT NULL,
	`token_hash` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`customer_id` text,
	`provider_id` text,
	`invoice_url` text,
	`valid_until` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `crm_subscription_email` ON `crm_subscriptions` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `crm_subscription_cpf` ON `crm_subscriptions` (`cpf`);--> statement-breakpoint
CREATE UNIQUE INDEX `crm_subscription_document` ON `crm_subscriptions` (`document`);--> statement-breakpoint
CREATE UNIQUE INDEX `crm_subscription_token` ON `crm_subscriptions` (`token_hash`);--> statement-breakpoint
CREATE UNIQUE INDEX `crm_subscription_provider` ON `crm_subscriptions` (`provider_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `crm_subscription_company` ON `crm_subscriptions` (`company_id`);