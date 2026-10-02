CREATE TABLE `photo_projects` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(60) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `photo_projects_id` PRIMARY KEY(`id`),
	CONSTRAINT `photo_projects_user_name_unique` UNIQUE(`userId`,`name`)
);
--> statement-breakpoint
ALTER TABLE `user_images` ADD `projectId` int;--> statement-breakpoint
CREATE INDEX `photo_projects_user_created_idx` ON `photo_projects` (`userId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `user_images_user_project_idx` ON `user_images` (`userId`,`projectId`);