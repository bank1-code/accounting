CREATE TABLE `accounts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`code` varchar(32) NOT NULL,
	`name` varchar(255) NOT NULL,
	`nameEn` varchar(255),
	`type` enum('asset','liability','equity','revenue','expense') NOT NULL,
	`parentId` int,
	`level` int NOT NULL DEFAULT 1,
	`isActive` boolean NOT NULL DEFAULT true,
	`isSystem` boolean NOT NULL DEFAULT false,
	`balance` decimal(18,2) NOT NULL DEFAULT '0',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `accounts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `attendance` (
	`id` int AUTO_INCREMENT NOT NULL,
	`employeeId` int NOT NULL,
	`shiftId` int,
	`date` timestamp NOT NULL,
	`checkIn` timestamp,
	`checkOut` timestamp,
	`financialHours` decimal(5,2) DEFAULT '0',
	`overtimeHours` decimal(5,2) DEFAULT '0',
	`overtimeApproved` boolean DEFAULT false,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `attendance_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `audit_log` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int,
	`action` varchar(64) NOT NULL,
	`entityType` varchar(64) NOT NULL,
	`entityId` int,
	`oldValues` json,
	`newValues` json,
	`ipAddress` varchar(64),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `audit_log_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `backups` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`fileUrl` text,
	`fileKey` varchar(512),
	`fileSize` int,
	`tablesCount` int DEFAULT 0,
	`recordsCount` int DEFAULT 0,
	`status` enum('creating','completed','failed','restoring') NOT NULL DEFAULT 'creating',
	`createdBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `backups_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `branches` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`nameEn` varchar(255),
	`type` enum('restaurant','grocery','accessories','warehouse','kitchen') NOT NULL,
	`address` text,
	`phone` varchar(32),
	`isActive` boolean NOT NULL DEFAULT true,
	`isCentralKitchen` boolean NOT NULL DEFAULT false,
	`isCentralWarehouse` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `branches_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `categories` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`parentId` int,
	`type` enum('product','raw_material','semi_finished','finished') NOT NULL DEFAULT 'product',
	`isActive` boolean NOT NULL DEFAULT true,
	`sortOrder` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `categories_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `company_profiles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`legalName` varchar(255) NOT NULL,
	`tradeName` varchar(255),
	`vatNumber` varchar(32),
	`commercialRegistrationNumber` varchar(64),
	`addressLine1` varchar(255),
	`addressLine2` varchar(255),
	`city` varchar(128),
	`district` varchar(128),
	`postalCode` varchar(16),
	`countryCode` varchar(2) NOT NULL,
	`currencyCode` varchar(3) NOT NULL,
	`isVatRegistered` boolean NOT NULL DEFAULT false,
	`eInvoicingMode` enum('disabled','sandbox','production') NOT NULL DEFAULT 'disabled',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `company_profiles_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `cost_allocation_lines` (
	`id` int AUTO_INCREMENT NOT NULL,
	`allocationId` int NOT NULL,
	`costCenterId` int NOT NULL,
	`amount` decimal(18,2) NOT NULL,
	`ratio` decimal(8,4),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `cost_allocation_lines_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `cost_allocations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`method` enum('sales_ratio','branch_count','employee_count','custom') NOT NULL,
	`periodStart` timestamp NOT NULL,
	`periodEnd` timestamp NOT NULL,
	`status` enum('draft','applied') NOT NULL DEFAULT 'draft',
	`totalAmount` decimal(18,2) NOT NULL DEFAULT '0',
	`createdBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `cost_allocations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `cost_centers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`code` varchar(32) NOT NULL,
	`branchId` int,
	`type` enum('profit','cost') NOT NULL DEFAULT 'profit',
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `cost_centers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `customers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`code` varchar(32),
	`name` varchar(255) NOT NULL,
	`customerType` enum('individual','business') NOT NULL DEFAULT 'individual',
	`vatNumber` varchar(32),
	`commercialRegistrationNumber` varchar(64),
	`addressLine1` varchar(255),
	`city` varchar(128),
	`countryCode` varchar(2),
	`email` varchar(320),
	`phone` varchar(32),
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `customers_id` PRIMARY KEY(`id`),
	CONSTRAINT `customers_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `documents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`fileUrl` text NOT NULL,
	`fileKey` varchar(512) NOT NULL,
	`mimeType` varchar(128),
	`fileSize` int,
	`entityType` varchar(64),
	`entityId` int,
	`uploadedBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `documents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `employees` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int,
	`name` varchar(255) NOT NULL,
	`email` varchar(320),
	`phone` varchar(32),
	`position` varchar(128),
	`branchId` int,
	`employeeRole` enum('cashier','waiter','chef','branch_manager','accountant','warehouse_manager','production_manager','operations_manager','owner') NOT NULL DEFAULT 'cashier',
	`hireDate` timestamp,
	`baseSalary` decimal(18,2) DEFAULT '0',
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `employees_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `fiscal_period_reopen_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`fiscalPeriodId` int NOT NULL,
	`reopenedBy` int NOT NULL,
	`reason` text NOT NULL,
	`reopenedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `fiscal_period_reopen_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `fiscal_periods` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(128) NOT NULL,
	`startDate` timestamp NOT NULL,
	`endDate` timestamp NOT NULL,
	`isClosed` boolean NOT NULL DEFAULT false,
	`closedBy` int,
	`closedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `fiscal_periods_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `internal_transfer_lines` (
	`id` int AUTO_INCREMENT NOT NULL,
	`transferId` int NOT NULL,
	`productId` int NOT NULL,
	`quantity` decimal(18,4) NOT NULL,
	`receivedQuantity` decimal(18,4) DEFAULT '0',
	`unitCost` decimal(18,4) DEFAULT '0',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `internal_transfer_lines_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `internal_transfers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`transferNumber` varchar(32) NOT NULL,
	`fromWarehouseId` int NOT NULL,
	`toWarehouseId` int NOT NULL,
	`status` enum('draft','approved','in_transit','received','cancelled') NOT NULL DEFAULT 'draft',
	`notes` text,
	`createdBy` int,
	`approvedBy` int,
	`approvedAt` timestamp,
	`receivedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `internal_transfers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `inventory_count_lines` (
	`id` int AUTO_INCREMENT NOT NULL,
	`countId` int NOT NULL,
	`productId` int NOT NULL,
	`systemQuantity` decimal(18,4) NOT NULL DEFAULT '0',
	`actualQuantity` decimal(18,4) NOT NULL DEFAULT '0',
	`difference` decimal(18,4) NOT NULL DEFAULT '0',
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `inventory_count_lines_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `inventory_counts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`countNumber` varchar(32) NOT NULL,
	`warehouseId` int NOT NULL,
	`type` enum('periodic','surprise') NOT NULL DEFAULT 'periodic',
	`status` enum('draft','in_progress','completed','approved') NOT NULL DEFAULT 'draft',
	`notes` text,
	`createdBy` int,
	`approvedBy` int,
	`completedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `inventory_counts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `journal_entries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`entryNumber` varchar(32) NOT NULL,
	`date` timestamp NOT NULL,
	`description` text,
	`reference` varchar(128),
	`referenceType` varchar(64),
	`referenceId` int,
	`status` enum('draft','posted','reversed') NOT NULL DEFAULT 'draft',
	`totalDebit` decimal(18,2) NOT NULL DEFAULT '0',
	`totalCredit` decimal(18,2) NOT NULL DEFAULT '0',
	`createdBy` int,
	`postedBy` int,
	`postedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `journal_entries_id` PRIMARY KEY(`id`),
	CONSTRAINT `journal_entries_entryNumber_unique` UNIQUE(`entryNumber`)
);
--> statement-breakpoint
CREATE TABLE `journal_entry_lines` (
	`id` int AUTO_INCREMENT NOT NULL,
	`journalEntryId` int NOT NULL,
	`accountId` int NOT NULL,
	`costCenterId` int,
	`branchId` int,
	`debit` decimal(18,2) NOT NULL DEFAULT '0',
	`credit` decimal(18,2) NOT NULL DEFAULT '0',
	`description` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `journal_entry_lines_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `kitchen_orders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orderId` int NOT NULL,
	`orderLineId` int NOT NULL,
	`branchId` int NOT NULL,
	`status` enum('new','preparing','ready','served') NOT NULL DEFAULT 'new',
	`priority` int,
	`startedAt` timestamp,
	`completedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `kitchen_orders_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `dgtera_migration_ledger` (
	`id` int AUTO_INCREMENT NOT NULL,
	`file_name` varchar(255) NOT NULL,
	`checksum` varchar(64) NOT NULL,
	`applied_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `dgtera_migration_ledger_id` PRIMARY KEY(`id`),
	CONSTRAINT `dgtera_migration_ledger_file_name_unique` UNIQUE(`file_name`)
);
--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`type` varchar(64) NOT NULL,
	`title` varchar(255) NOT NULL,
	`content` text,
	`isRead` boolean NOT NULL DEFAULT false,
	`entityType` varchar(64),
	`entityId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `notifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `order_lines` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orderId` int NOT NULL,
	`productId` int NOT NULL,
	`quantity` decimal(18,4) NOT NULL,
	`unitPrice` decimal(18,2) NOT NULL,
	`totalPrice` decimal(18,2) NOT NULL,
	`costPrice` decimal(18,2) DEFAULT '0',
	`discountAmount` decimal(18,2) DEFAULT '0',
	`notes` text,
	`status` enum('pending','preparing','ready','served','cancelled') NOT NULL DEFAULT 'pending',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `order_lines_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `orders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orderNumber` varchar(32) NOT NULL,
	`tableId` int,
	`sessionId` int,
	`branchId` int NOT NULL,
	`costCenterId` int,
	`cashierId` int,
	`type` enum('dine_in','takeaway','delivery') NOT NULL DEFAULT 'dine_in',
	`status` enum('new','preparing','ready','served','paid','cancelled') NOT NULL DEFAULT 'new',
	`subtotal` decimal(18,2) NOT NULL DEFAULT '0',
	`totalAmount` decimal(18,2) NOT NULL DEFAULT '0',
	`discountAmount` decimal(18,2) NOT NULL DEFAULT '0',
	`taxAmount` decimal(18,2) NOT NULL DEFAULT '0',
	`paymentMethod` enum('cash','card','transfer','mixed') DEFAULT 'cash',
	`notes` text,
	`paidAmount` decimal(18,2) DEFAULT '0',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `orders_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `payroll_batches` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(128) NOT NULL,
	`periodStart` timestamp NOT NULL,
	`periodEnd` timestamp NOT NULL,
	`status` enum('draft','approved','paid') NOT NULL DEFAULT 'draft',
	`totalAmount` decimal(18,2) DEFAULT '0',
	`createdBy` int,
	`approvedBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `payroll_batches_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `payroll_lines` (
	`id` int AUTO_INCREMENT NOT NULL,
	`batchId` int NOT NULL,
	`employeeId` int NOT NULL,
	`baseSalary` decimal(18,2) NOT NULL DEFAULT '0',
	`overtime` decimal(18,2) DEFAULT '0',
	`deductions` decimal(18,2) DEFAULT '0',
	`bonuses` decimal(18,2) DEFAULT '0',
	`netSalary` decimal(18,2) NOT NULL DEFAULT '0',
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `payroll_lines_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `permissions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`code` varchar(128) NOT NULL,
	`module` varchar(64) NOT NULL,
	`action` varchar(64) NOT NULL,
	`name` varchar(160) NOT NULL,
	`nameEn` varchar(160),
	`description` text,
	`isSystem` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `permissions_id` PRIMARY KEY(`id`),
	CONSTRAINT `permissions_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `pos_sessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`cashierId` int NOT NULL,
	`branchId` int NOT NULL,
	`openingBalance` decimal(18,2) NOT NULL DEFAULT '0',
	`closingBalance` decimal(18,2),
	`expectedCash` decimal(18,2),
	`cashVariance` decimal(18,2),
	`totalSales` decimal(18,2) DEFAULT '0',
	`totalReturns` decimal(18,2) DEFAULT '0',
	`status` enum('open','closed') NOT NULL DEFAULT 'open',
	`closedBy` int,
	`closedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `pos_sessions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `production_order_lines` (
	`id` int AUTO_INCREMENT NOT NULL,
	`productionOrderId` int NOT NULL,
	`ingredientId` int NOT NULL,
	`requiredQuantity` decimal(18,4) NOT NULL,
	`actualQuantity` decimal(18,4) DEFAULT '0',
	`unitCost` decimal(18,4) DEFAULT '0',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `production_order_lines_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `production_orders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orderNumber` varchar(32) NOT NULL,
	`recipeId` int NOT NULL,
	`productId` int NOT NULL,
	`warehouseId` int NOT NULL,
	`branchId` int,
	`plannedQuantity` decimal(18,4) NOT NULL,
	`actualQuantity` decimal(18,4) DEFAULT '0',
	`wasteQuantity` decimal(18,4) DEFAULT '0',
	`status` enum('draft','approved','in_progress','completed','cancelled') NOT NULL DEFAULT 'draft',
	`plannedCost` decimal(18,2) DEFAULT '0',
	`actualCost` decimal(18,2) DEFAULT '0',
	`variance` decimal(18,2) DEFAULT '0',
	`batchNumber` varchar(64),
	`notes` text,
	`createdBy` int,
	`approvedBy` int,
	`completedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `production_orders_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `products` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`nameEn` varchar(255),
	`sku` varchar(64),
	`barcode` varchar(64),
	`categoryId` int,
	`unitId` int,
	`type` enum('raw_material','semi_finished','finished','direct_sale','service') NOT NULL,
	`costPrice` decimal(18,2) NOT NULL DEFAULT '0',
	`salePrice` decimal(18,2) NOT NULL DEFAULT '0',
	`taxRate` decimal(5,2) NOT NULL DEFAULT '15',
	`taxCodeId` int,
	`reorderLevel` int DEFAULT 0,
	`imageUrl` text,
	`isActive` boolean NOT NULL DEFAULT true,
	`trackBatch` boolean NOT NULL DEFAULT false,
	`trackExpiry` boolean NOT NULL DEFAULT false,
	`yieldPercent` decimal(5,2) DEFAULT '100',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `products_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `purchase_invoice_lines` (
	`id` int AUTO_INCREMENT NOT NULL,
	`invoiceId` int NOT NULL,
	`productId` int NOT NULL,
	`quantity` decimal(18,4) NOT NULL,
	`unitPrice` decimal(18,2) NOT NULL,
	`lineTotal` decimal(18,2) DEFAULT '0',
	`taxCodeId` int,
	`taxRate` decimal(5,2) NOT NULL DEFAULT '15',
	`taxAmount` decimal(18,2) NOT NULL DEFAULT '0',
	`batchNumber` varchar(64),
	`expiryDate` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `purchase_invoice_lines_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `purchase_invoices` (
	`id` int AUTO_INCREMENT NOT NULL,
	`invoiceNumber` varchar(32) NOT NULL,
	`supplierId` int NOT NULL,
	`poId` int,
	`warehouseId` int,
	`status` enum('draft','received','items_approved','accounts_approved','approved','paid','cancelled') NOT NULL DEFAULT 'draft',
	`invoiceDate` timestamp NOT NULL,
	`dueDate` timestamp,
	`totalAmount` decimal(18,2) DEFAULT '0',
	`tax` decimal(18,2) DEFAULT '0',
	`notes` text,
	`createdBy` int,
	`approvedBy` int,
	`itemsApprovedBy` int,
	`itemsApprovalNotes` text,
	`accountsApprovedBy` int,
	`accountsApprovalNotes` text,
	`approvedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `purchase_invoices_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `purchase_order_lines` (
	`id` int AUTO_INCREMENT NOT NULL,
	`purchaseOrderId` int NOT NULL,
	`productId` int NOT NULL,
	`quantity` decimal(18,4) NOT NULL,
	`receivedQuantity` decimal(18,4) DEFAULT '0',
	`unitPrice` decimal(18,4) NOT NULL,
	`totalPrice` decimal(18,2) NOT NULL DEFAULT '0',
	`batchNumber` varchar(64),
	`expiryDate` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `purchase_order_lines_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `purchase_orders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orderNumber` varchar(32) NOT NULL,
	`supplierId` int NOT NULL,
	`warehouseId` int NOT NULL,
	`status` enum('draft','approved','received','partial','cancelled') NOT NULL DEFAULT 'draft',
	`totalAmount` decimal(18,2) NOT NULL DEFAULT '0',
	`taxAmount` decimal(18,2) NOT NULL DEFAULT '0',
	`notes` text,
	`createdBy` int,
	`approvedBy` int,
	`receivedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `purchase_orders_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `purchase_request_lines` (
	`id` int AUTO_INCREMENT NOT NULL,
	`requestId` int NOT NULL,
	`productId` int NOT NULL,
	`quantity` decimal(18,4) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `purchase_request_lines_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `purchase_requests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`requestNumber` varchar(32) NOT NULL,
	`branchId` int NOT NULL,
	`status` enum('draft','submitted','approved','rejected') NOT NULL DEFAULT 'draft',
	`createdBy` int,
	`requestedBy` int,
	`approvedBy` int,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `purchase_requests_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `recipe_lines` (
	`id` int AUTO_INCREMENT NOT NULL,
	`recipeId` int NOT NULL,
	`ingredientId` int NOT NULL,
	`quantity` decimal(18,4) NOT NULL,
	`wastePercent` decimal(5,2) DEFAULT '0',
	`unitCost` decimal(18,4) DEFAULT '0',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `recipe_lines_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `recipes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`productId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`outputQuantity` decimal(18,4) NOT NULL DEFAULT '1',
	`yieldPercent` decimal(5,2) DEFAULT '100',
	`standardCost` decimal(18,2) DEFAULT '0',
	`instructions` text,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `recipes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `role_permissions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`roleId` int NOT NULL,
	`permissionId` int NOT NULL,
	`effect` enum('allow','deny') NOT NULL DEFAULT 'allow',
	`createdBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `role_permissions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `roles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`code` varchar(96) NOT NULL,
	`name` varchar(160) NOT NULL,
	`nameEn` varchar(160),
	`description` text,
	`isSystem` boolean NOT NULL DEFAULT false,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `roles_id` PRIMARY KEY(`id`),
	CONSTRAINT `roles_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `sales_invoice_lines` (
	`id` int AUTO_INCREMENT NOT NULL,
	`invoiceId` int NOT NULL,
	`productId` int,
	`description` varchar(512) NOT NULL,
	`quantity` decimal(18,4) NOT NULL,
	`unitPrice` decimal(18,2) NOT NULL,
	`discountAmount` decimal(18,2) NOT NULL DEFAULT '0',
	`taxCodeId` int,
	`taxRate` decimal(5,2) NOT NULL,
	`taxAmount` decimal(18,2) NOT NULL,
	`lineTotal` decimal(18,2) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `sales_invoice_lines_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sales_invoices` (
	`id` int AUTO_INCREMENT NOT NULL,
	`invoiceUuid` varchar(64) NOT NULL,
	`invoiceNumber` varchar(32) NOT NULL,
	`orderId` int,
	`branchId` int NOT NULL,
	`customerId` int,
	`invoiceType` enum('simplified','tax','credit_note','debit_note') NOT NULL,
	`status` enum('draft','issued','reported','cleared','failed','cancelled') NOT NULL DEFAULT 'draft',
	`issueDate` timestamp NOT NULL,
	`currencyCode` varchar(3) NOT NULL,
	`subtotalAmount` decimal(18,2) NOT NULL,
	`discountAmount` decimal(18,2) NOT NULL DEFAULT '0',
	`taxAmount` decimal(18,2) NOT NULL,
	`totalAmount` decimal(18,2) NOT NULL,
	`previousInvoiceHash` text,
	`invoiceHash` text,
	`qrPayload` text,
	`complianceStatus` enum('not_submitted','pending','accepted','rejected') NOT NULL DEFAULT 'not_submitted',
	`complianceMessage` text,
	`createdBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `sales_invoices_id` PRIMARY KEY(`id`),
	CONSTRAINT `sales_invoices_invoiceUuid_unique` UNIQUE(`invoiceUuid`),
	CONSTRAINT `sales_invoices_invoiceNumber_unique` UNIQUE(`invoiceNumber`)
);
--> statement-breakpoint
CREATE TABLE `shifts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(128) NOT NULL,
	`branchId` int,
	`startTime` varchar(8) NOT NULL,
	`endTime` varchar(8) NOT NULL,
	`daysOfWeek` json,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `shifts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `stock` (
	`id` int AUTO_INCREMENT NOT NULL,
	`productId` int NOT NULL,
	`warehouseId` int NOT NULL,
	`quantity` decimal(18,4) NOT NULL DEFAULT '0',
	`avgCost` decimal(18,4) NOT NULL DEFAULT '0',
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `stock_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `stock_movements` (
	`id` int AUTO_INCREMENT NOT NULL,
	`productId` int NOT NULL,
	`warehouseId` int NOT NULL,
	`type` enum('purchase','sale','transfer_in','transfer_out','production_in','production_out','waste','adjustment','return') NOT NULL,
	`quantity` decimal(18,4) NOT NULL,
	`unitCost` decimal(18,4) DEFAULT '0',
	`referenceType` varchar(64),
	`referenceId` int,
	`batchNumber` varchar(64),
	`expiryDate` timestamp,
	`notes` text,
	`createdBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `stock_movements_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `suppliers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`contactPerson` varchar(128),
	`email` varchar(320),
	`phone` varchar(32),
	`address` text,
	`taxNumber` varchar(64),
	`isActive` boolean NOT NULL DEFAULT true,
	`balance` decimal(18,2) DEFAULT '0',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `suppliers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `system_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`settingKey` varchar(128) NOT NULL,
	`value` text,
	`settingGroup` varchar(64),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `system_settings_id` PRIMARY KEY(`id`),
	CONSTRAINT `system_settings_settingKey_unique` UNIQUE(`settingKey`)
);
--> statement-breakpoint
CREATE TABLE `restaurant_tables` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(64) NOT NULL,
	`capacity` int DEFAULT 4,
	`status` enum('available','occupied','reserved','maintenance') NOT NULL DEFAULT 'available',
	`branchId` int NOT NULL,
	`sortOrder` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `restaurant_tables_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `tax_codes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`code` varchar(32) NOT NULL,
	`name` varchar(128) NOT NULL,
	`category` enum('standard','zero_rated','exempt','out_of_scope') NOT NULL,
	`rate` decimal(5,2) NOT NULL,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `tax_codes_id` PRIMARY KEY(`id`),
	CONSTRAINT `tax_codes_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `units` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(64) NOT NULL,
	`symbol` varchar(16) NOT NULL,
	`baseUnitId` int,
	`conversionFactor` decimal(12,6) DEFAULT '1',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `units_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `user_permission_overrides` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`permissionId` int NOT NULL,
	`effect` enum('allow','deny') NOT NULL,
	`branchId` int,
	`warehouseId` int,
	`costCenterId` int,
	`reason` varchar(500),
	`expiresAt` timestamp,
	`grantedBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `user_permission_overrides_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `user_roles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`roleId` int NOT NULL,
	`branchId` int,
	`warehouseId` int,
	`costCenterId` int,
	`isActive` boolean NOT NULL DEFAULT true,
	`expiresAt` timestamp,
	`assignedBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `user_roles_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`openId` varchar(64),
	`username` varchar(64),
	`passwordHash` varchar(255),
	`name` text,
	`email` varchar(320),
	`loginMethod` varchar(64),
	`role` enum('user','admin') NOT NULL DEFAULT 'user',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`lastSignedIn` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_openId_unique` UNIQUE(`openId`),
	CONSTRAINT `users_username_unique` UNIQUE(`username`)
);
--> statement-breakpoint
CREATE TABLE `voucher_lines` (
	`id` int AUTO_INCREMENT NOT NULL,
	`voucherId` int NOT NULL,
	`accountId` int NOT NULL,
	`costCenterId` int,
	`description` text,
	`amount` decimal(18,2) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `voucher_lines_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `vouchers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`voucherNumber` varchar(32) NOT NULL,
	`voucherType` enum('receipt','payment') NOT NULL,
	`date` timestamp NOT NULL,
	`branchId` int NOT NULL,
	`description` text,
	`amount` decimal(18,2) NOT NULL,
	`paymentMethod` enum('cash','check','transfer','card') NOT NULL DEFAULT 'cash',
	`referenceNumber` varchar(64),
	`status` enum('draft','posted','cancelled') NOT NULL DEFAULT 'draft',
	`journalEntryId` int,
	`createdBy` int,
	`postedBy` int,
	`postedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `vouchers_id` PRIMARY KEY(`id`),
	CONSTRAINT `vouchers_voucherNumber_unique` UNIQUE(`voucherNumber`)
);
--> statement-breakpoint
CREATE TABLE `warehouses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`branchId` int,
	`type` enum('central','branch','kitchen') NOT NULL DEFAULT 'branch',
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `warehouses_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `zatca_connections` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyProfileId` int NOT NULL,
	`environment` enum('sandbox','production') NOT NULL,
	`status` enum('not_configured','ready','testing','active','error','suspended') NOT NULL DEFAULT 'not_configured',
	`credentialReference` varchar(128),
	`csidReference` varchar(128),
	`lastVerifiedAt` timestamp,
	`lastError` text,
	`createdBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `zatca_connections_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `zatca_submission_attempts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`salesInvoiceId` int NOT NULL,
	`connectionId` int,
	`submissionType` enum('reporting','clearance') NOT NULL,
	`status` enum('queued','sending','accepted','rejected','retryable_error','permanent_error') NOT NULL DEFAULT 'queued',
	`attemptNumber` int NOT NULL DEFAULT 1,
	`requestId` varchar(128),
	`httpStatus` int,
	`requestDocumentKey` varchar(512),
	`responseDocumentKey` varchar(512),
	`responseSummary` text,
	`nextRetryAt` timestamp,
	`sentAt` timestamp,
	`completedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `zatca_submission_attempts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `fiscal_period_reopen_logs_period_idx` ON `fiscal_period_reopen_logs` (`fiscalPeriodId`);--> statement-breakpoint
CREATE INDEX `role_permissions_role_idx` ON `role_permissions` (`roleId`);--> statement-breakpoint
CREATE INDEX `role_permissions_permission_idx` ON `role_permissions` (`permissionId`);--> statement-breakpoint
CREATE INDEX `user_permission_overrides_user_idx` ON `user_permission_overrides` (`userId`);--> statement-breakpoint
CREATE INDEX `user_permission_overrides_permission_idx` ON `user_permission_overrides` (`permissionId`);--> statement-breakpoint
CREATE INDEX `user_roles_user_idx` ON `user_roles` (`userId`);--> statement-breakpoint
CREATE INDEX `user_roles_role_idx` ON `user_roles` (`roleId`);--> statement-breakpoint
CREATE INDEX `zatca_submission_attempts_invoice_status_idx` ON `zatca_submission_attempts` (`salesInvoiceId`,`status`);