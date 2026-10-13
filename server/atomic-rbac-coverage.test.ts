import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const routerSource = readFileSync(resolve(process.cwd(), "server/routers.ts"), "utf8");

describe("تغطية التفويض الذري للإجراءات الحساسة", () => {
  const requiredGuards = [
    ["إدارة الفروع", "admin.settings.manage"],
    ["إدارة الأدوار", "admin.roles.manage"],
    ["إنشاء وترحيل القيود", "accounting.journal.create", "accounting.journal.post"],
    ["إقفال الفترة", "accounting.period.close"],
    ["التحويل والجرد", "inventory.transfer.create", "inventory.count.create"],
    ["الوصفات والإنتاج", "production.recipe.manage", "production.order.create", "production.order.complete"],
    ["دورة المشتريات", "purchasing.request.create", "purchasing.order.create", "purchasing.invoice.items_approve", "purchasing.invoice.accounts_approve"],
    ["جلسات وطلبات نقاط البيع", "pos.session.open", "pos.session.close", "pos.order.create", "pos.order.cancel"],
    ["الامتثال وزاتكا", "compliance.vat.manage", "compliance.invoice.issue", "compliance.zatca.manage", "compliance.zatca.submit"],
    ["النسخ والتدقيق", "admin.backups.manage", "admin.audit.view"],
  ] as const;

  for (const [area, ...permissionCodes] of requiredGuards) {
    it(`يربط ${area} بصلاحيات ذرية معلنة`, () => {
      for (const permissionCode of permissionCodes) {
        expect(routerSource).toContain(`atomicPermissionProcedure("${permissionCode}"`);
      }
    });
  }

  it("لا يترك إجراءات تعديل محمية بـ adminProcedure بعد الانتقال إلى RBAC", () => {
    expect(routerSource).not.toMatch(/adminProcedure\.input\(/);
  });
});
