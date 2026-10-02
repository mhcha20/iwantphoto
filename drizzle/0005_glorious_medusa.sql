CREATE TABLE `credit_transactions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`delta` int NOT NULL,
	`balanceAfter` int NOT NULL,
	`reason` varchar(32) NOT NULL,
	`stripeCheckoutSessionId` varchar(255),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `credit_transactions_id` PRIMARY KEY(`id`),
	CONSTRAINT `credit_transactions_stripeCheckoutSessionId_unique` UNIQUE(`stripeCheckoutSessionId`)
);
--> statement-breakpoint
ALTER TABLE `users` ADD `creditBalance` int DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX `credit_transactions_user_created_idx` ON `credit_transactions` (`userId`,`createdAt`);