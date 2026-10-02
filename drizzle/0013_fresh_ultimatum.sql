CREATE TABLE `account_security_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`event` varchar(40) NOT NULL,
	`detail` varchar(240) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `account_security_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` ADD `avatarUrl` text;--> statement-breakpoint
CREATE INDEX `account_security_events_user_created_idx` ON `account_security_events` (`userId`,`createdAt`);