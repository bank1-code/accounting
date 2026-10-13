import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function contextForRole(role: "admin" | "user"): TrpcContext {
  return {
    user: {
      id: role === "admin" ? 901 : 902,
      openId: null,
      username: role === "admin" ? "local_admin" : "local_user",
      passwordHash: "hidden",
      email: null,
      name: "Local User",
      loginMethod: "local",
      role,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("صلاحيات المستخدم المحلي", () => {
  it("يعيد دور المستخدم المحلي عبر واجهة المصادقة", async () => {
    const caller = appRouter.createCaller(contextForRole("user"));
    await expect(caller.auth.me()).resolves.toMatchObject({ username: "local_user", role: "user", loginMethod: "local" });
  });

  it("يسمح للمستخدم المحلي الإداري بإجراء إداري محمي", async () => {
    const caller = appRouter.createCaller(contextForRole("admin"));
    await expect(caller.auth.adminStatus()).resolves.toEqual({ admin: true });
  });

  it("يرفض إجراءات الإدارة للمستخدم المحلي غير المخول قبل تغيير البيانات", async () => {
    const caller = appRouter.createCaller(contextForRole("user"));
    await expect(caller.branches.create({ name: "Blocked", type: "restaurant" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
