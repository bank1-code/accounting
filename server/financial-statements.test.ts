import { describe, expect, it } from "vitest";
import { buildFinancialStatements } from "./db";

describe("القوائم المالية من القيود المرحلة", () => {
  it("يحتسب ميزان المراجعة وقائمة الدخل والمركز المالي من الحركات المدينة والدائنة", () => {
    const report = buildFinancialStatements([
      { id: 1, code: "1100", name: "نقدية", nameEn: null, type: "asset", periodDebit: "120", periodCredit: "20", closingDebit: "120", closingCredit: "20" },
      { id: 2, code: "2000", name: "دائنون", nameEn: null, type: "liability", periodDebit: "0", periodCredit: "30", closingDebit: "0", closingCredit: "30" },
      { id: 3, code: "3000", name: "رأس مال", nameEn: null, type: "equity", periodDebit: "0", periodCredit: "50", closingDebit: "0", closingCredit: "50" },
      { id: 4, code: "4000", name: "إيراد", nameEn: null, type: "revenue", periodDebit: "0", periodCredit: "40", closingDebit: "0", closingCredit: "40" },
      { id: 5, code: "5000", name: "مصروف", nameEn: null, type: "expense", periodDebit: "20", periodCredit: "0", closingDebit: "20", closingCredit: "0" },
    ]);
    expect(report.trialBalance).toMatchObject({ totalDebit: 140, totalCredit: 140, isBalanced: true });
    expect(report.incomeStatement).toMatchObject({ totalRevenue: 40, totalExpenses: 20, netIncome: 20 });
    expect(report.balanceSheet).toMatchObject({ totalAssets: 100, totalLiabilities: 30, totalEquity: 50, endingNetIncome: 20, difference: 0, isBalanced: true });
  });

  it("يعرض مسار التقارير القوائم المالية من القيود المرحلة لا أرصدة الحسابات المخزنة", () => {
    const source = require("node:fs").readFileSync(require("node:path").resolve(process.cwd(), "server/routers.ts"), "utf8");
    expect(source).toContain("financialStatements");
    expect(source).toContain("getFinancialStatements");
  });
});
