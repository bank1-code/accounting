import { describe, expect, it } from "vitest";
import { matchesPermissionScope, resolveScopedPermissionEffect } from "./db";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const routerSource = readFileSync(resolve(process.cwd(), "server/routers.ts"), "utf8");

describe("عزل RBAC للمخزن الأب والفرعي", () => {
  it("لا يورث المخزن الفرعي صلاحية الأب دون منح مستقل", () => {
    expect(matchesPermissionScope({ warehouseId: 10 }, { warehouseId: 11 })).toBe(false);
    expect(resolveScopedPermissionEffect([{ effect: "allow", warehouseId: 10, expiresAt: null }], { warehouseId: 11 })).toBeUndefined();
  });

  it("يسمح فقط للنطاق المطابق ويرفض المنع الصريح في النطاق الفرعي", () => {
    expect(resolveScopedPermissionEffect([{ effect: "allow", warehouseId: 11, expiresAt: null }], { warehouseId: 11 })).toBe(true);
    expect(resolveScopedPermissionEffect([{ effect: "allow", warehouseId: 10, expiresAt: null }, { effect: "deny", warehouseId: 11, expiresAt: null }], { warehouseId: 11 })).toBe(false);
  });

  it("يوثق أن النطاق الفارغ فقط هو التفويض الشامل المقصود", () => {
    expect(matchesPermissionScope({}, { warehouseId: 11 })).toBe(true);
  });

  it("يمرر نطاق المخزن الدقيق في التحويل والجرد وقراءة المخزون دون اعتماد على المخزن الأب", () => {
    expect(routerSource).toContain('byWarehouse: atomicPermissionProcedure("inventory.view", (input) => ({ warehouseId: (input as { warehouseId: number }).warehouseId }))');
    expect(routerSource).toContain('assertAtomicPermission(ctx.user.id, "inventory.transfer.create", { warehouseId: input.fromWarehouseId })');
    expect(routerSource).toContain('assertAtomicPermission(ctx.user.id, "inventory.transfer.approve", { warehouseId: transfer.fromWarehouseId })');
    expect(routerSource).toContain('assertAtomicPermission(ctx.user.id, "inventory.transfer.approve", { warehouseId: transfer.toWarehouseId })');
    expect(routerSource).toContain('assertAtomicPermission(ctx.user.id, "inventory.count.create", { warehouseId: input.warehouseId })');
    expect(routerSource).toContain('assertAtomicPermission(ctx.user.id, "inventory.count.approve", { warehouseId: count.warehouseId })');
  });
});
