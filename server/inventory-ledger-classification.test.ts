import { describe, expect, it } from "vitest";
import { getInventoryPostingAccountId, type PosPostingAccountMap } from "./db";

const map: PosPostingAccountMap = { cashAccountId: 1, cardClearingAccountId: 2, salesRevenueAccountId: 3, outputVatAccountId: 4, inputVatAccountId: 5, inventoryAccountId: 6, workInProgressAccountId: 7, finishedGoodsInventoryAccountId: 8, inventoryGainAccountId: 9, inventoryLossAccountId: 10, wasteExpenseAccountId: 11, cogsAccountId: 12, accountsPayableAccountId: 13 };

describe("تصنيف حسابات المخزون", () => {
  it("يوجه المنتج التام والبيع المباشر إلى مخزون المنتجات التامة، والمواد إلى مخزون المواد", () => {
    expect(getInventoryPostingAccountId(map, "finished")).toBe(8);
    expect(getInventoryPostingAccountId(map, "direct_sale")).toBe(8);
    expect(getInventoryPostingAccountId(map, "raw_material")).toBe(6);
    expect(getInventoryPostingAccountId(map, "semi_finished")).toBe(6);
  });
});
