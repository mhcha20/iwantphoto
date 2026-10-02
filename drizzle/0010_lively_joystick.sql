ALTER TABLE `marketplace_brand_preferences` DROP INDEX `marketplace_brand_preferences_user_unique`;--> statement-breakpoint
ALTER TABLE `marketplace_brand_preferences` ADD `name` varchar(60);--> statement-breakpoint
ALTER TABLE `marketplace_brand_preferences` ADD `logoUrl` text;--> statement-breakpoint
ALTER TABLE `marketplace_brand_preferences` ADD `logoMimeType` varchar(80);--> statement-breakpoint
ALTER TABLE `marketplace_brand_preferences` ADD `isDefault` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `marketplace_brand_preferences` ADD `createdAt` timestamp DEFAULT (now()) NOT NULL;--> statement-breakpoint
UPDATE `marketplace_brand_preferences` SET `name` = '我的品牌', `isDefault` = 1 WHERE `name` IS NULL;--> statement-breakpoint
ALTER TABLE `marketplace_brand_preferences` MODIFY `name` varchar(60) NOT NULL;--> statement-breakpoint
ALTER TABLE `photo_projects` ADD `brandPresetId` int;--> statement-breakpoint
ALTER TABLE `marketplace_brand_preferences` ADD CONSTRAINT `marketplace_brand_preferences_user_name_unique` UNIQUE(`userId`,`name`);--> statement-breakpoint
CREATE INDEX `marketplace_brand_preferences_user_default_idx` ON `marketplace_brand_preferences` (`userId`,`isDefault`);
