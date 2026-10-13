import { afterEach, describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import * as db from "./db";
import type { TrpcContext } from "./_core/context";

function warehouseUserContext(): TrpcContext {
  return {
    user: { id: 778, openId: null, username: "subwarehouse_scope", passwordHash: "hidden", email: null, name: "Subwarehouse Scope", loginMethod: "local", role: "user", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
    req: { protocol: "https", headers: {} } as TrpcContext["req"], res: {} as TrpcContext["res"],
  };
}

function allowOnlySubwarehouse(scope: { warehouseId?: number | null }) {
  return scope.warehouseId === undefined || scope.warehouseId === 11;
}

afterEach(() => vi.restoreAllMocks());

describe("تكامل نطاق المخزن الفرعي في مسارات tRPC", () => {
  it("يسمح بقراءة مخزون الفرعي المطابق ويرفض مخزون الأب", async () => {
    vi.spyOn(db, "hasAtomicPermission").mockImplementation(async (_userId, _code, scope) => allowOnlySubwarehouse(scope));
    vi.spyOn(db, "getStockByWarehouse").mockResolvedValue([]);
    const caller = appRouter.createCaller(warehouseUserContext());
    await expect(caller.stock.byWarehouse({ warehouseId: 11 })).resolves.toEqual([]);
    await expect(caller.stock.byWarehouse({ warehouseId: 10 })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("يسمح بإنشاء وتحويل من الفرعي فقط ولا يستدعي طبقة البيانات للمخزن الأب", async () => {
    vi.spyOn(db, "hasAtomicPermission").mockImplementation(async (_userId, _code, scope) => allowOnlySubwarehouse(scope));
    const createTransfer = vi.spyOn(db, "createTransfer").mockResolvedValue({ id: 701 });
    const caller = appRouter.createCaller(warehouseUserContext());
    await expect(caller.transfers.create({ fromWarehouseId: 11, toWarehouseId: 12, lines: [{ productId: 1, quantity: "1" }] })).resolves.toEqual({ id: 701 });
    await expect(caller.transfers.create({ fromWarehouseId: 10, toWarehouseId: 12, lines: [{ productId: 1, quantity: "1" }] })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(createTransfer).toHaveBeenCalledTimes(1);
  });

  it("يفرض نطاق الفرعي عند اعتماد التحويل والجرد بعد قراءة الوثيقة", async () => {
    vi.spyOn(db, "hasAtomicPermission").mockImplementation(async (_userId, _code, scope) => allowOnlySubwarehouse(scope));
    const getTransfer = vi.spyOn(db, "getTransferById");
    getTransfer.mockResolvedValueOnce({ id: 41, fromWarehouseId: 11, toWarehouseId: 12 } as Awaited<ReturnType<typeof db.getTransferById>>);
    getTransfer.mockResolvedValueOnce({ id: 42, fromWarehouseId: 10, toWarehouseId: 12 } as Awaited<ReturnType<typeof db.getTransferById>>);
    vi.spyOn(db, "approveTransfer").mockResolvedValue(undefined);
    const getCount = vi.spyOn(db, "getInventoryCountById");
    getCount.mockResolvedValueOnce({ id: 51, warehouseId: 11 } as Awaited<ReturnType<typeof db.getInventoryCountById>>);
    getCount.mockResolvedValueOnce({ id: 52, warehouseId: 10 } as Awaited<ReturnType<typeof db.getInventoryCountById>>);
    vi.spyOn(db, "approveInventoryCount").mockResolvedValue(undefined);
    const caller = appRouter.createCaller(warehouseUserContext());
    await expect(caller.transfers.approve({ id: 41 })).resolves.toBeUndefined();
    await expect(caller.transfers.approve({ id: 42 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.inventoryCounts.approve({ id: 51 })).resolves.toBeUndefined();
    await expect(caller.inventoryCounts.approve({ id: 52 })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("يفرض نطاق الفرعي عند إقفال الإنتاج واعتماد الأصناف والحسابات لفاتورة الشراء", async () => {
    vi.spyOn(db, "hasAtomicPermission").mockImplementation(async (_userId, _code, scope) => allowOnlySubwarehouse(scope));
    const production = vi.spyOn(db, "getProductionOrderById");
    production.mockResolvedValueOnce({ id: 61, warehouseId: 11, branchId: null } as Awaited<ReturnType<typeof db.getProductionOrderById>>);
    production.mockResolvedValueOnce({ id: 62, warehouseId: 10, branchId: null } as Awaited<ReturnType<typeof db.getProductionOrderById>>);
    vi.spyOn(db, "completeProductionOrder").mockResolvedValue({ id: 61 } as Awaited<ReturnType<typeof db.completeProductionOrder>>);
    const invoices = vi.spyOn(db, "getPurchaseInvoiceById");
    invoices.mockResolvedValueOnce({ id: 71, warehouseId: 11 } as Awaited<ReturnType<typeof db.getPurchaseInvoiceById>>);
    invoices.mockResolvedValueOnce({ id: 72, warehouseId: 10 } as Awaited<ReturnType<typeof db.getPurchaseInvoiceById>>);
    invoices.mockResolvedValueOnce({ id: 73, warehouseId: 11 } as Awaited<ReturnType<typeof db.getPurchaseInvoiceById>>);
    invoices.mockResolvedValueOnce({ id: 74, warehouseId: 10 } as Awaited<ReturnType<typeof db.getPurchaseInvoiceById>>);
    vi.spyOn(db, "approvePurchaseInvoiceItems").mockResolvedValue({ id: 71, receivedLines: 1 });
    vi.spyOn(db, "approvePurchaseInvoiceAccounts").mockResolvedValue({ id: 73, journalEntryId: 91 } as Awaited<ReturnType<typeof db.approvePurchaseInvoiceAccounts>>);
    const caller = appRouter.createCaller(warehouseUserContext());
    await expect(caller.productionOrders.complete({ id: 61, actualQuantity: "1", wasteQuantity: "0", actualCost: "0" })).resolves.toMatchObject({ id: 61 });
    await expect(caller.productionOrders.complete({ id: 62, actualQuantity: "1", wasteQuantity: "0", actualCost: "0" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.purchaseInvoices.approveItems({ id: 71 })).resolves.toEqual({ id: 71, receivedLines: 1 });
    await expect(caller.purchaseInvoices.approveItems({ id: 72 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.purchaseInvoices.approveAccounts({ id: 73 })).resolves.toMatchObject({ id: 73 });
    await expect(caller.purchaseInvoices.approveAccounts({ id: 74 })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("يتطلب صلاحية مستقلة لمخزن مواد الإنتاج ووجهة المنتج في الإنشاء والإقفال", async () => {
    const createOrder = vi.spyOn(db, "createProductionOrder").mockResolvedValue({ id: 81 });
    vi.spyOn(db, "hasAtomicPermission").mockImplementation(async (_userId, _code, scope) => scope.warehouseId === 11 || scope.warehouseId === 12);
    const caller = appRouter.createCaller(warehouseUserContext());
    await expect(caller.productionOrders.create({ recipeId: 1, productId: 2, warehouseId: 11, sourceWarehouseId: 12, plannedQuantity: "1", lines: [] })).resolves.toEqual({ id: 81 });
    expect(createOrder).toHaveBeenCalledTimes(1);

    vi.mocked(db.hasAtomicPermission).mockImplementation(async (_userId, _code, scope) => scope.warehouseId === 11);
    await expect(caller.productionOrders.create({ recipeId: 1, productId: 2, warehouseId: 11, sourceWarehouseId: 12, plannedQuantity: "1", lines: [] })).rejects.toMatchObject({ code: "FORBIDDEN" });

    const production = vi.spyOn(db, "getProductionOrderById");
    production.mockResolvedValueOnce({ id: 82, warehouseId: 11, sourceWarehouseId: 12, branchId: null } as Awaited<ReturnType<typeof db.getProductionOrderById>>);
    await expect(caller.productionOrders.complete({ id: 82, actualQuantity: "1", wasteQuantity: "0", actualCost: "0" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
