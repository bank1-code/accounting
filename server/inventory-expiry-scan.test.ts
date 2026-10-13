import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { calculateBatchBalanceNext, scanInventoryExpiryAlerts, type InventoryExpiryBatchRecord } from "./db";

describe("مسح صلاحية الدفعات", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-20T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("ينشئ التنبيه المؤهل مرة واحدة ويستبعد الرصيد الصفري والدفعة خارج الحد دون كتابة قاعدة بيانات", async () => {
    const batches: InventoryExpiryBatchRecord[] = [
      { productId: 81, warehouseId: 7, batchNumber: "VERIFY-NEAR", quantity: "3.0000", expiryDate: new Date("2026-08-25T00:00:00Z") },
      { productId: 82, warehouseId: 7, batchNumber: "VERIFY-ZERO", quantity: "0.0000", expiryDate: new Date("2026-08-22T00:00:00Z") },
      { productId: 83, warehouseId: 7, batchNumber: "VERIFY-LATER", quantity: "4.0000", expiryDate: new Date("2026-09-01T00:00:00Z") },
    ];
    const notifications: Array<{ content: string }> = [];
    const scan = () => scanInventoryExpiryAlerts({
      getThresholdDays: async () => 5,
      listBatches: async () => batches,
      getProductName: async (productId) => `Product ${productId}`,
      hasExistingNotification: async (batch) => notifications.some((notification) => notification.content.includes(batch.batchNumber)),
      createNotification: async (notification) => { notifications.push(notification); },
    });

    expect(await scan()).toEqual({ scanned: 1, created: 1, thresholdDays: 5 });
    expect(notifications).toHaveLength(1);
    expect(notifications[0].content).toContain("VERIFY-NEAR");
    expect(await scan()).toEqual({ scanned: 1, created: 0, thresholdDays: 5 });
    expect(notifications).toHaveLength(1);
  });

  it("يغطي دورة الدفعة من الاستلام إلى الاستهلاك الجزئي والكلي ثم يستبعد الرصيد المنفد من المسح", async () => {
    let balance = calculateBatchBalanceNext(0, 10, "incoming");
    balance = calculateBatchBalanceNext(balance, 4, "outgoing");
    expect(balance).toBe(6);
    balance = calculateBatchBalanceNext(balance, 6, "outgoing");
    expect(balance).toBe(0);
    const created: unknown[] = [];
    const result = await scanInventoryExpiryAlerts({
      getThresholdDays: async () => 5,
      listBatches: async () => [{ productId: 94, warehouseId: 17, batchNumber: "VERIFY-DEPLETED", quantity: String(balance), expiryDate: new Date("2026-08-24T00:00:00Z") }],
      getProductName: async () => "Product 94",
      hasExistingNotification: async () => false,
      createNotification: async (notification) => { created.push(notification); },
    });
    expect(result).toEqual({ scanned: 0, created: 0, thresholdDays: 5 });
    expect(created).toHaveLength(0);
  });
});
