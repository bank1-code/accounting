CREATE TABLE IF NOT EXISTS `roles` (
  `id` int AUTO_INCREMENT NOT NULL,
  `code` varchar(96) NOT NULL,
  `name` varchar(160) NOT NULL,
  `nameEn` varchar(160),
  `description` text,
  `isSystem` boolean NOT NULL DEFAULT false,
  `isActive` boolean NOT NULL DEFAULT true,
  `createdBy` int,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `roles_id` PRIMARY KEY(`id`),
  CONSTRAINT `roles_code_unique` UNIQUE(`code`)
);

CREATE TABLE IF NOT EXISTS `permissions` (
  `id` int AUTO_INCREMENT NOT NULL,
  `code` varchar(128) NOT NULL,
  `module` varchar(64) NOT NULL,
  `action` varchar(64) NOT NULL,
  `name` varchar(160) NOT NULL,
  `nameEn` varchar(160),
  `description` text,
  `isSystem` boolean NOT NULL DEFAULT true,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `permissions_id` PRIMARY KEY(`id`),
  CONSTRAINT `permissions_code_unique` UNIQUE(`code`)
);

CREATE TABLE IF NOT EXISTS `role_permissions` (
  `id` int AUTO_INCREMENT NOT NULL,
  `roleId` int NOT NULL,
  `permissionId` int NOT NULL,
  `effect` enum('allow','deny') NOT NULL DEFAULT 'allow',
  `createdBy` int,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `role_permissions_id` PRIMARY KEY(`id`),
  KEY `role_permissions_role_idx` (`roleId`),
  KEY `role_permissions_permission_idx` (`permissionId`)
);

CREATE TABLE IF NOT EXISTS `user_roles` (
  `id` int AUTO_INCREMENT NOT NULL,
  `userId` int NOT NULL,
  `roleId` int NOT NULL,
  `branchId` int,
  `warehouseId` int,
  `costCenterId` int,
  `isActive` boolean NOT NULL DEFAULT true,
  `expiresAt` timestamp NULL,
  `assignedBy` int,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `user_roles_id` PRIMARY KEY(`id`),
  KEY `user_roles_user_idx` (`userId`),
  KEY `user_roles_role_idx` (`roleId`)
);

CREATE TABLE IF NOT EXISTS `user_permission_overrides` (
  `id` int AUTO_INCREMENT NOT NULL,
  `userId` int NOT NULL,
  `permissionId` int NOT NULL,
  `effect` enum('allow','deny') NOT NULL,
  `branchId` int,
  `warehouseId` int,
  `costCenterId` int,
  `reason` varchar(500),
  `expiresAt` timestamp NULL,
  `grantedBy` int,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `user_permission_overrides_id` PRIMARY KEY(`id`),
  KEY `user_permission_overrides_user_idx` (`userId`),
  KEY `user_permission_overrides_permission_idx` (`permissionId`)
);
