import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const appSource = readFileSync(resolve(process.cwd(), "client/src/App.tsx"), "utf8");
const layoutSource = readFileSync(resolve(process.cwd(), "client/src/components/DashboardLayout.tsx"), "utf8");
const routerSource = readFileSync(resolve(process.cwd(), "server/routers.ts"), "utf8");
const wastePageSource = readFileSync(resolve(process.cwd(), "client/src/pages/inventory/WasteVouchers.tsx"), "utf8");

function parsePermissions(value: string) {
  return [...value.matchAll(/"([^"]+)"/g)].map((match) => match[1]).sort();
}

function permissionMap(source: string, pattern: RegExp) {
  return new Map([...source.matchAll(pattern)].map((match) => [match[1], parsePermissions(match[2])]));
}

describe("اتساق RBAC بين الواجهة والخادم", () => {
  it("يطابق كل عنصر تنقل محمي مع حارس PermissionOnly لمساره", () => {
    const navigation = permissionMap(layoutSource, /path: "([^"]+)", requiredAny: \[([^\]]+)\]/g);
    const routes = permissionMap(appSource, /<Route path="([^"]+)"><PermissionOnly permissions=\{\[([^\]]+)\]\}/g);
    expect(navigation.size).toBeGreaterThan(25);

    const mismatches = [...navigation.entries()]
      .filter(([path, permissions]) => JSON.stringify(routes.get(path)) !== JSON.stringify(permissions))
      .map(([path, permissions]) => ({ path, navigation: permissions, route: routes.get(path) }));
    expect(mismatches, `Navigation/route mismatches: ${JSON.stringify(mismatches)}`).toEqual([]);
  });

  it("يعكس مسارا المستندات والامتثال صلاحيات القراءة التي يقبلها الخادم", () => {
    const routes = permissionMap(appSource, /<Route path="([^"]+)"><PermissionOnly permissions=\{\[([^\]]+)\]\}/g);
    expect(routes.get("/admin/documents")).toEqual(["admin.documents.manage", "admin.settings.manage", "admin.settings.view"]);
    expect(routes.get("/admin/saudi-compliance")).toEqual(["compliance.vat.manage", "compliance.zatca.manage", "compliance.zatca.view"]);
    expect(routerSource).toContain('list: atomicAnyPermissionProcedure(["admin.documents.manage", "admin.settings.view", "admin.settings.manage"])');
    expect(routerSource).toContain('companyProfile: atomicAnyPermissionProcedure(["compliance.vat.manage", "compliance.zatca.view", "compliance.zatca.manage"])');
  });

  it("يطابق مسار إذن التوالف وأزراره مع نطاق warehouseId في الخادم للمخزن الفرعي", () => {
    const routes = permissionMap(appSource, /<Route path="([^"]+)"><PermissionOnly permissions=\{\[([^\]]+)\]\}/g);
    expect(routes.get("/inventory/waste-vouchers")).toEqual(["inventory.waste.approve", "inventory.waste.create"]);
    expect(layoutSource).toContain('path: "/inventory/waste-vouchers", requiredAny: ["inventory.waste.create", "inventory.waste.approve"]');
    expect(wastePageSource).toContain('PermissionAction permissions={["inventory.waste.create"]}');
    expect(wastePageSource).toContain('PermissionAction permissions={["inventory.waste.approve"]}');
    expect(routerSource).toContain('atomicPermissionProcedure("inventory.waste.create", (input) => ({ warehouseId: (input as { warehouseId?: number }).warehouseId }))');
    expect(routerSource).toContain('assertAtomicPermission(ctx.user.id, "inventory.waste.approve", { warehouseId: voucher.warehouseId })');
  });

  it("يحافظ على مواءمة كل مسار واجهة مخزون مقيّد بالمخزن مع حارس الخادم", () => {
    const routes = permissionMap(appSource, /<Route path="([^"]+)"><PermissionOnly permissions=\{\[([^\]]+)\]\}/g);
    expect(routes.get("/inventory/transfers")).toEqual(["inventory.transfer.approve", "inventory.transfer.create"]);
    expect(routes.get("/inventory/count")).toEqual(["inventory.count.approve", "inventory.count.create"]);
    expect(routes.get("/inventory/waste-vouchers")).toEqual(["inventory.waste.approve", "inventory.waste.create"]);
    expect(layoutSource).toContain('path: "/inventory/transfers", requiredAny: ["inventory.transfer.create", "inventory.transfer.approve"]');
    expect(layoutSource).toContain('path: "/inventory/count", requiredAny: ["inventory.count.create", "inventory.count.approve"]');
    expect(routerSource).toContain('assertAtomicPermission(ctx.user.id, "inventory.transfer.approve", { warehouseId: transfer.fromWarehouseId })');
    expect(routerSource).toContain('assertAtomicPermission(ctx.user.id, "inventory.transfer.approve", { warehouseId: transfer.toWarehouseId })');
    expect(routerSource).toContain('assertAtomicPermission(ctx.user.id, "inventory.count.approve", { warehouseId: count.warehouseId })');
  });

  it("يطابق مسارات الإنتاج والمشتريات ذات warehouseId مع حراس الخادم", () => {
    const routes = permissionMap(appSource, /<Route path="([^"]+)"><PermissionOnly permissions=\{\[([^\]]+)\]\}/g);
    expect(routes.get("/manufacturing/production-orders")).toEqual(["production.order.approve", "production.order.complete", "production.order.create"]);
    expect(routes.get("/purchasing/purchase-orders")).toEqual(["purchasing.invoice.accounts_approve", "purchasing.invoice.items_approve", "purchasing.order.approve", "purchasing.order.create", "purchasing.request.create"]);
    expect(layoutSource).toContain('path: "/manufacturing/production-orders", requiredAny: ["production.order.create", "production.order.approve", "production.order.complete"]');
    expect(layoutSource).toContain('path: "/purchasing/purchase-orders", requiredAny: ["purchasing.request.create", "purchasing.order.create", "purchasing.order.approve", "purchasing.invoice.items_approve", "purchasing.invoice.accounts_approve"]');
    expect(routerSource).toContain('assertAtomicPermission(ctx.user.id, "production.order.create", { warehouseId: input.warehouseId, branchId: input.branchId })');
    expect(routerSource).toContain('assertAtomicPermission(ctx.user.id, "production.order.create", { warehouseId: input.sourceWarehouseId, branchId: input.branchId })');
    expect(routerSource).toContain('assertAtomicPermission(ctx.user.id, "production.order.complete", { warehouseId: order.sourceWarehouseId, branchId: order.branchId })');
    expect(routerSource).toContain('assertAtomicPermission(ctx.user.id, "purchasing.order.create", { warehouseId: input.warehouseId })');
  });
});
