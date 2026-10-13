import { describe, expect, it } from "vitest";
import { isNotificationRuleEnabled, normalizeNotificationRules, runInventoryExpiryAlertScan } from "./db";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("إدارة قواعد الإشعارات المركزية", () => {
  it("تضبط القواعد الافتراضية وتقبل تمكين وتعطيل كل نوع بشكل مستقل", () => {
    expect(normalizeNotificationRules(undefined)).toEqual({ inventoryReorder: true, inventoryExpiry: true, posCashVariance: true });
    const rules = normalizeNotificationRules({ inventoryReorder: false, inventoryExpiry: true, posCashVariance: false });
    expect(isNotificationRuleEnabled(rules, "inventoryReorder")).toBe(false);
    expect(isNotificationRuleEnabled(rules, "inventoryExpiry")).toBe(true);
    expect(isNotificationRuleEnabled(rules, "posCashVariance")).toBe(false);
  });

  it("يمنع فحص الصلاحية من إنشاء تنبيهات عندما يعطّل هذا النوع مركزياً", async () => {
    const created: unknown[] = [];
    await expect(runInventoryExpiryAlertScan({ getThresholdDays: async () => 7, getNotificationRules: async () => ({ inventoryReorder: true, inventoryExpiry: false, posCashVariance: true }), listBatches: async () => [{ productId: 1, warehouseId: 1, batchNumber: "OFF", quantity: "1", expiryDate: new Date("2026-08-21") }], getProductName: async () => "صنف", hasExistingNotification: async () => false, createNotification: async (item) => { created.push(item); } })).resolves.toEqual({ scanned: 0, created: 0, thresholdDays: 7 });
    expect(created).toHaveLength(0);
  });

  it("يعرض قواعد الإدارة ويغلق مصادر reorder وexpiry وcash variance في الخادم", () => {
    const dbSource = readFileSync(resolve(process.cwd(), "server/db.ts"), "utf8");
    const routerSource = readFileSync(resolve(process.cwd(), "server/routers.ts"), "utf8");
    const settingsSource = readFileSync(resolve(process.cwd(), "client/src/pages/admin/Settings.tsx"), "utf8");
    expect(dbSource).toContain("NOTIFICATION_RULES_KEY");
    expect(dbSource).toContain('"inventoryReorder"');
    expect(dbSource).toContain('"inventoryExpiry"');
    expect(dbSource).toContain('"posCashVariance"');
    expect(routerSource).toContain("saveNotificationRules");
    expect(settingsSource).toContain("إدارة قواعد الإشعارات");
  });
});
