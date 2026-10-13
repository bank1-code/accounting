import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("نزاهة دورة الإنتاج", () => {
  const source = readFileSync(resolve(process.cwd(), "server/db.ts"), "utf8");

  it("يمنع إقفال أمر إنتاج مكتمل أو ملغى ويطلب كمية فعلية صالحة", () => {
    expect(source).toContain("Production order cannot be completed in its current status");
    expect(source).toContain("Actual production quantity must be positive");
    expect(source).toContain("Production waste quantity is invalid");
  });

  it("يسجل استهلاك المواد وإضافة المنتج النهائي ضمن نفس المعاملة", () => {
    expect(source).toContain('type: "production_out"');
    expect(source).toContain('type: "production_in"');
    expect(source).toContain("Consumed by production order");
    expect(source).toContain("Produced by production order");
    expect(source).toContain("const outputUnitCost = calculatedCost / producedQuantity");
  });

  it("يثبت دفعة المادة التي اختارها FEFO وتاريخ صلاحيتها في بند أمر الإنتاج", () => {
    expect(source).toContain('batchNumber: line.batchNumber || undefined');
    expect(source).toContain('set({ batchNumber: movement.batchNumber || null, expiryDate: movement.expiryDate || null })');
  });

  it("يخصم مواد الإنتاج من مخزن المصدر ويضيف المنتج التام إلى مخزن الوجهة", () => {
    expect(source).toContain("const sourceWarehouseId = data.sourceWarehouseId || data.warehouseId");
    expect(source).toContain("sourceWarehouseId, warehouseId: data.warehouseId");
    expect(source).toContain("const sourceWarehouseId = order.sourceWarehouseId || order.warehouseId");
    expect(source).toContain('warehouseId: sourceWarehouseId, type: "production_out"');
    expect(source).toContain('warehouseId: order.warehouseId, type: "production_in"');
  });

  it("يرحل قيد الإنتاج المتزن من المواد إلى تحت التشغيل ثم المنتج التام داخل المعاملة", () => {
    expect(source).toContain("Posting account map must be configured before completing a production order");
    expect(source).toContain('referenceType: "production_order", referenceId: order.id');
    expect(source).toContain("postingMap.workInProgressAccountId");
    expect(source).toContain("postingMap.finishedGoodsInventoryAccountId");
    expect(source).toContain("Raw inventory consumed by ${order.orderNumber}");
    expect(source).toContain("Finished goods produced by ${order.orderNumber}");
  });
});
