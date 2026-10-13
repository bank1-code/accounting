import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { appRouter } from "./routers";
import * as db from "./db";
import type { TrpcContext } from "./_core/context";

function adminContext(): TrpcContext {
  return { user: { id: 450001, openId: null, username: "admina", passwordHash: "hidden", email: null, name: "System Owner", loginMethod: "local", role: "admin", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() }, req: { protocol: "https", headers: {} } as TrpcContext["req"], res: {} as TrpcContext["res"] };
}

describe("لوحة تحكم المدير", () => {
  it("تحمي مسار لوحة المدير بصلاحية تدقيق أو إعدادات وتعيد مؤشرات النشاط", async () => {
    vi.spyOn(db, "hasAtomicPermission").mockResolvedValue(true);
    vi.spyOn(db, "getAdminDashboardOverview").mockResolvedValue({ stats: { totalAccounts: 1, totalBranches: 2, totalCostCenters: 3, totalEntries: 4, totalProducts: 5, totalOrders: 6, todaySales: "7.50" }, system: { totalUsers: 8, openPosSessions: 1, unreadNotifications: 2, draftJournalEntries: 3 }, recentActivity: [{ id: 9, action: "create", entityType: "role", entityId: 1, userId: 450001, userName: "System Owner", createdAt: new Date() }] } as Awaited<ReturnType<typeof db.getAdminDashboardOverview>>);
    const overview = await appRouter.createCaller(adminContext()).dashboard.adminOverview();
    expect(overview.system).toMatchObject({ totalUsers: 8, unreadNotifications: 2 });
    expect(overview.recentActivity).toHaveLength(1);
    expect(db.hasAtomicPermission).toHaveBeenCalledWith(450001, "admin.audit.view", {});
  });

  it("يسجل صفحة ولوحة المدير في التوجيه والتنقل ويستهلك مسار البيانات المحمي", () => {
    const app = readFileSync(resolve(process.cwd(), "client/src/App.tsx"), "utf8");
    const sidebar = readFileSync(resolve(process.cwd(), "client/src/components/DashboardLayout.tsx"), "utf8");
    const page = readFileSync(resolve(process.cwd(), "client/src/pages/admin/AdminDashboard.tsx"), "utf8");
    expect(app).toContain('path="/admin/overview"');
    expect(sidebar).toContain('path: "/admin/overview"');
    expect(page).toContain("trpc.dashboard.adminOverview.useQuery");
    expect(page).toContain("recentActivity");
  });
});
