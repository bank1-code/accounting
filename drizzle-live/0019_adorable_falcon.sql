ALTER TABLE `cost_allocations` MODIFY COLUMN `status` enum('draft','approved','posted','cancelled','applied') NOT NULL DEFAULT 'draft';--> statement-breakpoint
ALTER TABLE `cost_allocations` ADD `sourceAccountId` int;--> statement-breakpoint
ALTER TABLE `cost_allocations` ADD `sourceCostCenterId` int;--> statement-breakpoint
ALTER TABLE `cost_allocations` ADD `journalEntryId` int;--> statement-breakpoint
ALTER TABLE `cost_allocations` ADD `approvedBy` int;--> statement-breakpoint
ALTER TABLE `cost_allocations` ADD `approvedAt` timestamp;--> statement-breakpoint
ALTER TABLE `cost_allocations` ADD `postedBy` int;--> statement-breakpoint
ALTER TABLE `cost_allocations` ADD `postedAt` timestamp;