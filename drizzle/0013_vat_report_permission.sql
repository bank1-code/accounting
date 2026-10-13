INSERT INTO `permissions` (`code`, `module`, `action`, `name`, `nameEn`, `isSystem`) VALUES
('accounting.vat.view','accounting','view','عرض ملخص ضريبة القيمة المضافة','View VAT summary',true)
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`), `nameEn` = VALUES(`nameEn`), `module` = VALUES(`module`), `action` = VALUES(`action`);

INSERT INTO `role_permissions` (`roleId`, `permissionId`, `effect`)
SELECT r.id, p.id, 'allow'
FROM `roles` r CROSS JOIN `permissions` p
WHERE r.code = 'system_administrator'
  AND p.code = 'accounting.vat.view'
  AND NOT EXISTS (SELECT 1 FROM `role_permissions` rp WHERE rp.roleId = r.id AND rp.permissionId = p.id);
