CREATE TABLE `marketplace_workflows` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(60) NOT NULL,
	`channel` varchar(24) NOT NULL,
	`selectedRoles` text NOT NULL,
	`lifestyleStyle` varchar(24) NOT NULL,
	`projectId` int,
	`brandPresetId` int,
	`useCustomBrandStyle` int NOT NULL DEFAULT 0,
	`accentColor` varchar(7) NOT NULL,
	`fontStyle` enum('clean','editorial','friendly') NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `marketplace_workflows_id` PRIMARY KEY(`id`),
	CONSTRAINT `marketplace_workflows_user_name_unique` UNIQUE(`userId`,`name`)
);
--> statement-breakpoint
CREATE INDEX `marketplace_workflows_user_updated_idx` ON `marketplace_workflows` (`userId`,`updatedAt`);