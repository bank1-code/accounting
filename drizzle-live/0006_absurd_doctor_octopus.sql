CREATE TABLE `waste_voucher_lines` (
	`id` int AUTO_INCREMENT NOT NULL,
	`voucherId` int NOT NULL,
	`productId` int NOT NULL,
	`quantity` decimal(18,4) NOT NULL,
	`unitCost` decimal(18,4) NOT NULL DEFAULT '0',
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `waste_voucher_lines_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `waste_vouchers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`voucherNumber` varchar(32) NOT NULL,
	`warehouseId` int NOT NULL,
	`status` enum('draft','approved','cancelled') NOT NULL DEFAULT 'draft',
	`reason` varchar(255),
	`notes` text,
	`createdBy` int,
	`approvedBy` int,
	`approvedAt` timestamp,
	`cancelledAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `waste_vouchers_id` PRIMARY KEY(`id`)
);
