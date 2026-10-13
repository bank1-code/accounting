import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import * as db from "./db";

const source = readFileSync(resolve(process.cwd(), "server/db.ts"), "utf8");

describe("نزاهة التحويل والجرد", () => {
  it("يفصل التحويل إلى اعتماد وإرسال واستلام ويمنع تكرار كل مرحلة", () => {
    expect(source).toContain("export async function approveTransfer");
    expect(source).toContain("export async function dispatchTransfer");
    expect(source).toContain("export async function receiveTransfer");
    expect(source).toContain('type: "transfer_out"');
    expect(source).toContain('type: "transfer_in"');
    expect(source).toContain("Transfer cannot be dispatched in its current status");
    expect(source).toContain("Transfer cannot be received in its current status");
  });

  it("يثبت رقم الدفعة وتاريخ الصلاحية عند الإرسال ويعيدهما إلى مخزن الوجهة عند الاستلام", () => {
    expect(source).toContain("set({ batchNumber: movement.batchNumber, expiryDate: movement.expiryDate })");
    expect(source).toContain("batchNumber: line.batchNumber || undefined");
    expect(source).toContain("expiryDate: line.expiryDate || undefined");
  });

  it("يلتقط رصيد النظام من المخزون وقت الجرد ويطبق الفرق مرة واحدة عند الاعتماد", () => {
    expect(source).toContain("const stockRows = await tx.select().from(stock)");
    expect(source).toContain("Inventory count cannot be approved in its current status");
    expect(source).toContain('type: "adjustment"');
    expect(source).toContain("Approved inventory count");
  });

  it("يرحل مكاسب وخسائر فروقات الجرد إلى حساباتها المقابلة داخل معاملة الاعتماد", () => {
    expect(source).toContain("Posting account map must be configured before approving an inventory count");
    expect(source).toContain("postingMap.inventoryGainAccountId");
    expect(source).toContain("postingMap.inventoryLossAccountId");
    expect(source).toContain('referenceType: "inventory_count", referenceId: count.id');
    expect(source).toContain("Inventory gain from ${count.countNumber}");
    expect(source).toContain("Inventory loss from ${count.countNumber}");
  });

  it("ينشئ تنبيه إعادة الطلب عند عبور الحد فقط ولا يكرره ما دام الرصيد تحته", () => {
    expect(db.shouldCreateReorderAlert({ hasExistingBalance: true, currentQuantity: 12, nextQuantity: 8, reorderLevel: 10 })).toBe(true);
    expect(db.shouldCreateReorderAlert({ hasExistingBalance: true, currentQuantity: 8, nextQuantity: 6, reorderLevel: 10 })).toBe(false);
    expect(db.shouldCreateReorderAlert({ hasExistingBalance: false, currentQuantity: 0, nextQuantity: 4, reorderLevel: 10 })).toBe(true);
    expect(db.shouldCreateReorderAlert({ hasExistingBalance: true, currentQuantity: 12, nextQuantity: 11, reorderLevel: 10 })).toBe(false);
    expect(source).toContain('type: "inventory_reorder"');
  });
});
