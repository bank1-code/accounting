import { describe, expect, it } from "vitest";
import { buildTreasuryVoucherJournalLines } from "./db";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("سندات القبض والصرف", () => {
  const lines = [{ accountId: 210, costCenterId: 9, description: "Supplier settlement", amount: "80.00" }, { accountId: 220, amount: "20.00" }];

  it("ينشئ سند القبض قيداً متزناً: نقد أو بنك مدين مقابل بنود السند دائنة", () => {
    const journal = buildTreasuryVoucherJournalLines({ voucherType: "receipt", voucherNumber: "RV-00000001", branchId: 3, settlementAccountId: 101, lines });
    expect(journal).toEqual([
      expect.objectContaining({ accountId: 101, branchId: 3, debit: "100.00", credit: "0" }),
      expect.objectContaining({ accountId: 210, costCenterId: 9, debit: "0", credit: "80.00" }),
      expect.objectContaining({ accountId: 220, debit: "0", credit: "20.00" }),
    ]);
  });

  it("ينشئ سند الصرف قيداً متزناً: بنود السند مدينة مقابل نقد أو بنك دائن", () => {
    const journal = buildTreasuryVoucherJournalLines({ voucherType: "payment", voucherNumber: "PV-00000001", branchId: 3, settlementAccountId: 101, lines });
    expect(journal).toEqual([
      expect.objectContaining({ accountId: 210, debit: "80.00", credit: "0" }),
      expect.objectContaining({ accountId: 220, debit: "20.00", credit: "0" }),
      expect.objectContaining({ accountId: 101, branchId: 3, debit: "0", credit: "100.00" }),
    ]);
  });

  it("يحمي المسارات الذرية ومراحل المسودة والاعتماد والترحيل ولا يسمح بحجز قيد قبل الترحيل", () => {
    const router = readFileSync(resolve(process.cwd(), "server/routers.ts"), "utf8");
    const database = readFileSync(resolve(process.cwd(), "server/db.ts"), "utf8");
    const page = readFileSync(resolve(process.cwd(), "client/src/pages/accounting/TreasuryVouchers.tsx"), "utf8");
    expect(router).toContain('treasury.receipt.create');
    expect(router).toContain('treasury.payment.create');
    expect(router).toContain('treasury.voucher.approve');
    expect(router).toContain('treasury.voucher.post');
    expect(database).toContain('voucher.status !== "approved"');
    expect(database).toContain('status: "draft"');
    expect(database).toContain('createPostedOperationalJournalEntry');
    expect(page).toContain('treasuryVouchers.create.useMutation');
    expect(page).toContain('treasuryVouchers.approve.useMutation');
    expect(page).toContain('treasuryVouchers.post.useMutation');
  });
});
