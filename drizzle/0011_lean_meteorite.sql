CREATE TABLE `marketplace_saved_products` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`projectId` int NOT NULL,
	`sku` varchar(80) NOT NULL,
	`productName` varchar(100) NOT NULL,
	`summary` text NOT NULL,
	`confirmedFacts` text NOT NULL,
	`visualHighlights` text NOT NULL,
	`usageIdeas` text NOT NULL,
	`reviewQuestions` text NOT NULL,
	`listingCopy` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `marketplace_saved_products_id` PRIMARY KEY(`id`),
	CONSTRAINT `marketplace_saved_products_user_project_sku_unique` UNIQUE(`userId`,`projectId`,`sku`)
);
--> statement-breakpoint
CREATE INDEX `marketplace_saved_products_user_project_updated_idx` ON `marketplace_saved_products` (`userId`,`projectId`,`updatedAt`);