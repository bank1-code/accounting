import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";

const source = readFileSync(resolve(process.cwd(), "server/routers.ts"), "utf8");

type Guard = "atomic" | "atomic_any" | "public" | "protected" | "admin" | "unknown";
type Procedure = { route: string; kind: "query" | "mutation"; guard: Guard; permissions: string[] };

const sourceFile = ts.createSourceFile("routers.ts", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);

function propertyName(name: ts.PropertyName) {
  return ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name) ? name.text : undefined;
}

function callIdentifier(call: ts.CallExpression) {
  return ts.isIdentifier(call.expression) ? call.expression.text : undefined;
}

function hasProcedureKind(node: ts.Node): "query" | "mutation" | undefined {
  let kind: "query" | "mutation" | undefined;
  const visit = (current: ts.Node) => {
    if (ts.isPropertyAccessExpression(current) && (current.name.text === "query" || current.name.text === "mutation")) kind ??= current.name.text;
    current.forEachChild(visit);
  };
  visit(node);
  return kind;
}

function guardFor(node: ts.Node): Pick<Procedure, "guard" | "permissions"> {
  let guard: Guard = "unknown";
  let permissions: string[] = [];
  const visit = (current: ts.Node) => {
    if (ts.isPropertyAccessExpression(current) && ts.isIdentifier(current.expression)) {
      if (current.expression.text === "publicProcedure") guard = "public";
      if (current.expression.text === "protectedProcedure") guard = "protected";
      if (current.expression.text === "adminProcedure") guard = "admin";
    }
    if (ts.isCallExpression(current)) {
      const identifier = callIdentifier(current);
      if (identifier === "atomicPermissionProcedure") {
        guard = "atomic";
        permissions = ts.isStringLiteral(current.arguments[0]) ? [current.arguments[0].text] : [];
      }
      if (identifier === "atomicAnyPermissionProcedure") {
        guard = "atomic_any";
        permissions = ts.isArrayLiteralExpression(current.arguments[0])
          ? current.arguments[0].elements.filter(ts.isStringLiteral).map((item) => item.text)
          : [];
      }
      if (identifier === "publicProcedure") guard = "public";
      if (identifier === "protectedProcedure") guard = "protected";
      if (identifier === "adminProcedure") guard = "admin";
    }
    current.forEachChild(visit);
  };
  visit(node);
  return { guard, permissions };
}

function collectRouterProcedures(routerCall: ts.CallExpression, parentPath: string[] = []): Procedure[] {
  const config = routerCall.arguments.find(ts.isObjectLiteralExpression);
  if (!config) return [];
  return config.properties.flatMap((property) => {
    if (!ts.isPropertyAssignment(property)) return [];
    const name = propertyName(property.name);
    if (!name) return [];
    const route = [...parentPath, name];
    if (ts.isCallExpression(property.initializer) && callIdentifier(property.initializer) === "router") return collectRouterProcedures(property.initializer, route);
    const kind = hasProcedureKind(property.initializer);
    if (!kind) return [];
    return [{ route: route.join("."), kind, ...guardFor(property.initializer) }];
  });
}

const appRouterCall = sourceFile.statements
  .flatMap((statement) => ts.isVariableStatement(statement) ? statement.declarationList.declarations : [])
  .map((declaration) => declaration.initializer)
  .find((initializer): initializer is ts.CallExpression => ts.isCallExpression(initializer) && callIdentifier(initializer) === "router");

const procedures = appRouterCall ? collectRouterProcedures(appRouterCall) : [];
const nonAtomicExceptions: Record<string, Guard> = {
  "auth.me": "public",
  "auth.localCredentialsConfigured": "public",
  "auth.adminStatus": "admin",
  "auth.login": "public",
  "auth.logout": "public",
  "accessControl.myPermissions": "protected",
};

const warehouseScopeRouteMatrix = {
  "stock.byWarehouse": "inventory.view",
  "stock.availableBatches": "inventory.view",
  "transfers.create": "inventory.transfer.create",
  "transfers.approve": "inventory.transfer.approve",
  "transfers.dispatch": "inventory.transfer.approve",
  "transfers.receive": "inventory.transfer.approve",
  "inventoryCounts.create": "inventory.count.create",
  "inventoryCounts.approve": "inventory.count.approve",
  "wasteVouchers.create": "inventory.waste.create",
  "wasteVouchers.approve": "inventory.waste.approve",
  "wasteVouchers.cancel": "inventory.waste.create",
  "productionOrders.create": "production.order.create",
  "productionOrders.complete": "production.order.complete",
  "purchaseOrders.create": "purchasing.order.create",
  "purchaseInvoices.create": "purchasing.order.create",
  "purchaseInvoices.approveItems": "purchasing.invoice.items_approve",
  "purchaseInvoices.approveAccounts": "purchasing.invoice.accounts_approve",
} as const;

const warehouseScopeAdministrativeExceptions = [
  "accessControl.assignUserRole",
  "accessControl.setUserPermissionOverride",
] as const;

