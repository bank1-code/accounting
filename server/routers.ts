import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { sdk } from "./_core/sdk";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import * as db from "./db";
import { createEncryptedDatabaseBackup, testRestoreEncryptedBackupInIsolation, verifyEncryptedBackup } from "./backup-service";

function authUser(user: NonNullable<Awaited<ReturnType<typeof db.getUserById>>>) {
  return { id: user.id, username: user.username, name: user.name, email: user.email, role: user.role, loginMethod: user.loginMethod };
}

const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== 'admin') {
    throw new Error('Forbidden: Admin access required');
  }
  return next({ ctx });
});

async function assertAtomicPermission(
  userId: number,
  permissionCode: string,
  scope: db.PermissionScope = {},
) {
  if (!(await db.hasAtomicPermission(userId, permissionCode, scope))) {
    throw new TRPCError({ code: "FORBIDDEN", message: `Missing permission: ${permissionCode}` });
  }
}

const atomicPermissionProcedure = (
  permissionCode: string,
  getScope?: (input: unknown) => db.PermissionScope,
) => protectedProcedure.use(async ({ ctx, input, next }) => {
  // tRPC runs this middleware before this procedure's input parser. Scoped
  // permissions are therefore asserted inside the mutation after validation.
  if (getScope && input === undefined) return next({ ctx });
  await assertAtomicPermission(ctx.user.id, permissionCode, getScope?.(input) ?? {});
  return next({ ctx });
});

