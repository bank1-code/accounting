import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import * as db from "./db";
import type { TrpcContext } from "./_core/context";

describe("auth.localCredentialsConfigured", () => {
  it("يتحقق عبر واجهة المصادقة من وجود بيانات المستخدم الإداري الأول", async () => {
    const caller = appRouter.createCaller({
      user: null,
      req: { protocol: "https", headers: {} } as TrpcContext["req"],
      res: {} as TrpcContext["res"],
    });

    await expect(caller.auth.localCredentialsConfigured()).resolves.toEqual({ configured: true });
  });

  it("يتحقق من بيانات الدخول الإدارية وينشئ جلسة HttpOnly", async () => {
    const cookies: Array<{ name: string; value: string; options: Record<string, unknown> }> = [];
    const caller = appRouter.createCaller({
      user: null,
      req: { protocol: "https", headers: {} } as TrpcContext["req"],
      res: {
        cookie: (name: string, value: string, options: Record<string, unknown>) => cookies.push({ name, value, options }),
      } as TrpcContext["res"],
    });

    const result = await caller.auth.login({
      username: process.env.LOCAL_ADMIN_USERNAME!,
      password: process.env.LOCAL_ADMIN_PASSWORD!,
    });

    expect(result.user).toMatchObject({ username: process.env.LOCAL_ADMIN_USERNAME, role: "admin", loginMethod: "local" });
    expect(cookies).toHaveLength(1);
    expect(cookies[0]?.options).toMatchObject({ httpOnly: true, secure: true, sameSite: "none" });
  });

  it("يسند لحساب المالك دور مدير النظام غير المقيد بكامل الصلاحيات الذرية", async () => {
    const owner = await db.getUserByUsername(process.env.LOCAL_ADMIN_USERNAME!);
    expect(owner).toMatchObject({ username: process.env.LOCAL_ADMIN_USERNAME, role: "admin", loginMethod: "local" });
    const assignments = await db.listUserRoleAssignments(owner!.id);
    const administrator = assignments.find((assignment) => assignment.roleCode === "system_administrator" && assignment.isActive && assignment.branchId == null && assignment.warehouseId == null && assignment.costCenterId == null);
    expect(administrator).toBeDefined();
    const [allPermissions, grantedPermissions] = await Promise.all([
      db.listPermissions(),
      db.getRolePermissionIds(administrator!.roleId),
    ]);
    expect(grantedPermissions.filter((grant) => grant.effect === "allow").map((grant) => grant.permissionId).sort((a, b) => a - b))
      .toEqual(allPermissions.map((permission) => permission.id).sort((a, b) => a - b));
  });
});
