import { afterEach, describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import * as db from "./db";
import type { TrpcContext } from "./_core/context";

function reportContext(): TrpcContext {
  return {
    user: { id: 901, openId: null, username: "inventory_report_tester", passwordHash: "hidden", email: null, name: "Inventory Reporter", loginMethod: "local", role: "user", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

afterEach(() => {
  db.setInventoryReportPortForTesting(undefined);
  vi.restoreAllMocks();
});

describe("تكامل فترة تقرير المخزون", () => {
  it("ينفذ getInventoryReport نفسه بحساب الفترة الحقيقي دون نتيجة موهّمة", async () => {
    const balances = [{ productId: 1, warehouseId: 2, quantity: "12", avgCost: "5" }];
    const movements = [
      { productId: 1, warehouseId: 2, type: "purchase" as const, quantity: "10", createdAt: new Date("2026-07-25T00:00:00Z") },
      { productId: 1, warehouseId: 2, type: "purchase" as const, quantity: "4", createdAt: new Date("2026-08-05T00:00:00Z") },
      { productId: 1, warehouseId: 2, type: "sale" as const, quantity: "2", createdAt: new Date("2026-08-10T00:00:00Z") },
    ];
    const port = { listBalances: async () => balances, listMovementsThrough: async () => movements };
    const end = new Date("2026-08-31T23:59:59Z");
    const first = await db.getInventoryReport({ startDate: new Date("2026-08-01T00:00:00Z"), endDate: end }, port);
    const second = await db.getInventoryReport({ startDate: new Date("2026-08-06T00:00:00Z"), endDate: end }, port);
    expect(first[0]).toMatchObject({ openingQuantity: "10.0000", inboundQuantity: "4.0000", outboundQuantity: "2.0000", closingQuantity: "12.0000" });
    expect(second[0]).toMatchObject({ openingQuantity: "14.0000", inboundQuantity: "0.0000", outboundQuantity: "2.0000", closingQuantity: "12.0000" });
  });

  it("ينفذ reports.inventory عبر tRPC بالحساب الفعلي لفترتين مختلفتين دون محاكاة نتيجة التقرير", async () => {
    vi.spyOn(db, "hasAtomicPermission").mockResolvedValue(true);
    const balances = [{ productId: 1, warehouseId: 2, quantity: "12", avgCost: "5" }];
    const movements = [
      { productId: 1, warehouseId: 2, type: "purchase" as const, quantity: "10", createdAt: new Date("2026-07-25T00:00:00Z") },
      { productId: 1, warehouseId: 2, type: "purchase" as const, quantity: "4", createdAt: new Date("2026-08-05T00:00:00Z") },
      { productId: 1, warehouseId: 2, type: "sale" as const, quantity: "2", createdAt: new Date("2026-08-10T00:00:00Z") },
    ];
    db.setInventoryReportPortForTesting({ listBalances: async () => balances, listMovementsThrough: async () => movements });
    const caller = appRouter.createCaller(reportContext());
    const endDate = new Date("2026-08-31T23:59:59Z");
    const first = await caller.reports.inventory({ startDate: new Date("2026-08-01T00:00:00Z"), endDate });
    const second = await caller.reports.inventory({ startDate: new Date("2026-08-06T00:00:00Z"), endDate });
    expect(first[0]).toMatchObject({ openingQuantity: "10.0000", inboundQuantity: "4.0000", outboundQuantity: "2.0000", closingQuantity: "12.0000" });
    expect(second[0]).toMatchObject({ openingQuantity: "14.0000", inboundQuantity: "0.0000", outboundQuantity: "2.0000", closingQuantity: "12.0000" });
  });

  it("يمرر startDate/endDate إلى التقرير ويعيد نتيجة مختلفة عند تغيير الفترة", async () => {
    vi.spyOn(db, "hasAtomicPermission").mockResolvedValue(true);
    const getReport = vi.spyOn(db, "getInventoryReport").mockImplementation(async (period) => [{
      productId: 1, warehouseId: 2,
      openingQuantity: period?.startDate?.getUTCDate() === 1 ? "10.0000" : "14.0000",
      inboundQuantity: period?.startDate?.getUTCDate() === 1 ? "4.0000" : "0.0000",
      outboundQuantity: "2.0000", closingQuantity: "12.0000", avgCost: "5.0000", inventoryValue: "60.00",
    }] as Awaited<ReturnType<typeof db.getInventoryReport>>);
    const caller = appRouter.createCaller(reportContext());
    const startOfMonth = new Date("2026-08-01T00:00:00Z");
    const laterStart = new Date("2026-08-06T00:00:00Z");
    const end = new Date("2026-08-31T23:59:59Z");

    const first = await caller.reports.inventory({ startDate: startOfMonth, endDate: end });
    const second = await caller.reports.inventory({ startDate: laterStart, endDate: end });

    expect(first[0].openingQuantity).toBe("10.0000");
    expect(second[0].openingQuantity).toBe("14.0000");
    expect(getReport).toHaveBeenNthCalledWith(1, { startDate: startOfMonth, endDate: end });
    expect(getReport).toHaveBeenNthCalledWith(2, { startDate: laterStart, endDate: end });
  });
});
