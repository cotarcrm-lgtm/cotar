CREATE TABLE `__new_sales` (
	`company_id` text,
	`created_by` text,
	`id` text PRIMARY KEY NOT NULL,
	`data` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`store_id` text NOT NULL,
	`user_id` text NOT NULL,
	`vehicle_id` text,
	`lead_id` text NOT NULL,
	`status` text NOT NULL,
	FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`vehicle_id`) REFERENCES `vehicles`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`lead_id`) REFERENCES `leads`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
INSERT INTO `__new_sales`("company_id", "created_by", "id", "data", "version", "created_at", "updated_at", "store_id", "user_id", "vehicle_id", "lead_id", "status") SELECT "company_id", "created_by", "id", "data", "version", "created_at", "updated_at", "store_id", "user_id", "vehicle_id", "lead_id", "status" FROM `sales`;--> statement-breakpoint
DROP TABLE `sales`;--> statement-breakpoint
ALTER TABLE `__new_sales` RENAME TO `sales`;--> statement-breakpoint
CREATE UNIQUE INDEX `sales_completed_vehicle_unique` ON `sales` (`vehicle_id`) WHERE "sales"."status" = 'Concluída';