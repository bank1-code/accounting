ALTER TABLE `order_lines` MODIFY COLUMN `discountAmount` decimal(18,2) NOT NULL DEFAULT '0';--> statement-breakpoint
ALTER TABLE `order_lines` ADD `taxCodeId` int;--> statement-breakpoint
ALTER TABLE `order_lines` ADD `taxRate` decimal(5,2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE `order_lines` ADD `taxAmount` decimal(18,2) DEFAULT '0' NOT NULL;