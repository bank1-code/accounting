ALTER TABLE `pos_sessions`
  ADD COLUMN `expectedCash` DECIMAL(18,2) NULL,
  ADD COLUMN `cashVariance` DECIMAL(18,2) NULL,
  ADD COLUMN `closedBy` INT NULL;
