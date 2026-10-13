import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import * as db from "./db";

const routerSource = readFileSync(resolve(process.cwd(), "server/routers.ts"), "utf8");
const terminalSource = readFileSync(resolve(process.cwd(), "client/src/pages/pos/PosTerminal.tsx"), "utf8");
const settingsSource = readFileSync(resolve(process.cwd(), "client/src/pages/admin/Settings.tsx"), "utf8");
const dbSource = readFileSync(resolve(process.cwd(), "server/db.ts"), "utf8");

describe("ضوابط نقاط البيع", () => {
  it("يرفض فتح جلسة برصيد افتتاحي غير صالح", async () => {
    await expect(db.openPosSession({ branchId: 1, cashierId: 1, openingBalance: "-1" }))
      .rejects.toThrow("Invalid opening balance");
  });

  it("يرفض الطلب الفارغ والخصم الذي يتجاوز إجمالي الطلب", async () => {
    await expect(db.createOrder({ orderNumber: "POS-EMPTY", branchId: 1, warehouseId: 1, lines: [] }))
      .rejects.toThrow("at least one line");
    await expect(db.createOrder({
      orderNumber: "POS-DISCOUNT", branchId: 1, warehouseId: 1, discountAmount: "100",
      lines: [{ productId: 1, quantity: "1", unitPrice: "10" }],
    })).rejects.toThrow("Discount cannot exceed");
  });

  it("يلزم مخزن تحصيل صريح ولا يقبل قيمة مفقودة أو غير صالحة", () => {
    expect(db.requirePosWarehouseId(8)).toBe(8);
    expect(() => db.requirePosWarehouseId(undefined)).toThrow("explicit warehouse");
    expect(() => db.requirePosWarehouseId(0)).toThrow("explicit warehouse");
    expect(() => db.requirePosWarehouseId(1.5)).toThrow("explicit warehouse");
    expect(db.assertPosWarehouseForBranch({ branchId: 4, warehouseId: 7, warehouse: { id: 7, branchId: 4, isActive: true } })).toMatchObject({ id: 7 });
    expect(() => db.assertPosWarehouseForBranch({ branchId: 4, warehouseId: 7, warehouse: { id: 7, branchId: 5, isActive: true } })).toThrow("not active for this branch");
  });

  it("يرفض createOrder الحقيقي مخزن تحصيل غير نشط أو غير تابع للفرع قبل أي كتابة", async () => {
    await expect(db.createOrder({
      orderNumber: "POS-NONEXISTENT-WAREHOUSE", branchId: 998_001, warehouseId: 998_002,
      lines: [{ productId: 1, quantity: "1", unitPrice: "1" }],
    })).rejects.toThrow("Selected POS warehouse is not active for this branch");
  });

  it("يختار FEFO الدفعة الأقرب صلاحية بكسر تعادل ثابت", () => {
    const pickFefoBatch = (db as typeof db & { pickFefoBatch: Function }).pickFefoBatch;
    expect(pickFefoBatch([
      { id: 9, batchNumber: "LATE", quantity: "2", expiryDate: new Date("2027-03-01") },
      { id: 7, batchNumber: "EARLY-B", quantity: "1", expiryDate: new Date("2027-02-01") },
      { id: 6, batchNumber: "EARLY-A", quantity: "1", expiryDate: new Date("2027-02-01") },
      { id: 1, batchNumber: "EMPTY", quantity: "0", expiryDate: new Date("2027-01-01") },
    ])).toMatchObject({ id: 6, batchNumber: "EARLY-A" });
  });

  it("يثبت دورة كمية الدفعة من الاستلام إلى الاستهلاك الجزئي والكلي دون رصيد سالب", () => {
    const calculateBatchBalanceNext = (db as typeof db & { calculateBatchBalanceNext: Function }).calculateBatchBalanceNext;
    const received = calculateBatchBalanceNext(0, 10, "incoming");
    const partiallyConsumed = calculateBatchBalanceNext(received, 4, "outgoing");
    const depleted = calculateBatchBalanceNext(partiallyConsumed, 6, "outgoing");
    expect([received, partiallyConsumed, depleted]).toEqual([10, 6, 0]);
    expect(() => calculateBatchBalanceNext(depleted, 1, "outgoing")).toThrow("Insufficient stock in batch");
  });

  it("يحسب ضريبة كل بند من معدل الصنف ويوزع الخصم بأمان حتى عند إجمالي صفري", () => {
    const products = new Map([
      [10, { taxRate: "15", taxCodeId: 7 }],
      [11, { taxRate: "0", taxCodeId: 8 }],
    ]);
    const calculated = db.calculatePosLineTaxes([
      { productId: 10, total: 10_000 },
      { productId: 11, total: 5_000 },
    ], products, 1_500);
    expect(calculated).toEqual([
      expect.objectContaining({ productId: 10, taxCodeId: 7, taxRate: 15, discountAmount: 1_000, taxAmount: 1_350 }),
      expect.objectContaining({ productId: 11, taxCodeId: 8, taxRate: 0, discountAmount: 500, taxAmount: 0 }),
    ]);

    const freeLines = db.calculatePosLineTaxes([
      { productId: 10, total: 0 },
      { productId: 11, total: 0 },
    ], products, 0);
    expect(freeLines.every((line) => Number.isFinite(line.taxAmount) && line.taxAmount === 0 && line.discountAmount === 0)).toBe(true);
  });

  it("يحتوي منطق الجلسة والطلب على تسوية نقدية ومعاملة وحالة مشروطة", () => {
    const source = readFileSync(resolve(process.cwd(), "server/db.ts"), "utf8");
    expect(source).toContain("Cashier already has an open POS session");
    expect(source).toContain("expectedCash");
    expect(source).toContain("cashVariance");
    expect(source).toContain('eq(orders.status, "paid")');
    expect(source).toContain('eq(orderPayments.paymentMethod, "cash")');
    expect(source).toContain("innerJoin(orders, eq(orderPayments.orderId, orders.id))");
    expect(source).toContain("POS session is not open for this cashier and branch");
    expect(source).toContain("Invalid order status transition");
    expect(source).toContain("POS posting account map must be configured before posting a paid order");
    expect(source).toContain('referenceType: "pos_order", referenceId: order.id');
    expect(source).toContain("createPostedOperationalJournalEntry(tx");
    expect(source).toContain("Mixed-payment order requires documented payment allocations");
    expect(source).toContain("await tx.insert(orderPayments).values(paymentAllocations.map");
    expect(source).toContain("POS payment allocations do not equal the order total");
    expect(source).toContain("taxRate: products.taxRate, taxCodeId: products.taxCodeId");
    expect(source).toContain("Product ${line.productId} has an invalid tax rate");
    expect(source).toContain("taxCodeId: line.taxCodeId, taxRate: line.taxRate.toFixed(2), taxAmount: (line.taxAmount / 100).toFixed(2)");
  });

  it("يربط زر التحصيل بجلسة الكاشير المفتوحة ومسار دفع مقيد بالفرع", () => {
    expect(terminalSource).toContain("trpc.posSessions.list.useQuery({ branchId }");
    expect(terminalSource).toContain("يلزم فتح جلسة كاشير نشطة للفرع المحدد قبل التحصيل");
    expect(terminalSource).toContain("sessionId: openSession.id");
    expect(terminalSource).toContain("trpc.orders.pay.useMutation");
    expect(terminalSource).toContain("توزيع التحصيل المختلط");
    expect(terminalSource).toContain("payments: paymentMethod === \"mixed\"");
    expect(terminalSource).toContain("taxRate: parseFloat(product.taxRate || \"0\")");
    expect(terminalSource).toContain("line.item.taxRate / 100");
    expect(routerSource).toContain('pay: atomicPermissionProcedure("pos.order.create"');
    expect(dbSource).toContain("export async function payPosOrder(id: number, branchId: number, postedBy: number)");
    expect(dbSource).toContain("Original payment allocations do not equal the approved refund amount");
  });

  it("يثبت مخزن التحصيل ورقم الدفعة في الطلب ويستعملهما في البيع والاسترداد", () => {
    expect(routerSource).toContain("warehouseId: z.number(),");
    expect(routerSource).toContain("batchNumber: z.string().max(64).optional()");
    expect(dbSource).toContain("Selected POS warehouse is not active for this branch");
    expect(dbSource).toContain("warehouseId: selectedWarehouse.id");
    expect(dbSource).toContain("batchNumber: line.batchNumber || undefined");
    expect(terminalSource).toContain("trpc.stock.availableBatches.useQuery");
    expect(terminalSource).toContain("warehouseId, sessionId: openSession.id");
    expect(terminalSource).toContain("batchNumber: c.batchNumber");
  });

  it("ينبه عن فرق النقد عند تجاوز الحد المضبوط ولا ينبه عندما يكون الحد معطلاً", () => {
    expect(db.shouldCreateCashVarianceAlert(5_000, 2_500)).toBe(true);
    expect(db.shouldCreateCashVarianceAlert(-5_000, 2_500)).toBe(true);
    expect(db.shouldCreateCashVarianceAlert(2_499, 2_500)).toBe(false);
    expect(db.shouldCreateCashVarianceAlert(5_000, 0)).toBe(false);
    expect(dbSource).toContain('type: "pos_cash_variance"');
    expect(dbSource).toContain("POS_CASH_VARIANCE_ALERT_THRESHOLD_KEY");
    expect(routerSource).toContain("savePosCashVarianceAlertThreshold");
    expect(settingsSource).toContain("posCashVarianceAlertThreshold");
  });

  it("ينبه عن قرب انتهاء الدفعة ضمن الحد المضبوط ويعرض إعدادها المحمي", () => {
    const today = new Date("2026-08-20T12:00:00Z");
    expect(db.shouldCreateExpiryAlert(new Date("2026-08-25T00:00:00Z"), 5, today)).toBe(true);
    expect(db.shouldCreateExpiryAlert(new Date("2026-08-26T00:00:00Z"), 5, today)).toBe(false);
    expect(db.shouldCreateExpiryAlert(new Date("2026-08-20T00:00:00Z"), 1, today)).toBe(true);
    expect(db.shouldCreateExpiryAlert(new Date("invalid"), 30, today)).toBe(false);
    expect(db.shouldScanInventoryBatch({ quantity: "4.0000", expiryDate: new Date("2026-08-25T00:00:00Z"), thresholdDays: 5, referenceDate: today })).toBe(true);
    expect(db.shouldScanInventoryBatch({ quantity: "0.0000", expiryDate: new Date("2026-08-25T00:00:00Z"), thresholdDays: 5, referenceDate: today })).toBe(false);
    expect(db.shouldScanInventoryBatch({ quantity: "4.0000", expiryDate: new Date("2026-09-01T00:00:00Z"), thresholdDays: 5, referenceDate: today })).toBe(false);
    expect(db.shouldCreateExpiryNotification(false)).toBe(true);
    expect(db.shouldCreateExpiryNotification(true)).toBe(false);
    expect(db.evaluateInventoryExpiryBatch({
      quantity: "4.0000", expiryDate: new Date("2026-08-25T00:00:00Z"), thresholdDays: 5,
      hasExistingNotification: false, referenceDate: today,
    })).toEqual({ scanned: true, shouldCreateNotification: true });
    expect(db.evaluateInventoryExpiryBatch({
      quantity: "4.0000", expiryDate: new Date("2026-08-25T00:00:00Z"), thresholdDays: 5,
      hasExistingNotification: true, referenceDate: today,
    })).toEqual({ scanned: true, shouldCreateNotification: false });
    expect(db.evaluateInventoryExpiryBatch({
      quantity: "0.0000", expiryDate: new Date("2026-08-25T00:00:00Z"), thresholdDays: 5,
      hasExistingNotification: false, referenceDate: today,
    })).toEqual({ scanned: false, shouldCreateNotification: false });
    expect(dbSource).toContain('type: "inventory_expiry"');
    expect(dbSource).toContain("INVENTORY_EXPIRY_ALERT_DAYS_KEY");
    expect(dbSource).toContain("export async function scanInventoryExpiryAlerts(testPort?: InventoryExpiryScanPort)");
    expect(dbSource).toContain("runInventoryExpiryAlertScan");
    expect(dbSource).toContain("evaluateInventoryExpiryBatch");
    expect(routerSource).toContain("saveInventoryExpiryAlertDays");
    expect(routerSource).toContain("scanInventoryExpiryAlerts");
    expect(settingsSource).toContain("inventoryExpiryAlertDays");
    expect(settingsSource).toContain("فحص الدفعات الآن");
    expect(settingsSource).toContain("لم يُضبط حد قرب انتهاء الصلاحية بعد");
    expect(settingsSource).toContain("آخر فحص:");
  });
});
