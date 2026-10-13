CREATE TABLE `inventory_batches` (
	`id` int AUTO_INCREMENT NOT NULL,
	`productId` int NOT NULL,
	`warehouseId` int NOT NULL,
	`batchNumber` varchar(64) NOT NULL,
	`expiryDate` timestamp,
	`quantity` decimal(18,4) NOT NULL DEFAULT '0',
	`unitCost` decimal(18,4) NOT NULL DEFAULT '0',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `inventory_batches_id` PRIMARY KEY(`id`),
	CONSTRAINT `inventory_batches_product_warehouse_batch_unique` UNIQUE(`productId`,`warehouseId`,`batchNumber`)
);
--> statement-breakpoint
CREATE INDEX `inventory_batches_expiry_idx` ON `inventory_batches` (`expiryDate`);