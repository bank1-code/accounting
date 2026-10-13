CREATE TABLE `product_addons` (
	`id` int AUTO_INCREMENT NOT NULL,
	`parentProductId` int NOT NULL,
	`addonProductId` int NOT NULL,
	`pricingMode` enum('included','free','separate') NOT NULL DEFAULT 'included',
	`salePrice` decimal(18,2) NOT NULL DEFAULT '0',
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `product_addons_id` PRIMARY KEY(`id`),
	CONSTRAINT `product_addons_parent_addon_unique` UNIQUE(`parentProductId`,`addonProductId`)
);
