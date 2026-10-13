ALTER TABLE `vouchers` MODIFY COLUMN `status` enum('draft','approved','posted','cancelled') NOT NULL DEFAULT 'draft';--> statement-breakpoint
ALTER TABLE `vouchers` ADD `settlementAccountId` int;--> statement-breakpoint
ALTER TABLE `vouchers` ADD `approvedBy` int;--> statement-breakpoint
ALTER TABLE `vouchers` ADD `approvedAt` timestamp;