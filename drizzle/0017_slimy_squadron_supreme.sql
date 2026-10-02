CREATE TABLE `processing_usage_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`units` int NOT NULL DEFAULT 1,
	`source` varchar(40) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `processing_usage_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `processing_usage_events_user_created_idx` ON `processing_usage_events` (`userId`,`createdAt`);