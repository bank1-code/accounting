CREATE TABLE `uat_entity_registry` (
	`id` int AUTO_INCREMENT NOT NULL,
	`uatRunId` int NOT NULL,
	`tableName` varchar(96) NOT NULL,
	`entityId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `uat_entity_registry_id` PRIMARY KEY(`id`),
	CONSTRAINT `uat_registry_entity_unique` UNIQUE(`uatRunId`,`tableName`,`entityId`)
);
--> statement-breakpoint
CREATE TABLE `uat_runs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`code` varchar(64) NOT NULL,
	`status` enum('active','completed','cleanup_pending','cleaned','failed') NOT NULL DEFAULT 'active',
	`baselineSnapshot` json NOT NULL,
	`scenarioVersion` varchar(32) NOT NULL,
	`notes` text,
	`createdBy` int NOT NULL,
	`completedAt` timestamp,
	`cleanedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `uat_runs_id` PRIMARY KEY(`id`),
	CONSTRAINT `uat_runs_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE INDEX `uat_registry_run_idx` ON `uat_entity_registry` (`uatRunId`);