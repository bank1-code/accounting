import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { productAddons } from "../drizzle/schema";
import * as db from "./db";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

const dbSource = readFileSync(resolve(process.cwd(), "server/db.ts"), "utf8");
const routerSource = readFileSync(resolve(process.cwd(), "server/routers.ts"), "utf8");
const pageSource = readFileSync(resolve(process.cwd(), "client/src/pages/inventory/Products.tsx"), "utf8");
const posSource = readFileSync(resolve(process.cwd(), "client/src/pages/pos/PosTerminal.tsx"), "utf8");
const recipesPageSource = readFileSync(resolve(process.cwd(), "client/src/pages/manufacturing/Recipes.tsx"), "utf8");

afterEach(() => {
  db.setRecipeDetailPortForTesting(undefined);
  vi.restoreAllMocks();
});

function recipeContext(): TrpcContext {
  return { user: { id: 902, openId: null, username: "recipe_cost_tester", passwordHash: "hidden", email: null, name: "Recipe Cost", loginMethod: "local", role: "user", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() }, req: { protocol: "https", headers: {} } as TrpcContext["req"], res: {} as TrpcContext["res"] };
}

describe("إضافات الوجبات الهجينة", () => {
  it("يحفظ نموذج الإضافة أوضاع المشمول والمجاني والمدفوع المستقل", () => {
    expect(productAddons).toHaveProperty("parentProductId");
    expect(productAddons).toHaveProperty("addonProductId");
    expect(productAddons).toHaveProperty("pricingMode");
    expect(productAddons).toHaveProperty("salePrice");
    expect(dbSource).toContain("A product cannot be its own add-on");
    expect(dbSource).toContain("A separately priced add-on requires a positive sale price");
  });

  it("يعرض واجهة محمية ومسارات كتالوج ذرية لإدارة الإضافات", () => {
    expect(routerSource).toContain('addons: atomicPermissionProcedure("inventory.catalog.manage")');
    expect(routerSource).toContain('createAddon: atomicPermissionProcedure("inventory.catalog.manage")');
    expect(routerSource).toContain('deleteAddon: atomicPermissionProcedure("inventory.catalog.manage")');
    expect(pageSource).toContain("t.inv.mealAddOns");
    expect(pageSource).toContain('value="included"');
    expect(pageSource).toContain('value="free"');
    expect(pageSource).toContain('value="separate"');
  });

  it("يفرض تسعير الإضافة في الخادم ويمرر وضعها إلى سلة POS وخط الطلب", () => {
    expect(dbSource).toContain("POS add-on is not configured for its parent product");
    expect(dbSource).toContain("addon.pricingMode === \"separate\"");
    expect(dbSource).toContain("parentProductId: line.parentProductId");
    expect(routerSource).toContain("addonPricingMode: z.enum");
    expect(posSource).toContain("parentProductId: c.parentProductId");
    expect(posSource).toContain("addonPricingMode: c.addonMode");
  });

  it("يدخل تكلفة الإضافة المشمولة أو المجانية في تكلفة مبيعات الوجبة حتى لو كان سعرها صفراً", () => {
    const cost = db.calculatePosOrderCostCents([
      { quantity: "1", costPrice: "25.00" },
      { quantity: "1", costPrice: "7.50" },
    ]);
    expect(cost).toBe(3250);
    expect(dbSource).toContain("const costCents = lines.reduce");
    expect(dbSource).toContain("costByInventoryAccount");
    expect(dbSource).toContain("POS cost of sales for ${order.orderNumber}");
  });

  it("يضيف تكلفة الإضافة المشمولة إلى معيار تكلفة الوصفة ويُبقي الإضافة المجانية خارج معيار الوصفة", () => {
    const breakdown = db.calculateRecipeCostBreakdown({
      lines: [{ quantity: "1", unitCost: "25.00", wastePercent: "0" }],
      includedAddons: [{ unitCost: "7.50" }], outputQuantity: "1", yieldPercent: "100",
    });
    expect(breakdown).toEqual({ ingredientCost: "25.00", includedAddonCost: "7.50", totalCost: "32.50", unitCost: "32.50" });
    expect(dbSource).toContain("selectIncludedAddonsForRecipeCost");
    expect(dbSource).toContain("costBreakdown: calculateRecipeCostBreakdown");
    expect(dbSource).toContain("rows.map((recipe) => getRecipeWithLines(recipe.id))");
    expect(recipesPageSource).toContain("r.costBreakdown?.totalCost ?? r.standardCost");
    expect(recipesPageSource).toContain("t.mfg.includedAddonsCost");
  });

  it("يعيد recipes.get تكلفة وصفة محسوبة تشمل الإضافة المشمولة عبر مسار tRPC الفعلي", async () => {
    vi.spyOn(db, "hasAtomicPermission").mockResolvedValue(true);
    db.setRecipeDetailPortForTesting({
      getRecipe: async () => ({ id: 51, productId: 20, outputQuantity: "1", yieldPercent: "100", name: "وجبة الجمعة" }),
      listLines: async () => [{ quantity: "1", unitCost: "25.00", wastePercent: "0", ingredientId: 11 }],
      listIncludedAddons: async () => [{ addonProductId: 21, pricingMode: "included", unitCost: "7.50", name: "مشروب" }],
    });
    const recipe = await appRouter.createCaller(recipeContext()).recipes.get({ id: 51 });
    expect(recipe?.costBreakdown).toEqual({ ingredientCost: "25.00", includedAddonCost: "7.50", totalCost: "32.50", unitCost: "32.50" });
  });

  it("يحسب recipes.create التكلفة المعيارية من المكونات والإضافة المشمولة ولا يقبل القيمة اليدوية المتعارضة", async () => {
    let savedRecipe: Record<string, unknown> | undefined;
    const created = await db.createRecipe({ productId: 20, name: "وجبة الجمعة", outputQuantity: "1", yieldPercent: "100", standardCost: "1.00", lines: [{ ingredientId: 11, quantity: "1", unitCost: "25.00" }] }, {
      listIncludedAddons: async () => [{ pricingMode: "included", unitCost: "7.50" }],
      createRecipe: async (recipe) => { savedRecipe = recipe; return 53; },
      createLines: async () => undefined,
    });
    expect(created).toMatchObject({ id: 53, standardCost: "32.50", costBreakdown: { includedAddonCost: "7.50" } });
    expect(savedRecipe).toMatchObject({ standardCost: "32.50" });
  });

  it("يدخل وضع included وحده في تكلفة الوصفة، بينما free وseparate يبقيان خارجها مع بقاء تكلفتهما في COGS عند البيع", () => {
    expect(db.selectIncludedAddonsForRecipeCost([
      { pricingMode: "included" as const, unitCost: "7.50" },
      { pricingMode: "free" as const, unitCost: "8.00" },
      { pricingMode: "separate" as const, unitCost: "9.00" },
    ])).toEqual([{ pricingMode: "included", unitCost: "7.50" }]);
    expect(recipesPageSource).toContain("t.mfg.recipeCostCalculated");
    expect(recipesPageSource).not.toContain("form.standardCost");
  });
});
