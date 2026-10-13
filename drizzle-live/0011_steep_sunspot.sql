ALTER TABLE `order_lines` ADD `parentProductId` int;--> statement-breakpoint
ALTER TABLE `order_lines` ADD `addonPricingMode` enum('included','free','separate');