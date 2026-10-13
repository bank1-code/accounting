INSERT INTO `roles` (`code`, `name`, `nameEn`, `description`, `isSystem`, `isActive`)
VALUES ('system_administrator', 'مدير النظام', 'System Administrator', 'دور نظامي كامل لإدارة الإعدادات والصلاحيات والعمليات الحساسة', true, true)
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`), `nameEn` = VALUES(`nameEn`), `description` = VALUES(`description`), `isActive` = true;

INSERT INTO `permissions` (`code`, `module`, `action`, `name`, `nameEn`, `isSystem`) VALUES
('admin.settings.view','admin','view','عرض الإعدادات','View settings',true),
('admin.settings.manage','admin','manage','إدارة الإعدادات','Manage settings',true),
('admin.users.manage','admin','manage','إدارة المستخدمين','Manage users',true),
('admin.roles.manage','admin','manage','إدارة الأدوار والصلاحيات','Manage roles and permissions',true),
('admin.audit.view','admin','view','عرض سجل التدقيق','View audit log',true),
('admin.backups.manage','admin','manage','إدارة النسخ الاحتياطية','Manage backups',true),
('accounting.coa.view','accounting','view','عرض دليل الحسابات','View chart of accounts',true),
('accounting.coa.manage','accounting','manage','إدارة دليل الحسابات','Manage chart of accounts',true),
('accounting.journal.create','accounting','create','إنشاء قيد يومية','Create journal entry',true),
('accounting.journal.post','accounting','post','ترحيل قيد يومية','Post journal entry',true),
('accounting.journal.reverse','accounting','reverse','عكس قيد يومية','Reverse journal entry',true),
('accounting.period.close','accounting','close','إقفال فترة مالية','Close fiscal period',true),
('accounting.period.reopen','accounting','reopen','إعادة فتح فترة مالية','Reopen fiscal period',true),
('accounting.reports.view','accounting','view','عرض التقارير المالية','View financial reports',true),
('treasury.receipt.create','treasury','create','إنشاء سند قبض','Create receipt voucher',true),
('treasury.payment.create','treasury','create','إنشاء سند صرف','Create payment voucher',true),
('treasury.voucher.approve','treasury','approve','اعتماد سند','Approve voucher',true),
('treasury.voucher.post','treasury','post','ترحيل سند','Post voucher',true),
('treasury.refund.approve','treasury','approve','اعتماد استرداد','Approve refund',true),
('pos.session.open','pos','open','فتح جلسة نقاط بيع','Open POS session',true),
('pos.session.close','pos','close','إقفال جلسة نقاط بيع','Close POS session',true),
('pos.order.create','pos','create','إنشاء طلب بيع','Create POS order',true),
('pos.order.cancel','pos','cancel','إلغاء طلب بيع','Cancel POS order',true),
('pos.order.refund','pos','refund','استرداد طلب بيع','Refund POS order',true),
('pos.discount.apply','pos','apply','تطبيق خصم','Apply discount',true),
('pos.cash_variance.approve','pos','approve','اعتماد فرق نقدي','Approve cash variance',true),
('inventory.view','inventory','view','عرض المخزون','View inventory',true),
('inventory.transfer.create','inventory','create','إنشاء تحويل مخزني','Create inventory transfer',true),
('inventory.transfer.approve','inventory','approve','اعتماد تحويل مخزني','Approve inventory transfer',true),
('inventory.count.create','inventory','create','إنشاء جرد','Create inventory count',true),
('inventory.count.approve','inventory','approve','اعتماد جرد','Approve inventory count',true),
('inventory.adjust.post','inventory','post','ترحيل تسوية مخزون','Post inventory adjustment',true),
('inventory.waste.create','inventory','create','إنشاء إذن تالف','Create waste voucher',true),
('inventory.waste.approve','inventory','approve','اعتماد إذن تالف','Approve waste voucher',true),
('production.recipe.manage','production','manage','إدارة الوصفات','Manage recipes',true),
('production.order.create','production','create','إنشاء أمر إنتاج','Create production order',true),
('production.order.complete','production','complete','إتمام أمر إنتاج','Complete production order',true),
('production.order.approve','production','approve','اعتماد أمر إنتاج','Approve production order',true),
('purchasing.request.create','purchasing','create','إنشاء طلب شراء','Create purchase request',true),
('purchasing.order.create','purchasing','create','إنشاء أمر شراء','Create purchase order',true),
('purchasing.order.approve','purchasing','approve','اعتماد أمر شراء','Approve purchase order',true),
('purchasing.invoice.items_approve','purchasing','approve','اعتماد أصناف فاتورة شراء','Approve purchase invoice items',true),
('purchasing.invoice.accounts_approve','purchasing','approve','اعتماد حسابات فاتورة شراء','Approve purchase invoice accounts',true),
('purchasing.invoice.post','purchasing','post','ترحيل فاتورة شراء','Post purchase invoice',true),
('compliance.vat.manage','compliance','manage','إدارة ضريبة القيمة المضافة','Manage VAT',true),
('compliance.zatca.view','compliance','view','عرض حالة زاتكا','View ZATCA status',true),
('compliance.zatca.manage','compliance','manage','إدارة إعدادات زاتكا','Manage ZATCA settings',true),
('compliance.zatca.submit','compliance','submit','إرسال فاتورة إلى زاتكا','Submit invoice to ZATCA',true)
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`), `nameEn` = VALUES(`nameEn`), `module` = VALUES(`module`), `action` = VALUES(`action`);

INSERT INTO `role_permissions` (`roleId`, `permissionId`, `effect`)
SELECT r.id, p.id, 'allow'
FROM `roles` r CROSS JOIN `permissions` p
WHERE r.code = 'system_administrator'
  AND NOT EXISTS (
    SELECT 1 FROM `role_permissions` rp WHERE rp.roleId = r.id AND rp.permissionId = p.id
  );

INSERT INTO `user_roles` (`userId`, `roleId`, `isActive`)
SELECT u.id, r.id, true
FROM `users` u CROSS JOIN `roles` r
WHERE u.role = 'admin' AND r.code = 'system_administrator'
  AND NOT EXISTS (
    SELECT 1 FROM `user_roles` ur WHERE ur.userId = u.id AND ur.roleId = r.id AND ur.isActive = true
  );
