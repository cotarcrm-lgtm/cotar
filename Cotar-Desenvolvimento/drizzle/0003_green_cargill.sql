CREATE TABLE `__new_assessments` (
	`company_id` text,
	`created_by` text,
	`id` text PRIMARY KEY NOT NULL,
	`data` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`store_id` text NOT NULL,
	`user_id` text,
	`vehicle_id` text,
	FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`vehicle_id`) REFERENCES `vehicles`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
INSERT INTO `__new_assessments`("company_id", "created_by", "id", "data", "version", "created_at", "updated_at", "store_id", "user_id", "vehicle_id") SELECT "company_id", "created_by", "id", "data", "version", "created_at", "updated_at", "store_id", "user_id", "vehicle_id" FROM `assessments`;--> statement-breakpoint
DROP TABLE `assessments`;--> statement-breakpoint
ALTER TABLE `__new_assessments` RENAME TO `assessments`;