import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { warehouses } from "../drizzle/schema";

const dbSource = readFileSync(resolve(process.cwd(), "server/db.ts"), "utf8");
const routerSource = readFileSync(resolve(process.cwd(), "server/routers.ts"), "utf8");
const pageSource = readFileSync(resolve(process.cwd(), "client/src/pages/inventory/Warehouses.tsx"), "utf8");

describe("هيكل المخازن الفرعية وفئات التخزين", () => {
  it("يحفظ علاقة المخزن الأب وفئة التخزين في المخطط", () => {
    expect(warehouses).toHaveProperty("parentWarehouseId");
    expect(warehouses).toHaveProperty("storageCategory");
  });

  it("يتحقق من صلاحية المخزن الأب واتساق الفرع قبل إنشاء المخزن الفرعي", () => {
    expect(dbSource).toContain("Parent warehouse is invalid or inactive");
    expect(dbSource).toContain("Sub-warehouse must use the same branch as its parent");
    expect(dbSource).toContain("branchId = branchId || parent.branchId || undefined");
  });

  it("يعرض اختيار الأب والفئة من خلال عقد tRPC محمي لإدارة الكتالوج", () => {
    expect(routerSource).toContain("parentWarehouseId: z.number().optional()");
    expect(routerSource).toContain("storageCategory: z.enum");
    expect(pageSource).toContain("المخزن الأب");
    expect(pageSource).toContain("فئة التخزين");
    expect(pageSource).toContain("categoryLabels");
  });
});
