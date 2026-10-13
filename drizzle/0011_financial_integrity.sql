ALTER TABLE `journal_entries`
  ADD CONSTRAINT `journal_entries_entryNumber_unique` UNIQUE (`entryNumber`);

CREATE TABLE IF NOT EXISTS `fiscal_period_reopen_logs` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `fiscalPeriodId` INT NOT NULL,
  `reopenedBy` INT NOT NULL,
  `reason` TEXT NOT NULL,
  `reopenedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `fiscal_period_reopen_logs_period_idx` (`fiscalPeriodId`)
);
