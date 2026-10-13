import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { calculateInventoryMovementReport } from "./db";

describe("نزاهة تقرير مخزون الفروع", () => {
  const dataSource = readFileSync(resolve(process.cwd(), "server/db.ts"), "utf8");
  const page = readFileSync(resolve(process.cwd(), "client/src/pages/reports/InventoryReports.tsx"), "utf8");
  const router = readFileSync(resolve(process.cwd(), "server/routers.ts"), "utf8");

  it("يعيد الكمية والكلفة والقيمة بأصفار آمنة مع اسم الصنف والمخزن", () => {
    expect(dataSource).toContain("productName: products.name");
    expect(dataSource).toContain("warehouseName: warehouses.name");
    expect(dataSource).toContain("COALESCE(${stock.quantity}, 0)");
    expect(dataSource).toContain("inventoryValue");
  });

  it("يحسب الافتتاحي والوارد والصادر والختامي حتى عند غياب حركات الفترة", () => {
    const start = new Date("2026-08-01T00:00:00Z");
    const end = new Date("2026-08-31T23:59:59Z");
    const report = calculateInventoryMovementReport([{ productId: 1, warehouseId: 2, quantity: "12", avgCost: "5" }], [
      { productId: 1, warehouseId: 2, type: "purchase", quantity: "10", createdAt: new Date("2026-07-25T00:00:00Z") },
      { productId: 1, warehouseId: 2, type: "purchase", quantity: "4", createdAt: new Date("2026-08-05T00:00:00Z") },
      { productId: 1, warehouseId: 2, type: "sale", quantity: "2", createdAt: new Date("2026-08-10T00:00:00Z") },
    ], start, end);
    expect(report[0]).toMatchObject({ openingQuantity: "10.0000", inboundQuantity: "4.0000", outboundQuantity: "2.0000", closingQuantity: "12.0000", inventoryValue: "60.00" });
    const empty = calculateInventoryMovementReport([{ productId: 2, warehouseId: 2, quantity: "0", avgCost: "0" }], [], start, end);
    expect(empty[0]).toMatchObject({ openingQuantity: "0.0000", inboundQuantity: "0.0000", outboundQuantity: "0.0000", closingQuantity: "0.0000", inventoryValue: "0.00" });
  });

  it("يربط فترة الواجهة بالراوتر والحساب دون انزياح زمني UTC", () => {
    expect(page).toContain("formatLocalDate");
    expect(page).not.toContain("toISOString().slice(0, 10)");
    expect(page).toContain("trpc.reports.inventory.useQuery(period)");
    expect(router).toContain('inventory: atomicPermissionProcedure("inventory.view").input(z.object({ startDate: z.date().optional(), endDate: z.date().optional() }).optional())');
  });

  it("يغير الأرصدة فعلياً عند تغيير حدود الفترة للحركات نفسها", () => {
    const balances = [{ productId: 1, warehouseId: 2, quantity: "12", avgCost: "5" }];
    const movements = [
      { productId: 1, warehouseId: 2, type: "purchase" as const, quantity: "10", createdAt: new Date("2026-07-25T00:00:00Z") },
      { productId: 1, warehouseId: 2, type: "purchase" as const, quantity: "4", createdAt: new Date("2026-08-05T00:00:00Z") },
      { productId: 1, warehouseId: 2, type: "sale" as const, quantity: "2", createdAt: new Date("2026-08-10T00:00:00Z") },
    ];
    const august = calculateInventoryMovementReport(balances, movements, new Date("2026-08-01T00:00:00Z"), new Date("2026-08-31T23:59:59Z"))[0];
    const lateAugust = calculateInventoryMovementReport(balances, movements, new Date("2026-08-06T00:00:00Z"), new Date("2026-08-31T23:59:59Z"))[0];
    expect(august).toMatchObject({ openingQuantity: "10.0000", inboundQuantity: "4.0000", outboundQuantity: "2.0000", closingQuantity: "12.0000" });
    expect(lateAugust).toMatchObject({ openingQuantity: "14.0000", inboundQuantity: "0.0000", outboundQuantity: "2.0000", closingQuantity: "12.0000" });
  });

  it("لا يعرض الواجهة قيمة غير صالحة أو يعيد حساب الكلفة من بيانات ناقصة", () => {
    expect(page).toContain("const safeNumber");
    expect(page).toContain("safeNumber(r.inventoryValue)");
    expect(page).toContain("safeNumber(r.openingQuantity)");
    expect(page).toContain("safeNumber(r.inboundQuantity)");
    expect(page).toContain("safeNumber(r.outboundQuantity)");
    expect(page).toContain("t.inv.openingBalance");
    expect(page).toContain("t.inv.periodMovements");
  });
});
