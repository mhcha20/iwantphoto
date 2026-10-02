ALTER TABLE `users` ADD `stripeCustomerId` varchar(255);--> statement-breakpoint
ALTER TABLE `users` ADD `stripeSubscriptionId` varchar(255);--> statement-breakpoint
ALTER TABLE `users` ADD `subscriptionStatus` varchar(48);--> statement-breakpoint
ALTER TABLE `users` ADD `subscriptionCurrentPeriodEnd` timestamp;--> statement-breakpoint
ALTER TABLE `users` ADD CONSTRAINT `users_stripeCustomerId_unique` UNIQUE(`stripeCustomerId`);--> statement-breakpoint
ALTER TABLE `users` ADD CONSTRAINT `users_stripeSubscriptionId_unique` UNIQUE(`stripeSubscriptionId`);