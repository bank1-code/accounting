import * as db from "../server/db.ts";

const report = await db.getFinancialStatements(new Date("2026-01-01T00:00:00.000Z"), new Date("2026-12-31T23:59:59.000Z"));
const summary = {
  trialBalance: { totalDebit: report.trialBalance.totalDebit, totalCredit: report.trialBalance.totalCredit, difference: report.trialBalance.difference, isBalanced: report.trialBalance.isBalanced },
  incomeStatement: { totalRevenue: report.incomeStatement.totalRevenue, totalExpenses: report.incomeStatement.totalExpenses, netIncome: report.incomeStatement.netIncome },
  balanceSheet: { totalAssets: report.balanceSheet.totalAssets, totalLiabilities: report.balanceSheet.totalLiabilities, totalEquity: report.balanceSheet.totalEquity, endingNetIncome: report.balanceSheet.endingNetIncome, difference: report.balanceSheet.difference, isBalanced: report.balanceSheet.isBalanced },
};
if (!report.trialBalance.isBalanced) throw new Error(`UAT trial balance is not balanced: ${report.trialBalance.difference}`);
if (!report.balanceSheet.isBalanced) throw new Error(`UAT balance sheet is not balanced: ${report.balanceSheet.difference}`);
console.log(JSON.stringify(summary, null, 2));
process.exit(0);
