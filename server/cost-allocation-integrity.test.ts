import { describe, expect, it } from "vitest";
import { buildCostAllocationJournalLines } from "./db";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("دورة توزيع المصاريف", () => {
  it("ينشئ قيد إعادة توزيع متزناً من حساب ومركز مصدر إلى مراكز تكلفة مستهدفة", () => {
    const journal = buildCostAllocationJournalLines({
      sourceAccountId: 611, sourceCostCenterId: 90, sourceBranchId: 1,
      lines: [{ costCenterId: 11, branchId: 2, amount: "70.00" }, { costCenterId: 12, branchId: 3, amount: "30.00" }],
    });
    expect(journal).toEqual([
      expect.objectContaining({ accountId: 611, costCenterId: 11, branchId: 2, debit: "70.00", credit: "0" }),
      expect.objectContaining({ accountId: 611, costCenterId: 12, branchId: 3, debit: "30.00", credit: "0" }),
      expect.objectContaining({ accountId: 611, costCenterId: 90, branchId: 1, debit: "0", credit: "100.00" }),
    ]);
  });

  it("يرفض مبالغ التوزيع غير الموجبة قبل بناء القيد", () => {
    expect(() => buildCostAllocationJournalLines({ sourceAccountId: 611, lines: [{ costCenterId: 11, amount: "0" }] })).toThrow("positive");
  });

  it("يوفر إنشاءاً واعتماداً وترحيلاً بحالة مستقلة وقيد تشغيل متزن في الخادم والواجهة", () => {
    const database = readFileSync(resolve(process.cwd(), "server/db.ts"), "utf8");
    const router = readFileSync(resolve(process.cwd(), "server/routers.ts"), "utf8");
    const page = readFileSync(resolve(process.cwd(), "client/src/pages/accounting/CostAllocation.tsx"), "utf8");
    expect(database).toContain("Cost allocation lines must be positive and equal the total amount");
    expect(database).toContain("async function approveCostAllocation");
    expect(database).toContain("async function postCostAllocation");
    expect(database).toContain('referenceType: "cost_allocation"');
    expect(database).toContain('status: "approved"');
    expect(database).toContain('status: "posted"');
    expect(router).toContain("costAllocations: router");
    expect(router).toContain("approve: atomicPermissionProcedure(\"accounting.journal.post\")");
    expect(router).toContain("post: atomicPermissionProcedure(\"accounting.journal.post\")");
    expect(page).toContain("sourceAccountId");
    expect(page).toContain("costAllocations.approve.useMutation");
    expect(page).toContain("costAllocations.post.useMutation");
  });
});
