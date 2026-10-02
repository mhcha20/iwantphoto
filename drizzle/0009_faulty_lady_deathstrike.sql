CREATE TABLE `marketplace_brand_preferences` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`accentColor` varchar(7) NOT NULL,
	`fontStyle` enum('clean','editorial','friendly') NOT NULL,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `marketplace_brand_preferences_id` PRIMARY KEY(`id`),
	CONSTRAINT `marketplace_brand_preferences_user_unique` UNIQUE(`userId`)
);
