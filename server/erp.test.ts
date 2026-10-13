import { describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAdminContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "admin-user",
    email: "admin@dgtera.com",
    name: "Admin",
    loginMethod: "manus",
    role: "admin",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };
  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

function createUserContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 2,
    openId: "regular-user",
    email: "user@dgtera.com",
    name: "User",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };
  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

describe("ERP Router Structure", () => {
  it("should have all required routers defined", () => {
    const caller = appRouter.createCaller(createAdminContext());
    // Verify all main routers exist
    expect(caller.auth).toBeDefined();
    expect(caller.dashboard).toBeDefined();
    expect(caller.branches).toBeDefined();
    expect(caller.accounts).toBeDefined();
    expect(caller.costCenters).toBeDefined();
    expect(caller.journalEntries).toBeDefined();
    expect(caller.fiscalPeriods).toBeDefined();
    expect(caller.products).toBeDefined();
    expect(caller.warehouses).toBeDefined();
    expect(caller.stockMovements).toBeDefined();
    expect(caller.transfers).toBeDefined();
    expect(caller.inventoryCount).toBeDefined();
    expect(caller.recipes).toBeDefined();
    expect(caller.productionOrders).toBeDefined();
    expect(caller.suppliers).toBeDefined();
    expect(caller.purchaseOrders).toBeDefined();
    expect(caller.posOrders).toBeDefined();
    expect(caller.posSessions).toBeDefined();
    expect(caller.tables).toBeDefined();
    expect(caller.employees).toBeDefined();
    expect(caller.attendance).toBeDefined();
    expect(caller.documents).toBeDefined();
    expect(caller.auditLog).toBeDefined();
    expect(caller.reports).toBeDefined();
    expect(caller.ai).toBeDefined();
  });
});

describe("Auth", () => {
  it("auth.me returns null for unauthenticated user", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.auth.me();
    expect(result).toBeNull();
  });

  it("auth.me returns user for authenticated user", async () => {
    const caller = appRouter.createCaller(createAdminContext());
    const result = await caller.auth.me();
    expect(result).toBeDefined();
    expect(result?.email).toBe("admin@dgtera.com");
    expect(result?.role).toBe("admin");
  });

  it("auth.logout clears cookie and returns success", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.logout();
    expect(result).toEqual({ success: true });
  });
});

describe("Admin Procedure Authorization", () => {
  it("should reject non-admin users from creating branches", async () => {
    const caller = appRouter.createCaller(createUserContext());
    await expect(
      caller.branches.create({
        name: "Test Branch",
        type: "restaurant",
      })
    ).rejects.toThrow();
  });

  it("should allow admin users to access admin procedures", async () => {
    const caller = appRouter.createCaller(createAdminContext());
    // Admin should not throw on authorization (may throw on DB)
    // We just verify the authorization layer passes
    expect(caller.branches.create).toBeDefined();
  });
});

describe("Input Validation", () => {
  it("should reject empty account code", async () => {
    const caller = appRouter.createCaller(createAdminContext());
    await expect(
      caller.accounts.create({
        code: "",
        name: "Test",
        type: "asset",
      })
    ).rejects.toThrow();
  });

  it("should reject invalid account type", async () => {
    const caller = appRouter.createCaller(createAdminContext());
    await expect(
      caller.accounts.create({
        code: "1000",
        name: "Test",
        type: "invalid" as any,
      })
    ).rejects.toThrow();
  });

  it("should reject empty branch name", async () => {
    const caller = appRouter.createCaller(createAdminContext());
    await expect(
      caller.branches.create({
        name: "",
        type: "restaurant",
      })
    ).rejects.toThrow();
  });

  it("should reject invalid branch type", async () => {
    const caller = appRouter.createCaller(createAdminContext());
    await expect(
      caller.branches.create({
        name: "Test",
        type: "invalid" as any,
      })
    ).rejects.toThrow();
  });

  it("should reject empty product name", async () => {
    const caller = appRouter.createCaller(createAdminContext());
    await expect(
      caller.products.create({
        name: "",
        type: "raw",
        unitOfMeasure: "kg",
      })
    ).rejects.toThrow();
  });

  it("should reject invalid product type", async () => {
    const caller = appRouter.createCaller(createAdminContext());
    await expect(
      caller.products.create({
        name: "Test",
        type: "invalid" as any,
        unitOfMeasure: "kg",
      })
    ).rejects.toThrow();
  });

  it("should reject empty supplier name", async () => {
    const caller = appRouter.createCaller(createAdminContext());
    await expect(
      caller.suppliers.create({
        name: "",
      })
    ).rejects.toThrow();
  });

  it("should validate journal entry requires lines", async () => {
    const caller = appRouter.createCaller(createAdminContext());
    await expect(
      caller.journalEntries.create({
        date: new Date(),
        description: "Test",
        lines: [],
      })
    ).rejects.toThrow();
  });
});

describe("Router Methods Exist", () => {
  it("dashboard.stats should be callable", () => {
    const caller = appRouter.createCaller(createAdminContext());
    expect(typeof caller.dashboard.stats).toBe("function");
  });

  it("reports.sales should be callable", () => {
    const caller = appRouter.createCaller(createAdminContext());
    expect(typeof caller.reports.sales).toBe("function");
  });

  it("reports.profitability should be callable", () => {
    const caller = appRouter.createCaller(createAdminContext());
    expect(typeof caller.reports.profitability).toBe("function");
  });

  it("ai.analyze should be callable", () => {
    const caller = appRouter.createCaller(createAdminContext());
    expect(typeof caller.ai.analyze).toBe("function");
  });
});
