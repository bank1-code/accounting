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
	`method` enum('sales_ratio','branch_count','employee_count','custom') NOT NULL DEFAULT 'sales_ratio',
	`periodStart` timestamp NOT NULL,
	`periodEnd` timestamp NOT NULL,
	`totalAmount` decimal(18,2) NOT NULL DEFAULT '0',
	`status` enum('draft','applied') NOT NULL DEFAULT 'draft',
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
	`phone` varchar(32),
	`email` varchar(320),
	`branchId` int,
	`position` varchar(128),
	`employeeRole` enum('cashier','waiter','chef','branch_manager','accountant','warehouse_manager','production_manager','operations_manager','owner') NOT NULL DEFAULT 'cashier',
	`baseSalary` decimal(18,2) DEFAULT '0',
	`isActive` boolean NOT NULL DEFAULT true,
	`hireDate` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `employees_id` PRIMARY KEY(`id`)
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
	CONSTRAINT `journal_entries_id` PRIMARY KEY(`id`)
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
	`priority` int DEFAULT 0,
	`startedAt` timestamp,
	`completedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `kitchen_orders_id` PRIMARY KEY(`id`)
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
	`branchId` int NOT NULL,
	`costCenterId` int,
	`tableId` int,
	`sessionId` int,
	`cashierId` int,
	`type` enum('dine_in','takeaway','delivery') NOT NULL DEFAULT 'dine_in',
	`status` enum('new','preparing','ready','served','paid','cancelled') NOT NULL DEFAULT 'new',
	`subtotal` decimal(18,2) NOT NULL DEFAULT '0',
	`taxAmount` decimal(18,2) NOT NULL DEFAULT '0',
	`discountAmount` decimal(18,2) NOT NULL DEFAULT '0',
	`totalAmount` decimal(18,2) NOT NULL DEFAULT '0',
	`paidAmount` decimal(18,2) DEFAULT '0',
	`paymentMethod` enum('cash','card','transfer','mixed') DEFAULT 'cash',
	`notes` text,
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
CREATE TABLE `pos_sessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`branchId` int NOT NULL,
	`cashierId` int NOT NULL,
	`openingBalance` decimal(18,2) NOT NULL DEFAULT '0',
	`closingBalance` decimal(18,2),
	`totalSales` decimal(18,2) DEFAULT '0',
	`totalReturns` decimal(18,2) DEFAULT '0',
	`status` enum('open','closed') NOT NULL DEFAULT 'open',
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
	`phone` varchar(32),
	`email` varchar(320),
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
	CONSTRAINT `system_settings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `restaurant_tables` (
	`id` int AUTO_INCREMENT NOT NULL,
	`branchId` int NOT NULL,
	`name` varchar(64) NOT NULL,
	`capacity` int DEFAULT 4,
	`status` enum('available','occupied','reserved','maintenance') NOT NULL DEFAULT 'available',
	`sortOrder` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `restaurant_tables_id` PRIMARY KEY(`id`)
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
CREATE TABLE `warehouses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`branchId` int,
	`type` enum('central','branch','kitchen') NOT NULL DEFAULT 'branch',
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `warehouses_id` PRIMARY KEY(`id`)
);