describe("مصفوفة المسارات والصلاحيات الذرية", () => {
  it("يستخرج كل إجراءات tRPC الحساسة ويثبت أن كلاً منها يحمل صلاحية ذرية معلنة", () => {
    expect(procedures.length).toBeGreaterThan(70);
    const unguarded = procedures.filter((procedure) => {
      const expectedException = nonAtomicExceptions[procedure.route];
      if (expectedException) return procedure.guard !== expectedException;
      return !["atomic", "atomic_any"].includes(procedure.guard) || procedure.permissions.length === 0;
    });
    expect(unguarded, `Non-compliant procedures: ${JSON.stringify(unguarded, null, 2)}`).toEqual([]);
  });

  it("يطابق قائمة الاستثناءات غير الذرية المعلنة ولا يسمح باستثناء إضافي", () => {
    const actualExceptions = procedures
      .filter((procedure) => !["atomic", "atomic_any"].includes(procedure.guard))
      .map((procedure) => ({ route: procedure.route, guard: procedure.guard }))
      .sort((left, right) => left.route.localeCompare(right.route));
    const declaredExceptions = Object.entries(nonAtomicExceptions)
      .map(([route, guard]) => ({ route, guard }))
      .sort((left, right) => left.route.localeCompare(right.route));
    expect(actualExceptions).toEqual(declaredExceptions);
  });

  it("يفرض نطاق warehouseId صريحاً على دورة إذن التوالف، بما في ذلك اعتماد مخزن فرعي", () => {
    const wasteCreate = procedures.find((procedure) => procedure.route === "wasteVouchers.create");
    const wasteApprove = procedures.find((procedure) => procedure.route === "wasteVouchers.approve");
    expect(wasteCreate).toMatchObject({ guard: "atomic", permissions: ["inventory.waste.create"] });
    expect(wasteApprove).toMatchObject({ guard: "atomic", permissions: ["inventory.waste.approve"] });
    expect(source).toContain('atomicPermissionProcedure("inventory.waste.create", (input) => ({ warehouseId: (input as { warehouseId?: number }).warehouseId }))');
    expect(source).toContain('assertAtomicPermission(ctx.user.id, "inventory.waste.approve", { warehouseId: voucher.warehouseId })');
  });

  it("يحصر كل إجراءات المخزون الحالية ذات warehouseId ويمنع فقد نطاقها بعد تحليل الإدخال", () => {
    const warehouseScopedAssertions = [
      'assertAtomicPermission(ctx.user.id, "inventory.view", { warehouseId: input.warehouseId })',
      'assertAtomicPermission(ctx.user.id, "inventory.transfer.create", { warehouseId: input.fromWarehouseId })',
      'assertAtomicPermission(ctx.user.id, "inventory.transfer.approve", { warehouseId: transfer.fromWarehouseId })',
      'assertAtomicPermission(ctx.user.id, "inventory.transfer.approve", { warehouseId: transfer.toWarehouseId })',
      'assertAtomicPermission(ctx.user.id, "inventory.count.create", { warehouseId: input.warehouseId })',
      'assertAtomicPermission(ctx.user.id, "inventory.count.approve", { warehouseId: count.warehouseId })',
      'assertAtomicPermission(ctx.user.id, "inventory.waste.create", { warehouseId: input.warehouseId })',
      'assertAtomicPermission(ctx.user.id, "inventory.waste.approve", { warehouseId: voucher.warehouseId })',
      'assertAtomicPermission(ctx.user.id, "inventory.waste.create", { warehouseId: voucher.warehouseId })',
      'assertAtomicPermission(ctx.user.id, "production.order.create", { warehouseId: input.warehouseId, branchId: input.branchId })',
      'assertAtomicPermission(ctx.user.id, "production.order.create", { warehouseId: input.sourceWarehouseId, branchId: input.branchId })',
      'assertAtomicPermission(ctx.user.id, "production.order.complete", { warehouseId: order.warehouseId, branchId: order.branchId })',
      'assertAtomicPermission(ctx.user.id, "production.order.complete", { warehouseId: order.sourceWarehouseId, branchId: order.branchId })',
      'assertAtomicPermission(ctx.user.id, "purchasing.order.create", { warehouseId: input.warehouseId })',
      'assertAtomicPermission(ctx.user.id, "purchasing.invoice.items_approve", { warehouseId: invoice.warehouseId })',
      'assertAtomicPermission(ctx.user.id, "purchasing.invoice.accounts_approve", { warehouseId: invoice.warehouseId })',
    ];
    for (const assertion of warehouseScopedAssertions) expect(source).toContain(assertion);
    expect(source).toContain('userId: z.number(), roleId: z.number(), branchId: z.number().optional(), warehouseId: z.number().optional()');
    expect(source).toContain('warehouseId: z.number().optional(), costCenterId: z.number().optional(), reason: z.string().min(3).max(500)');
  });

  it("يعلن مصفوفة كاملة لكل route تشغيلي ذي warehouseId ويوثق استثناءات إسناد النطاق", () => {
    const matrixEntries = Object.entries(warehouseScopeRouteMatrix);
    expect(matrixEntries).toHaveLength(17);
    for (const [route, permission] of matrixEntries) {
      const procedure = procedures.find((candidate) => candidate.route === route);
      expect(procedure, `Missing warehouse-scoped route: ${route}`).toBeDefined();
      expect(procedure?.permissions).toContain(permission);
    }
    for (const exception of warehouseScopeAdministrativeExceptions) {
      expect(procedures.some((procedure) => procedure.route === exception)).toBe(true);
    }
  });
});
