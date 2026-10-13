CREATE TABLE `pos_refunds` (
	`id` int AUTO_INCREMENT NOT NULL,
	`refundNumber` varchar(32) NOT NULL,
	`orderId` int NOT NULL,
	`branchId` int NOT NULL,
	`sessionId` int,
	`paymentMethod` enum('cash','card','transfer','mixed') NOT NULL,
	`amount` decimal(18,2) NOT NULL,
	`reason` text NOT NULL,
	`status` enum('requested','approved','completed','rejected') NOT NULL DEFAULT 'requested',
	`requestedBy` int NOT NULL,
	`approvedBy` int,
	`approvedAt` timestamp,
	`completedBy` int,
	`completedAt` timestamp,
	`stockRestoredAt` timestamp,
	`journalEntryId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `pos_refunds_id` PRIMARY KEY(`id`),
	CONSTRAINT `pos_refunds_refundNumber_unique` UNIQUE(`refundNumber`),
	CONSTRAINT `pos_refunds_orderId_unique` UNIQUE(`orderId`)
);
--> statement-breakpoint
CREATE INDEX `idx_pos_refunds_branch_status` ON `pos_refunds` (`branchId`,`status`);--> statement-breakpoint
CREATE INDEX `idx_pos_refunds_session` ON `pos_refunds` (`sessionId`);