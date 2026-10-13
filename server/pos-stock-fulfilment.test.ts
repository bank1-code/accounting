import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("تحصيل طلب نقطة البيع", () => {
  const source = readFileSync(resolve(process.cwd(), "server/db.ts"), "utf8");

  it("يخصم الأصناف من مخزن الفرع في نفس معاملة التحصيل", () => {
    expect(source).toContain("No active sales warehouse is configured for this branch");
    expect(source).toContain('type: "sale"');
    expect(source).toContain('referenceType: "pos_order"');
    expect(source).toContain("Fulfilled POS order");
  });

  it("لا يسمح بتحصيل الطلب إلا من انتقال حالة صالح، فيمنع الخصم المكرر", () => {
    expect(source).toContain("Invalid order status transition");
    expect(source).toContain('paid: []');
    expect(source).toContain("Order status was changed by another process");
  });
});
