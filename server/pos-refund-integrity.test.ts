import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const schema = readFileSync(resolve(process.cwd(), "drizzle/schema.ts"), "utf8");
const database = readFileSync(resolve(process.cwd(), "server/db.ts"), "utf8");
const router = readFileSync(resolve(process.cwd(), "server/routers.ts"), "utf8");
const ordersPage = readFileSync(resolve(process.cwd(), "client/src/pages/pos/Orders.tsx"), "utf8");
const settingsPage = readFileSync(resolve(process.cwd(), "client/src/pages/admin/Settings.tsx"), "utf8");

describe("دورة مردودات POS المالية", () => {
  it("توثق سند المردود بحالات طلب واعتماد وإتمام وبمرجع فريد للطلب", () => {
    expect(schema).toContain('export const posRefunds = mysqlTable("pos_refunds"');
    expect(schema).toContain('orderId: int("orderId").notNull().unique()');
    expect(schema).toContain('status: mysqlEnum("status", ["requested", "approved", "completed", "rejected"])');
    expect(schema).toContain('approvedBy: int("approvedBy")');
    expect(schema).toContain('stockRestoredAt: timestamp("stockRestoredAt")');
  });

  it("لا يسمح بإتمام المردود إلا بعد اعتماد مستقل ويعيد المخزون ويسوي النقد ذرّياً", () => {
    expect(database).toContain('if (refund.requestedBy === approvedBy) throw new Error("Refund requester cannot approve the same document")');
    expect(database).toContain('if (refund.status !== "approved") throw new Error("Only an approved refund can be completed")');
    expect(database).toContain('if (!order || order.status !== "paid") throw new Error("Original POS order is not eligible for refund completion")');
    expect(database).toContain('type: "return"');
    expect(database).toContain("const cashRefundCents = paymentRows.filter");
    expect(database).toContain('totalReturns: sql`${posSessions.totalReturns} + ${(cashRefundCents / 100).toFixed(2)}`');
    expect(database).toContain('where(and(eq(orders.id, order.id), eq(orders.status, "paid")))');
    expect(database).toContain('db.transaction(async (tx) =>');
  });

  it("يفصل بين طلب المردود واعتماده وصرفه بواسطة صلاحيات ذرية مستقلة", () => {
    expect(router).toContain('request: atomicPermissionProcedure("pos.order.refund"');
    expect(router).toContain('approve: atomicPermissionProcedure("treasury.refund.approve"');
    expect(router).toContain('complete: atomicPermissionProcedure("treasury.voucher.post"');
  });

  it("يعرض الواجهة كسلسلة طلب ثم اعتماد ثم إتمام، مع إخفاء كل زر بترخيصه", () => {
    expect(ordersPage).toContain("trpc.posRefunds.request.useMutation");
    expect(ordersPage).toContain("trpc.posRefunds.approve.useMutation");
    expect(ordersPage).toContain("trpc.posRefunds.complete.useMutation");
    expect(ordersPage).toContain('permissions={["pos.order.refund"]}');
    expect(ordersPage).toContain('permissions={["treasury.refund.approve"]}');
    expect(ordersPage).toContain('permissions={["treasury.voucher.post"]}');
    expect(ordersPage).toContain("لن يُلغى الطلب أو يعاد المخزون قبل اعتماد السند وإتمامه");
  });

  it("يرفض التخمين المحاسبي ويشترط خريطة حسابات فعالة ثم يحفظ قيد العكس مع سند المردود", () => {
    expect(database).toContain('const POS_POSTING_MAP_KEY = "accounting.pos_posting_map.v1"');
    expect(database).toContain('throw new Error("POS posting account map must be configured before completing a refund")');
    expect(database).toContain('const refundJournal = await createPostedOperationalJournalEntry(tx');
    expect(database).toContain('referenceType: "pos_refund", referenceId: refund.id');
    expect(database).toContain('journalEntryId: refundJournal.id');
    expect(database).toContain("Original payment allocations do not equal the approved refund amount");
    expect(router).toContain('savePosMap: atomicPermissionProcedure("admin.settings.manage")');
    expect(settingsPage).toContain("خريطة حسابات نقاط البيع");
    expect(settingsPage).toContain('permissions={["admin.settings.manage"]}');
  });
});
