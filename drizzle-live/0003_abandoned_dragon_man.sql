CREATE TABLE `order_payments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orderId` int NOT NULL,
	`paymentMethod` enum('cash','card','transfer') NOT NULL,
	`amount` decimal(18,2) NOT NULL,
	`reference` varchar(128),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `order_payments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `idx_order_payments_order` ON `order_payments` (`orderId`);