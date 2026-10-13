import { afterEach, describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import * as db from "./db";
import type { TrpcContext } from "./_core/context";

function contextForUser(): TrpcContext {
  return {
    user: {
      id: 777,
      openId: null,
      username: "rbac_test_user",
      passwordHash: "hidden",
      email: null,
      name: "RBAC Test User",
      loginMethod: "local",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

afterEach(() => vi.restoreAllMocks());

describe("حارس الصلاحيات الذرية", () => {
  it("يرفض إدارة الأدوار قبل استدعاء البيانات عند غياب الصلاحية", async () => {
    vi.spyOn(db, "hasAtomicPermission").mockResolvedValue(false);
    const listRoles = vi.spyOn(db, "listRoles");
    const caller = appRouter.createCaller(contextForUser());

    await expect(caller.accessControl.roles()).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(listRoles).not.toHaveBeenCalled();
    expect(db.hasAtomicPermission).toHaveBeenCalledWith(777, "admin.roles.manage", {});
  });

  it("يسمح بالإجراء عند توفر الصلاحية الذرية", async () => {
    vi.spyOn(db, "hasAtomicPermission").mockResolvedValue(true);
    vi.spyOn(db, "listRoles").mockResolvedValue([] as Awaited<ReturnType<typeof db.listRoles>>);
    const caller = appRouter.createCaller(contextForUser());

    await expect(caller.accessControl.roles()).resolves.toEqual([]);
  });

  it("يمرر نطاق المخزن عند إنشاء تحويل داخلي", async () => {
    vi.spyOn(db, "hasAtomicPermission").mockResolvedValue(false);
    const caller = appRouter.createCaller(contextForUser());

    await expect(caller.transfers.create({
      transferNumber: "TEST-001", fromWarehouseId: 12, toWarehouseId: 13, lines: [],
    })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(db.hasAtomicPermission).toHaveBeenCalledWith(777, "inventory.transfer.create", { warehouseId: 12 });
  });

  it("يمرر نطاق الفرع ومركز التكلفة عند إنشاء طلب بيع", async () => {
    vi.spyOn(db, "hasAtomicPermission").mockResolvedValue(false);
    const caller = appRouter.createCaller(contextForUser());

    await expect(caller.orders.create({
      orderNumber: "POS-SCOPE-001", branchId: 4, warehouseId: 7, costCenterId: 55, lines: [],
    })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(db.hasAtomicPermission).toHaveBeenCalledWith(777, "pos.order.create", { branchId: 4, warehouseId: 7, costCenterId: 55 });
  });

  it("لا يسمح بإنشاء طلب POS إلا داخل نطاق مركز التكلفة الممنوح", async () => {
    vi.spyOn(db, "hasAtomicPermission").mockImplementation(async (_userId, code, scope) =>
      code === "pos.order.create" && scope.branchId === 4 && scope.costCenterId === 55,
    );
    const createOrder = vi.spyOn(db, "createOrder").mockResolvedValue({ id: 901 } as Awaited<ReturnType<typeof db.createOrder>>);
    const caller = appRouter.createCaller(contextForUser());

    await expect(caller.orders.create({
      orderNumber: "POS-COST-CENTER-ALLOWED", branchId: 4, warehouseId: 7, costCenterId: 55, lines: [],
    })).resolves.toMatchObject({ id: 901 });

    await expect(caller.orders.create({
      orderNumber: "POS-COST-CENTER-DENIED", branchId: 4, warehouseId: 7, costCenterId: 56, lines: [],
    })).rejects.toMatchObject({ code: "FORBIDDEN" });

    expect(createOrder).toHaveBeenCalledTimes(1);
    expect(db.hasAtomicPermission).toHaveBeenCalledWith(777, "pos.order.create", { branchId: 4, warehouseId: 7, costCenterId: 55 });
    expect(db.hasAtomicPermission).toHaveBeenCalledWith(777, "pos.order.create", { branchId: 4, warehouseId: 7, costCenterId: 56 });
  });

  it("يرفض مسار orders.create غياب مخزن التحصيل قبل استدعاء طبقة البيانات", async () => {
    vi.spyOn(db, "hasAtomicPermission").mockResolvedValue(true);
    const createOrder = vi.spyOn(db, "createOrder");
    const caller = appRouter.createCaller(contextForUser());

    await expect(caller.orders.create({
      orderNumber: "POS-MISSING-WAREHOUSE", branchId: 4, lines: [],
    } as never)).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(createOrder).not.toHaveBeenCalled();
  });

  it("يرفض مخزن تحصيل لا ينتمي للفرع حتى مع صلاحية POS صحيحة", async () => {
    vi.spyOn(db, "hasAtomicPermission").mockResolvedValue(true);
    vi.spyOn(db, "createOrder").mockImplementation(async (input) => {
      db.assertPosWarehouseForBranch({ branchId: input.branchId, warehouseId: input.warehouseId, warehouse: { id: input.warehouseId, branchId: 9, isActive: true } });
      return { id: 902 } as Awaited<ReturnType<typeof db.createOrder>>;
    });
    const caller = appRouter.createCaller(contextForUser());

    await expect(caller.orders.create({
      orderNumber: "POS-WRONG-BRANCH-WAREHOUSE", branchId: 4, warehouseId: 7, lines: [],
    })).rejects.toThrow("Selected POS warehouse is not active for this branch");
    expect(db.hasAtomicPermission).toHaveBeenCalledWith(777, "pos.order.create", { branchId: 4, warehouseId: 7, costCenterId: undefined });
  });

  it("يرفض orders.create الحقيقي مخزن تحصيل خارج الفرع بعد نجاح حارس الصلاحية", async () => {
    vi.spyOn(db, "hasAtomicPermission").mockResolvedValue(true);
    const caller = appRouter.createCaller(contextForUser());

    await expect(caller.orders.create({
      orderNumber: "POS-TRPC-NONEXISTENT-WAREHOUSE", branchId: 998_001, warehouseId: 998_002,
      lines: [{ productId: 1, quantity: "1", unitPrice: "1" }],
    })).rejects.toThrow("Selected POS warehouse is not active for this branch");
    expect(db.hasAtomicPermission).toHaveBeenCalledWith(777, "pos.order.create", { branchId: 998_001, warehouseId: 998_002, costCenterId: undefined });
  });

  it("يحفظ مركز التكلفة عند إسناد دور وعند إنشاء تجاوز فردي عبر tRPC", async () => {
    vi.spyOn(db, "hasAtomicPermission").mockResolvedValue(true);
    const assignUserRole = vi.spyOn(db, "assignUserRole").mockResolvedValue({ id: 801 });
    const setOverride = vi.spyOn(db, "setUserPermissionOverride").mockResolvedValue({ id: 802 });
    vi.spyOn(db, "logAudit").mockResolvedValue(undefined);
    const caller = appRouter.createCaller(contextForUser());

    await expect(caller.accessControl.assignUserRole({
      userId: 90, roleId: 12, branchId: 4, warehouseId: 7, costCenterId: 55,
    })).resolves.toEqual({ id: 801 });
    await expect(caller.accessControl.setUserPermissionOverride({
      userId: 90, permissionId: 44, effect: "allow", branchId: 4, warehouseId: 7, costCenterId: 55, reason: "مسؤولية تشغيلية محددة",
    })).resolves.toEqual({ id: 802 });

    expect(assignUserRole).toHaveBeenCalledWith(expect.objectContaining({
      userId: 90, roleId: 12, branchId: 4, warehouseId: 7, costCenterId: 55, assignedBy: 777,
    }));
    expect(setOverride).toHaveBeenCalledWith(expect.objectContaining({
      userId: 90, permissionId: 44, effect: "allow", branchId: 4, warehouseId: 7, costCenterId: 55, grantedBy: 777,
    }));
  });

  it("يطبق تجاوز مركز التكلفة على المنح ويعطي المنع الصريح أولوية داخل النطاق نفسه", () => {
    const active = new Date(Date.now() + 60_000);
    const overrides = [
      { effect: "allow" as const, branchId: 4, warehouseId: 7, costCenterId: 55, expiresAt: active },
    ];

    expect(db.resolveScopedPermissionEffect(overrides, { branchId: 4, warehouseId: 7, costCenterId: 55 })).toBe(true);
    expect(db.resolveScopedPermissionEffect(overrides, { branchId: 4, warehouseId: 7, costCenterId: 56 })).toBeUndefined();
    expect(db.resolveScopedPermissionEffect([
      ...overrides,
      { effect: "deny" as const, branchId: 4, warehouseId: 7, costCenterId: 55, expiresAt: active },
    ], { branchId: 4, warehouseId: 7, costCenterId: 55 })).toBe(false);
  });
});
