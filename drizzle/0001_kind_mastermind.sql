CREATE TABLE `user_images` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`fileName` varchar(160) NOT NULL,
	`mimeType` varchar(80) NOT NULL,
	`originalUrl` text NOT NULL,
	`processedUrl` text NOT NULL,
	`mode` enum('background','cleanup') NOT NULL,
	`backgroundStyle` enum('transparent','white') NOT NULL,
	`cleanupNote` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `user_images_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `user_images_user_created_idx` ON `user_images` (`userId`,`createdAt`);