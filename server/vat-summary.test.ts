import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { calculateVatLedgerReconciliation, calculateVatSummaryFromDocuments } from "./db";

const dbSource = readFileSync(resolve(process.cwd(), "server/db.ts"), "utf8");
const routerSource = readFileSync(resolve(process.cwd(), "server/routers.ts"), "utf8");
const compliancePage = readFileSync(resolve(process.cwd(), "client/src/pages/admin/SaudiCompliance.tsx"), "utf8");

describe("ملخص ضريبة القيمة المضافة", () => {
  it("يفصل ضريبة المخرجات للفواتير الصادرة عن ضريبة المدخلات لفواتير الشراء المعتمدة", () => {
    expect(dbSource).toContain("export async function getVatSummary");
    expect(dbSource).toContain('eq(salesInvoices.status, "issued")');
    expect(dbSource).toContain('eq(purchaseInvoices.status, "accounts_approved")');
    expect(dbSource).toContain("netVatPayable");
  });

  it("يطابق ضريبة المستندات مع حسابي VAT في القيود المرحلة دون إخفاء الفروقات", () => {
    expect(dbSource).toContain("export async function getVatLedgerReconciliation");
    expect(dbSource).toContain('eq(journalEntries.status, "posted")');
    expect(dbSource).toContain("outputTaxLedger");
    expect(dbSource).toContain("inputTaxLedger");
    expect(dbSource).toContain("refundOutputTax");
    expect(dbSource).toContain("configured: false as const");
  });

  it("يحمي تقرير الضريبة بصلاحية امتثال قائمة ويعرض نتيجة المطابقة في الواجهة", () => {
    expect(routerSource).toContain('vatSummary: atomicPermissionProcedure("compliance.vat.manage")');
    expect(routerSource).toContain('vatReconciliation: atomicPermissionProcedure("compliance.vat.manage")');
    expect(compliancePage).toContain("مطابقة ضريبة القيمة المضافة مع دفتر الأستاذ");
    expect(compliancePage).toContain("trpc.reports.vatReconciliation.useQuery");
  });

  it("يربط مستندات البيع والشراء والمرتجع بأرصدة حسابي VAT ويظهر التطابق أو الفرق بدقة", () => {
    const summary = calculateVatSummaryFromDocuments(new Date("2026-08-01"), new Date("2026-08-31"), [{ subtotal: "100.00", tax: "15.00" }], [{ subtotal: "57.50", tax: "7.50" }]);
    expect(summary).toMatchObject({ outputTax: "15.00", inputTax: "7.50", netVatPayable: "7.50" });
    expect(calculateVatLedgerReconciliation(summary, { refundOutputTax: "3.00", outputVatAccountId: 21, inputVatAccountId: 22, ledgerLines: [{ accountId: 21, debit: "3.00", credit: "15.00" }, { accountId: 22, debit: "7.50", credit: "0" }] })).toMatchObject({ documentOutputTax: "12.00", outputTaxLedger: "12.00", inputTaxLedger: "7.50", netDocumentVat: "4.50", netLedgerVat: "4.50", matched: true });
  });
});
