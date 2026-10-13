import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import * as db from "./db";

describe("تحصين المحرك المالي", () => {
  const date = new Date("2026-08-14T00:00:00.000Z");

  it("يرفض خريطة قيود تشغيلية تستخدم نوع حساب غير صحيح", () => {
    const map = { cashAccountId: 1, cardClearingAccountId: 2, salesRevenueAccountId: 3, outputVatAccountId: 4, inputVatAccountId: 5, inventoryAccountId: 6, workInProgressAccountId: 7, finishedGoodsInventoryAccountId: 8, inventoryGainAccountId: 9, inventoryLossAccountId: 10, wasteExpenseAccountId: 11, cogsAccountId: 12, accountsPayableAccountId: 13 };
    const correctRows = [
      { id: 1, type: "asset", isActive: true }, { id: 2, type: "asset", isActive: true }, { id: 3, type: "revenue", isActive: true }, { id: 4, type: "liability", isActive: true }, { id: 5, type: "asset", isActive: true }, { id: 6, type: "asset", isActive: true }, { id: 7, type: "asset", isActive: true }, { id: 8, type: "asset", isActive: true }, { id: 9, type: "revenue", isActive: true }, { id: 10, type: "expense", isActive: true }, { id: 11, type: "expense", isActive: true }, { id: 12, type: "expense", isActive: true }, { id: 13, type: "liability", isActive: true },
    ];
    expect(() => db.validatePostingAccountMapTypes(map, correctRows)).not.toThrow();
    expect(() => db.validatePostingAccountMapTypes(map, correctRows.map((row) => row.id === 4 ? { ...row, type: "asset" } : row))).toThrow("outputVatAccountId");
  });

  it("يرفض القيد أحادي البند قبل أي كتابة في قاعدة البيانات", async () => {
    await expect(db.createJournalEntry({
      entryNumber: "TEST-ONE-LINE", date, lines: [{ accountId: 1, debit: "10.00", credit: "0" }],
    })).rejects.toThrow("at least two lines");
  });

  it("يرفض القيد غير المتزن والأرقام غير السليمة", async () => {
    await expect(db.createJournalEntry({
      entryNumber: "TEST-UNBALANCED", date,
      lines: [{ accountId: 1, debit: "10.00", credit: "0" }, { accountId: 2, debit: "0", credit: "9.99" }],
    })).rejects.toThrow("not balanced");
    await expect(db.createJournalEntry({
      entryNumber: "TEST-INVALID", date,
      lines: [{ accountId: 1, debit: "-10", credit: "0" }, { accountId: 2, debit: "0", credit: "10" }],
    })).rejects.toThrow("Invalid debit");
  });

  it("يرفض فترة مالية ذات تاريخ بداية بعد تاريخ النهاية", async () => {
    await expect(db.createFiscalPeriod({ name: "فترة غير صالحة", startDate: new Date("2026-12-31"), endDate: new Date("2026-01-01") }))
      .rejects.toThrow("start date");
  });

  it("يحتوي المحرك على ضمانات المعاملة وفحص الفترة والإقفال المتزامن", () => {
    const source = readFileSync(resolve(process.cwd(), "server/db.ts"), "utf8");
    expect(source).toContain("db.transaction(async (tx)");
    expect(source).toContain("assertFiscalPeriodOpen(tx");
    expect(source).toContain("eq(journalEntries.status, \"draft\")");
    expect(source).toContain("fiscalPeriodReopenLogs");
    expect(source).toContain("FOR UPDATE");
    expect(source).toContain("Fiscal period cannot be closed while draft journal entries remain");
    expect(source).toContain("Fiscal period cannot be closed while pending treasury vouchers remain");
    expect(source).toContain("Fiscal period cannot be closed while pending cost allocations remain");
    expect(source).toContain("FROM cost_allocations WHERE status IN ('draft', 'approved')");
    expect(source).toContain("status IN ('draft', 'approved')");
    expect(source).toContain("async function reserveDocumentSequence");
    expect(source).toContain('reserveDocumentSequence(tx, "journal_entry")');
    expect(source).toContain('reserveDocumentSequence(tx, "pos_order")');
    expect(source).toContain('reserveDocumentSequence(tx, "pos_refund")');
    expect(source).toContain('reserveDocumentSequence(tx, "inventory_transfer")');
    expect(source).toContain('reserveDocumentSequence(tx, "inventory_count")');
    expect(source).toContain('reserveDocumentSequence(tx, "production_order")');
    expect(source).toContain('reserveDocumentSequence(tx, "purchase_order")');
  });
});
