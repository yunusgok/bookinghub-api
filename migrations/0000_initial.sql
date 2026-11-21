CREATE TABLE `api_keys` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`hash` text NOT NULL,
	`created_at` text NOT NULL,
	`revoked_at` text,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `api_keys_hash_unique` ON `api_keys` (`hash`);--> statement-breakpoint
CREATE INDEX `api_keys_tenant_idx` ON `api_keys` (`tenant_id`);--> statement-breakpoint
CREATE TABLE `bookings` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`customer_id` text NOT NULL,
	`service_id` text NOT NULL,
	`start_at` text NOT NULL,
	`end_at` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`tenant_id`,`customer_id`) REFERENCES `customers`(`tenant_id`,`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`tenant_id`,`service_id`) REFERENCES `services`(`tenant_id`,`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "bookings_status" CHECK("bookings"."status" IN ('active','cancelled')),
	CONSTRAINT "bookings_interval" CHECK("bookings"."start_at" < "bookings"."end_at")
);
--> statement-breakpoint
CREATE INDEX `bookings_overlap_idx` ON `bookings` (`tenant_id`,`status`,`start_at`,`end_at`);--> statement-breakpoint
CREATE INDEX `bookings_page_idx` ON `bookings` (`tenant_id`,`created_at`,`id`);--> statement-breakpoint
CREATE TABLE `customers` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`phone` text,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "customers_active" CHECK("customers"."active" IN (0,1))
);
--> statement-breakpoint
CREATE INDEX `customers_page_idx` ON `customers` (`tenant_id`,`created_at`,`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `customers_tenant_id` ON `customers` (`tenant_id`,`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `customers_tenant_email` ON `customers` (`tenant_id`,`email`);--> statement-breakpoint
CREATE TABLE `services` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`duration_minutes` integer NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "services_duration" CHECK("services"."duration_minutes" BETWEEN 1 AND 1440),
	CONSTRAINT "services_active" CHECK("services"."active" IN (0,1))
);
--> statement-breakpoint
CREATE INDEX `services_page_idx` ON `services` (`tenant_id`,`created_at`,`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `services_tenant_id` ON `services` (`tenant_id`,`id`);--> statement-breakpoint
CREATE TABLE `tenants` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`created_at` text NOT NULL
);