const atomicAnyPermissionProcedure = (
  permissionCodes: string[],
  getScope?: (input: unknown) => db.PermissionScope,
) => protectedProcedure.use(async ({ ctx, input, next }) => {
  if (getScope && input === undefined) return next({ ctx });
  const scope = getScope?.(input) ?? {};
  for (const permissionCode of permissionCodes) {
    if (await db.hasAtomicPermission(ctx.user.id, permissionCode, scope)) return next({ ctx });
  }
  throw new TRPCError({ code: "FORBIDDEN", message: `Missing one of permissions: ${permissionCodes.join(", ")}` });
});

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user ? authUser(opts.ctx.user) : null),
    localCredentialsConfigured: publicProcedure.query(() => ({ configured: db.localAdminCredentialsConfigured() })),
    adminStatus: adminProcedure.query(() => ({ admin: true })),
    login: publicProcedure.input(z.object({ username: z.string().min(1).max(64), password: z.string().min(1).max(256) })).mutation(async ({ input, ctx }) => {
      const loginKey = db.localLoginAttemptKey(input.username, ctx.req.ip || ctx.req.socket?.remoteAddress || "unknown");
      const attemptStatus = db.getLocalLoginAttemptStatus(loginKey);
      if (attemptStatus.blocked) throw new Error(`Too many login attempts. Try again in ${attemptStatus.retryAfterSeconds} seconds`);
      await db.ensureLocalAdminUser();
      const user = await db.authenticateLocalUser(input.username, input.password);
      if (!user) { db.recordLocalLoginFailure(loginKey); throw new Error("Invalid username or password"); }
      db.recordLocalLoginSuccess(loginKey);
      const sessionToken = await sdk.createSessionToken(user.id, { username: user.username ?? String(user.id) });
      ctx.res.cookie(COOKIE_NAME, sessionToken, getSessionCookieOptions(ctx.req));
      return { user: authUser(user) };
    }),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // ============ DYNAMIC RBAC / ATOMIC PERMISSIONS ============
  accessControl: router({
    myPermissions: protectedProcedure.query(async ({ ctx }) => db.listEffectivePermissionCodes(ctx.user.id)),
    users: atomicPermissionProcedure("admin.roles.manage").query(async () => db.listUsersForAccessControl()),
    roles: atomicPermissionProcedure("admin.roles.manage").query(async () => db.listRoles()),
    permissions: atomicPermissionProcedure("admin.roles.manage").query(async () => db.listPermissions()),
    rolePermissions: atomicPermissionProcedure("admin.roles.manage").input(z.object({ roleId: z.number() })).query(async ({ input }) => db.getRolePermissionIds(input.roleId)),
    createRole: atomicPermissionProcedure("admin.roles.manage").input(z.object({
      code: z.string().min(3).max(96).regex(/^[a-z0-9_:-]+$/), name: z.string().min(2).max(160),
      nameEn: z.string().max(160).optional(), description: z.string().max(2000).optional(),
    })).mutation(async ({ input, ctx }) => {
      const result = await db.createRole({ ...input, createdBy: ctx.user.id });
      await db.logAudit({ userId: ctx.user.id, action: "create", entityType: "role", entityId: result.id, newValues: input });
      return result;
    }),
    updateRole: atomicPermissionProcedure("admin.roles.manage").input(z.object({
      id: z.number(), name: z.string().min(2).max(160).optional(), nameEn: z.string().max(160).optional(),
      description: z.string().max(2000).optional(), isActive: z.boolean().optional(),
    })).mutation(async ({ input, ctx }) => {
      const { id, ...data } = input;
      await db.updateRole(id, data);
      await db.logAudit({ userId: ctx.user.id, action: "update", entityType: "role", entityId: id, newValues: data });
    }),
    setRolePermissions: atomicPermissionProcedure("admin.roles.manage").input(z.object({
      roleId: z.number(), permissionIds: z.array(z.number()).max(200), deniedPermissionIds: z.array(z.number()).max(200),
    })).mutation(async ({ input, ctx }) => {
      await db.setRolePermissions(input.roleId, input.permissionIds, input.deniedPermissionIds, ctx.user.id);
      await db.logAudit({ userId: ctx.user.id, action: "set_permissions", entityType: "role", entityId: input.roleId, newValues: input });
    }),
    userRoles: atomicPermissionProcedure("admin.roles.manage").input(z.object({ userId: z.number() })).query(async ({ input }) => db.listUserRoleAssignments(input.userId)),
    userPermissionOverrides: atomicPermissionProcedure("admin.roles.manage").input(z.object({ userId: z.number() })).query(async ({ input }) => db.listUserPermissionOverrides(input.userId)),
    assignUserRole: atomicPermissionProcedure("admin.roles.manage").input(z.object({
      userId: z.number(), roleId: z.number(), branchId: z.number().optional(), warehouseId: z.number().optional(),
      costCenterId: z.number().optional(), expiresAt: z.date().optional(),
    })).mutation(async ({ input, ctx }) => {
      const result = await db.assignUserRole({ ...input, assignedBy: ctx.user.id });
      await db.logAudit({ userId: ctx.user.id, action: "assign_role", entityType: "user_role", entityId: result.id, newValues: input });
      return result;
    }),
    setUserRoleActive: atomicPermissionProcedure("admin.roles.manage").input(z.object({ id: z.number(), isActive: z.boolean() })).mutation(async ({ input, ctx }) => {
      await db.setUserRoleActive(input.id, input.isActive);
      await db.logAudit({ userId: ctx.user.id, action: "set_role_assignment_status", entityType: "user_role", entityId: input.id, newValues: input });
    }),
    setUserPermissionOverride: atomicPermissionProcedure("admin.roles.manage").input(z.object({
      userId: z.number(), permissionId: z.number(), effect: z.enum(["allow", "deny"]), branchId: z.number().optional(),
      warehouseId: z.number().optional(), costCenterId: z.number().optional(), reason: z.string().min(3).max(500), expiresAt: z.date().optional(),
    })).mutation(async ({ input, ctx }) => {
      const result = await db.setUserPermissionOverride({ ...input, grantedBy: ctx.user.id });
      await db.logAudit({ userId: ctx.user.id, action: "set_permission_override", entityType: "user_permission_override", entityId: result.id, newValues: input });
      return result;
    }),
  }),

  // ============ DASHBOARD ============
  dashboard: router({
    stats: atomicAnyPermissionProcedure(["accounting.reports.view", "admin.settings.view"]).query(async () => db.getDashboardStats()),
    adminOverview: atomicAnyPermissionProcedure(["admin.audit.view", "admin.settings.view"]).query(async () => db.getAdminDashboardOverview()),
  }),

  // ============ BRANCHES ============
  branches: router({
    list: atomicAnyPermissionProcedure(["admin.settings.view", "admin.settings.manage"]).query(async () => db.listBranches()),
    create: atomicPermissionProcedure("admin.settings.manage").input(z.object({
      name: z.string().min(1), nameEn: z.string().optional(), type: z.enum(["restaurant", "grocery", "accessories", "warehouse", "kitchen"]),
      address: z.string().optional(), phone: z.string().optional(), isCentralKitchen: z.boolean().optional(), isCentralWarehouse: z.boolean().optional(),
    })).mutation(async ({ input }) => db.createBranch(input)),
    update: atomicPermissionProcedure("admin.settings.manage").input(z.object({
      id: z.number(), name: z.string().optional(), nameEn: z.string().optional(), isActive: z.boolean().optional(),
    })).mutation(async ({ input }) => { const { id, ...data } = input; return db.updateBranch(id, data); }),
  }),

  // ============ ACCOUNTS ============
  accounts: router({
    list: atomicAnyPermissionProcedure(["accounting.coa.view", "accounting.coa.manage"]).query(async () => db.listAccounts()),
    create: atomicPermissionProcedure("accounting.coa.manage").input(z.object({
      code: z.string().min(1), name: z.string().min(1), nameEn: z.string().optional(),
      type: z.enum(["asset", "liability", "equity", "revenue", "expense"]),
      parentId: z.number().optional(), level: z.number().optional(), isSystem: z.boolean().optional(),
    })).mutation(async ({ input }) => db.createAccount(input)),
    update: atomicPermissionProcedure("accounting.coa.manage").input(z.object({
      id: z.number(), code: z.string().optional(), name: z.string().optional(), nameEn: z.string().optional(),
      type: z.enum(["asset", "liability", "equity", "revenue", "expense"]).optional(), parentId: z.number().optional(), isActive: z.boolean().optional(),
    })).mutation(async ({ input }) => { const { id, ...data } = input; return db.updateAccount(id, data); }),
  }),

  accountingPosting: router({
    posMap: atomicAnyPermissionProcedure(["admin.settings.view", "admin.settings.manage"]).query(async () => db.getPosPostingAccountMap()),
    posCashVarianceAlertThreshold: atomicAnyPermissionProcedure(["admin.settings.view", "admin.settings.manage"]).query(async () => db.getPosCashVarianceAlertThreshold()),
    inventoryExpiryAlertDays: atomicAnyPermissionProcedure(["admin.settings.view", "admin.settings.manage"]).query(async () => db.getInventoryExpiryAlertDays()),
    notificationRules: atomicAnyPermissionProcedure(["admin.settings.view", "admin.settings.manage"]).query(async () => db.getNotificationRules()),
    savePosMap: atomicPermissionProcedure("admin.settings.manage").input(z.object({
      cashAccountId: z.number().int().positive(), cardClearingAccountId: z.number().int().positive(),
      salesRevenueAccountId: z.number().int().positive(), outputVatAccountId: z.number().int().positive(), inputVatAccountId: z.number().int().positive(),
      inventoryAccountId: z.number().int().positive(), workInProgressAccountId: z.number().int().positive(), finishedGoodsInventoryAccountId: z.number().int().positive(), inventoryGainAccountId: z.number().int().positive(), inventoryLossAccountId: z.number().int().positive(), wasteExpenseAccountId: z.number().int().positive(), cogsAccountId: z.number().int().positive(), accountsPayableAccountId: z.number().int().positive(),
    })).mutation(async ({ input }) => db.savePosPostingAccountMap(input)),
    savePosCashVarianceAlertThreshold: atomicPermissionProcedure("admin.settings.manage").input(z.object({ value: z.string().regex(/^\d+(\.\d{1,2})?$/) }))
      .mutation(async ({ input }) => db.savePosCashVarianceAlertThreshold(input.value)),
    saveInventoryExpiryAlertDays: atomicPermissionProcedure("admin.settings.manage").input(z.object({ value: z.number().int().min(1).max(3650) }))
      .mutation(async ({ input }) => db.saveInventoryExpiryAlertDays(input.value)),
    saveNotificationRules: atomicPermissionProcedure("admin.settings.manage").input(z.object({ inventoryReorder: z.boolean(), inventoryExpiry: z.boolean(), posCashVariance: z.boolean() }))
      .mutation(async ({ input }) => db.saveNotificationRules(input)),
    scanInventoryExpiryAlerts: atomicPermissionProcedure("admin.settings.manage").mutation(async () => db.scanInventoryExpiryAlerts()),
  }),

  // ============ COST CENTERS ============
  costCenters: router({
    list: atomicAnyPermissionProcedure(["accounting.coa.manage", "accounting.reports.view"]).query(async () => db.listCostCenters()),
    create: atomicPermissionProcedure("accounting.coa.manage").input(z.object({
      name: z.string().min(1), code: z.string().min(1), branchId: z.number().optional(), type: z.enum(["profit", "cost"]).optional(),
    })).mutation(async ({ input }) => db.createCostCenter(input)),
    update: atomicPermissionProcedure("accounting.coa.manage").input(z.object({
      id: z.number(), name: z.string().optional(), code: z.string().optional(), branchId: z.number().optional(),
      type: z.enum(["profit", "cost"]).optional(), isActive: z.boolean().optional(),
    })).mutation(async ({ input }) => { const { id, ...data } = input; return db.updateCostCenter(id, data); }),
  }),

  // ============ JOURNAL ENTRIES ============
  journalEntries: router({
    list: atomicAnyPermissionProcedure(["accounting.journal.create", "accounting.journal.post", "accounting.reports.view"]).input(z.object({ limit: z.number().optional(), offset: z.number().optional() }).optional()).query(async ({ input }) => db.listJournalEntries(input?.limit, input?.offset)),
    get: atomicAnyPermissionProcedure(["accounting.journal.create", "accounting.journal.post", "accounting.reports.view"]).input(z.object({ id: z.number() })).query(async ({ input }) => db.getJournalEntryWithLines(input.id)),
    nextNumber: atomicPermissionProcedure("accounting.journal.create").query(async () => db.getNextEntryNumber()),
    create: atomicPermissionProcedure("accounting.journal.create").input(z.object({
      entryNumber: z.string().optional(), date: z.date(), description: z.string().optional(), reference: z.string().optional(),
      sourceEntryNumber: z.string().max(32).optional(),
      referenceType: z.string().optional(), referenceId: z.number().optional(),
      lines: z.array(z.object({ accountId: z.number(), costCenterId: z.number().optional(), branchId: z.number().optional(), debit: z.string(), credit: z.string(), description: z.string().optional() })),
    })).mutation(async ({ input, ctx }) => db.createJournalEntry({ ...input, createdBy: ctx.user.id })),
    post: atomicPermissionProcedure("accounting.journal.post").input(z.object({ id: z.number() })).mutation(async ({ input, ctx }) => db.postJournalEntry(input.id, ctx.user.id)),
  }),
  journalTemplates: router({
    list: atomicPermissionProcedure("accounting.journal.create").query(async ({ ctx }) => db.listJournalEntryTemplates(ctx.user.id)),
    create: atomicPermissionProcedure("accounting.journal.create").input(z.object({
      name: z.string().trim().min(1).max(160), sourceEntryNumber: z.string().max(32).optional(),
      templateData: z.object({ description: z.string(), reference: z.string(), lines: z.array(z.object({ accountId: z.number(), costCenterId: z.number().optional(), branchId: z.number().optional(), debit: z.string(), credit: z.string(), description: z.string().optional() })).min(2) }),
    })).mutation(async ({ input, ctx }) => db.createJournalEntryTemplate({ ...input, createdBy: ctx.user.id })),
    deactivate: atomicPermissionProcedure("accounting.journal.create").input(z.object({ id: z.number() })).mutation(async ({ input, ctx }) => db.deactivateJournalEntryTemplate(input.id, ctx.user.id)),
  }),
  // ============ TREASURY VOUCHERS (سندات القبض والصرف) ============
  treasuryVouchers: router({
    list: atomicAnyPermissionProcedure(["treasury.receipt.create", "treasury.payment.create", "treasury.voucher.approve", "treasury.voucher.post"], (input) => ({ branchId: (input as { branchId: number }).branchId }))
      .input(z.object({ branchId: z.number(), limit: z.number().min(1).max(200).optional() })).query(async ({ input }) => db.listTreasuryVouchers(input.branchId, input.limit)),
    get: atomicAnyPermissionProcedure(["treasury.receipt.create", "treasury.payment.create", "treasury.voucher.approve", "treasury.voucher.post"], (input) => ({ branchId: (input as { branchId: number }).branchId }))
      .input(z.object({ id: z.number(), branchId: z.number() })).query(async ({ input }) => { const voucher = await db.getTreasuryVoucherWithLines(input.id); if (!voucher || voucher.branchId !== input.branchId) throw new TRPCError({ code: "NOT_FOUND", message: "Treasury voucher not found" }); return voucher; }),
    nextNumber: atomicAnyPermissionProcedure(["treasury.receipt.create", "treasury.payment.create"], (input) => ({ branchId: (input as { branchId: number }).branchId }))
      .input(z.object({ voucherType: z.enum(["receipt", "payment"]), branchId: z.number() })).query(async ({ input, ctx }) => { await assertAtomicPermission(ctx.user.id, input.voucherType === "receipt" ? "treasury.receipt.create" : "treasury.payment.create", { branchId: input.branchId }); return db.getNextTreasuryVoucherNumber(input.voucherType); }),
    create: atomicAnyPermissionProcedure(["treasury.receipt.create", "treasury.payment.create"], (input) => ({ branchId: (input as { branchId: number }).branchId }))
      .input(z.object({ voucherType: z.enum(["receipt", "payment"]), date: z.date(), branchId: z.number(), description: z.string().max(2000).optional(), settlementAccountId: z.number(), paymentMethod: z.enum(["cash", "check", "transfer", "card"]).optional(), referenceNumber: z.string().max(64).optional(), lines: z.array(z.object({ accountId: z.number(), costCenterId: z.number().optional(), description: z.string().max(2000).optional(), amount: z.string() })).min(1) }))
      .mutation(async ({ input, ctx }) => { await assertAtomicPermission(ctx.user.id, input.voucherType === "receipt" ? "treasury.receipt.create" : "treasury.payment.create", { branchId: input.branchId }); return db.createTreasuryVoucher({ ...input, createdBy: ctx.user.id }); }),
    approve: atomicPermissionProcedure("treasury.voucher.approve", (input) => ({ branchId: (input as { branchId: number }).branchId }))
      .input(z.object({ id: z.number(), branchId: z.number() })).mutation(async ({ input, ctx }) => { const voucher = await db.getTreasuryVoucherWithLines(input.id); if (!voucher || voucher.branchId !== input.branchId) throw new TRPCError({ code: "NOT_FOUND", message: "Treasury voucher not found" }); return db.approveTreasuryVoucher(input.id, ctx.user.id); }),
    post: atomicPermissionProcedure("treasury.voucher.post", (input) => ({ branchId: (input as { branchId: number }).branchId }))
      .input(z.object({ id: z.number(), branchId: z.number() })).mutation(async ({ input, ctx }) => { const voucher = await db.getTreasuryVoucherWithLines(input.id); if (!voucher || voucher.branchId !== input.branchId) throw new TRPCError({ code: "NOT_FOUND", message: "Treasury voucher not found" }); return db.postTreasuryVoucher(input.id, ctx.user.id); }),
    cancel: atomicAnyPermissionProcedure(["treasury.receipt.create", "treasury.payment.create"], (input) => ({ branchId: (input as { branchId: number }).branchId }))
      .input(z.object({ id: z.number(), branchId: z.number(), voucherType: z.enum(["receipt", "payment"]) })).mutation(async ({ input, ctx }) => { await assertAtomicPermission(ctx.user.id, input.voucherType === "receipt" ? "treasury.receipt.create" : "treasury.payment.create", { branchId: input.branchId }); const voucher = await db.getTreasuryVoucherWithLines(input.id); if (!voucher || voucher.branchId !== input.branchId || voucher.voucherType !== input.voucherType) throw new TRPCError({ code: "NOT_FOUND", message: "Treasury voucher not found" }); return db.cancelTreasuryVoucher(input.id); }),
  }),

  // ============ FISCAL PERIODS ============
  fiscalPeriods: router({
    list: atomicAnyPermissionProcedure(["accounting.period.close", "accounting.period.reopen", "accounting.reports.view"]).query(async () => db.listFiscalPeriods()),
    create: atomicPermissionProcedure("accounting.period.reopen").input(z.object({ name: z.string().min(1), startDate: z.date(), endDate: z.date() })).mutation(async ({ input }) => db.createFiscalPeriod(input)),
    close: atomicPermissionProcedure("accounting.period.close").input(z.object({ id: z.number(), retainedEarningsAccountId: z.number().optional() })).mutation(async ({ input, ctx }) => db.closeFiscalPeriod(input.id, ctx.user.id, input.retainedEarningsAccountId)),
    reopen: atomicPermissionProcedure("accounting.period.reopen").input(z.object({ id: z.number(), reason: z.string().min(3).max(1000) })).mutation(async ({ input, ctx }) => db.reopenFiscalPeriod(input.id, ctx.user.id, input.reason)),
  }),

  // ============ TRIAL BALANCE ============
  trialBalance: router({
    get: atomicPermissionProcedure("accounting.reports.view").query(async () => db.getTrialBalance()),
  }),

  // ============ COST ALLOCATIONS ============
  costAllocations: router({
    list: atomicAnyPermissionProcedure(["accounting.coa.manage", "accounting.reports.view"]).query(async () => db.listCostAllocations()),
    create: atomicPermissionProcedure("accounting.journal.create").input(z.object({
      name: z.string().min(1), method: z.enum(["sales_ratio", "branch_count", "employee_count", "custom"]),
      periodStart: z.date(), periodEnd: z.date(), totalAmount: z.string(), sourceAccountId: z.number(), sourceCostCenterId: z.number().optional(),
      lines: z.array(z.object({ costCenterId: z.number(), amount: z.string(), ratio: z.string().optional() })),
    })).mutation(async ({ input, ctx }) => db.createCostAllocation({ ...input, createdBy: ctx.user.id })),
    approve: atomicPermissionProcedure("accounting.journal.post").input(z.object({ id: z.number() })).mutation(async ({ input, ctx }) => db.approveCostAllocation(input.id, ctx.user.id)),
    post: atomicPermissionProcedure("accounting.journal.post").input(z.object({ id: z.number() })).mutation(async ({ input, ctx }) => db.postCostAllocation(input.id, ctx.user.id)),
  }),

  // ============ CATEGORIES ============
  categories: router({
    list: atomicPermissionProcedure("inventory.catalog.manage").query(async () => db.listCategories()),
    create: atomicPermissionProcedure("inventory.catalog.manage").input(z.object({
      name: z.string().min(1), parentId: z.number().optional(), type: z.enum(["product", "raw_material", "semi_finished", "finished"]).optional(),
    })).mutation(async ({ input }) => db.createCategory(input)),
  }),

  // ============ UNITS ============
  units: router({
    list: atomicPermissionProcedure("inventory.catalog.manage").query(async () => db.listUnits()),
    create: atomicPermissionProcedure("inventory.catalog.manage").input(z.object({
      name: z.string().min(1), symbol: z.string().min(1), baseUnitId: z.number().optional(), conversionFactor: z.string().optional(),
    })).mutation(async ({ input }) => db.createUnit(input)),
  }),

  // ============ PRODUCTS ============
  products: router({
    list: atomicPermissionProcedure("inventory.catalog.manage").query(async () => db.listProducts()),
    taxCodes: atomicPermissionProcedure("inventory.catalog.manage").query(async () => db.listTaxCodes()),
    taxCodeConsistency: atomicPermissionProcedure("inventory.catalog.manage").query(async () => db.getProductTaxCodeConsistency()),
    synchronizeTaxCodeRates: atomicPermissionProcedure("inventory.catalog.manage").mutation(async () => db.synchronizeProductTaxCodeRates()),
    addons: atomicPermissionProcedure("inventory.catalog.manage").input(z.object({ parentProductId: z.number() })).query(async ({ input }) => db.listProductAddons(input.parentProductId)),
    createAddon: atomicPermissionProcedure("inventory.catalog.manage").input(z.object({ parentProductId: z.number(), addonProductId: z.number(), pricingMode: z.enum(["included", "free", "separate"]), salePrice: z.string().optional() })).mutation(async ({ input }) => db.createProductAddon(input)),
    deleteAddon: atomicPermissionProcedure("inventory.catalog.manage").input(z.object({ id: z.number() })).mutation(async ({ input }) => db.deleteProductAddon(input.id)),
    create: atomicPermissionProcedure("inventory.catalog.manage").input(z.object({
      name: z.string().min(1), nameEn: z.string().optional(), sku: z.string().optional(), barcode: z.string().optional(),
      type: z.enum(["raw_material", "semi_finished", "finished", "direct_sale", "service"]),
      categoryId: z.number().optional(), unitId: z.number().optional(), costPrice: z.string().optional(), salePrice: z.string().optional(),
      taxRate: z.string().optional(), taxCodeId: z.number().optional(), reorderLevel: z.number().optional(), trackBatch: z.boolean().optional(), trackExpiry: z.boolean().optional(),
    })).mutation(async ({ input }) => db.createProduct(input)),
    update: atomicPermissionProcedure("inventory.catalog.manage").input(z.object({ id: z.number() }).passthrough()).mutation(async ({ input }) => { const { id, ...data } = input; return db.updateProduct(id as number, data); }),
  }),

  // ============ WAREHOUSES ============
  warehouses: router({
    list: atomicPermissionProcedure("inventory.catalog.manage").query(async () => db.listWarehouses()),
    create: atomicPermissionProcedure("inventory.catalog.manage").input(z.object({
      name: z.string().min(1), branchId: z.number().optional(), parentWarehouseId: z.number().optional(), type: z.enum(["central", "branch", "kitchen"]).optional(),
      storageCategory: z.enum(["general", "dry", "chilled", "frozen", "ingredients", "packaging", "finished_goods", "other"]).optional(),
    })).mutation(async ({ input }) => db.createWarehouse(input)),
  }),

  // ============ STOCK ============
  stock: router({
    all: atomicPermissionProcedure("inventory.view").query(async () => db.getAllStock()),
    byWarehouse: atomicPermissionProcedure("inventory.view", (input) => ({ warehouseId: (input as { warehouseId: number }).warehouseId })).input(z.object({ warehouseId: z.number() })).query(async ({ input, ctx }) => {
      await assertAtomicPermission(ctx.user.id, "inventory.view", { warehouseId: input.warehouseId });
      return db.getStockByWarehouse(input.warehouseId);
    }),
    availableBatches: atomicPermissionProcedure("inventory.view", (input) => ({ warehouseId: (input as { warehouseId: number }).warehouseId })).input(z.object({ warehouseId: z.number(), productId: z.number() })).query(async ({ input, ctx }) => {
      await assertAtomicPermission(ctx.user.id, "inventory.view", { warehouseId: input.warehouseId });
      return db.listAvailableInventoryBatches(input.warehouseId, input.productId);
    }),
    byProduct: atomicPermissionProcedure("inventory.view").input(z.object({ productId: z.number() })).query(async ({ input }) => db.getStockByProduct(input.productId)),
    movements: atomicPermissionProcedure("inventory.view").query(async () => db.listStockMovements()),
  }),

  // ============ TRANSFERS ============
  transfers: router({
    list: atomicAnyPermissionProcedure(["inventory.transfer.create", "inventory.transfer.approve"]).query(async () => db.listTransfers()),
    nextNumber: atomicPermissionProcedure("inventory.transfer.create").query(async () => db.getNextTransferNumber()),
    create: atomicPermissionProcedure("inventory.transfer.create", (input) => ({ warehouseId: (input as { fromWarehouseId?: number }).fromWarehouseId })).input(z.object({
      transferNumber: z.string().optional(), fromWarehouseId: z.number(), toWarehouseId: z.number(), notes: z.string().optional(),
      lines: z.array(z.object({ productId: z.number(), quantity: z.string(), unitCost: z.string().optional() })),
    })).mutation(async ({ input, ctx }) => {
      await assertAtomicPermission(ctx.user.id, "inventory.transfer.create", { warehouseId: input.fromWarehouseId });
      return db.createTransfer({ ...input, createdBy: ctx.user.id });
    }),
    approve: atomicPermissionProcedure("inventory.transfer.approve").input(z.object({ id: z.number() })).mutation(async ({ input, ctx }) => {
      const transfer = await db.getTransferById(input.id); if (!transfer) throw new TRPCError({ code: "NOT_FOUND", message: "Transfer not found" });
      await assertAtomicPermission(ctx.user.id, "inventory.transfer.approve", { warehouseId: transfer.fromWarehouseId });
      return db.approveTransfer(input.id, ctx.user.id);
    }),
    dispatch: atomicPermissionProcedure("inventory.transfer.approve").input(z.object({ id: z.number() })).mutation(async ({ input, ctx }) => {
      const transfer = await db.getTransferById(input.id); if (!transfer) throw new TRPCError({ code: "NOT_FOUND", message: "Transfer not found" });
      await assertAtomicPermission(ctx.user.id, "inventory.transfer.approve", { warehouseId: transfer.fromWarehouseId });
      return db.dispatchTransfer(input.id, ctx.user.id);
    }),
    receive: atomicPermissionProcedure("inventory.transfer.approve").input(z.object({ id: z.number() })).mutation(async ({ input, ctx }) => {
      const transfer = await db.getTransferById(input.id); if (!transfer) throw new TRPCError({ code: "NOT_FOUND", message: "Transfer not found" });
      await assertAtomicPermission(ctx.user.id, "inventory.transfer.approve", { warehouseId: transfer.toWarehouseId });
      return db.receiveTransfer(input.id, ctx.user.id);
    }),
  }),

  // ============ INVENTORY COUNTS ============
  inventoryCounts: router({
    list: atomicAnyPermissionProcedure(["inventory.count.create", "inventory.count.approve"]).query(async () => db.listInventoryCounts()),
    create: atomicPermissionProcedure("inventory.count.create", (input) => ({ warehouseId: (input as { warehouseId?: number }).warehouseId })).input(z.object({
      countNumber: z.string().optional(), warehouseId: z.number(), type: z.enum(["periodic", "surprise"]).optional(), notes: z.string().optional(),
      lines: z.array(z.object({ productId: z.number(), systemQuantity: z.string(), actualQuantity: z.string() })),
    })).mutation(async ({ input, ctx }) => {
      await assertAtomicPermission(ctx.user.id, "inventory.count.create", { warehouseId: input.warehouseId });
      return db.createInventoryCount({ ...input, createdBy: ctx.user.id });
    }),
    approve: atomicPermissionProcedure("inventory.count.approve").input(z.object({ id: z.number() })).mutation(async ({ input, ctx }) => {
      const count = await db.getInventoryCountById(input.id); if (!count) throw new TRPCError({ code: "NOT_FOUND", message: "Inventory count not found" });
      await assertAtomicPermission(ctx.user.id, "inventory.count.approve", { warehouseId: count.warehouseId });
      return db.approveInventoryCount(input.id, ctx.user.id);
    }),
  }),

  // ============ WASTE VOUCHERS ==========
  wasteVouchers: router({
    list: atomicAnyPermissionProcedure(["inventory.waste.create", "inventory.waste.approve"]).query(async () => db.listWasteVouchers()),
    get: atomicAnyPermissionProcedure(["inventory.waste.create", "inventory.waste.approve"]).input(z.object({ id: z.number() })).query(async ({ input }) => db.getWasteVoucherWithLines(input.id)),
    create: atomicPermissionProcedure("inventory.waste.create", (input) => ({ warehouseId: (input as { warehouseId?: number }).warehouseId })).input(z.object({
      warehouseId: z.number(), reason: z.string().max(255).optional(), notes: z.string().optional(),
      lines: z.array(z.object({ productId: z.number(), quantity: z.string(), notes: z.string().optional() })).min(1),
    })).mutation(async ({ input, ctx }) => {
      await assertAtomicPermission(ctx.user.id, "inventory.waste.create", { warehouseId: input.warehouseId });
      return db.createWasteVoucher({ ...input, createdBy: ctx.user.id });
    }),
    approve: atomicPermissionProcedure("inventory.waste.approve").input(z.object({ id: z.number() })).mutation(async ({ input, ctx }) => {
      const voucher = await db.getWasteVoucherWithLines(input.id);
      if (!voucher) throw new TRPCError({ code: "NOT_FOUND", message: "Waste voucher not found" });
      await assertAtomicPermission(ctx.user.id, "inventory.waste.approve", { warehouseId: voucher.warehouseId });
      return db.approveWasteVoucher(input.id, ctx.user.id);
    }),
    cancel: atomicPermissionProcedure("inventory.waste.create").input(z.object({ id: z.number() })).mutation(async ({ input, ctx }) => {
      const voucher = await db.getWasteVoucherWithLines(input.id);
      if (!voucher) throw new TRPCError({ code: "NOT_FOUND", message: "Waste voucher not found" });
      await assertAtomicPermission(ctx.user.id, "inventory.waste.create", { warehouseId: voucher.warehouseId });
      return db.cancelWasteVoucher(input.id);
    }),
  }),

  // ============ RECIPES (BOM) ============
  recipes: router({
    list: atomicPermissionProcedure("production.recipe.manage").query(async () => db.listRecipes()),
    get: atomicPermissionProcedure("production.recipe.manage").input(z.object({ id: z.number() })).query(async ({ input }) => db.getRecipeWithLines(input.id)),
    create: atomicPermissionProcedure("production.recipe.manage").input(z.object({
      productId: z.number(), name: z.string().min(1), outputQuantity: z.string().optional(), yieldPercent: z.string().optional(),
      standardCost: z.string().optional(), instructions: z.string().optional(),
      lines: z.array(z.object({ ingredientId: z.number(), quantity: z.string(), wastePercent: z.string().optional(), unitCost: z.string().optional() })),
    })).mutation(async ({ input }) => db.createRecipe(input)),
  }),

  // ============ PRODUCTION ORDERS ============
  productionOrders: router({
    list: atomicAnyPermissionProcedure(["production.order.create", "production.order.approve", "production.order.complete"]).query(async () => db.listProductionOrders()),
    nextNumber: atomicPermissionProcedure("production.order.create").query(async () => db.getNextProductionNumber()),
    create: atomicPermissionProcedure("production.order.create", (input) => ({ warehouseId: (input as { warehouseId?: number }).warehouseId, branchId: (input as { branchId?: number }).branchId })).input(z.object({
      orderNumber: z.string().optional(), recipeId: z.number(), productId: z.number(), warehouseId: z.number(), sourceWarehouseId: z.number().optional(),
      branchId: z.number().optional(), plannedQuantity: z.string(), plannedCost: z.string().optional(),
      batchNumber: z.string().optional(), notes: z.string().optional(),
      lines: z.array(z.object({ ingredientId: z.number(), requiredQuantity: z.string(), unitCost: z.string().optional() })),
    })).mutation(async ({ input, ctx }) => {
      await assertAtomicPermission(ctx.user.id, "production.order.create", { warehouseId: input.warehouseId, branchId: input.branchId });
      if (input.sourceWarehouseId && input.sourceWarehouseId !== input.warehouseId) await assertAtomicPermission(ctx.user.id, "production.order.create", { warehouseId: input.sourceWarehouseId, branchId: input.branchId });
      return db.createProductionOrder({ ...input, createdBy: ctx.user.id });
    }),
    complete: atomicPermissionProcedure("production.order.complete").input(z.object({
      id: z.number(), actualQuantity: z.string(), wasteQuantity: z.string(), actualCost: z.string(),
    })).mutation(async ({ input, ctx }) => {
      const order = await db.getProductionOrderById(input.id); if (!order) throw new TRPCError({ code: "NOT_FOUND", message: "Production order not found" });
      await assertAtomicPermission(ctx.user.id, "production.order.complete", { warehouseId: order.warehouseId, branchId: order.branchId });
      if (order.sourceWarehouseId && order.sourceWarehouseId !== order.warehouseId) await assertAtomicPermission(ctx.user.id, "production.order.complete", { warehouseId: order.sourceWarehouseId, branchId: order.branchId });
      return db.completeProductionOrder(input.id, input.actualQuantity, input.wasteQuantity, input.actualCost);
    }),
  }),

  // ============ SUPPLIERS ============
  suppliers: router({
    list: atomicPermissionProcedure("purchasing.suppliers.manage").query(async () => db.listSuppliers()),
    create: atomicPermissionProcedure("purchasing.suppliers.manage").input(z.object({
      name: z.string().min(1), contactPerson: z.string().optional(), phone: z.string().optional(),
      email: z.string().optional(), address: z.string().optional(), taxNumber: z.string().optional(),
    })).mutation(async ({ input }) => db.createSupplier(input)),
    update: atomicPermissionProcedure("purchasing.suppliers.manage").input(z.object({ id: z.number() }).passthrough()).mutation(async ({ input }) => { const { id, ...data } = input; return db.updateSupplier(id as number, data); }),
  }),

  // ============ PURCHASE ORDERS ============
  purchaseOrders: router({
    list: atomicAnyPermissionProcedure(["purchasing.order.create", "purchasing.order.approve", "purchasing.invoice.items_approve", "purchasing.invoice.accounts_approve"]).query(async () => db.listPurchaseOrders()),
    nextNumber: atomicPermissionProcedure("purchasing.order.create").query(async () => db.getNextPurchaseNumber()),
    create: atomicPermissionProcedure("purchasing.order.create", (input) => ({ warehouseId: (input as { warehouseId?: number }).warehouseId })).input(z.object({
      orderNumber: z.string().optional(), supplierId: z.number(), warehouseId: z.number(), notes: z.string().optional(),
      lines: z.array(z.object({ productId: z.number(), quantity: z.string(), unitPrice: z.string() })),
    })).mutation(async ({ input, ctx }) => {
      await assertAtomicPermission(ctx.user.id, "purchasing.order.create", { warehouseId: input.warehouseId });
      return db.createPurchaseOrder({ ...input, createdBy: ctx.user.id });
    }),
  }),

  // ============ TABLES ============
  tables: router({
    list: atomicPermissionProcedure("pos.tables.manage", (input) => ({ branchId: (input as { branchId?: number } | undefined)?.branchId })).input(z.object({ branchId: z.number().optional() }).optional()).query(async ({ input }) => db.listTables(input?.branchId)),
    create: atomicPermissionProcedure("pos.tables.manage").input(z.object({ branchId: z.number(), name: z.string().min(1), capacity: z.number().optional() })).mutation(async ({ input }) => db.createTable(input)),
    updateStatus: atomicPermissionProcedure("pos.tables.manage").input(z.object({ id: z.number(), status: z.enum(["available", "occupied", "reserved", "maintenance"]) })).mutation(async ({ input }) => db.updateTableStatus(input.id, input.status)),
  }),

  // ============ POS SESSIONS ============
  posSessions: router({
    list: atomicAnyPermissionProcedure(["pos.session.open", "pos.session.close"], (input) => ({ branchId: (input as { branchId?: number } | undefined)?.branchId })).input(z.object({ branchId: z.number().optional() }).optional()).query(async ({ input }) => db.listPosSessions(input?.branchId)),
    open: atomicPermissionProcedure("pos.session.open", (input) => ({ branchId: (input as { branchId?: number }).branchId })).input(z.object({ branchId: z.number(), openingBalance: z.string() })).mutation(async ({ input, ctx }) => db.openPosSession({ ...input, cashierId: ctx.user.id })),
    close: atomicPermissionProcedure("pos.session.close").input(z.object({ id: z.number(), closingBalance: z.string() })).mutation(async ({ input, ctx }) => db.closePosSession(input.id, input.closingBalance, ctx.user.id)),
  }),

  // ============ ORDERS ============
  orders: router({
    list: atomicAnyPermissionProcedure(["pos.order.create", "pos.order.cancel", "pos.order.refund"], (input) => ({ branchId: (input as { branchId?: number } | undefined)?.branchId })).input(z.object({ limit: z.number().optional(), branchId: z.number().optional() }).optional()).query(async ({ input }) => db.listOrders(input?.limit, input?.branchId)),
    get: atomicAnyPermissionProcedure(["pos.order.create", "pos.order.cancel", "pos.order.refund"]).input(z.object({ id: z.number() })).query(async ({ input }) => db.getOrderWithLines(input.id)),
    nextNumber: atomicPermissionProcedure("pos.order.create").query(async () => db.getNextOrderNumber()),
    create: atomicPermissionProcedure("pos.order.create", (input) => ({ branchId: (input as { branchId?: number }).branchId, warehouseId: (input as { warehouseId?: number }).warehouseId, costCenterId: (input as { costCenterId?: number }).costCenterId })).input(z.object({
      orderNumber: z.string().optional(), branchId: z.number(), warehouseId: z.number(), costCenterId: z.number().optional(), tableId: z.number().optional(),
      sessionId: z.number().optional(), type: z.enum(["dine_in", "takeaway", "delivery"]).optional(),
      notes: z.string().optional(), discountAmount: z.string().optional(), paymentMethod: z.enum(["cash", "card", "transfer", "mixed"]).optional(),
      payments: z.array(z.object({ paymentMethod: z.enum(["cash", "card", "transfer"]), amount: z.string(), reference: z.string().max(128).optional() })).optional(),
      lines: z.array(z.object({ productId: z.number(), quantity: z.string(), unitPrice: z.string(), costPrice: z.string().optional(), batchNumber: z.string().max(64).optional(), parentProductId: z.number().optional(), addonPricingMode: z.enum(["included", "free", "separate"]).optional(), notes: z.string().optional() })),
    })).mutation(async ({ input, ctx }) => {
      await assertAtomicPermission(ctx.user.id, "pos.order.create", { branchId: input.branchId, warehouseId: input.warehouseId, costCenterId: input.costCenterId });
      return db.createOrder({ ...input, cashierId: ctx.user.id });
    }),
    updateStatus: atomicPermissionProcedure("pos.order.cancel").input(z.object({ id: z.number(), status: z.enum(["new", "preparing", "ready", "served", "cancelled"]) })).mutation(async ({ input, ctx }) => db.updateOrderStatus(input.id, input.status, ctx.user.id)),
    pay: atomicPermissionProcedure("pos.order.create", (input) => ({ branchId: (input as { branchId: number }).branchId })).input(z.object({ id: z.number(), branchId: z.number() })).mutation(async ({ input, ctx }) => db.payPosOrder(input.id, input.branchId, ctx.user.id)),
  }),

  // ============ POS REFUNDS ============
  posRefunds: router({
    list: atomicAnyPermissionProcedure(["pos.order.refund", "treasury.refund.approve", "treasury.voucher.post"], (input) => ({ branchId: (input as { branchId?: number } | undefined)?.branchId }))
      .input(z.object({ limit: z.number().min(1).max(200).optional(), branchId: z.number().optional() }).optional())
      .query(async ({ input }) => db.listPosRefunds(input?.limit, input?.branchId)),
    nextNumber: atomicPermissionProcedure("pos.order.refund").query(async () => db.getNextPosRefundNumber()),
    request: atomicPermissionProcedure("pos.order.refund", (input) => ({ branchId: (input as { branchId: number }).branchId })).input(z.object({
      refundNumber: z.string().min(1).max(32).optional(), orderId: z.number(), branchId: z.number(), reason: z.string().min(3).max(2000),
    })).mutation(async ({ input, ctx }) => db.requestPosRefund({ ...input, requestedBy: ctx.user.id })),
    approve: atomicPermissionProcedure("treasury.refund.approve", (input) => ({ branchId: (input as { branchId: number }).branchId }))
      .input(z.object({ id: z.number(), branchId: z.number() }))
      .mutation(async ({ input, ctx }) => db.approvePosRefund(input.id, input.branchId, ctx.user.id)),
    complete: atomicPermissionProcedure("treasury.voucher.post", (input) => ({ branchId: (input as { branchId: number }).branchId }))
      .input(z.object({ id: z.number(), branchId: z.number() }))
      .mutation(async ({ input, ctx }) => db.completePosRefund(input.id, input.branchId, ctx.user.id)),
  }),

  // ============ KITCHEN ============
  kitchen: router({
    list: atomicPermissionProcedure("pos.kitchen.manage", (input) => ({ branchId: (input as { branchId: number }).branchId })).input(z.object({ branchId: z.number() })).query(async ({ input }) => db.listKitchenOrders(input.branchId)),
    updateStatus: atomicPermissionProcedure("pos.kitchen.manage").input(z.object({ id: z.number(), status: z.enum(["new", "preparing", "ready", "served"]) })).mutation(async ({ input }) => db.updateKitchenOrderStatus(input.id, input.status)),
  }),

  // ============ PURCHASE REQUESTS ============
  purchaseRequests: router({
    list: atomicAnyPermissionProcedure(["purchasing.request.create", "purchasing.order.approve"]).query(async () => db.listPurchaseRequests()),
    create: atomicPermissionProcedure("purchasing.request.create", (input) => ({ branchId: (input as { branchId?: number }).branchId })).input(z.object({
      requestNumber: z.string().min(1), branchId: z.number(), notes: z.string().optional(),
      lines: z.array(z.object({ productId: z.number(), quantity: z.string() })),
    })).mutation(async ({ input, ctx }) => {
      await assertAtomicPermission(ctx.user.id, "purchasing.request.create", { branchId: input.branchId });
      return db.createPurchaseRequest({ ...input, requestedBy: ctx.user.id });
    }),
  }),

  // ============ PURCHASE INVOICES ============
  purchaseInvoices: router({
    list: atomicAnyPermissionProcedure(["purchasing.invoice.items_approve", "purchasing.invoice.accounts_approve", "purchasing.invoice.post"]).query(async () => db.listPurchaseInvoices()),
    create: atomicPermissionProcedure("purchasing.order.create", (input) => ({ warehouseId: (input as { warehouseId?: number }).warehouseId })).input(z.object({
      invoiceNumber: z.string().min(1), purchaseOrderId: z.number().optional(), supplierId: z.number(), warehouseId: z.number(),
      invoiceDate: z.date(), dueDate: z.date().optional(), notes: z.string().optional(),
      lines: z.array(z.object({ productId: z.number(), quantity: z.string(), unitPrice: z.string(), batchNumber: z.string().optional(), expiryDate: z.date().optional() })),
    })).mutation(async ({ input, ctx }) => {
      await assertAtomicPermission(ctx.user.id, "purchasing.order.create", { warehouseId: input.warehouseId });
      return db.createPurchaseInvoice({ ...input, createdBy: ctx.user.id });
    }),
    approveItems: atomicPermissionProcedure("purchasing.invoice.items_approve").input(z.object({ id: z.number(), notes: z.string().optional() })).mutation(async ({ input, ctx }) => {
      const invoice = await db.getPurchaseInvoiceById(input.id); if (!invoice) throw new TRPCError({ code: "NOT_FOUND", message: "Purchase invoice not found" });
      await assertAtomicPermission(ctx.user.id, "purchasing.invoice.items_approve", { warehouseId: invoice.warehouseId });
      return db.approvePurchaseInvoiceItems(input.id, ctx.user.id, input.notes);
    }),
    approveAccounts: atomicPermissionProcedure("purchasing.invoice.accounts_approve").input(z.object({ id: z.number(), notes: z.string().optional() })).mutation(async ({ input, ctx }) => {
      const invoice = await db.getPurchaseInvoiceById(input.id); if (!invoice) throw new TRPCError({ code: "NOT_FOUND", message: "Purchase invoice not found" });
      await assertAtomicPermission(ctx.user.id, "purchasing.invoice.accounts_approve", { warehouseId: invoice.warehouseId });
      return db.approvePurchaseInvoiceAccounts(input.id, ctx.user.id, input.notes);
    }),
  }),

  // ============ SAUDI COMPLIANCE & E-INVOICING ============
  saudiCompliance: router({
    companyProfile: atomicAnyPermissionProcedure(["compliance.vat.manage", "compliance.zatca.view", "compliance.zatca.manage"]).query(async () => db.getCompanyProfile()),
    saveCompanyProfile: atomicPermissionProcedure("compliance.vat.manage").input(z.object({
      legalName: z.string().min(1), tradeName: z.string().optional(), vatNumber: z.string().optional(),
      commercialRegistrationNumber: z.string().optional(), addressLine1: z.string().optional(), addressLine2: z.string().optional(),
      city: z.string().optional(), district: z.string().optional(), postalCode: z.string().optional(),
      countryCode: z.string().length(2), currencyCode: z.string().length(3), isVatRegistered: z.boolean().optional(),
      eInvoicingMode: z.enum(["disabled", "sandbox", "production"]).optional(),
    })).mutation(async ({ input }) => db.saveCompanyProfile(input)),
    taxCodes: router({
      list: atomicPermissionProcedure("compliance.vat.manage").query(async () => db.listTaxCodes()),
      create: atomicPermissionProcedure("compliance.vat.manage").input(z.object({
        code: z.string().min(1), name: z.string().min(1), category: z.enum(["standard", "zero_rated", "exempt", "out_of_scope"]), rate: z.string(),
      })).mutation(async ({ input }) => db.createTaxCode(input)),
    }),
    customers: router({
      list: atomicPermissionProcedure("compliance.invoice.issue").query(async () => db.listCustomers()),
      create: atomicPermissionProcedure("compliance.invoice.issue").input(z.object({
        code: z.string().optional(), name: z.string().min(1), customerType: z.enum(["individual", "business"]).optional(),
        vatNumber: z.string().optional(), commercialRegistrationNumber: z.string().optional(), addressLine1: z.string().optional(),
        city: z.string().optional(), countryCode: z.string().length(2).optional(), email: z.string().email().optional(), phone: z.string().optional(),
      })).mutation(async ({ input }) => db.createCustomer(input)),
    }),
    invoices: router({
      list: atomicAnyPermissionProcedure(["compliance.invoice.issue", "compliance.zatca.view", "compliance.zatca.submit"]).input(z.object({ limit: z.number().min(1).max(200).optional() }).optional()).query(async ({ input }) => db.listSalesInvoices(input?.limit)),
      nextNumber: atomicPermissionProcedure("compliance.invoice.issue").query(async () => db.getNextSalesInvoiceNumber()),
      issueFromOrder: atomicPermissionProcedure("compliance.invoice.issue").input(z.object({
        orderId: z.number(), branchId: z.number(), customerId: z.number().optional(), invoiceType: z.enum(["simplified", "tax"]),
      })).mutation(async ({ input, ctx }) => db.issueSalesInvoiceFromOrder({ ...input, createdBy: ctx.user.id })),
      queueForZatca: atomicPermissionProcedure("compliance.zatca.submit").input(z.object({ salesInvoiceId: z.number() })).mutation(async ({ input }) => db.queueZatcaSubmission(input.salesInvoiceId)),
    }),
    zatca: router({
      readiness: atomicPermissionProcedure("compliance.zatca.view").query(async () => db.getZatcaReadiness()),
      connection: atomicPermissionProcedure("compliance.zatca.view").input(z.object({ companyProfileId: z.number(), environment: z.enum(["sandbox", "production"]).optional() })).query(async ({ input }) => db.getZatcaConnection(input.companyProfileId, input.environment)),
      saveConnection: atomicPermissionProcedure("compliance.zatca.manage").input(z.object({
        companyProfileId: z.number(), environment: z.enum(["sandbox", "production"]),
        status: z.enum(["not_configured", "ready", "testing", "active", "error", "suspended"]).optional(),
        credentialReference: z.string().max(128).nullable().optional(), csidReference: z.string().max(128).nullable().optional(),
        lastError: z.string().max(2000).nullable().optional(),
      })).mutation(async ({ input, ctx }) => db.saveZatcaConnection({ ...input, createdBy: ctx.user.id })),
      submissions: atomicPermissionProcedure("compliance.zatca.view").input(z.object({ salesInvoiceId: z.number().optional(), limit: z.number().min(1).max(200).optional() }).optional()).query(async ({ input }) => db.listZatcaSubmissionAttempts(input?.salesInvoiceId, input?.limit)),
    }),
  }),

  // ============ BACKUPS ============
  backups: router({
    list: atomicPermissionProcedure("admin.backups.manage").query(async () => db.listBackups()),
    create: atomicPermissionProcedure("admin.backups.manage").input(z.object({
      backupName: z.string().min(1), backupSize: z.number().optional(), backupPath: z.string().optional(),
      backupType: z.enum(["manual", "automatic"]).optional(),
    })).mutation(async ({ input, ctx }) => db.createBackup({ ...input, createdBy: ctx.user.id })),
    createEncrypted: atomicPermissionProcedure("admin.backups.manage").input(z.object({ label: z.string().min(1).max(255).optional() })).mutation(async ({ input, ctx }) => {
      const result = await createEncryptedDatabaseBackup(ctx.user.id, input.label);
      await db.logAudit({ userId: ctx.user.id, action: "create_encrypted_backup", entityType: "backup", entityId: result.id, newValues: { tablesCount: result.tablesCount, recordsCount: result.recordsCount } });
      return result;
    }),
    verifyEncrypted: atomicPermissionProcedure("admin.backups.manage").input(z.object({ backupId: z.number() })).query(async ({ input }) => {
      const backup = await db.getBackupById(input.backupId);
      if (!backup?.fileKey || backup.status !== "completed") throw new TRPCError({ code: "NOT_FOUND", message: "Encrypted backup is not available" });
      return verifyEncryptedBackup(backup.fileKey);
    }),
    testRestoreIsolated: atomicPermissionProcedure("admin.backups.manage").input(z.object({ backupId: z.number() })).mutation(async ({ input, ctx }) => {
      const backup = await db.getBackupById(input.backupId);
      if (!backup?.fileKey || backup.status !== "completed") throw new TRPCError({ code: "NOT_FOUND", message: "Encrypted backup is not available" });
      const result = await testRestoreEncryptedBackupInIsolation(backup.fileKey);
      await db.logAudit({ userId: ctx.user.id, action: "test_isolated_backup_restore", entityType: "backup", entityId: backup.id, newValues: result });
      return result;
    }),
  }),

  // ============ AUDIT LOG ============
  auditLog: router({
    list: atomicPermissionProcedure("admin.audit.view").query(async () => db.listAuditLog()),
  }),

  // ============ DOCUMENTS ============
  documents: router({
    list: atomicAnyPermissionProcedure(["admin.documents.manage", "admin.settings.view", "admin.settings.manage"]).query(async () => db.listDocuments()),
    create: atomicPermissionProcedure("admin.documents.manage").input(z.object({
      name: z.string().min(1), fileUrl: z.string(), fileKey: z.string(), mimeType: z.string().optional(),
      fileSize: z.number().optional(), entityType: z.string().optional(), entityId: z.number().optional(),
    })).mutation(async ({ input, ctx }) => db.createDocument({ ...input, uploadedBy: ctx.user.id })),
  }),

  // ============ NOTIFICATIONS ============
  notifications: router({
    list: atomicAnyPermissionProcedure(["admin.settings.view", "admin.settings.manage"]).query(async () => db.listNotifications()),
    markRead: atomicAnyPermissionProcedure(["admin.settings.view", "admin.settings.manage"]).input(z.object({ id: z.number() })).mutation(async ({ input }) => db.markNotificationRead(input.id)),
  }),

  // ============ REPORTS ============
  reports: router({
    sales: atomicPermissionProcedure("accounting.reports.view", (input) => ({ branchId: (input as { branchId?: number }).branchId })).input(z.object({ startDate: z.date(), endDate: z.date(), branchId: z.number().optional() })).query(async ({ input }) => db.getSalesReport(input.startDate, input.endDate, input.branchId)),
    profitability: atomicPermissionProcedure("accounting.reports.view").input(z.object({ startDate: z.date(), endDate: z.date() })).query(async ({ input }) => db.getProfitabilityReport(input.startDate, input.endDate)),
    production: atomicAnyPermissionProcedure(["production.order.approve", "production.order.complete"]).input(z.object({ startDate: z.date(), endDate: z.date() })).query(async ({ input }) => db.getProductionReport(input.startDate, input.endDate)),
    inventory: atomicPermissionProcedure("inventory.view").input(z.object({ startDate: z.date().optional(), endDate: z.date().optional() }).optional()).query(async ({ input }) => db.getInventoryReport(input)),
    vatSummary: atomicPermissionProcedure("compliance.vat.manage").input(z.object({ startDate: z.date(), endDate: z.date() })).query(async ({ input }) => db.getVatSummary(input.startDate, input.endDate)),
    vatReconciliation: atomicPermissionProcedure("compliance.vat.manage").input(z.object({ startDate: z.date(), endDate: z.date() })).query(async ({ input }) => db.getVatLedgerReconciliation(input.startDate, input.endDate)),
    financialStatements: atomicPermissionProcedure("accounting.reports.view").input(z.object({ startDate: z.date(), endDate: z.date() })).query(async ({ input }) => db.getFinancialStatements(input.startDate, input.endDate)),
  }),
});

export type AppRouter = typeof appRouter;
