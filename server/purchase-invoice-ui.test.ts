import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const read = (path: string) => readFileSync(resolve(root, path), "utf8");

describe("واجهة فواتير الشراء والدفعات", () => {
  const page = read("client/src/pages/purchasing/PurchaseInvoices.tsx");
  const app = read("client/src/App.tsx");
  const layout = read("client/src/components/DashboardLayout.tsx");
  const ar = read("client/src/lib/i18n/ar.ts");
  const en = read("client/src/lib/i18n/en.ts");

  it("ينشئ فاتورة شراء عبر العقد الفعلي ويحمل حقلي الدفعة والصلاحية", () => {
    expect(page).toContain("trpc.purchaseInvoices.create.useMutation");
    expect(page).toContain("batchNumber: line.batchNumber || undefined");
    expect(page).toContain("expiryDate: line.expiryDate ? asUtcDate(line.expiryDate) : undefined");
    expect(page).toContain("trpc.purchaseInvoices.approveItems.useMutation");
    expect(page).toContain("trpc.purchaseInvoices.approveAccounts.useMutation");
    expect(page).toContain('invoice.status === "accounts_approved"');
  });

  it("يسجل مسار الفاتورة في التطبيق والتنقل بحراس المشتريات", () => {
    expect(app).toContain('path="/purchasing/purchase-invoices"');
    expect(app).toContain("purchasing.invoice.items_approve");
    expect(layout).toContain('path: "/purchasing/purchase-invoices"');
  });

  it("يوفر مفاتيح عربية وإنجليزية لتسميات الفاتورة والدفعة", () => {
    for (const content of [ar, en]) {
      expect(content).toContain("purchaseInvoices:");
      expect(content).toContain("batchNumber:");
      expect(content).toContain("expiryDate:");
      expect(content).toContain("approveItems:");
      expect(content).toContain("approveAccounts:");
    }
  });
});
