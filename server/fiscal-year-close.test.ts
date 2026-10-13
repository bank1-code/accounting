import { describe, expect, it } from "vitest";
import { buildFiscalYearClosingLines } from "./db";

describe("قيد الإقفال السنوي", () => {
  it("يقفل الإيرادات والمصروفات وينقل صافي الربح إلى الأرباح المحتجزة بقيد متزن", () => {
    const closing = buildFiscalYearClosingLines([{ id: 4, type: "revenue", debit: "0", credit: "300" }, { id: 5, type: "expense", debit: "280", credit: "0" }], 7);
    expect(closing.netIncome).toBe("20.00");
    expect(closing.lines).toEqual([{ accountId: 4, debit: "300.00", credit: "0", description: "Close revenue account" }, { accountId: 5, debit: "0", credit: "280.00", description: "Close expense account" }, { accountId: 7, debit: "0", credit: "20.00", description: "Transfer net income to retained earnings" }]);
  });
});
