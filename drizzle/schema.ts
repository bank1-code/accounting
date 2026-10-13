import {
  char, int, mysqlEnum, mysqlTable, text, timestamp, varchar,
  bigint, boolean, decimal, json, index, uniqueIndex
} from "drizzle-orm/mysql-core";

// ===================== USERS =====================
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).unique(),
  username: varchar("username", { length: 64 }).unique(),
  passwordHash: varchar("passwordHash", { length: 255 }),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});
export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type LocalUser = Omit<User, 'openId'> & { openId: null }; // User with local login

// ===================== MIGRATION LEDGER =====================
export const migrationLedger = mysqlTable("dgtera_migration_ledger", {
  id: int("id").autoincrement().primaryKey(),
  fileName: varchar("file_name", { length: 255 }).notNull().unique(),
  checksum: char("checksum", { length: 64 }).notNull(),
  appliedAt: timestamp("applied_at").defaultNow().notNull(),
});

// ===================== DYNAMIC RBAC / ATOMIC PERMISSIONS =====================
export const roles = mysqlTable("roles", {
  id: int("id").autoincrement().primaryKey(),
  code: varchar("code", { length: 96 }).notNull().unique(),
  name: varchar("name", { length: 160 }).notNull(),
  nameEn: varchar("nameEn", { length: 160 }),
  description: text("description"),
  isSystem: boolean("isSystem").default(false).notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  createdBy: int("createdBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const permissions = mysqlTable("permissions", {
  id: int("id").autoincrement().primaryKey(),
  code: varchar("code", { length: 128 }).notNull().unique(),
  module: varchar("module", { length: 64 }).notNull(),
  action: varchar("action", { length: 64 }).notNull(),
  name: varchar("name", { length: 160 }).notNull(),
  nameEn: varchar("nameEn", { length: 160 }),
  description: text("description"),
  isSystem: boolean("isSystem").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const rolePermissions = mysqlTable("role_permissions", {
  id: int("id").autoincrement().primaryKey(),
  roleId: int("roleId").notNull(),
  permissionId: int("permissionId").notNull(),
  effect: mysqlEnum("effect", ["allow", "deny"]).default("allow").notNull(),
  createdBy: int("createdBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  index("role_permissions_role_idx").on(table.roleId),
  index("role_permissions_permission_idx").on(table.permissionId),
]);

export const userRoles = mysqlTable("user_roles", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  roleId: int("roleId").notNull(),
  branchId: int("branchId"),
  warehouseId: int("warehouseId"),
  costCenterId: int("costCenterId"),
  isActive: boolean("isActive").default(true).notNull(),
  expiresAt: timestamp("expiresAt"),
  assignedBy: int("assignedBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  index("user_roles_user_idx").on(table.userId),
  index("user_roles_role_idx").on(table.roleId),
]);

export const userPermissionOverrides = mysqlTable("user_permission_overrides", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  permissionId: int("permissionId").notNull(),
  effect: mysqlEnum("effect", ["allow", "deny"]).notNull(),
  branchId: int("branchId"),
  warehouseId: int("warehouseId"),
  costCenterId: int("costCenterId"),
  reason: varchar("reason", { length: 500 }),
  expiresAt: timestamp("expiresAt"),
  grantedBy: int("grantedBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  index("user_permission_overrides_user_idx").on(table.userId),
  index("user_permission_overrides_permission_idx").on(table.permissionId),
]);

// ===================== HR / EMPLOYEES (الموارد البشرية) =====================
export const employees = mysqlTable("employees", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId"),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 320 }),
  phone: varchar("phone", { length: 32 }),
  position: varchar("position", { length: 128 }),
  branchId: int("branchId"),
  employeeRole: mysqlEnum("employeeRole", ["cashier", "waiter", "chef", "branch_manager", "accountant", "warehouse_manager", "production_manager", "operations_manager", "owner"]).default("cashier").notNull(),
  hireDate: timestamp("hireDate"),
  baseSalary: decimal("baseSalary", { precision: 18, scale: 2 }).default("0"),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const shifts = mysqlTable("shifts", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 128 }).notNull(),
  branchId: int("branchId"),
  startTime: varchar("startTime", { length: 8 }).notNull(),
  endTime: varchar("endTime", { length: 8 }).notNull(),
  daysOfWeek: json("daysOfWeek"),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const attendance = mysqlTable("attendance", {
  id: int("id").autoincrement().primaryKey(),
  employeeId: int("employeeId").notNull(),
  shiftId: int("shiftId"),
  date: timestamp("date").notNull(),
  checkIn: timestamp("checkIn"),
  checkOut: timestamp("checkOut"),
  financialHours: decimal("financialHours", { precision: 5, scale: 2 }).default("0"),
  overtimeHours: decimal("overtimeHours", { precision: 5, scale: 2 }).default("0"),
  overtimeApproved: boolean("overtimeApproved").default(false),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const payroll_batches = mysqlTable("payroll_batches", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 128 }).notNull(),
  periodStart: timestamp("periodStart").notNull(),
  periodEnd: timestamp("periodEnd").notNull(),
  status: mysqlEnum("status", ["draft", "approved", "paid"]).default("draft").notNull(),
  totalAmount: decimal("totalAmount", { precision: 18, scale: 2 }).default("0"),
  createdBy: int("createdBy"),
  approvedBy: int("approvedBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const payroll_lines = mysqlTable("payroll_lines", {
  id: int("id").autoincrement().primaryKey(),
  batchId: int("batchId").notNull(),
  employeeId: int("employeeId").notNull(),
  baseSalary: decimal("baseSalary", { precision: 18, scale: 2 }).default("0").notNull(),
  overtime: decimal("overtime", { precision: 18, scale: 2 }).default("0"),
  deductions: decimal("deductions", { precision: 18, scale: 2 }).default("0"),
  bonuses: decimal("bonuses", { precision: 18, scale: 2 }).default("0"),
  netSalary: decimal("netSalary", { precision: 18, scale: 2 }).default("0").notNull(),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ===================== BRANCHES (الفروع) =====================
export const branches = mysqlTable("branches", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  nameEn: varchar("nameEn", { length: 255 }),
  type: mysqlEnum("type", ["restaurant", "grocery", "accessories", "warehouse", "kitchen"]).notNull(),
  address: text("address"),
  phone: varchar("phone", { length: 32 }),
  isActive: boolean("isActive").default(true).notNull(),
  isCentralKitchen: boolean("isCentralKitchen").default(false).notNull(),
  isCentralWarehouse: boolean("isCentralWarehouse").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

// ===================== COST CENTERS (مراكز التكلفة) =====================
export const costCenters = mysqlTable("cost_centers", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  code: varchar("code", { length: 32 }).notNull(),
  branchId: int("branchId"),
  type: mysqlEnum("type", ["profit", "cost"]).default("profit").notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ===================== CHART OF ACCOUNTS (شجرة الحسابات) =====================
export const accounts = mysqlTable("accounts", {
  id: int("id").autoincrement().primaryKey(),
  code: varchar("code", { length: 32 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  nameEn: varchar("nameEn", { length: 255 }),
  type: mysqlEnum("type", ["asset", "liability", "equity", "revenue", "expense"]).notNull(),
  parentId: int("parentId"),
  level: int("level").default(1).notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  isSystem: boolean("isSystem").default(false).notNull(),
  balance: decimal("balance", { precision: 18, scale: 2 }).default("0").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

// ===================== JOURNAL ENTRIES (القيود اليومية) =====================
export const journalEntries = mysqlTable("journal_entries", {
  id: int("id").autoincrement().primaryKey(),
  entryNumber: varchar("entryNumber", { length: 32 }).notNull().unique(),
  date: timestamp("date").notNull(),
  description: text("description"),
  reference: varchar("reference", { length: 128 }),
  sourceEntryNumber: varchar("sourceEntryNumber", { length: 32 }),
  referenceType: varchar("referenceType", { length: 64 }),
  referenceId: int("referenceId"),
  status: mysqlEnum("status", ["draft", "posted", "reversed"]).default("draft").notNull(),
  totalDebit: decimal("totalDebit", { precision: 18, scale: 2 }).default("0").notNull(),
  totalCredit: decimal("totalCredit", { precision: 18, scale: 2 }).default("0").notNull(),
  createdBy: int("createdBy"),
  postedBy: int("postedBy"),
  postedAt: timestamp("postedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

// ===================== JOURNAL ENTRY LINES (بنود القيود) =====================
export const journalEntryLines = mysqlTable("journal_entry_lines", {
  id: int("id").autoincrement().primaryKey(),
  journalEntryId: int("journalEntryId").notNull(),
  accountId: int("accountId").notNull(),
  costCenterId: int("costCenterId"),
  branchId: int("branchId"),
  debit: decimal("debit", { precision: 18, scale: 2 }).default("0").notNull(),
  credit: decimal("credit", { precision: 18, scale: 2 }).default("0").notNull(),
  description: text("description"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type JournalEntryTemplatePayload = {
  description: string;
  reference: string;
  lines: Array<{ accountId: number; costCenterId?: number; branchId?: number; debit: string; credit: string; description?: string }>;
};

export const journalEntryTemplates = mysqlTable("journal_entry_templates", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 160 }).notNull(),
  sourceEntryNumber: varchar("sourceEntryNumber", { length: 32 }),
  templateData: json("templateData").$type<JournalEntryTemplatePayload>().notNull(),
  createdBy: int("createdBy").notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  index("journal_templates_creator_idx").on(table.createdBy),
  index("journal_templates_active_idx").on(table.isActive),
]);

// ===================== FISCAL PERIODS (الفترات المالية) =====================
export const fiscalPeriods = mysqlTable("fiscal_periods", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 128 }).notNull(),
  startDate: timestamp("startDate").notNull(),
  endDate: timestamp("endDate").notNull(),
  isClosed: boolean("isClosed").default(false).notNull(),
  closedBy: int("closedBy"),
  closedAt: timestamp("closedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const fiscalPeriodReopenLogs = mysqlTable("fiscal_period_reopen_logs", {
  id: int("id").autoincrement().primaryKey(),
  fiscalPeriodId: int("fiscalPeriodId").notNull(),
  reopenedBy: int("reopenedBy").notNull(),
  reason: text("reason").notNull(),
  reopenedAt: timestamp("reopenedAt").defaultNow().notNull(),
}, (table) => [
  index("fiscal_period_reopen_logs_period_idx").on(table.fiscalPeriodId),
]);

// ===================== CATEGORIES (التصنيفات) =====================
export const categories = mysqlTable("categories", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  parentId: int("parentId"),
  type: mysqlEnum("type", ["product", "raw_material", "semi_finished", "finished"]).default("product").notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  sortOrder: int("sortOrder").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ===================== UNITS OF MEASURE (وحدات القياس) =====================
export const units = mysqlTable("units", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 64 }).notNull(),
  symbol: varchar("symbol", { length: 16 }).notNull(),
  baseUnitId: int("baseUnitId"),
  conversionFactor: decimal("conversionFactor", { precision: 12, scale: 6 }).default("1"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ===================== PRODUCTS (المنتجات والأصناف) =====================
export const products = mysqlTable("products", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  nameEn: varchar("nameEn", { length: 255 }),
  sku: varchar("sku", { length: 64 }),
  barcode: varchar("barcode", { length: 64 }),
  categoryId: int("categoryId"),
  unitId: int("unitId"),
  type: mysqlEnum("type", ["raw_material", "semi_finished", "finished", "direct_sale", "service"]).notNull(),
  costPrice: decimal("costPrice", { precision: 18, scale: 2 }).default("0").notNull(),
  salePrice: decimal("salePrice", { precision: 18, scale: 2 }).default("0").notNull(),
  taxRate: decimal("taxRate", { precision: 5, scale: 2 }).default("15").notNull(),
  taxCodeId: int("taxCodeId"),
  reorderLevel: int("reorderLevel").default(0),
  imageUrl: text("imageUrl"),
  isActive: boolean("isActive").default(true).notNull(),
  trackBatch: boolean("trackBatch").default(false).notNull(),
  trackExpiry: boolean("trackExpiry").default(false).notNull(),
  yieldPercent: decimal("yieldPercent", { precision: 5, scale: 2 }).default("100"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

// ===================== PRODUCT ADD-ONS (إضافات الوجبات) =====================
export const productAddons = mysqlTable("product_addons", {
  id: int("id").autoincrement().primaryKey(),
  parentProductId: int("parentProductId").notNull(),
  addonProductId: int("addonProductId").notNull(),
  pricingMode: mysqlEnum("pricingMode", ["included", "free", "separate"]).default("included").notNull(),
  salePrice: decimal("salePrice", { precision: 18, scale: 2 }).default("0").notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  parentAddonUnique: uniqueIndex("product_addons_parent_addon_unique").on(table.parentProductId, table.addonProductId),
}));

// ===================== WAREHOUSES (المخازن) =====================
export const warehouses = mysqlTable("warehouses", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  branchId: int("branchId"),
  parentWarehouseId: int("parentWarehouseId"),
  type: mysqlEnum("type", ["central", "branch", "kitchen"]).default("branch").notNull(),
  storageCategory: mysqlEnum("storageCategory", ["general", "dry", "chilled", "frozen", "ingredients", "packaging", "finished_goods", "other"]).default("general").notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ===================== STOCK (أرصدة المخزون) =====================
export const stock = mysqlTable("stock", {
  id: int("id").autoincrement().primaryKey(),
  productId: int("productId").notNull(),
  warehouseId: int("warehouseId").notNull(),
  quantity: decimal("quantity", { precision: 18, scale: 4 }).default("0").notNull(),
  avgCost: decimal("avgCost", { precision: 18, scale: 4 }).default("0").notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

// ===================== INVENTORY BATCH BALANCES (أرصدة الدفعات) =====================
export const inventoryBatches = mysqlTable("inventory_batches", {
  id: int("id").autoincrement().primaryKey(),
  productId: int("productId").notNull(),
  warehouseId: int("warehouseId").notNull(),
  batchNumber: varchar("batchNumber", { length: 64 }).notNull(),
  expiryDate: timestamp("expiryDate"),
  quantity: decimal("quantity", { precision: 18, scale: 4 }).default("0").notNull(),
  unitCost: decimal("unitCost", { precision: 18, scale: 4 }).default("0").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  productWarehouseBatchUnique: uniqueIndex("inventory_batches_product_warehouse_batch_unique").on(table.productId, table.warehouseId, table.batchNumber),
  expiryIndex: index("inventory_batches_expiry_idx").on(table.expiryDate),
}));

// ===================== STOCK MOVEMENTS (حركات المخزون) =====================
export const stockMovements = mysqlTable("stock_movements", {
  id: int("id").autoincrement().primaryKey(),
  productId: int("productId").notNull(),
  warehouseId: int("warehouseId").notNull(),
  type: mysqlEnum("type", ["purchase", "sale", "transfer_in", "transfer_out", "production_in", "production_out", "waste", "adjustment", "return"]).notNull(),
  quantity: decimal("quantity", { precision: 18, scale: 4 }).notNull(),
  unitCost: decimal("unitCost", { precision: 18, scale: 4 }).default("0"),
  referenceType: varchar("referenceType", { length: 64 }),
  referenceId: int("referenceId"),
  batchNumber: varchar("batchNumber", { length: 64 }),
  expiryDate: timestamp("expiryDate"),
  notes: text("notes"),
  createdBy: int("createdBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ===================== WASTE VOUCHERS (أذون التوالف) =====================
export const wasteVouchers = mysqlTable("waste_vouchers", {
  id: int("id").autoincrement().primaryKey(),
  voucherNumber: varchar("voucherNumber", { length: 32 }).notNull(),
  warehouseId: int("warehouseId").notNull(),
  status: mysqlEnum("status", ["draft", "approved", "cancelled"]).default("draft").notNull(),
  reason: varchar("reason", { length: 255 }),
  notes: text("notes"),
  createdBy: int("createdBy"),
  approvedBy: int("approvedBy"),
  approvedAt: timestamp("approvedAt"),
  cancelledAt: timestamp("cancelledAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const wasteVoucherLines = mysqlTable("waste_voucher_lines", {
  id: int("id").autoincrement().primaryKey(),
  voucherId: int("voucherId").notNull(),
  productId: int("productId").notNull(),
  quantity: decimal("quantity", { precision: 18, scale: 4 }).notNull(),
  unitCost: decimal("unitCost", { precision: 18, scale: 4 }).default("0").notNull(),
  batchNumber: varchar("batchNumber", { length: 64 }),
  expiryDate: timestamp("expiryDate"),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ===================== INTERNAL TRANSFERS (التحويلات الداخلية) =====================
export const internalTransfers = mysqlTable("internal_transfers", {
  id: int("id").autoincrement().primaryKey(),
  transferNumber: varchar("transferNumber", { length: 32 }).notNull(),
  fromWarehouseId: int("fromWarehouseId").notNull(),
  toWarehouseId: int("toWarehouseId").notNull(),
  status: mysqlEnum("status", ["draft", "approved", "in_transit", "received", "cancelled"]).default("draft").notNull(),
  notes: text("notes"),
  createdBy: int("createdBy"),
  approvedBy: int("approvedBy"),
  approvedAt: timestamp("approvedAt"),
  receivedAt: timestamp("receivedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const internalTransferLines = mysqlTable("internal_transfer_lines", {
  id: int("id").autoincrement().primaryKey(),
  transferId: int("transferId").notNull(),
  productId: int("productId").notNull(),
  quantity: decimal("quantity", { precision: 18, scale: 4 }).notNull(),
  receivedQuantity: decimal("receivedQuantity", { precision: 18, scale: 4 }).default("0"),
  unitCost: decimal("unitCost", { precision: 18, scale: 4 }).default("0"),
  batchNumber: varchar("batchNumber", { length: 64 }),
  expiryDate: timestamp("expiryDate"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ===================== INVENTORY COUNT (الجرد) =====================
export const inventoryCounts = mysqlTable("inventory_counts", {
  id: int("id").autoincrement().primaryKey(),
  countNumber: varchar("countNumber", { length: 32 }).notNull(),
  warehouseId: int("warehouseId").notNull(),
  type: mysqlEnum("type", ["periodic", "surprise"]).default("periodic").notNull(),
  status: mysqlEnum("status", ["draft", "in_progress", "completed", "approved"]).default("draft").notNull(),
  notes: text("notes"),
  createdBy: int("createdBy"),
  approvedBy: int("approvedBy"),
  completedAt: timestamp("completedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const inventoryCountLines = mysqlTable("inventory_count_lines", {
  id: int("id").autoincrement().primaryKey(),
  countId: int("countId").notNull(),
  productId: int("productId").notNull(),
  systemQuantity: decimal("systemQuantity", { precision: 18, scale: 4 }).default("0").notNull(),
  actualQuantity: decimal("actualQuantity", { precision: 18, scale: 4 }).default("0").notNull(),
  difference: decimal("difference", { precision: 18, scale: 4 }).default("0").notNull(),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ===================== RECIPES / BOM (الوصفات) =====================
export const recipes = mysqlTable("recipes", {
  id: int("id").autoincrement().primaryKey(),
  productId: int("productId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  outputQuantity: decimal("outputQuantity", { precision: 18, scale: 4 }).default("1").notNull(),
  yieldPercent: decimal("yieldPercent", { precision: 5, scale: 2 }).default("100"),
  standardCost: decimal("standardCost", { precision: 18, scale: 2 }).default("0"),
  instructions: text("instructions"),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const recipeLines = mysqlTable("recipe_lines", {
  id: int("id").autoincrement().primaryKey(),
  recipeId: int("recipeId").notNull(),
  ingredientId: int("ingredientId").notNull(),
  quantity: decimal("quantity", { precision: 18, scale: 4 }).notNull(),
  wastePercent: decimal("wastePercent", { precision: 5, scale: 2 }).default("0"),
  unitCost: decimal("unitCost", { precision: 18, scale: 4 }).default("0"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ===================== PRODUCTION ORDERS (أوامر الإنتاج) =====================
export const productionOrders = mysqlTable("production_orders", {
  id: int("id").autoincrement().primaryKey(),
  orderNumber: varchar("orderNumber", { length: 32 }).notNull(),
  recipeId: int("recipeId").notNull(),
  productId: int("productId").notNull(),
  sourceWarehouseId: int("sourceWarehouseId"),
  warehouseId: int("warehouseId").notNull(),
  branchId: int("branchId"),
  plannedQuantity: decimal("plannedQuantity", { precision: 18, scale: 4 }).notNull(),
  actualQuantity: decimal("actualQuantity", { precision: 18, scale: 4 }).default("0"),
  wasteQuantity: decimal("wasteQuantity", { precision: 18, scale: 4 }).default("0"),
  status: mysqlEnum("status", ["draft", "approved", "in_progress", "completed", "cancelled"]).default("draft").notNull(),
  plannedCost: decimal("plannedCost", { precision: 18, scale: 2 }).default("0"),
  actualCost: decimal("actualCost", { precision: 18, scale: 2 }).default("0"),
  variance: decimal("variance", { precision: 18, scale: 2 }).default("0"),
  batchNumber: varchar("batchNumber", { length: 64 }),
  notes: text("notes"),
  createdBy: int("createdBy"),
  approvedBy: int("approvedBy"),
  completedAt: timestamp("completedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const productionOrderLines = mysqlTable("production_order_lines", {
  id: int("id").autoincrement().primaryKey(),
  productionOrderId: int("productionOrderId").notNull(),
  ingredientId: int("ingredientId").notNull(),
  requiredQuantity: decimal("requiredQuantity", { precision: 18, scale: 4 }).notNull(),
  actualQuantity: decimal("actualQuantity", { precision: 18, scale: 4 }).default("0"),
  unitCost: decimal("unitCost", { precision: 18, scale: 4 }).default("0"),
  batchNumber: varchar("batchNumber", { length: 64 }),
  expiryDate: timestamp("expiryDate"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ===================== SUPPLIERS (الموردون) =====================
export const suppliers = mysqlTable("suppliers", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  contactPerson: varchar("contactPerson", { length: 128 }),
  email: varchar("email", { length: 320 }),
  phone: varchar("phone", { length: 32 }),
  address: text("address"),
  taxNumber: varchar("taxNumber", { length: 64 }),
  isActive: boolean("isActive").default(true).notNull(),
  balance: decimal("balance", { precision: 18, scale: 2 }).default("0"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

// ===================== PURCHASE ORDERS (أوامر الشراء) =====================
export const purchaseOrders = mysqlTable("purchase_orders", {
  id: int("id").autoincrement().primaryKey(),
  orderNumber: varchar("orderNumber", { length: 32 }).notNull(),
  supplierId: int("supplierId").notNull(),
  warehouseId: int("warehouseId").notNull(),
  status: mysqlEnum("status", ["draft", "approved", "received", "partial", "cancelled"]).default("draft").notNull(),
  totalAmount: decimal("totalAmount", { precision: 18, scale: 2 }).default("0").notNull(),
  taxAmount: decimal("taxAmount", { precision: 18, scale: 2 }).default("0").notNull(),
  notes: text("notes"),
  createdBy: int("createdBy"),
  approvedBy: int("approvedBy"),
  receivedAt: timestamp("receivedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

// ===================== PURCHASE INVOICES (فواتير الشراء) =====================
export const purchaseInvoices = mysqlTable("purchase_invoices", {
  id: int("id").autoincrement().primaryKey(),
  invoiceNumber: varchar("invoiceNumber", { length: 32 }).notNull(),
  supplierId: int("supplierId").notNull(),
  poId: int("poId"),
  warehouseId: int("warehouseId"),
  status: mysqlEnum("status", ["draft", "received", "items_approved", "accounts_approved", "approved", "paid", "cancelled"]).default("draft").notNull(),
  invoiceDate: timestamp("invoiceDate").notNull(),
  dueDate: timestamp("dueDate"),
  totalAmount: decimal("totalAmount", { precision: 18, scale: 2 }).default("0"),
  tax: decimal("tax", { precision: 18, scale: 2 }).default("0"),
  notes: text("notes"),
  createdBy: int("createdBy"),
  approvedBy: int("approvedBy"),
  itemsApprovedBy: int("itemsApprovedBy"),
  itemsApprovalNotes: text("itemsApprovalNotes"),
  accountsApprovedBy: int("accountsApprovedBy"),
  accountsApprovalNotes: text("accountsApprovalNotes"),
  approvedAt: timestamp("approvedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

// ===================== PURCHASE ORDER LINES (بنود أوامر الشراء) =====================
export const purchaseOrderLines = mysqlTable("purchase_order_lines", {
  id: int("id").autoincrement().primaryKey(),
  purchaseOrderId: int("purchaseOrderId").notNull(),
  productId: int("productId").notNull(),
  quantity: decimal("quantity", { precision: 18, scale: 4 }).notNull(),
  receivedQuantity: decimal("receivedQuantity", { precision: 18, scale: 4 }).default("0"),
  unitPrice: decimal("unitPrice", { precision: 18, scale: 4 }).notNull(),
  totalPrice: decimal("totalPrice", { precision: 18, scale: 2 }).default("0").notNull(),
  batchNumber: varchar("batchNumber", { length: 64 }),
  expiryDate: timestamp("expiryDate"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ===================== PURCHASE INVOICE LINES (بنود فواتير الشراء) =====================
export const purchaseInvoiceLines = mysqlTable("purchase_invoice_lines", {
  id: int("id").autoincrement().primaryKey(),
  invoiceId: int("invoiceId").notNull(),
  productId: int("productId").notNull(),
  quantity: decimal("quantity", { precision: 18, scale: 4 }).notNull(),
  unitPrice: decimal("unitPrice", { precision: 18, scale: 2 }).notNull(),
  lineTotal: decimal("lineTotal", { precision: 18, scale: 2 }).default("0"),
  taxCodeId: int("taxCodeId"),
  taxRate: decimal("taxRate", { precision: 5, scale: 2 }).default("15").notNull(),
  taxAmount: decimal("taxAmount", { precision: 18, scale: 2 }).default("0").notNull(),
  batchNumber: varchar("batchNumber", { length: 64 }),
  expiryDate: timestamp("expiryDate"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ===================== RESTAURANT TABLES (طاولات المطعم) =====================
export const tables = mysqlTable("restaurant_tables", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 64 }).notNull(),
  capacity: int("capacity").default(4),
  status: mysqlEnum("status", ["available", "occupied", "reserved", "maintenance"]).default("available").notNull(),
  branchId: int("branchId").notNull(),
  sortOrder: int("sortOrder").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ===================== POS SESSIONS (جلسات الكاشير) =====================
export const posSessions = mysqlTable("pos_sessions", {
  id: int("id").autoincrement().primaryKey(),
  cashierId: int("cashierId").notNull(),
  branchId: int("branchId").notNull(),
  openingBalance: decimal("openingBalance", { precision: 18, scale: 2 }).default("0").notNull(),
  closingBalance: decimal("closingBalance", { precision: 18, scale: 2 }),
  expectedCash: decimal("expectedCash", { precision: 18, scale: 2 }),
  cashVariance: decimal("cashVariance", { precision: 18, scale: 2 }),
  totalSales: decimal("totalSales", { precision: 18, scale: 2 }).default("0"),
  totalReturns: decimal("totalReturns", { precision: 18, scale: 2 }).default("0"),
  status: mysqlEnum("status", ["open", "closed"]).default("open").notNull(),
  closedBy: int("closedBy"),
  closedAt: timestamp("closedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ===================== ORDERS (الطلبات) =====================
export const orders = mysqlTable("orders", {
  id: int("id").autoincrement().primaryKey(),
  orderNumber: varchar("orderNumber", { length: 32 }).notNull(),
  tableId: int("tableId"),
  sessionId: int("sessionId"),
  branchId: int("branchId").notNull(),
  warehouseId: int("warehouseId"),
  costCenterId: int("costCenterId"),
  cashierId: int("cashierId"),
  type: mysqlEnum("type", ["dine_in", "takeaway", "delivery"]).default("dine_in").notNull(),
  status: mysqlEnum("status", ["new", "preparing", "ready", "served", "paid", "cancelled"]).default("new").notNull(),
  subtotal: decimal("subtotal", { precision: 18, scale: 2 }).default("0").notNull(),
  totalAmount: decimal("totalAmount", { precision: 18, scale: 2 }).default("0").notNull(),
  discountAmount: decimal("discountAmount", { precision: 18, scale: 2 }).default("0").notNull(),
  taxAmount: decimal("taxAmount", { precision: 18, scale: 2 }).default("0").notNull(),
  paymentMethod: mysqlEnum("paymentMethod", ["cash", "card", "transfer", "mixed"]).default("cash"),
  notes: text("notes"),
  paidAmount: decimal("paidAmount", { precision: 18, scale: 2 }).default("0"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

// ===================== ORDER LINES (بنود الطلبات) =====================
export const orderLines = mysqlTable("order_lines", {
  id: int("id").autoincrement().primaryKey(),
  orderId: int("orderId").notNull(),
  productId: int("productId").notNull(),
  parentProductId: int("parentProductId"),
  addonPricingMode: mysqlEnum("addonPricingMode", ["included", "free", "separate"]),
  quantity: decimal("quantity", { precision: 18, scale: 4 }).notNull(),
  unitPrice: decimal("unitPrice", { precision: 18, scale: 2 }).notNull(),
  totalPrice: decimal("totalPrice", { precision: 18, scale: 2 }).notNull(),
  costPrice: decimal("costPrice", { precision: 18, scale: 2 }).default("0"),
  discountAmount: decimal("discountAmount", { precision: 18, scale: 2 }).default("0").notNull(),
  taxCodeId: int("taxCodeId"),
  taxRate: decimal("taxRate", { precision: 5, scale: 2 }).default("0").notNull(),
  taxAmount: decimal("taxAmount", { precision: 18, scale: 2 }).default("0").notNull(),
  batchNumber: varchar("batchNumber", { length: 64 }),
  notes: text("notes"),
  status: mysqlEnum("status", ["pending", "preparing", "ready", "served", "cancelled"]).default("pending").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ===================== ORDER PAYMENTS (تخصيص مدفوعات الطلب) =====================
export const orderPayments = mysqlTable("order_payments", {
  id: int("id").autoincrement().primaryKey(),
  orderId: int("orderId").notNull(),
  paymentMethod: mysqlEnum("paymentMethod", ["cash", "card", "transfer"]).notNull(),
  amount: decimal("amount", { precision: 18, scale: 2 }).notNull(),
  reference: varchar("reference", { length: 128 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  index("idx_order_payments_order").on(table.orderId),
]);

// ===================== POS REFUNDS (سندات مردودات نقاط البيع) =====================
export const posRefunds = mysqlTable("pos_refunds", {
  id: int("id").autoincrement().primaryKey(),
  refundNumber: varchar("refundNumber", { length: 32 }).notNull().unique(),
  orderId: int("orderId").notNull().unique(),
  branchId: int("branchId").notNull(),
  sessionId: int("sessionId"),
  paymentMethod: mysqlEnum("paymentMethod", ["cash", "card", "transfer", "mixed"]).notNull(),
  amount: decimal("amount", { precision: 18, scale: 2 }).notNull(),
  reason: text("reason").notNull(),
  status: mysqlEnum("status", ["requested", "approved", "completed", "rejected"]).default("requested").notNull(),
  requestedBy: int("requestedBy").notNull(),
  approvedBy: int("approvedBy"),
  approvedAt: timestamp("approvedAt"),
  completedBy: int("completedBy"),
  completedAt: timestamp("completedAt"),
  stockRestoredAt: timestamp("stockRestoredAt"),
  journalEntryId: int("journalEntryId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  index("idx_pos_refunds_branch_status").on(table.branchId, table.status),
  index("idx_pos_refunds_session").on(table.sessionId),
]);
export type PosRefund = typeof posRefunds.$inferSelect;
export type InsertPosRefund = typeof posRefunds.$inferInsert;

// ===================== KITCHEN ORDERS (طلبات المطبخ) =====================
export const kitchenOrders = mysqlTable("kitchen_orders", {
  id: int("id").autoincrement().primaryKey(),
  orderId: int("orderId").notNull(),
  orderLineId: int("orderLineId").notNull(),
  branchId: int("branchId").notNull(),
  status: mysqlEnum("status", ["new", "preparing", "ready", "served"]).default("new").notNull(),
  priority: int("priority"),
  startedAt: timestamp("startedAt"),
  completedAt: timestamp("completedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ===================== PURCHASE REQUESTS (طلبات الشراء) =====================
export const purchaseRequests = mysqlTable("purchase_requests", {
  id: int("id").autoincrement().primaryKey(),
  requestNumber: varchar("requestNumber", { length: 32 }).notNull(),
  branchId: int("branchId").notNull(),
  status: mysqlEnum("status", ["draft", "submitted", "approved", "rejected"]).default("draft").notNull(),
  createdBy: int("createdBy"),
  requestedBy: int("requestedBy"),
  approvedBy: int("approvedBy"),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const purchaseRequestLines = mysqlTable("purchase_request_lines", {
  id: int("id").autoincrement().primaryKey(),
  requestId: int("requestId").notNull(),
  productId: int("productId").notNull(),
  quantity: decimal("quantity", { precision: 18, scale: 4 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ===================== BACKUPS (النسخ الاحتياطية) =====================
export const backups = mysqlTable("backups", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  fileUrl: text("fileUrl"),
  fileKey: varchar("fileKey", { length: 512 }),
  fileSize: int("fileSize"),
  tablesCount: int("tablesCount").default(0),
  recordsCount: int("recordsCount").default(0),
  status: mysqlEnum("status", ["creating", "completed", "failed", "restoring"]).default("creating").notNull(),
  createdBy: int("createdBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ===================== COST ALLOCATIONS (توزيع المصاريف) =====================
export const costAllocations = mysqlTable("cost_allocations", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  method: mysqlEnum("method", ["sales_ratio", "branch_count", "employee_count", "custom"]).notNull(),
  periodStart: timestamp("periodStart").notNull(),
  periodEnd: timestamp("periodEnd").notNull(),
  status: mysqlEnum("status", ["draft", "approved", "posted", "cancelled", "applied"]).default("draft").notNull(),
  totalAmount: decimal("totalAmount", { precision: 18, scale: 2 }).default("0").notNull(),
  sourceAccountId: int("sourceAccountId"),
  sourceCostCenterId: int("sourceCostCenterId"),
  journalEntryId: int("journalEntryId"),
  createdBy: int("createdBy"),
  approvedBy: int("approvedBy"),
  approvedAt: timestamp("approvedAt"),
  postedBy: int("postedBy"),
  postedAt: timestamp("postedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const costAllocationLines = mysqlTable("cost_allocation_lines", {
  id: int("id").autoincrement().primaryKey(),
  allocationId: int("allocationId").notNull(),
  costCenterId: int("costCenterId").notNull(),
  amount: decimal("amount", { precision: 18, scale: 2 }).notNull(),
  ratio: decimal("ratio", { precision: 8, scale: 4 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ===================== AUDIT LOG (سجل التدقيق) =====================
export const auditLog = mysqlTable("audit_log", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId"),
  action: varchar("action", { length: 64 }).notNull(),
  entityType: varchar("entityType", { length: 64 }).notNull(),
  entityId: int("entityId"),
  oldValues: json("oldValues"),
  newValues: json("newValues"),
  ipAddress: varchar("ipAddress", { length: 64 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ===================== DOCUMENTS (المستندات) =====================
export const documents = mysqlTable("documents", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  fileUrl: text("fileUrl").notNull(),
  fileKey: varchar("fileKey", { length: 512 }).notNull(),
  mimeType: varchar("mimeType", { length: 128 }),
  fileSize: int("fileSize"),
  entityType: varchar("entityType", { length: 64 }),
  entityId: int("entityId"),
  uploadedBy: int("uploadedBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ===================== SYSTEM SETTINGS (إعدادات النظام) =====================
export const systemSettings = mysqlTable("system_settings", {
  id: int("id").autoincrement().primaryKey(),
  settingKey: varchar("settingKey", { length: 128 }).notNull().unique(),
  value: text("value"),
  group: varchar("settingGroup", { length: 64 }),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

// ===================== DOCUMENT SEQUENCES (عدادات المستندات الذرية) =====================
export const documentSequences = mysqlTable("document_sequences", {
  sequenceKey: varchar("sequenceKey", { length: 64 }).primaryKey(),
  currentValue: int("currentValue").default(0).notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

// ===================== SAUDI COMPANY PROFILE (بيانات المنشأة والامتثال) =====================
export const companyProfiles = mysqlTable("company_profiles", {
  id: int("id").autoincrement().primaryKey(),
  legalName: varchar("legalName", { length: 255 }).notNull(),
  tradeName: varchar("tradeName", { length: 255 }),
  vatNumber: varchar("vatNumber", { length: 32 }),
  commercialRegistrationNumber: varchar("commercialRegistrationNumber", { length: 64 }),
  addressLine1: varchar("addressLine1", { length: 255 }),
  addressLine2: varchar("addressLine2", { length: 255 }),
  city: varchar("city", { length: 128 }),
  district: varchar("district", { length: 128 }),
  postalCode: varchar("postalCode", { length: 16 }),
  countryCode: varchar("countryCode", { length: 2 }).notNull(),
  currencyCode: varchar("currencyCode", { length: 3 }).notNull(),
  isVatRegistered: boolean("isVatRegistered").default(false).notNull(),
  eInvoicingMode: mysqlEnum("eInvoicingMode", ["disabled", "sandbox", "production"]).default("disabled").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

// ===================== TAX CODES (الرموز الضريبية) =====================
export const taxCodes = mysqlTable("tax_codes", {
  id: int("id").autoincrement().primaryKey(),
  code: varchar("code", { length: 32 }).notNull().unique(),
  name: varchar("name", { length: 128 }).notNull(),
  category: mysqlEnum("category", ["standard", "zero_rated", "exempt", "out_of_scope"]).notNull(),
  rate: decimal("rate", { precision: 5, scale: 2 }).notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

// ===================== CUSTOMERS (العملاء) =====================
export const customers = mysqlTable("customers", {
  id: int("id").autoincrement().primaryKey(),
  code: varchar("code", { length: 32 }).unique(),
  name: varchar("name", { length: 255 }).notNull(),
  customerType: mysqlEnum("customerType", ["individual", "business"]).default("individual").notNull(),
  vatNumber: varchar("vatNumber", { length: 32 }),
  commercialRegistrationNumber: varchar("commercialRegistrationNumber", { length: 64 }),
  addressLine1: varchar("addressLine1", { length: 255 }),
  city: varchar("city", { length: 128 }),
  countryCode: varchar("countryCode", { length: 2 }),
  email: varchar("email", { length: 320 }),
  phone: varchar("phone", { length: 32 }),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

// ===================== SALES INVOICES (الفواتير الضريبية) =====================
export const salesInvoices = mysqlTable("sales_invoices", {
  id: int("id").autoincrement().primaryKey(),
  invoiceUuid: varchar("invoiceUuid", { length: 64 }).notNull().unique(),
  invoiceNumber: varchar("invoiceNumber", { length: 32 }).notNull().unique(),
  orderId: int("orderId"),
  branchId: int("branchId").notNull(),
  customerId: int("customerId"),
  invoiceType: mysqlEnum("invoiceType", ["simplified", "tax", "credit_note", "debit_note"]).notNull(),
  status: mysqlEnum("status", ["draft", "issued", "reported", "cleared", "failed", "cancelled"]).default("draft").notNull(),
  issueDate: timestamp("issueDate").notNull(),
  currencyCode: varchar("currencyCode", { length: 3 }).notNull(),
  subtotalAmount: decimal("subtotalAmount", { precision: 18, scale: 2 }).notNull(),
  discountAmount: decimal("discountAmount", { precision: 18, scale: 2 }).default("0").notNull(),
  taxAmount: decimal("taxAmount", { precision: 18, scale: 2 }).notNull(),
  totalAmount: decimal("totalAmount", { precision: 18, scale: 2 }).notNull(),
  previousInvoiceHash: text("previousInvoiceHash"),
  invoiceHash: text("invoiceHash"),
  qrPayload: text("qrPayload"),
  complianceStatus: mysqlEnum("complianceStatus", ["not_submitted", "pending", "accepted", "rejected"]).default("not_submitted").notNull(),
  complianceMessage: text("complianceMessage"),
  createdBy: int("createdBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const salesInvoiceLines = mysqlTable("sales_invoice_lines", {
  id: int("id").autoincrement().primaryKey(),
  invoiceId: int("invoiceId").notNull(),
  productId: int("productId"),
  description: varchar("description", { length: 512 }).notNull(),
  quantity: decimal("quantity", { precision: 18, scale: 4 }).notNull(),
  unitPrice: decimal("unitPrice", { precision: 18, scale: 2 }).notNull(),
  discountAmount: decimal("discountAmount", { precision: 18, scale: 2 }).default("0").notNull(),
  taxCodeId: int("taxCodeId"),
  taxRate: decimal("taxRate", { precision: 5, scale: 2 }).notNull(),
  taxAmount: decimal("taxAmount", { precision: 18, scale: 2 }).notNull(),
  lineTotal: decimal("lineTotal", { precision: 18, scale: 2 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ===================== ZATCA / FATOORA INTEGRATION =====================
// لا تُخزَّن الشهادات أو المفاتيح أو كلمات المرور هنا؛ تحفظ كأسرار تشغيلية فقط.
export const zatcaConnections = mysqlTable("zatca_connections", {
  id: int("id").autoincrement().primaryKey(),
  companyProfileId: int("companyProfileId").notNull(),
  environment: mysqlEnum("environment", ["sandbox", "production"]).notNull(),
  status: mysqlEnum("status", ["not_configured", "ready", "testing", "active", "error", "suspended"]).default("not_configured").notNull(),
  credentialReference: varchar("credentialReference", { length: 128 }),
  csidReference: varchar("csidReference", { length: 128 }),
  lastVerifiedAt: timestamp("lastVerifiedAt"),
  lastError: text("lastError"),
  createdBy: int("createdBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const zatcaSubmissionAttempts = mysqlTable("zatca_submission_attempts", {
  id: int("id").autoincrement().primaryKey(),
  salesInvoiceId: int("salesInvoiceId").notNull(),
  connectionId: int("connectionId"),
  submissionType: mysqlEnum("submissionType", ["reporting", "clearance"]).notNull(),
  status: mysqlEnum("status", ["queued", "sending", "accepted", "rejected", "retryable_error", "permanent_error"]).default("queued").notNull(),
  attemptNumber: int("attemptNumber").default(1).notNull(),
  requestId: varchar("requestId", { length: 128 }),
  httpStatus: int("httpStatus"),
  requestDocumentKey: varchar("requestDocumentKey", { length: 512 }),
  responseDocumentKey: varchar("responseDocumentKey", { length: 512 }),
  responseSummary: text("responseSummary"),
  nextRetryAt: timestamp("nextRetryAt"),
  sentAt: timestamp("sentAt"),
  completedAt: timestamp("completedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  index("zatca_submission_attempts_invoice_status_idx").on(table.salesInvoiceId, table.status),
]);

// ===================== VOUCHERS (سندات الصرف والقبض) =====================
export const vouchers = mysqlTable("vouchers", {
  id: int("id").autoincrement().primaryKey(),
  voucherNumber: varchar("voucherNumber", { length: 32 }).notNull().unique(),
  voucherType: mysqlEnum("voucherType", ["receipt", "payment"]).notNull(),
  date: timestamp("date").notNull(),
  branchId: int("branchId").notNull(),
  description: text("description"),
  amount: decimal("amount", { precision: 18, scale: 2 }).notNull(),
  settlementAccountId: int("settlementAccountId"),
  paymentMethod: mysqlEnum("paymentMethod", ["cash", "check", "transfer", "card"]).default("cash").notNull(),
  referenceNumber: varchar("referenceNumber", { length: 64 }),
  status: mysqlEnum("status", ["draft", "approved", "posted", "cancelled"]).default("draft").notNull(),
  journalEntryId: int("journalEntryId"),
  createdBy: int("createdBy"),
  approvedBy: int("approvedBy"),
  approvedAt: timestamp("approvedAt"),
  postedBy: int("postedBy"),
  postedAt: timestamp("postedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Voucher = typeof vouchers.$inferSelect;
export type InsertVoucher = typeof vouchers.$inferInsert;

// ===================== VOUCHER LINES (بنود السندات) =====================
export const voucherLines = mysqlTable("voucher_lines", {
  id: int("id").autoincrement().primaryKey(),
  voucherId: int("voucherId").notNull(),
  accountId: int("accountId").notNull(),
  costCenterId: int("costCenterId"),
  description: text("description"),
  amount: decimal("amount", { precision: 18, scale: 2 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type VoucherLine = typeof voucherLines.$inferSelect;
export type InsertVoucherLine = typeof voucherLines.$inferInsert;

// ===================== NOTIFICATIONS (الإشعارات) =====================
export const notifications = mysqlTable("notifications", {
  id: int("id").autoincrement().primaryKey(),
  type: varchar("type", { length: 64 }).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  content: text("content"),
  isRead: boolean("isRead").default(false).notNull(),
  entityType: varchar("entityType", { length: 64 }),
  entityId: int("entityId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ===================== UAT DATA ISOLATION / CLEANUP =====================
export const uatRuns = mysqlTable("uat_runs", {
  id: int("id").autoincrement().primaryKey(),
  code: varchar("code", { length: 64 }).notNull().unique(),
  status: mysqlEnum("status", ["active", "completed", "cleanup_pending", "cleaned", "failed"]).default("active").notNull(),
  baselineSnapshot: json("baselineSnapshot").notNull(),
  scenarioVersion: varchar("scenarioVersion", { length: 32 }).notNull(),
  notes: text("notes"),
  createdBy: int("createdBy").notNull(),
  completedAt: timestamp("completedAt"),
  cleanedAt: timestamp("cleanedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const uatEntityRegistry = mysqlTable("uat_entity_registry", {
  id: int("id").autoincrement().primaryKey(),
  uatRunId: int("uatRunId").notNull(),
  tableName: varchar("tableName", { length: 96 }).notNull(),
  entityId: int("entityId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  index("uat_registry_run_idx").on(table.uatRunId),
  uniqueIndex("uat_registry_entity_unique").on(table.uatRunId, table.tableName, table.entityId),
]);
