CREATE TABLE `document_sequences` (
	`sequenceKey` varchar(64) NOT NULL,
	`currentValue` int NOT NULL DEFAULT 0,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `document_sequences_sequenceKey` PRIMARY KEY(`sequenceKey`)
);
