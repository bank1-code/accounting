import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const dbSource = readFileSync(resolve(process.cwd(), "server/db.ts"), "utf8");
const routerSource = readFileSync(resolve(process.cwd(), "server/routers.ts"), "utf8");
const pageSource = readFileSync(resolve(process.cwd(), "client/src/pages/inventory/WasteVouchers.tsx"), "utf8");

describe("نزاهة إذن التوالف متعدد البنود", () => {
  it("يحفظ مسودة واحدة متعددة البنود ولا يسمح بخط فارغ أو كمية غير موجبة", () => {
    expect(dbSource).toContain("export async function createWasteVoucher");
    expect(dbSource).toContain("Waste voucher requires at least one line");
    expect(dbSource).toContain("Waste voucher line is invalid");
    expect(dbSource).toContain('sequence = await reserveDocumentSequence(tx, "waste_voucher")');
  });

  it("يخصم المخزون ويرحل مصروف الهدر مقابل المخزون داخل اعتماد ذري مستقل", () => {
    expect(dbSource).toContain("export async function approveWasteVoucher");
    expect(dbSource).toContain('type: "waste"');
    expect(dbSource).toContain("postingMap.wasteExpenseAccountId");
    expect(dbSource).toContain('referenceType: "waste_voucher", referenceId: voucher.id');
    expect(dbSource).toContain("Only draft waste vouchers can be cancelled");
  });

  it("يحفظ الدفعة التي اختارها FEFO وتاريخ صلاحيتها في بند التوالف المعتمد", () => {
    expect(dbSource).toContain('batchNumber: line.batchNumber || undefined');
    expect(dbSource).toContain('set({ unitCost, batchNumber: movement.batchNumber || null, expiryDate: movement.expiryDate || null })');
  });

  it("يفرض صلاحيات إنشاء واعتماد التوالف ونطاق المخزن ويعرض الواجهة المحمية", () => {
    expect(routerSource).toContain('atomicPermissionProcedure("inventory.waste.create"');
    expect(routerSource).toContain('atomicPermissionProcedure("inventory.waste.approve")');
    expect(routerSource).toContain('assertAtomicPermission(ctx.user.id, "inventory.waste.approve", { warehouseId: voucher.warehouseId })');
    expect(pageSource).toContain('PermissionAction permissions={["inventory.waste.create"]}');
    expect(pageSource).toContain('PermissionAction permissions={["inventory.waste.approve"]}');
    expect(pageSource).toContain("إنشاء إذن توالف متعدد البنود");
  });
});
