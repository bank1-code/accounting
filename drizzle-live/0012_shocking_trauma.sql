ALTER TABLE `order_lines` ADD `batchNumber` varchar(64);--> statement-breakpoint
ALTER TABLE `orders` ADD `warehouseId` int;