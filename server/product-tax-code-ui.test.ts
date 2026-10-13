import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const pageSource = readFileSync(resolve(process.cwd(), "client/src/pages/inventory/Products.tsx"), "utf8");
const routerSource = readFileSync(resolve(process.cwd(), "server/routers.ts"), "utf8");

describe("واجهة رمز ضريبة الصنف", () => {
  it("تعرض رموز الضريبة النشطة وتقرأها من مسار كتالوج محمي وتوقف التعديل اليدوي للمعدل عند الاختيار", () => {
    expect(routerSource).toContain('taxCodes: atomicPermissionProcedure("inventory.catalog.manage")');
    expect(pageSource).toContain("trpc.products.taxCodes.useQuery()");
    expect(pageSource).toContain("taxCodeId: 0");
    expect(pageSource).toContain("taxCodesList?.filter((taxCode) => taxCode.isActive)");
    expect(pageSource).toContain("disabled={Boolean(form.taxCodeId)}");
    expect(pageSource).toContain("taxRate: selected ? String(selected.rate) : form.taxRate");
    expect(pageSource).toContain("trpc.products.taxCodeConsistency.useQuery()");
    expect(pageSource).toContain("trpc.products.synchronizeTaxCodeRates.useMutation");
    expect(pageSource).toContain("تدقيق اتساق رمز الضريبة");
    expect(pageSource).toContain('PermissionAction permissions={["inventory.catalog.manage"]}');
  });
});
