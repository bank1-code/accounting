INSERT INTO `permissions` (`code`, `module`, `action`, `name`, `nameEn`, `isSystem`) VALUES
('inventory.catalog.manage','inventory','manage','إدارة الأصناف والفئات والوحدات والمخازن','Manage inventory catalog and warehouses',true),
('purchasing.suppliers.manage','purchasing','manage','إدارة الموردين','Manage suppliers',true),
('pos.tables.manage','pos','manage','إدارة طاولات المطعم','Manage restaurant tables',true),
('pos.kitchen.manage','pos','manage','إدارة شاشة المطبخ','Manage kitchen display',true),
('compliance.invoice.issue','compliance','issue','إصدار فاتورة ضريبية','Issue tax invoice',true),
('admin.documents.manage','admin','manage','إدارة المستندات','Manage documents',true)
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`), `nameEn` = VALUES(`nameEn`), `module` = VALUES(`module`), `action` = VALUES(`action`);

INSERT INTO `role_permissions` (`roleId`, `permissionId`, `effect`)
SELECT r.id, p.id, 'allow'
FROM `roles` r CROSS JOIN `permissions` p
WHERE r.code = 'system_administrator'
  AND p.code IN ('inventory.catalog.manage','purchasing.suppliers.manage','pos.tables.manage','pos.kitchen.manage','compliance.invoice.issue','admin.documents.manage')
  AND NOT EXISTS (SELECT 1 FROM `role_permissions` rp WHERE rp.roleId = r.id AND rp.permissionId = p.id);
