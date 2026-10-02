CREATE TABLE `storage_usage_alerts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`threshold` int NOT NULL,
	`cycle` int NOT NULL,
	`status` varchar(16) NOT NULL DEFAULT 'pending',
	`sentAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `storage_usage_alerts_id` PRIMARY KEY(`id`),
	CONSTRAINT `storage_usage_alerts_user_threshold_cycle_unique` UNIQUE(`userId`,`threshold`,`cycle`)
);
--> statement-breakpoint
ALTER TABLE `users` ADD `storageEmailAlertsEnabled` int DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `storageAlertCycle` int DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX `storage_usage_alerts_user_created_idx` ON `storage_usage_alerts` (`userId`,`createdAt`);