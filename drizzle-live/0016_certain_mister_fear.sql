CREATE TABLE `journal_entry_templates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(160) NOT NULL,
	`sourceEntryNumber` varchar(32),
	`templateData` json NOT NULL,
	`createdBy` int NOT NULL,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `journal_entry_templates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `journal_templates_creator_idx` ON `journal_entry_templates` (`createdBy`);--> statement-breakpoint
CREATE INDEX `journal_templates_active_idx` ON `journal_entry_templates` (`isActive`);