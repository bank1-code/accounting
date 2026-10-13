import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const sources = {
  chartOfAccounts: readFileSync(resolve(process.cwd(), "client/src/pages/accounting/ChartOfAccounts.tsx"), "utf8"),
  costCenters: readFileSync(resolve(process.cwd(), "client/src/pages/accounting/CostCenters.tsx"), "utf8"),
  journal: readFileSync(resolve(process.cwd(), "client/src/pages/accounting/JournalEntries.tsx"), "utf8"),
  fiscalPeriods: readFileSync(resolve(process.cwd(), "client/src/pages/accounting/FiscalPeriods.tsx"), "utf8"),
  transfers: readFileSync(resolve(process.cwd(), "client/src/pages/inventory/Transfers.tsx"), "utf8"),
  inventoryCount: readFileSync(resolve(process.cwd(), "client/src/pages/inventory/InventoryCount.tsx"), "utf8"),
  production: readFileSync(resolve(process.cwd(), "client/src/pages/manufacturing/ProductionOrders.tsx"), "utf8"),
  pos: readFileSync(resolve(process.cwd(), "client/src/pages/pos/PosTerminal.tsx"), "utf8"),
  posSessions: readFileSync(resolve(process.cwd(), "client/src/pages/pos/PosSessions.tsx"), "utf8"),
  purchaseOrders: readFileSync(resolve(process.cwd(), "client/src/pages/purchasing/PurchaseOrders.tsx"), "utf8"),
  backups: readFileSync(resolve(process.cwd(), "client/src/pages/admin/Backups.tsx"), "utf8"),
  documents: readFileSync(resolve(process.cwd(), "client/src/pages/admin/Documents.tsx"), "utf8"),
  compliance: readFileSync(resolve(process.cwd(), "client/src/pages/admin/SaudiCompliance.tsx"), "utf8"),
};

describe("حماية أزرار الإجراءات الذرية", () => {
  it("يوفر مكوّن موحد لإخفاء الإجراء عند غياب إحدى الصلاحيات", () => {
    const component = readFileSync(resolve(process.cwd(), "client/src/components/PermissionAction.tsx"), "utf8");
    expect(component).toContain("trpc.accessControl.myPermissions.useQuery");
    expect(component).toContain("permissions.some");
  });

  it("يحمي الأزرار عالية الأثر في الدورات المالية والتشغيلية", () => {
    const expectedPermissions: Record<keyof typeof sources, string[]> = {
      chartOfAccounts: ["accounting.coa.manage"],
      costCenters: ["accounting.coa.manage"],
      journal: ["accounting.journal.create", "accounting.journal.post"],
      fiscalPeriods: ["accounting.period.reopen", "accounting.period.close"],
      transfers: ["inventory.transfer.create"],
      inventoryCount: ["inventory.count.create"],
      production: ["production.order.create", "production.order.complete"],
      pos: ["pos.order.create"],
      posSessions: ["pos.session.open", "pos.session.close"],
      purchaseOrders: ["purchasing.order.create"],
      backups: ["admin.backups.manage"],
      documents: ["admin.documents.manage"],
      compliance: ["compliance.vat.manage", "compliance.zatca.manage"],
    };

    for (const [page, permissions] of Object.entries(expectedPermissions)) {
      expect(sources[page as keyof typeof sources], `${page} must import PermissionAction`).toContain('import { PermissionAction }');
      for (const permission of permissions) {
        expect(sources[page as keyof typeof sources], `${page} is missing ${permission}`).toContain(`permissions={["${permission}"]}`);
      }
    }
  });
});
