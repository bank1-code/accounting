import { eq, and, sql, desc, asc, isNull, gte, lte, like, inArray, or } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { createHash, randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import {
  InsertUser, users, accounts, journalEntries, journalEntryLines,
  costCenters, branches, fiscalPeriods, categories, units, products, productAddons,
  warehouses, stock, inventoryBatches, stockMovements, wasteVouchers, wasteVoucherLines, internalTransfers, internalTransferLines,
  inventoryCounts, inventoryCountLines, recipes, recipeLines,
  productionOrders, productionOrderLines, suppliers, purchaseOrders, purchaseOrderLines,
  purchaseRequests, purchaseRequestLines, purchaseInvoices, purchaseInvoiceLines,
  tables, posSessions, orders, orderLines, orderPayments, posRefunds, kitchenOrders,
  costAllocations, costAllocationLines, auditLog, documents, systemSettings, documentSequences, notifications, backups,
  companyProfiles, taxCodes, customers, salesInvoices, salesInvoiceLines,
  zatcaConnections, zatcaSubmissionAttempts, roles, permissions, rolePermissions,
  userRoles, userPermissionOverrides, fiscalPeriodReopenLogs, journalEntryTemplates, vouchers, voucherLines
} from "../drizzle/schema";
import { ENV } from './_core/env';
import { getZatcaReadinessIssues, getZatcaSubmissionType } from "./zatca-submission";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try { _db = drizzle(process.env.DATABASE_URL); } catch (error) { console.warn("[Database] Failed to connect:", error); _db = null; }
  }
  return _db;
}

// ============ USERS ============
export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) { console.warn("[Database] Cannot upsert user: database not available"); return; }
  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  const textFields = ["name", "email", "loginMethod"] as const;
  type TextField = (typeof textFields)[number];
  const assignNullable = (field: TextField) => { const value = user[field]; if (value === undefined) return; values[field] = value ?? null; updateSet[field] = value ?? null; };
  textFields.forEach(assignNullable);
  if (user.lastSignedIn !== undefined) { values.lastSignedIn = user.lastSignedIn; updateSet.lastSignedIn = user.lastSignedIn; }
  if (user.role !== undefined) { values.role = user.role; updateSet.role = user.role; }
  else if (user.openId === ENV.ownerOpenId) { values.role = 'admin'; updateSet.role = 'admin'; }
  if (!values.lastSignedIn) values.lastSignedIn = new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();
  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb(); if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

export function localAdminCredentialsConfigured() {
  return Boolean(process.env.LOCAL_ADMIN_USERNAME && process.env.LOCAL_ADMIN_PASSWORD);
}

export async function getUserById(id: number) {
  const db = await getDb(); if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result[0];
}

export async function getUserByUsername(username: string) {
  const db = await getDb(); if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.username, username.trim().toLowerCase())).limit(1);
  return result[0];
}

export async function listUsersForAccessControl() {
  const db = await getDb(); if (!db) return [];
  return db.select({
    id: users.id, username: users.username, name: users.name, email: users.email,
    role: users.role, loginMethod: users.loginMethod, lastSignedIn: users.lastSignedIn,
  }).from(users).orderBy(asc(users.name));
}

export async function ensureLocalAdminUser() {
  if (!localAdminCredentialsConfigured()) return undefined;
  const db = await getDb(); if (!db) throw new Error("Database not available");
  const username = process.env.LOCAL_ADMIN_USERNAME!.trim().toLowerCase();
  const password = process.env.LOCAL_ADMIN_PASSWORD!;
  const existing = await getUserByUsername(username);
  if (existing) {
    if (!existing.passwordHash) {
      await db.update(users).set({ passwordHash: await bcrypt.hash(password, 12), loginMethod: "local", role: "admin" }).where(eq(users.id, existing.id));
      return getUserById(existing.id);
    }
    return existing;
  }
  const passwordHash = await bcrypt.hash(password, 12);
  const result = await db.insert(users).values({
    username,
    passwordHash,
    name: "Local Administrator",
    loginMethod: "local",
    role: "admin",
    lastSignedIn: new Date(),
  });
  return getUserById(Number(result[0].insertId));
}

export async function authenticateLocalUser(username: string, password: string) {
  const user = await getUserByUsername(username);
  if (!user?.passwordHash) return undefined;
  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) return undefined;
  const db = await getDb();
  if (db) await db.update(users).set({ lastSignedIn: new Date() }).where(eq(users.id, user.id));
  return getUserById(user.id);
}

type LoginAttemptState = { failures: number; windowStartedAt: number; blockedUntil?: number };
const localLoginAttempts = new Map<string, LoginAttemptState>();
export const LOCAL_LOGIN_MAX_FAILURES = 5;
export const LOCAL_LOGIN_WINDOW_MS = 15 * 60 * 1000;

export function localLoginAttemptKey(username: string, clientAddress?: string) {
  return `${username.trim().toLowerCase()}::${clientAddress || "unknown"}`;
}

export function getLocalLoginAttemptStatus(key: string, now = Date.now()) {
  const state = localLoginAttempts.get(key);
  if (!state) return { blocked: false, retryAfterSeconds: 0 };
  if (state.blockedUntil && state.blockedUntil > now) return { blocked: true, retryAfterSeconds: Math.ceil((state.blockedUntil - now) / 1000) };
  if (now - state.windowStartedAt >= LOCAL_LOGIN_WINDOW_MS) localLoginAttempts.delete(key);
  return { blocked: false, retryAfterSeconds: 0 };
}

export function recordLocalLoginFailure(key: string, now = Date.now()) {
  const current = localLoginAttempts.get(key);
  const state = !current || now - current.windowStartedAt >= LOCAL_LOGIN_WINDOW_MS
    ? { failures: 1, windowStartedAt: now } satisfies LoginAttemptState
    : { ...current, failures: current.failures + 1 };
  if (state.failures >= LOCAL_LOGIN_MAX_FAILURES) state.blockedUntil = now + LOCAL_LOGIN_WINDOW_MS;
  localLoginAttempts.set(key, state);
  return getLocalLoginAttemptStatus(key, now);
}

export function recordLocalLoginSuccess(key: string) {
  localLoginAttempts.delete(key);
}

// ============ DYNAMIC RBAC / ATOMIC PERMISSIONS ============
export type PermissionScope = {
  branchId?: number | null;
  warehouseId?: number | null;
  costCenterId?: number | null;
};

type PermissionGrant = PermissionScope & {
  effect: "allow" | "deny";
  expiresAt: Date | null;
};

function isActiveGrant(grant: PermissionGrant) {
  return !grant.expiresAt || grant.expiresAt.getTime() > Date.now();
}

export function matchesPermissionScope(grant: PermissionScope, requested: PermissionScope) {
  const fields: Array<keyof PermissionScope> = ["branchId", "warehouseId", "costCenterId"];
  return fields.every((field) => {
    const allowed = grant[field];
    const current = requested[field];
    return allowed === null || allowed === undefined || current === allowed;
  });
}

export function resolveScopedPermissionEffect(grants: PermissionGrant[], requested: PermissionScope): boolean | undefined {
  const validGrants = grants.filter((grant) => isActiveGrant(grant) && matchesPermissionScope(grant, requested));
  if (validGrants.some((grant) => grant.effect === "deny")) return false;
  if (validGrants.some((grant) => grant.effect === "allow")) return true;
  return undefined;
}

export async function listRoles() {
  const db = await getDb(); if (!db) return [];
  return db.select().from(roles).orderBy(asc(roles.name));
}

export async function listPermissions() {
  const db = await getDb(); if (!db) return [];
  return db.select().from(permissions).orderBy(asc(permissions.module), asc(permissions.code));
}

export async function getRolePermissionIds(roleId: number) {
  const db = await getDb(); if (!db) return [];
  const result = await db.select({ permissionId: rolePermissions.permissionId, effect: rolePermissions.effect })
    .from(rolePermissions).where(eq(rolePermissions.roleId, roleId));
  return result;
}

export async function createRole(data: { code: string; name: string; nameEn?: string; description?: string; createdBy?: number }) {
  const db = await getDb(); if (!db) throw new Error("Database not available");
  const result = await db.insert(roles).values({
    code: data.code.trim().toLowerCase(), name: data.name.trim(), nameEn: data.nameEn,
    description: data.description, createdBy: data.createdBy, isSystem: false, isActive: true,
  });
  return { id: Number(result[0].insertId) };
}

export async function updateRole(id: number, data: Partial<{ name: string; nameEn: string; description: string; isActive: boolean }>) {
  const db = await getDb(); if (!db) throw new Error("Database not available");
  const existing = await db.select().from(roles).where(eq(roles.id, id)).limit(1);
  if (!existing[0]) throw new Error("Role not found");
  await db.update(roles).set(data).where(eq(roles.id, id));
}

export async function setRolePermissions(roleId: number, permissionIds: number[], deniedPermissionIds: number[], createdBy?: number) {
  const db = await getDb(); if (!db) throw new Error("Database not available");
  const uniqueAllow = Array.from(new Set(permissionIds)).filter((id) => !deniedPermissionIds.includes(id));
  const uniqueDeny = Array.from(new Set(deniedPermissionIds));
  await db.transaction(async (tx) => {
    await tx.delete(rolePermissions).where(eq(rolePermissions.roleId, roleId));
    const values = [
      ...uniqueAllow.map((permissionId) => ({ roleId, permissionId, effect: "allow" as const, createdBy })),
      ...uniqueDeny.map((permissionId) => ({ roleId, permissionId, effect: "deny" as const, createdBy })),
    ];
    if (values.length) await tx.insert(rolePermissions).values(values);
  });
}

export async function listUserRoleAssignments(userId: number) {
  const db = await getDb(); if (!db) return [];
  return db.select({
    assignmentId: userRoles.id, roleId: roles.id, roleCode: roles.code, roleName: roles.name,
    isSystem: roles.isSystem, isActive: userRoles.isActive, branchId: userRoles.branchId,
    warehouseId: userRoles.warehouseId, costCenterId: userRoles.costCenterId, expiresAt: userRoles.expiresAt,
  }).from(userRoles).innerJoin(roles, eq(userRoles.roleId, roles.id))
    .where(eq(userRoles.userId, userId));
}

export async function assignUserRole(data: { userId: number; roleId: number; branchId?: number; warehouseId?: number; costCenterId?: number; expiresAt?: Date; assignedBy?: number }) {
  const db = await getDb(); if (!db) throw new Error("Database not available");
  const result = await db.insert(userRoles).values({ ...data, isActive: true });
  return { id: Number(result[0].insertId) };
}

export async function setUserRoleActive(id: number, isActive: boolean) {
  const db = await getDb(); if (!db) throw new Error("Database not available");
  await db.update(userRoles).set({ isActive }).where(eq(userRoles.id, id));
}

export async function setUserPermissionOverride(data: { userId: number; permissionId: number; effect: "allow" | "deny"; branchId?: number; warehouseId?: number; costCenterId?: number; reason?: string; expiresAt?: Date; grantedBy?: number }) {
  const db = await getDb(); if (!db) throw new Error("Database not available");
  const result = await db.insert(userPermissionOverrides).values(data);
  return { id: Number(result[0].insertId) };
}

export async function listUserPermissionOverrides(userId: number) {
  const db = await getDb(); if (!db) return [];
  return db.select({
    id: userPermissionOverrides.id, permissionId: permissions.id, permissionCode: permissions.code,
    permissionName: permissions.name, effect: userPermissionOverrides.effect, branchId: userPermissionOverrides.branchId,
    warehouseId: userPermissionOverrides.warehouseId, costCenterId: userPermissionOverrides.costCenterId,
    reason: userPermissionOverrides.reason, expiresAt: userPermissionOverrides.expiresAt,
  }).from(userPermissionOverrides)
    .innerJoin(permissions, eq(userPermissionOverrides.permissionId, permissions.id))
    .where(eq(userPermissionOverrides.userId, userId))
    .orderBy(desc(userPermissionOverrides.createdAt));
}

export async function hasAtomicPermission(userId: number, permissionCode: string, scope: PermissionScope = {}) {
  const db = await getDb(); if (!db) return false;
  const [user] = await db.select({ role: users.role }).from(users).where(eq(users.id, userId)).limit(1);
  if (!user) return false;

  const directGrants = await db.select({
    effect: userPermissionOverrides.effect, branchId: userPermissionOverrides.branchId,
    warehouseId: userPermissionOverrides.warehouseId, costCenterId: userPermissionOverrides.costCenterId,
    expiresAt: userPermissionOverrides.expiresAt,
  }).from(userPermissionOverrides)
    .innerJoin(permissions, eq(userPermissionOverrides.permissionId, permissions.id))
    .where(and(eq(userPermissionOverrides.userId, userId), eq(permissions.code, permissionCode)));
  const directEffect = resolveScopedPermissionEffect(directGrants, scope);
  if (directEffect !== undefined) return directEffect;

  const roleGrants = await db.select({
    effect: rolePermissions.effect, branchId: userRoles.branchId, warehouseId: userRoles.warehouseId,
    costCenterId: userRoles.costCenterId, expiresAt: userRoles.expiresAt,
  }).from(userRoles)
    .innerJoin(roles, eq(userRoles.roleId, roles.id))
    .innerJoin(rolePermissions, eq(rolePermissions.roleId, roles.id))
    .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
    .where(and(eq(userRoles.userId, userId), eq(userRoles.isActive, true), eq(roles.isActive, true), eq(permissions.code, permissionCode)));
  const roleEffect = resolveScopedPermissionEffect(roleGrants, scope);
  if (roleEffect !== undefined) return roleEffect;

  return false;
}

export function resolveEffectivePermissionCodes(
  allCodes: string[],
  directGrants: Array<PermissionGrant & { permissionCode: string }>,
  roleGrants: Array<PermissionGrant & { permissionCode: string }>,
) {
  return allCodes.filter((permissionCode) => {
    const directEffect = resolveScopedPermissionEffect(directGrants.filter((grant) => grant.permissionCode === permissionCode), {});
    if (directEffect !== undefined) return directEffect;
    return resolveScopedPermissionEffect(roleGrants.filter((grant) => grant.permissionCode === permissionCode), {}) === true;
  });
}

export async function listEffectivePermissionCodes(userId: number) {
  const db = await getDb(); if (!db) return [];
  const [allPermissions, directGrants, roleGrants] = await Promise.all([
    db.select({ code: permissions.code }).from(permissions).orderBy(asc(permissions.module), asc(permissions.code)),
    db.select({ permissionCode: permissions.code, effect: userPermissionOverrides.effect, branchId: userPermissionOverrides.branchId, warehouseId: userPermissionOverrides.warehouseId, costCenterId: userPermissionOverrides.costCenterId, expiresAt: userPermissionOverrides.expiresAt })
      .from(userPermissionOverrides).innerJoin(permissions, eq(userPermissionOverrides.permissionId, permissions.id)).where(eq(userPermissionOverrides.userId, userId)),
    db.select({ permissionCode: permissions.code, effect: rolePermissions.effect, branchId: userRoles.branchId, warehouseId: userRoles.warehouseId, costCenterId: userRoles.costCenterId, expiresAt: userRoles.expiresAt })
      .from(userRoles).innerJoin(roles, eq(userRoles.roleId, roles.id)).innerJoin(rolePermissions, eq(rolePermissions.roleId, roles.id)).innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
      .where(and(eq(userRoles.userId, userId), eq(userRoles.isActive, true), eq(roles.isActive, true))),
  ]);
  return resolveEffectivePermissionCodes(allPermissions.map((permission) => permission.code), directGrants, roleGrants);
}

// ============ BRANCHES ============
export async function listBranches() {
  const db = await getDb(); if (!db) return [];
  return db.select().from(branches).orderBy(asc(branches.name));
}
export async function createBranch(data: { name: string; nameEn?: string; type: "restaurant" | "grocery" | "accessories" | "warehouse" | "kitchen"; address?: string; phone?: string; isCentralKitchen?: boolean; isCentralWarehouse?: boolean }) {
  const db = await getDb(); if (!db) throw new Error("Database not available");
  const result = await db.insert(branches).values(data);
  return { id: Number(result[0].insertId) };
}
export async function updateBranch(id: number, data: Partial<{ name: string; nameEn: string; type: string; address: string; phone: string; isActive: boolean; isCentralKitchen: boolean; isCentralWarehouse: boolean }>) {
  const db = await getDb(); if (!db) throw new Error("Database not available");
  await db.update(branches).set(data as any).where(eq(branches.id, id));
}

// ============ ACCOUNTS ============
export async function listAccounts() {
  const db = await getDb(); if (!db) return [];
  return db.select().from(accounts).orderBy(asc(accounts.code));
}
export async function createAccount(data: { code: string; name: string; nameEn?: string; type: "asset" | "liability" | "equity" | "revenue" | "expense"; parentId?: number; level?: number; isSystem?: boolean }) {
  const db = await getDb(); if (!db) throw new Error("Database not available");
  const result = await db.insert(accounts).values(data);
  return { id: Number(result[0].insertId) };
}
export async function updateAccount(id: number, data: Partial<{ code: string; name: string; nameEn: string; type: string; parentId: number; isActive: boolean }>) {
  const db = await getDb(); if (!db) throw new Error("Database not available");
  await db.update(accounts).set(data as any).where(eq(accounts.id, id));
}
export async function getAccountById(id: number) {
  const db = await getDb(); if (!db) return undefined;
  const result = await db.select().from(accounts).where(eq(accounts.id, id)).limit(1);
  return result[0];
}

export type PosPostingAccountMap = {
  cashAccountId: number;
  cardClearingAccountId: number;
  salesRevenueAccountId: number;
  outputVatAccountId: number;
  inputVatAccountId: number;
  inventoryAccountId: number;
  workInProgressAccountId: number;
  finishedGoodsInventoryAccountId: number;
  inventoryGainAccountId: number;
  inventoryLossAccountId: number;
  wasteExpenseAccountId: number;
  cogsAccountId: number;
  accountsPayableAccountId: number;
};

type InventoryPostingProductType = "raw_material" | "semi_finished" | "finished" | "direct_sale" | "service";
export function getInventoryPostingAccountId(postingMap: PosPostingAccountMap, productType: InventoryPostingProductType) {
  return productType === "finished" || productType === "direct_sale" ? postingMap.finishedGoodsInventoryAccountId : postingMap.inventoryAccountId;
}

const POS_POSTING_MAP_KEY = "accounting.pos_posting_map.v1";
const POS_CASH_VARIANCE_ALERT_THRESHOLD_KEY = "pos.cash_variance_alert_threshold.v1";
const INVENTORY_EXPIRY_ALERT_DAYS_KEY = "inventory.expiry_alert_days.v1";
const NOTIFICATION_RULES_KEY = "notifications.rules.v1";
export type NotificationRules = { inventoryReorder: boolean; inventoryExpiry: boolean; posCashVariance: boolean };
const DEFAULT_NOTIFICATION_RULES: NotificationRules = { inventoryReorder: true, inventoryExpiry: true, posCashVariance: true };
const POSTING_ACCOUNT_TYPES: Record<keyof PosPostingAccountMap, "asset" | "liability" | "revenue" | "expense"> = {
  cashAccountId: "asset", cardClearingAccountId: "asset", salesRevenueAccountId: "revenue",
  outputVatAccountId: "liability", inputVatAccountId: "asset", inventoryAccountId: "asset",
  workInProgressAccountId: "asset", finishedGoodsInventoryAccountId: "asset", inventoryGainAccountId: "revenue",
  inventoryLossAccountId: "expense", wasteExpenseAccountId: "expense", cogsAccountId: "expense",
  accountsPayableAccountId: "liability",
};

function normalizePosPostingAccountMap(value: unknown): PosPostingAccountMap {
  if (!value || typeof value !== "object") throw new Error("POS posting account map is invalid");
  const map = value as Record<string, unknown>;
  const keys: Array<keyof PosPostingAccountMap> = ["cashAccountId", "cardClearingAccountId", "salesRevenueAccountId", "outputVatAccountId", "inputVatAccountId", "inventoryAccountId", "workInProgressAccountId", "finishedGoodsInventoryAccountId", "inventoryGainAccountId", "inventoryLossAccountId", "wasteExpenseAccountId", "cogsAccountId", "accountsPayableAccountId"];
  const normalized = {} as PosPostingAccountMap;
  for (const key of keys) {
    const accountId = Number(map[key]);
    if (!Number.isInteger(accountId) || accountId <= 0) throw new Error(`POS posting map requires a valid ${key}`);
    normalized[key] = accountId;
  }
  if (normalized.salesRevenueAccountId === normalized.outputVatAccountId || normalized.outputVatAccountId === normalized.inputVatAccountId || normalized.inventoryAccountId === normalized.cogsAccountId || normalized.inventoryAccountId === normalized.workInProgressAccountId || normalized.inventoryAccountId === normalized.finishedGoodsInventoryAccountId || normalized.inventoryAccountId === normalized.inventoryGainAccountId || normalized.inventoryAccountId === normalized.inventoryLossAccountId || normalized.inventoryAccountId === normalized.wasteExpenseAccountId || normalized.workInProgressAccountId === normalized.finishedGoodsInventoryAccountId || normalized.inventoryGainAccountId === normalized.inventoryLossAccountId || normalized.inventoryLossAccountId === normalized.wasteExpenseAccountId || normalized.accountsPayableAccountId === normalized.inventoryAccountId || normalized.accountsPayableAccountId === normalized.inputVatAccountId) {
    throw new Error("Posting accounts must keep revenue, VAT, inventory, production, and cost of sales distinct");
  }
  return normalized;
}

export function normalizeNotificationRules(value: unknown): NotificationRules {
  if (!value || typeof value !== "object") return { ...DEFAULT_NOTIFICATION_RULES };
  const rules = value as Partial<NotificationRules>;
  return {
    inventoryReorder: typeof rules.inventoryReorder === "boolean" ? rules.inventoryReorder : true,
    inventoryExpiry: typeof rules.inventoryExpiry === "boolean" ? rules.inventoryExpiry : true,
    posCashVariance: typeof rules.posCashVariance === "boolean" ? rules.posCashVariance : true,
  };
}

export function isNotificationRuleEnabled(rules: NotificationRules, rule: keyof NotificationRules) {
  return rules[rule] === true;
}

export async function getNotificationRules(): Promise<NotificationRules> {
  const db = await getDb(); if (!db) return { ...DEFAULT_NOTIFICATION_RULES };
  const rows = await db.select().from(systemSettings).where(eq(systemSettings.settingKey, NOTIFICATION_RULES_KEY)).limit(1);
  try { return normalizeNotificationRules(rows[0]?.value ? JSON.parse(rows[0].value) : undefined); } catch { return { ...DEFAULT_NOTIFICATION_RULES }; }
}

export async function saveNotificationRules(input: NotificationRules) {
  const rules = normalizeNotificationRules(input);
  const db = await getDb(); if (!db) throw new Error("Database not available");
  await db.insert(systemSettings).values({ settingKey: NOTIFICATION_RULES_KEY, group: "notifications", value: JSON.stringify(rules) })
    .onDuplicateKeyUpdate({ set: { value: JSON.stringify(rules), group: "notifications", updatedAt: new Date() } });
  return rules;
}

export function validatePostingAccountMapTypes(map: PosPostingAccountMap, rows: Array<{ id: number; type: string; isActive: boolean }>) {
  const ids = Array.from(new Set(Object.values(map)));
  if (rows.length !== ids.length || rows.some((account) => !account.isActive)) throw new Error("POS posting map contains an invalid or inactive account");
  const byId = new Map(rows.map((account) => [account.id, account]));
  for (const [key, expectedType] of Object.entries(POSTING_ACCOUNT_TYPES) as Array<[keyof PosPostingAccountMap, string]>) {
    if (byId.get(map[key])?.type !== expectedType) throw new Error(`POS posting map requires ${key} to use a ${expectedType} account`);
  }
}

async function assertActivePostingAccounts(tx: any, map: PosPostingAccountMap) {
  const ids = Array.from(new Set(Object.values(map)));
  const accountRows = await tx.select({ id: accounts.id, type: accounts.type, isActive: accounts.isActive }).from(accounts).where(inArray(accounts.id, ids));
  validatePostingAccountMapTypes(map, accountRows);
}

export async function getPosPostingAccountMap(): Promise<PosPostingAccountMap | null> {
  const db = await getDb(); if (!db) return null;
  const rows = await db.select().from(systemSettings).where(eq(systemSettings.settingKey, POS_POSTING_MAP_KEY)).limit(1);
  if (!rows[0]?.value) return null;
  try { return normalizePosPostingAccountMap(JSON.parse(rows[0].value)); } catch { throw new Error("POS posting account map is invalid"); }
}

export async function savePosPostingAccountMap(input: PosPostingAccountMap) {
  const db = await getDb(); if (!db) throw new Error("Database not available");
  const map = normalizePosPostingAccountMap(input);
  return db.transaction(async (tx) => {
    await assertActivePostingAccounts(tx, map);
    await tx.insert(systemSettings).values({ settingKey: POS_POSTING_MAP_KEY, group: "accounting", value: JSON.stringify(map) })
      .onDuplicateKeyUpdate({ set: { value: JSON.stringify(map), group: "accounting", updatedAt: new Date() } });
    return map;
  });
}

export function shouldCreateCashVarianceAlert(varianceCents: number, thresholdCents: number) {
  return Number.isInteger(varianceCents) && Number.isInteger(thresholdCents) && thresholdCents > 0 && Math.abs(varianceCents) >= thresholdCents;
}

export async function getPosCashVarianceAlertThreshold() {
  const db = await getDb(); if (!db) return null;
  const rows = await db.select().from(systemSettings).where(eq(systemSettings.settingKey, POS_CASH_VARIANCE_ALERT_THRESHOLD_KEY)).limit(1);
  return rows[0]?.value ? rows[0].value : null;
}

export async function savePosCashVarianceAlertThreshold(value: string) {
  const db = await getDb(); if (!db) throw new Error("Database not available");
  const thresholdCents = toCents(value, "cash variance alert threshold");
  return db.transaction(async (tx) => {
    await tx.insert(systemSettings).values({ settingKey: POS_CASH_VARIANCE_ALERT_THRESHOLD_KEY, group: "pos", value: (thresholdCents / 100).toFixed(2) })
      .onDuplicateKeyUpdate({ set: { value: (thresholdCents / 100).toFixed(2), group: "pos", updatedAt: new Date() } });
    return (thresholdCents / 100).toFixed(2);
  });
}

export function shouldCreateExpiryAlert(expiryDate: Date, thresholdDays: number, referenceDate = new Date()) {
  if (!Number.isInteger(thresholdDays) || thresholdDays < 1 || !Number.isFinite(expiryDate.getTime())) return false;
  const expiryMidnight = new Date(expiryDate.getFullYear(), expiryDate.getMonth(), expiryDate.getDate()).getTime();
  const referenceMidnight = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate()).getTime();
  return Math.ceil((expiryMidnight - referenceMidnight) / 86_400_000) <= thresholdDays;
}

export function shouldScanInventoryBatch(input: { quantity: string | number; expiryDate: Date | null; thresholdDays: number; referenceDate?: Date }) {
  return Number(input.quantity) > 0 && Boolean(input.expiryDate) && shouldCreateExpiryAlert(input.expiryDate!, input.thresholdDays, input.referenceDate);
}

export function shouldCreateExpiryNotification(hasExistingNotification: boolean) {
  return !hasExistingNotification;
}

export function evaluateInventoryExpiryBatch(input: {
  quantity: string | number;
  expiryDate: Date | null;
  thresholdDays: number;
  hasExistingNotification: boolean;
  referenceDate?: Date;
}) {
  const scanned = shouldScanInventoryBatch(input);
  return { scanned, shouldCreateNotification: scanned && shouldCreateExpiryNotification(input.hasExistingNotification) };
}

export type InventoryExpiryBatchRecord = {
  productId: number;
  warehouseId: number;
  batchNumber: string;
  expiryDate: Date | null;
  quantity: string | number;
};

export type InventoryExpiryScanPort = {
  getThresholdDays: () => Promise<number>;
  getNotificationRules?: () => Promise<NotificationRules>;
  listBatches: () => Promise<InventoryExpiryBatchRecord[]>;
  getProductName: (productId: number) => Promise<string | undefined>;
  hasExistingNotification: (batch: InventoryExpiryBatchRecord) => Promise<boolean>;
  createNotification: (notification: { type: "inventory_expiry"; title: string; content: string; entityType: "product"; entityId: number }) => Promise<void>;
};

/** تنفيذ واحد لمسح الصلاحية؛ يُستدعى من قاعدة البيانات ويُختبر عبر منفذ معزول بلا بيانات تشغيلية. */
export async function runInventoryExpiryAlertScan(port: InventoryExpiryScanPort) {
  const thresholdDays = await port.getThresholdDays();
  if (!Number.isInteger(thresholdDays) || thresholdDays < 1) throw new Error("Configure inventory expiry alert days before scanning");
  if (port.getNotificationRules && !isNotificationRuleEnabled(await port.getNotificationRules(), "inventoryExpiry")) return { scanned: 0, created: 0, thresholdDays };
  const batches = await port.listBatches();
  let scanned = 0;
  let created = 0;
  for (const batch of batches) {
    const expiryDate = batch.expiryDate;
    if (!expiryDate) continue;
    const initialDecision = evaluateInventoryExpiryBatch({ quantity: batch.quantity, expiryDate, thresholdDays, hasExistingNotification: false });
    if (!initialDecision.scanned) continue;
    scanned += 1;
    const hasExistingNotification = await port.hasExistingNotification(batch);
    const decision = evaluateInventoryExpiryBatch({ quantity: batch.quantity, expiryDate, thresholdDays, hasExistingNotification });
    if (!decision.shouldCreateNotification) continue;
    const productName = await port.getProductName(batch.productId);
    await port.createNotification({
      type: "inventory_expiry",
      title: `Expiry alert: ${productName || `Product ${batch.productId}`}`,
      content: `Batch ${batch.batchNumber} at warehouse ${batch.warehouseId} expires on ${expiryDate.toISOString().slice(0, 10)}.`,
      entityType: "product",
      entityId: batch.productId,
    });
    created += 1;
  }
  return { scanned, created, thresholdDays };
}

export async function getInventoryExpiryAlertDays() {
  const db = await getDb(); if (!db) return null;
  const rows = await db.select().from(systemSettings).where(eq(systemSettings.settingKey, INVENTORY_EXPIRY_ALERT_DAYS_KEY)).limit(1);
  return rows[0]?.value ?? null;
}

export async function saveInventoryExpiryAlertDays(value: number) {
  if (!Number.isInteger(value) || value < 1 || value > 3650) throw new Error("Inventory expiry alert days must be between 1 and 3650");
  const db = await getDb(); if (!db) throw new Error("Database not available");
  await db.insert(systemSettings).values({ settingKey: INVENTORY_EXPIRY_ALERT_DAYS_KEY, group: "inventory", value: String(value) })
    .onDuplicateKeyUpdate({ set: { value: String(value), group: "inventory", updatedAt: new Date() } });
  return String(value);
}

export async function scanInventoryExpiryAlerts(testPort?: InventoryExpiryScanPort) {
  if (testPort) return runInventoryExpiryAlertScan(testPort);
  const db = await getDb(); if (!db) throw new Error("Database not available");
  return db.transaction(async (tx) => {
    const settings = await tx.select().from(systemSettings).where(eq(systemSettings.settingKey, INVENTORY_EXPIRY_ALERT_DAYS_KEY)).limit(1);
    const ruleRows = await tx.select().from(systemSettings).where(eq(systemSettings.settingKey, NOTIFICATION_RULES_KEY)).limit(1);
    const batches = await tx.select().from(inventoryBatches);
    const productRows = await tx.select({ id: products.id, name: products.name }).from(products);
    const productNames = new Map(productRows.map((row) => [row.id, row.name]));
    return runInventoryExpiryAlertScan({
      getThresholdDays: async () => Number(settings[0]?.value || 0),
      getNotificationRules: async () => { try { return normalizeNotificationRules(ruleRows[0]?.value ? JSON.parse(ruleRows[0].value) : undefined); } catch { return { ...DEFAULT_NOTIFICATION_RULES }; } },
      listBatches: async () => batches,
      getProductName: async (productId) => productNames.get(productId),
      hasExistingNotification: async (batch) => Boolean((await tx.select({ id: notifications.id }).from(notifications).where(and(eq(notifications.type, "inventory_expiry"), eq(notifications.entityType, "product"), eq(notifications.entityId, batch.productId), like(notifications.content, `%${batch.batchNumber}%`))).limit(1))[0]),
      createNotification: async (notification) => { await tx.insert(notifications).values(notification); },
    });
  });
}

// ============ COST CENTERS ============
export async function listCostCenters() {
  const db = await getDb(); if (!db) return [];
  return db.select().from(costCenters).orderBy(asc(costCenters.code));
}
export async function createCostCenter(data: { name: string; code: string; branchId?: number; type?: "profit" | "cost" }) {
  const db = await getDb(); if (!db) throw new Error("Database not available");
  const result = await db.insert(costCenters).values(data);
  return { id: Number(result[0].insertId) };
}
export async function updateCostCenter(id: number, data: Partial<{ name: string; code: string; branchId: number; type: "profit" | "cost"; isActive: boolean }>) {
  const db = await getDb(); if (!db) throw new Error("Database not available");
  await db.update(costCenters).set(data).where(eq(costCenters.id, id));
}

// ============ JOURNAL ENTRIES ============
function toCents(value: string | number | null | undefined, field: string) {
  const normalized = String(value ?? "0").trim();
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) throw new Error(`Invalid ${field} amount`);
  return Math.round(Number(normalized) * 100);
}

function validateJournalLines(lines: Array<{ debit: string; credit: string }>) {
  if (lines.length < 2) throw new Error("A journal entry requires at least two lines");
  let debitTotal = 0;
  let creditTotal = 0;
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const debit = toCents(line.debit, `debit at line ${index + 1}`);
    const credit = toCents(line.credit, `credit at line ${index + 1}`);
    if ((debit === 0 && credit === 0) || (debit > 0 && credit > 0)) throw new Error(`Invalid debit/credit direction at line ${index + 1}`);
    debitTotal += debit;
    creditTotal += credit;
  }
  if (debitTotal !== creditTotal) throw new Error("Journal entry is not balanced");
  return { debitTotal, creditTotal };
}

async function reserveDocumentSequence(tx: any, sequenceKey: string) {
  await tx.insert(documentSequences).values({ sequenceKey, currentValue: 0 })
    .onDuplicateKeyUpdate({ set: { sequenceKey } });
  await tx.update(documentSequences).set({ currentValue: sql`${documentSequences.currentValue} + 1` })
    .where(eq(documentSequences.sequenceKey, sequenceKey));
  const rows = await tx.select({ currentValue: documentSequences.currentValue }).from(documentSequences)
    .where(eq(documentSequences.sequenceKey, sequenceKey)).limit(1);
  const value = Number(rows[0]?.currentValue || 0);
  if (!Number.isInteger(value) || value < 1) throw new Error("Unable to reserve a document number");
  return value;
}

async function assertFiscalPeriodOpen(tx: any, date: Date) {
  const [periods] = await tx.execute(sql`SELECT id, isClosed FROM fiscal_periods WHERE startDate <= ${date} AND endDate >= ${date} FOR UPDATE`) as unknown as [Array<{ id: number; isClosed: number | boolean }>];
  if (periods.some((period) => Boolean(period.isClosed))) throw new Error("Fiscal period is closed for this transaction date");
}

export async function listJournalEntries(limit = 50, offset = 0) {
  const db = await getDb(); if (!db) return [];
  return db.select().from(journalEntries).orderBy(desc(journalEntries.createdAt)).limit(limit).offset(offset);
}
export async function getJournalEntryWithLines(id: number) {
  const db = await getDb(); if (!db) return null;
  const entry = await db.select().from(journalEntries).where(eq(journalEntries.id, id)).limit(1);
  if (!entry[0]) return null;
  const lines = await db.select().from(journalEntryLines).where(eq(journalEntryLines.journalEntryId, id));
  return { ...entry[0], lines };
}
export async function createJournalEntry(data: {
  entryNumber?: string; date: Date; description?: string; reference?: string;
  sourceEntryNumber?: string;
  referenceType?: string; referenceId?: number; createdBy?: number;
  lines: Array<{ accountId: number; costCenterId?: number; branchId?: number; debit: string; credit: string; description?: string }>;
}) {
  const db = await getDb(); if (!db) throw new Error("Database not available");
  const totals = validateJournalLines(data.lines);
  return db.transaction(async (tx) => {
    await assertFiscalPeriodOpen(tx, data.date);
    const sequence = await reserveDocumentSequence(tx, "journal_entry");
    const accountIds = Array.from(new Set(data.lines.map((line) => line.accountId)));
    const existingAccounts = await tx.select({ id: accounts.id, isActive: accounts.isActive }).from(accounts).where(inArray(accounts.id, accountIds));
    if (existingAccounts.length !== accountIds.length || existingAccounts.some((account) => !account.isActive)) throw new Error("Journal entry contains an invalid or inactive account");
    const result = await tx.insert(journalEntries).values({
      entryNumber: `JE-${String(sequence).padStart(8, "0")}`, date: data.date, description: data.description,
      reference: data.reference, sourceEntryNumber: data.sourceEntryNumber, referenceType: data.referenceType, referenceId: data.referenceId,
      totalDebit: (totals.debitTotal / 100).toFixed(2), totalCredit: (totals.creditTotal / 100).toFixed(2), createdBy: data.createdBy, status: "draft",
    });
    const entryId = Number(result[0].insertId);
    await tx.insert(journalEntryLines).values(data.lines.map((line) => ({
      journalEntryId: entryId, accountId: line.accountId, costCenterId: line.costCenterId,
      branchId: line.branchId, debit: (toCents(line.debit, "debit") / 100).toFixed(2), credit: (toCents(line.credit, "credit") / 100).toFixed(2), description: line.description,
    })));
    return { id: entryId };
  });
}
export async function postJournalEntry(id: number, userId: number) {
  const db = await getDb(); if (!db) throw new Error("Database not available");
  return db.transaction(async (tx) => {
    const entries = await tx.select().from(journalEntries).where(eq(journalEntries.id, id)).limit(1);
    const entry = entries[0];
    if (!entry) throw new Error("Entry not found");
    if (entry.status !== "draft") throw new Error("Only draft entries can be posted");
    await assertFiscalPeriodOpen(tx, entry.date);
    const lines = await tx.select().from(journalEntryLines).where(eq(journalEntryLines.journalEntryId, id));
    const totals = validateJournalLines(lines.map((line) => ({ debit: String(line.debit), credit: String(line.credit) })));
    if (toCents(entry.totalDebit, "entry debit") !== totals.debitTotal || toCents(entry.totalCredit, "entry credit") !== totals.creditTotal) throw new Error("Journal totals do not match their lines");
    const statusUpdate = await tx.update(journalEntries).set({ status: "posted", postedBy: userId, postedAt: new Date() })
      .where(and(eq(journalEntries.id, id), eq(journalEntries.status, "draft")));
    if (Number(statusUpdate[0].affectedRows || 0) !== 1) throw new Error("Journal entry was posted by another process");
    const accountIds = Array.from(new Set(lines.map((line) => line.accountId)));
    const accountRows = await tx.select({ id: accounts.id, type: accounts.type, isActive: accounts.isActive }).from(accounts).where(inArray(accounts.id, accountIds));
    if (accountRows.length !== accountIds.length || accountRows.some((account) => !account.isActive)) throw new Error("Journal entry contains an invalid or inactive account");
    const accountTypes = new Map(accountRows.map((account) => [account.id, account.type]));
    for (const line of lines) {
      const debit = toCents(line.debit, "line debit");
      const credit = toCents(line.credit, "line credit");
      const accountType = accountTypes.get(line.accountId)!;
      const amount = accountType === "asset" || accountType === "expense" ? debit - credit : credit - debit;
      await tx.update(accounts).set({ balance: sql`${accounts.balance} + ${(amount / 100).toFixed(2)}` }).where(eq(accounts.id, line.accountId));
    }
    return { id, status: "posted" as const };
  });
}

async function createPostedOperationalJournalEntry(tx: any, data: {
  entryNumber?: string; date: Date; description: string; referenceType: string; referenceId: number; postedBy: number;
  lines: Array<{ accountId: number; costCenterId?: number; branchId?: number; debit: string; credit: string; description?: string }>;
}) {
  const totals = validateJournalLines(data.lines);
  await assertFiscalPeriodOpen(tx, data.date);
  const duplicate = await tx.select({ id: journalEntries.id }).from(journalEntries)
    .where(and(eq(journalEntries.referenceType, data.referenceType), eq(journalEntries.referenceId, data.referenceId))).limit(1);
  if (duplicate[0]) throw new Error("Operational journal entry already exists for this reference");
  const accountIds = Array.from(new Set(data.lines.map((line) => line.accountId)));
  const accountRows = await tx.select({ id: accounts.id, type: accounts.type, isActive: accounts.isActive }).from(accounts).where(inArray(accounts.id, accountIds));
  if (accountRows.length !== accountIds.length || accountRows.some((account: { isActive: boolean }) => !account.isActive)) throw new Error("Operational journal entry contains an invalid or inactive account");
  const sequence = await reserveDocumentSequence(tx, "journal_entry");
  const result = await tx.insert(journalEntries).values({
    entryNumber: `JE-${String(sequence).padStart(8, "0")}`, date: data.date, description: data.description, referenceType: data.referenceType, referenceId: data.referenceId,
    totalDebit: (totals.debitTotal / 100).toFixed(2), totalCredit: (totals.creditTotal / 100).toFixed(2),
    createdBy: data.postedBy, postedBy: data.postedBy, postedAt: new Date(), status: "posted",
  });
  const entryId = Number(result[0].insertId);
  await tx.insert(journalEntryLines).values(data.lines.map((line) => ({
    journalEntryId: entryId, accountId: line.accountId, costCenterId: line.costCenterId, branchId: line.branchId,
    debit: (toCents(line.debit, "debit") / 100).toFixed(2), credit: (toCents(line.credit, "credit") / 100).toFixed(2), description: line.description,
  })));
  const accountTypes = new Map(accountRows.map((account: { id: number; type: string }) => [account.id, account.type]));
  for (const line of data.lines) {
    const debit = toCents(line.debit, "line debit");
    const credit = toCents(line.credit, "line credit");
    const accountType = accountTypes.get(line.accountId)!;
    const balanceChange = accountType === "asset" || accountType === "expense" ? debit - credit : credit - debit;
    await tx.update(accounts).set({ balance: sql`${accounts.balance} + ${(balanceChange / 100).toFixed(2)}` }).where(eq(accounts.id, line.accountId));
  }
  return { id: entryId };
}
export async function getNextEntryNumber() {
  const db = await getDb(); if (!db) return "JE-PENDING";
  const result = await db.select({ currentValue: documentSequences.currentValue }).from(documentSequences).where(eq(documentSequences.sequenceKey, "journal_entry")).limit(1);
  return `JE-${String(Number(result[0]?.currentValue || 0) + 1).padStart(8, "0")}`;
}

export type JournalTemplateDraft = {
  description: string;
  reference: string;
  lines: Array<{ accountId: number; costCenterId?: number; branchId?: number; debit: string; credit: string; description?: string }>;
};

function normalizeJournalTemplateDraft(data: JournalTemplateDraft): JournalTemplateDraft {
  return {
    description: data.description || "",
    reference: data.reference || "",
    lines: data.lines.map((line) => ({
      accountId: line.accountId,
      ...(line.costCenterId == null ? {} : { costCenterId: line.costCenterId }),
      ...(line.branchId == null ? {} : { branchId: line.branchId }),
      debit: String(line.debit ?? "0"), credit: String(line.credit ?? "0"),
      ...(line.description == null ? {} : { description: line.description }),
    })),
  };
}

export async function listJournalEntryTemplates(createdBy: number) {
  const db = await getDb(); if (!db) return [];
  return db.select().from(journalEntryTemplates)
    .where(and(eq(journalEntryTemplates.createdBy, createdBy), eq(journalEntryTemplates.isActive, true)))
    .orderBy(desc(journalEntryTemplates.updatedAt));
}

export async function createJournalEntryTemplate(data: { name: string; sourceEntryNumber?: string; templateData: JournalTemplateDraft; createdBy: number }) {
  const db = await getDb(); if (!db) throw new Error("Database not available");
  const normalized = normalizeJournalTemplateDraft(data.templateData);
  if (normalized.lines.length < 2) throw new Error("Journal template requires at least two lines");
  validateJournalLines(normalized.lines);
  const result = await db.insert(journalEntryTemplates).values({
    name: data.name.trim(), sourceEntryNumber: data.sourceEntryNumber, templateData: normalized, createdBy: data.createdBy, isActive: true,
  });
  return { id: Number(result[0].insertId) };
}

export async function deactivateJournalEntryTemplate(id: number, createdBy: number) {
  const db = await getDb(); if (!db) throw new Error("Database not available");
  const result = await db.update(journalEntryTemplates).set({ isActive: false }).where(and(eq(journalEntryTemplates.id, id), eq(journalEntryTemplates.createdBy, createdBy), eq(journalEntryTemplates.isActive, true)));
  if (!result[0].affectedRows) throw new Error("Journal template not found");
}

// ============ TREASURY VOUCHERS (سندات القبض والصرف) ============
export type TreasuryVoucherLineInput = { accountId: number; costCenterId?: number; description?: string; amount: string };
export type TreasuryVoucherInput = {
  voucherType: "receipt" | "payment"; date: Date; branchId: number; description?: string; settlementAccountId: number;
  paymentMethod?: "cash" | "check" | "transfer" | "card"; referenceNumber?: string; lines: TreasuryVoucherLineInput[]; createdBy: number;
};

function normalizeTreasuryVoucherLines(lines: TreasuryVoucherLineInput[]) {
  if (!lines.length) throw new Error("Treasury voucher requires at least one allocation line");
  return lines.map((line, index) => {
    if (!Number.isInteger(line.accountId) || line.accountId <= 0) throw new Error(`Treasury voucher account at line ${index + 1} is invalid`);
    const cents = toCents(line.amount, `treasury voucher amount at line ${index + 1}`);
    if (cents <= 0) throw new Error("Treasury voucher amounts must be positive");
    return { ...line, cents, amount: (cents / 100).toFixed(2) };
  });
}

export function buildTreasuryVoucherJournalLines(input: {
  voucherType: "receipt" | "payment"; voucherNumber: string; branchId: number; settlementAccountId: number; description?: string | null;
  lines: TreasuryVoucherLineInput[];
}) {
  const lines = normalizeTreasuryVoucherLines(input.lines);
  const totalCents = lines.reduce((total, line) => total + line.cents, 0);
  const amount = (totalCents / 100).toFixed(2);
  const allocationDescription = (line: typeof lines[number]) => line.description || input.description || `${input.voucherType === "receipt" ? "Receipt" : "Payment"} ${input.voucherNumber}`;
  return input.voucherType === "receipt"
    ? [{ accountId: input.settlementAccountId, branchId: input.branchId, debit: amount, credit: "0", description: `Receipt ${input.voucherNumber}` }, ...lines.map((line) => ({ accountId: line.accountId, costCenterId: line.costCenterId, branchId: input.branchId, debit: "0", credit: line.amount, description: allocationDescription(line) }))]
    : [...lines.map((line) => ({ accountId: line.accountId, costCenterId: line.costCenterId, branchId: input.branchId, debit: line.amount, credit: "0", description: allocationDescription(line) })), { accountId: input.settlementAccountId, branchId: input.branchId, debit: "0", credit: amount, description: `Payment ${input.voucherNumber}` }];
}

export async function listTreasuryVouchers(branchId: number, limit = 100) {
  const db = await getDb(); if (!db) return [];
  return db.select().from(vouchers).where(eq(vouchers.branchId, branchId)).orderBy(desc(vouchers.createdAt)).limit(limit);
}

export async function getTreasuryVoucherWithLines(id: number) {
  const db = await getDb(); if (!db) return null;
  const rows = await db.select().from(vouchers).where(eq(vouchers.id, id)).limit(1);
  if (!rows[0]) return null;
  const lines = await db.select().from(voucherLines).where(eq(voucherLines.voucherId, id));
  return { ...rows[0], lines };
}

export async function getNextTreasuryVoucherNumber(voucherType: "receipt" | "payment") {
  const db = await getDb(); if (!db) return voucherType === "receipt" ? "RV-PENDING" : "PV-PENDING";
  const sequenceKey = voucherType === "receipt" ? "treasury_receipt" : "treasury_payment";
  const rows = await db.select({ currentValue: documentSequences.currentValue }).from(documentSequences).where(eq(documentSequences.sequenceKey, sequenceKey)).limit(1);
  const prefix = voucherType === "receipt" ? "RV" : "PV";
  return `${prefix}-${String(Number(rows[0]?.currentValue || 0) + 1).padStart(8, "0")}`;
}

export async function createTreasuryVoucher(data: TreasuryVoucherInput) {
  const db = await getDb(); if (!db) throw new Error("Database not available");
  const lines = normalizeTreasuryVoucherLines(data.lines);
  const totalCents = lines.reduce((total, line) => total + line.cents, 0);
  if (!Number.isInteger(data.settlementAccountId) || data.settlementAccountId <= 0) throw new Error("Treasury settlement account is required");
  if (lines.some((line) => line.accountId === data.settlementAccountId)) throw new Error("Treasury settlement account cannot be a voucher allocation account");
  return db.transaction(async (tx) => {
    await assertFiscalPeriodOpen(tx, data.date);
    const accountIds = Array.from(new Set([data.settlementAccountId, ...lines.map((line) => line.accountId)]));
    const accountRows = await tx.select({ id: accounts.id, isActive: accounts.isActive }).from(accounts).where(inArray(accounts.id, accountIds));
    if (accountRows.length !== accountIds.length || accountRows.some((account) => !account.isActive)) throw new Error("Treasury voucher contains an invalid or inactive account");
    const sequence = await reserveDocumentSequence(tx, data.voucherType === "receipt" ? "treasury_receipt" : "treasury_payment");
    const voucherNumber = `${data.voucherType === "receipt" ? "RV" : "PV"}-${String(sequence).padStart(8, "0")}`;
    const result = await tx.insert(vouchers).values({
      voucherNumber, voucherType: data.voucherType, date: data.date, branchId: data.branchId, description: data.description?.trim() || null,
      amount: (totalCents / 100).toFixed(2), settlementAccountId: data.settlementAccountId, paymentMethod: data.paymentMethod || "cash",
      referenceNumber: data.referenceNumber?.trim() || null, status: "draft", createdBy: data.createdBy,
    });
    const voucherId = Number(result[0].insertId);
    await tx.insert(voucherLines).values(lines.map((line) => ({ voucherId, accountId: line.accountId, costCenterId: line.costCenterId || null, description: line.description?.trim() || null, amount: line.amount })));
    return { id: voucherId, voucherNumber, amount: (totalCents / 100).toFixed(2) };
  });
}

export async function approveTreasuryVoucher(id: number, approvedBy: number) {
  const db = await getDb(); if (!db) throw new Error("Database not available");
  return db.transaction(async (tx) => {
    const rows = await tx.select().from(vouchers).where(eq(vouchers.id, id)).limit(1);
    const voucher = rows[0];
    if (!voucher || voucher.status !== "draft") throw new Error("Treasury voucher cannot be approved in its current status");
    await assertFiscalPeriodOpen(tx, voucher.date);
    const update = await tx.update(vouchers).set({ status: "approved", approvedBy, approvedAt: new Date() }).where(and(eq(vouchers.id, id), eq(vouchers.status, "draft")));
    if (Number(update[0].affectedRows || 0) !== 1) throw new Error("Treasury voucher was approved by another process");
    return { id, voucherNumber: voucher.voucherNumber, status: "approved" as const };
  });
}

export async function postTreasuryVoucher(id: number, postedBy: number) {
  const db = await getDb(); if (!db) throw new Error("Database not available");
  return db.transaction(async (tx) => {
    const rows = await tx.select().from(vouchers).where(eq(vouchers.id, id)).limit(1);
    const voucher = rows[0];
    if (!voucher || voucher.status !== "approved") throw new Error("Treasury voucher must be approved before posting");
    if (!voucher.settlementAccountId) throw new Error("Treasury voucher settlement account is missing");
    await assertFiscalPeriodOpen(tx, voucher.date);
    const lines = await tx.select().from(voucherLines).where(eq(voucherLines.voucherId, id));
    const normalized = normalizeTreasuryVoucherLines(lines.map((line) => ({ accountId: line.accountId, costCenterId: line.costCenterId || undefined, description: line.description || undefined, amount: String(line.amount) })));
    const totalCents = normalized.reduce((total, line) => total + line.cents, 0);
    if (toCents(String(voucher.amount), "treasury voucher header amount") !== totalCents) throw new Error("Treasury voucher header amount does not match allocation lines");
    const journalLines = buildTreasuryVoucherJournalLines({ voucherType: voucher.voucherType, voucherNumber: voucher.voucherNumber, branchId: voucher.branchId, settlementAccountId: voucher.settlementAccountId, description: voucher.description, lines: normalized });
    const journal = await createPostedOperationalJournalEntry(tx, { date: voucher.date, referenceType: "treasury_voucher", referenceId: voucher.id, description: voucher.description || `${voucher.voucherType === "receipt" ? "Receipt" : "Payment"} voucher ${voucher.voucherNumber}`, postedBy, lines: journalLines });
    const update = await tx.update(vouchers).set({ status: "posted", journalEntryId: journal.id, postedBy, postedAt: new Date() }).where(and(eq(vouchers.id, id), eq(vouchers.status, "approved")));
    if (Number(update[0].affectedRows || 0) !== 1) throw new Error("Treasury voucher was posted by another process");
    return { id, voucherNumber: voucher.voucherNumber, journalEntryId: journal.id, status: "posted" as const };
  });
}

export async function cancelTreasuryVoucher(id: number) {
  const db = await getDb(); if (!db) throw new Error("Database not available");
  const update = await db.update(vouchers).set({ status: "cancelled" }).where(and(eq(vouchers.id, id), eq(vouchers.status, "draft")));
  if (Number(update[0].affectedRows || 0) !== 1) throw new Error("Only draft treasury vouchers can be cancelled");
}

// ============ FISCAL PERIODS ============
export async function listFiscalPeriods() {
  const db = await getDb(); if (!db) return [];
  return db.select().from(fiscalPeriods).orderBy(desc(fiscalPeriods.startDate));
}
export async function createFiscalPeriod(data: { name: string; startDate: Date; endDate: Date }) {
  const db = await getDb(); if (!db) throw new Error("Database not available");
  if (data.startDate > data.endDate) throw new Error("Fiscal period start date must not be after its end date");
  const overlaps = await db.select({ id: fiscalPeriods.id }).from(fiscalPeriods).where(and(lte(fiscalPeriods.startDate, data.endDate), gte(fiscalPeriods.endDate, data.startDate))).limit(1);
  if (overlaps[0]) throw new Error("Fiscal period overlaps an existing period");
  const result = await db.insert(fiscalPeriods).values(data);
  return { id: Number(result[0].insertId) };
}
export function buildFiscalYearClosingLines(rows: Array<{ id: number; type: "revenue" | "expense"; debit: string | number; credit: string | number }>, retainedEarningsAccountId: number) {
  const lines: Array<{ accountId: number; debit: string; credit: string; description: string }> = [];
  let netIncomeCents = 0;
  for (const row of rows) {
    const debitCents = toCents(row.debit, "period debit"); const creditCents = toCents(row.credit, "period credit");
    const normalBalanceCents = row.type === "revenue" ? creditCents - debitCents : debitCents - creditCents;
    if (normalBalanceCents === 0) continue;
    if (row.type === "revenue") {
      lines.push({ accountId: row.id, debit: (normalBalanceCents / 100).toFixed(2), credit: "0", description: "Close revenue account" });
      netIncomeCents += normalBalanceCents;
    } else {
      lines.push({ accountId: row.id, debit: "0", credit: (normalBalanceCents / 100).toFixed(2), description: "Close expense account" });
      netIncomeCents -= normalBalanceCents;
    }
  }
  if (netIncomeCents > 0) lines.push({ accountId: retainedEarningsAccountId, debit: "0", credit: (netIncomeCents / 100).toFixed(2), description: "Transfer net income to retained earnings" });
  if (netIncomeCents < 0) lines.push({ accountId: retainedEarningsAccountId, debit: (Math.abs(netIncomeCents) / 100).toFixed(2), credit: "0", description: "Transfer net loss to retained earnings" });
  return { lines, netIncome: (netIncomeCents / 100).toFixed(2) };
}

export async function closeFiscalPeriod(id: number, userId: number, retainedEarningsAccountId?: number) {
  const db = await getDb(); if (!db) throw new Error("Database not available");
  await db.transaction(async (tx) => {
    const [periods] = await tx.execute(sql`SELECT id, startDate, endDate, isClosed FROM fiscal_periods WHERE id = ${id} FOR UPDATE`) as unknown as [Array<{ id: number; startDate: Date; endDate: Date; isClosed: number | boolean }>];
    const period = periods[0];
    if (!period || Boolean(period.isClosed)) throw new Error("Fiscal period was not found or is already closed");
    const periodStart = new Date(period.startDate); const periodEnd = new Date(period.endDate);
    if (Number.isNaN(periodStart.getTime()) || Number.isNaN(periodEnd.getTime())) throw new Error("Fiscal period dates are invalid");
    const [draftRows] = await tx.execute(sql`SELECT COUNT(*) AS count FROM journal_entries WHERE status = 'draft' AND date >= ${periodStart} AND date <= ${periodEnd}`) as unknown as [Array<{ count: number }>];
    if (Number(draftRows[0]?.count || 0) > 0) throw new Error("Fiscal period cannot be closed while draft journal entries remain");
    const [pendingVoucherRows] = await tx.execute(sql`SELECT COUNT(*) AS count FROM vouchers WHERE status IN ('draft', 'approved') AND date >= ${periodStart} AND date <= ${periodEnd}`) as unknown as [Array<{ count: number }>];
    if (Number(pendingVoucherRows[0]?.count || 0) > 0) throw new Error("Fiscal period cannot be closed while pending treasury vouchers remain");
    const [pendingAllocationRows] = await tx.execute(sql`SELECT COUNT(*) AS count FROM cost_allocations WHERE status IN ('draft', 'approved') AND periodEnd >= ${periodStart} AND periodEnd <= ${periodEnd}`) as unknown as [Array<{ count: number }>];
    if (Number(pendingAllocationRows[0]?.count || 0) > 0) throw new Error("Fiscal period cannot be closed while pending cost allocations remain");
    const [incomeRows] = await tx.execute(sql`
      SELECT a.id, a.type, COALESCE(SUM(jl.debit), 0) AS debit, COALESCE(SUM(jl.credit), 0) AS credit
      FROM accounts a INNER JOIN journal_entry_lines jl ON jl.accountId = a.id INNER JOIN journal_entries j ON j.id = jl.journalEntryId
      WHERE j.status = 'posted' AND j.date >= ${periodStart} AND j.date <= ${periodEnd} AND a.type IN ('revenue', 'expense')
      GROUP BY a.id, a.type
    `) as unknown as [Array<{ id: number; type: "revenue" | "expense"; debit: string; credit: string }>];
    const hasIncomeBalances = incomeRows.some((row) => toCents(row.debit, "period debit") !== toCents(row.credit, "period credit"));
    if (hasIncomeBalances) {
      if (!retainedEarningsAccountId) throw new Error("Retained earnings account is required to close a fiscal year with income statement balances");
      const retainedRows = await tx.select({ id: accounts.id, type: accounts.type, isActive: accounts.isActive }).from(accounts).where(eq(accounts.id, retainedEarningsAccountId)).limit(1);
      if (!retainedRows[0] || retainedRows[0].type !== "equity" || !retainedRows[0].isActive) throw new Error("Retained earnings account must be an active equity account");
      const closing = buildFiscalYearClosingLines(incomeRows, retainedEarningsAccountId);
      if (closing.lines.length >= 2) {
        await createPostedOperationalJournalEntry(tx, { date: periodEnd, referenceType: "fiscal_year_close", referenceId: period.id, description: `Fiscal year close ${period.id}`, postedBy: userId, lines: closing.lines });
      }
    }
    const result = await tx.update(fiscalPeriods).set({ isClosed: true, closedBy: userId, closedAt: new Date() }).where(and(eq(fiscalPeriods.id, id), eq(fiscalPeriods.isClosed, false)));
    if (Number(result[0].affectedRows || 0) !== 1) throw new Error("Fiscal period was changed by another process");
  });
}
export async function reopenFiscalPeriod(id: number, userId: number, reason: string) {
  const db = await getDb(); if (!db) throw new Error("Database not available");
  if (reason.trim().length < 3) throw new Error("A reopen reason is required");
  await db.transaction(async (tx) => {
    const result = await tx.update(fiscalPeriods).set({ isClosed: false, closedBy: null, closedAt: null }).where(and(eq(fiscalPeriods.id, id), eq(fiscalPeriods.isClosed, true)));
    if (Number(result[0].affectedRows || 0) !== 1) throw new Error("Fiscal period was not found or is not closed");
    await tx.insert(fiscalPeriodReopenLogs).values({ fiscalPeriodId: id, reopenedBy: userId, reason: reason.trim() });
  });
}

// ============ TRIAL BALANCE ============
export async function getTrialBalance() {
  const db = await getDb(); if (!db) return [];
  return db.select({ id: accounts.id, code: accounts.code, name: accounts.name, nameEn: accounts.nameEn, type: accounts.type, level: accounts.level, parentId: accounts.parentId, balance: accounts.balance }).from(accounts).where(eq(accounts.isActive, true)).orderBy(asc(accounts.code));
}

export type FinancialStatementLedgerRow = {
  id: number; code: string; name: string; nameEn: string | null; type: "asset" | "liability" | "equity" | "revenue" | "expense";
  periodDebit: number | string; periodCredit: number | string; closingDebit: number | string; closingCredit: number | string;
};

export function buildFinancialStatements(rows: FinancialStatementLedgerRow[]) {
  const lines = rows.map((row) => {
    const periodDebit = Number(row.periodDebit || 0); const periodCredit = Number(row.periodCredit || 0);
    const closingDebit = Number(row.closingDebit || 0); const closingCredit = Number(row.closingCredit || 0);
    const debitNormal = row.type === "asset" || row.type === "expense";
    return { ...row, periodDebit, periodCredit, closingDebit, closingCredit, periodBalance: debitNormal ? periodDebit - periodCredit : periodCredit - periodDebit, closingBalance: debitNormal ? closingDebit - closingCredit : closingCredit - closingDebit };
  });
  const byType = (type: FinancialStatementLedgerRow["type"]) => lines.filter((line) => line.type === type && Math.abs(line.closingBalance) > 0.000001);
  const periodByType = (type: FinancialStatementLedgerRow["type"]) => lines.filter((line) => line.type === type && Math.abs(line.periodBalance) > 0.000001);
  const sum = (items: Array<{ closingBalance: number }>) => items.reduce((total, item) => total + item.closingBalance, 0);
  const sumPeriod = (items: Array<{ periodBalance: number }>) => items.reduce((total, item) => total + item.periodBalance, 0);
  const assets = byType("asset"); const liabilities = byType("liability"); const equity = byType("equity");
  const revenue = periodByType("revenue"); const expenses = periodByType("expense");
  const allRevenue = byType("revenue"); const allExpenses = byType("expense");
  const trialDebit = lines.reduce((total, line) => total + line.periodDebit, 0); const trialCredit = lines.reduce((total, line) => total + line.periodCredit, 0);
  const totalAssets = sum(assets); const totalLiabilities = sum(liabilities); const totalEquity = sum(equity);
  const netIncome = sumPeriod(revenue) - sumPeriod(expenses); const endingNetIncome = sum(allRevenue) - sum(allExpenses);
  return {
    trialBalance: { lines, totalDebit: trialDebit, totalCredit: trialCredit, difference: trialDebit - trialCredit, isBalanced: Math.abs(trialDebit - trialCredit) < 0.000001 },
    incomeStatement: { revenue, expenses, totalRevenue: sumPeriod(revenue), totalExpenses: sumPeriod(expenses), netIncome },
    balanceSheet: { assets, liabilities, equity, totalAssets, totalLiabilities, totalEquity, endingNetIncome, totalLiabilitiesAndEquity: totalLiabilities + totalEquity + endingNetIncome, difference: totalAssets - totalLiabilities - totalEquity - endingNetIncome, isBalanced: Math.abs(totalAssets - totalLiabilities - totalEquity - endingNetIncome) < 0.000001 },
  };
}

export async function getFinancialStatements(startDate: Date, endDate: Date) {
  if (startDate > endDate) throw new Error("Financial statement start date must be before end date");
  const db = await getDb(); if (!db) return buildFinancialStatements([]);
  const [rows] = await db.execute(sql`
    SELECT a.id, a.code, a.name, a.nameEn, a.type,
      COALESCE(SUM(CASE WHEN j.status = 'posted' AND j.date >= ${startDate} AND j.date <= ${endDate} THEN l.debit ELSE 0 END), 0) AS periodDebit,
      COALESCE(SUM(CASE WHEN j.status = 'posted' AND j.date >= ${startDate} AND j.date <= ${endDate} THEN l.credit ELSE 0 END), 0) AS periodCredit,
      COALESCE(SUM(CASE WHEN j.status = 'posted' AND j.date <= ${endDate} THEN l.debit ELSE 0 END), 0) AS closingDebit,
      COALESCE(SUM(CASE WHEN j.status = 'posted' AND j.date <= ${endDate} THEN l.credit ELSE 0 END), 0) AS closingCredit
    FROM accounts a
    LEFT JOIN journal_entry_lines l ON l.accountId = a.id
    LEFT JOIN journal_entries j ON j.id = l.journalEntryId
    WHERE a.isActive = true
    GROUP BY a.id, a.code, a.name, a.nameEn, a.type
    ORDER BY a.code ASC
  `) as unknown as [FinancialStatementLedgerRow[]];
  return buildFinancialStatements(rows);
}

// ============ COST ALLOCATION ============
export async function listCostAllocations() {
  const db = await getDb(); if (!db) return [];
  return db.select().from(costAllocations).orderBy(desc(costAllocations.createdAt));
}
export async function createCostAllocation(data: {
  name: string; method: "sales_ratio" | "branch_count" | "employee_count" | "custom";
  periodStart: Date; periodEnd: Date; totalAmount: string; sourceAccountId: number; sourceCostCenterId?: number; createdBy?: number;
  lines: Array<{ costCenterId: number; amount: string; ratio?: string }>;
}) {
  const db = await getDb(); if (!db) throw new Error("Database not available");
  if (!data.lines.length || !Number.isInteger(data.sourceAccountId) || data.sourceAccountId <= 0) throw new Error("Cost allocation source account and lines are required");
  if (data.periodStart > data.periodEnd) throw new Error("Cost allocation period start cannot be after end");
  const totalCents = toCents(data.totalAmount, "cost allocation total");
  if (totalCents <= 0) throw new Error("Cost allocation total must be positive");
  const lines = data.lines.map((line, index) => ({ ...line, cents: toCents(line.amount, `cost allocation line ${index + 1}`) }));
  if (lines.some((line) => !Number.isInteger(line.costCenterId) || line.costCenterId <= 0 || line.cents <= 0) || lines.reduce((total, line) => total + line.cents, 0) !== totalCents) throw new Error("Cost allocation lines must be positive and equal the total amount");
  return db.transaction(async (tx) => {
    const accountRows = await tx.select({ id: accounts.id, isActive: accounts.isActive }).from(accounts).where(eq(accounts.id, data.sourceAccountId));
    if (!accountRows[0]?.isActive) throw new Error("Cost allocation source account is invalid or inactive");
    const centerIds = Array.from(new Set([...(data.sourceCostCenterId ? [data.sourceCostCenterId] : []), ...lines.map((line) => line.costCenterId)]));
    const centerRows = await tx.select({ id: costCenters.id, isActive: costCenters.isActive }).from(costCenters).where(inArray(costCenters.id, centerIds));
    if (centerRows.length !== centerIds.length || centerRows.some((center) => !center.isActive)) throw new Error("Cost allocation contains an invalid or inactive cost center");
    const result = await tx.insert(costAllocations).values({ name: data.name.trim(), method: data.method, periodStart: data.periodStart, periodEnd: data.periodEnd, totalAmount: (totalCents / 100).toFixed(2), sourceAccountId: data.sourceAccountId, sourceCostCenterId: data.sourceCostCenterId || null, createdBy: data.createdBy });
    const allocationId = Number(result[0].insertId);
    await tx.insert(costAllocationLines).values(lines.map((line) => ({ allocationId, costCenterId: line.costCenterId, amount: (line.cents / 100).toFixed(2), ratio: line.ratio ?? "0" })));
    return { id: allocationId, status: "draft" as const };
  });
}

export function buildCostAllocationJournalLines(input: { sourceAccountId: number; sourceCostCenterId?: number | null; sourceBranchId?: number | null; lines: Array<{ costCenterId: number; branchId?: number | null; amount: string }> }) {
  const normalized = input.lines.map((line, index) => ({ ...line, cents: toCents(line.amount, `cost allocation journal line ${index + 1}`) }));
  const totalCents = normalized.reduce((total, line) => total + line.cents, 0);
  if (!totalCents || normalized.some((line) => line.cents <= 0)) throw new Error("Cost allocation journal lines must be positive");
  const amount = (totalCents / 100).toFixed(2);
  return [
    ...normalized.map((line) => ({ accountId: input.sourceAccountId, costCenterId: line.costCenterId, branchId: line.branchId || undefined, debit: (line.cents / 100).toFixed(2), credit: "0", description: "Cost allocation" })),
    { accountId: input.sourceAccountId, costCenterId: input.sourceCostCenterId || undefined, branchId: input.sourceBranchId || undefined, debit: "0", credit: amount, description: "Cost allocation source" },
  ];
}

export async function approveCostAllocation(id: number, approvedBy: number) {
  const db = await getDb(); if (!db) throw new Error("Database not available");
  return db.transaction(async (tx) => {
    const rows = await tx.select().from(costAllocations).where(eq(costAllocations.id, id)).limit(1);
    const allocation = rows[0];
    if (!allocation || allocation.status !== "draft") throw new Error("Cost allocation cannot be approved in its current status");
    await assertFiscalPeriodOpen(tx, allocation.periodEnd);
    const update = await tx.update(costAllocations).set({ status: "approved", approvedBy, approvedAt: new Date() }).where(and(eq(costAllocations.id, id), eq(costAllocations.status, "draft")));
    if (Number(update[0].affectedRows || 0) !== 1) throw new Error("Cost allocation was approved by another process");
    return { id, status: "approved" as const };
  });
}

export async function postCostAllocation(id: number, postedBy: number) {
  const db = await getDb(); if (!db) throw new Error("Database not available");
  return db.transaction(async (tx) => {
    const rows = await tx.select().from(costAllocations).where(eq(costAllocations.id, id)).limit(1);
    const allocation = rows[0];
    if (!allocation || allocation.status !== "approved" || !allocation.sourceAccountId) throw new Error("Cost allocation must be approved and have a source account before posting");
    await assertFiscalPeriodOpen(tx, allocation.periodEnd);
    const allocationLines = await tx.select().from(costAllocationLines).where(eq(costAllocationLines.allocationId, id));
    const centerIds = Array.from(new Set([...(allocation.sourceCostCenterId ? [allocation.sourceCostCenterId] : []), ...allocationLines.map((line) => line.costCenterId)]));
    const centers = await tx.select({ id: costCenters.id, branchId: costCenters.branchId, isActive: costCenters.isActive }).from(costCenters).where(inArray(costCenters.id, centerIds));
    if (centers.length !== centerIds.length || centers.some((center) => !center.isActive)) throw new Error("Cost allocation contains an invalid or inactive cost center");
    const centersById = new Map(centers.map((center) => [center.id, center]));
    const journalLines = buildCostAllocationJournalLines({ sourceAccountId: allocation.sourceAccountId, sourceCostCenterId: allocation.sourceCostCenterId, sourceBranchId: allocation.sourceCostCenterId ? centersById.get(allocation.sourceCostCenterId)?.branchId : undefined, lines: allocationLines.map((line) => ({ costCenterId: line.costCenterId, branchId: centersById.get(line.costCenterId)?.branchId, amount: String(line.amount) })) });
    const totalCents = journalLines.filter((line) => line.debit !== "0").reduce((total, line) => total + toCents(line.debit, "cost allocation debit"), 0);
    if (toCents(String(allocation.totalAmount), "cost allocation header total") !== totalCents) throw new Error("Cost allocation header total does not match distribution lines");
    const journal = await createPostedOperationalJournalEntry(tx, { date: allocation.periodEnd, referenceType: "cost_allocation", referenceId: allocation.id, description: `Cost allocation ${allocation.name}`, postedBy, lines: journalLines });
    const update = await tx.update(costAllocations).set({ status: "posted", journalEntryId: journal.id, postedBy, postedAt: new Date() }).where(and(eq(costAllocations.id, id), eq(costAllocations.status, "approved")));
    if (Number(update[0].affectedRows || 0) !== 1) throw new Error("Cost allocation was posted by another process");
    return { id, journalEntryId: journal.id, status: "posted" as const };
  });
}

// ============ CATEGORIES ============
export async function listCategories() {
  const db = await getDb(); if (!db) return [];
  return db.select().from(categories).orderBy(asc(categories.sortOrder));
}
export async function createCategory(data: { name: string; parentId?: number; type?: "product" | "raw_material" | "semi_finished" | "finished" }) {
  const db = await getDb(); if (!db) throw new Error("Database not available");
  const result = await db.insert(categories).values(data);
  return { id: Number(result[0].insertId) };
}

// ============ UNITS ============
export async function listUnits() {
  const db = await getDb(); if (!db) return [];
  return db.select().from(units);
}
export async function createUnit(data: { name: string; symbol: string; baseUnitId?: number; conversionFactor?: string }) {
  const db = await getDb(); if (!db) throw new Error("Database not available");
  const result = await db.insert(units).values(data);
  return { id: Number(result[0].insertId) };
}

// ============ PRODUCTS ============
export async function listProducts() {
  const db = await getDb(); if (!db) return [];
  return db.select().from(products).orderBy(asc(products.name));
}
export function normalizeProductTaxRate(fallbackRate?: string) {
  const taxRate = Number(fallbackRate ?? "0");
  if (!Number.isFinite(taxRate) || taxRate < 0 || taxRate > 100) throw new Error("Product tax rate is invalid");
  return taxRate.toFixed(2);
}

async function resolveProductTaxCode(tx: any, taxCodeId?: number, fallbackRate?: string) {
  if (taxCodeId) {
    const rows = await tx.select({ id: taxCodes.id, rate: taxCodes.rate, isActive: taxCodes.isActive }).from(taxCodes).where(eq(taxCodes.id, taxCodeId)).limit(1);
    const taxCode = rows[0];
    if (!taxCode || !taxCode.isActive) throw new Error("Product tax code is invalid or inactive");
    return { taxCodeId: taxCode.id, taxRate: String(taxCode.rate) };
  }
  return { taxCodeId: undefined, taxRate: normalizeProductTaxRate(fallbackRate) };
}

export async function createProduct(data: {
  name: string; nameEn?: string; sku?: string; barcode?: string;
  type: "raw_material" | "semi_finished" | "finished" | "direct_sale" | "service";
  categoryId?: number; unitId?: number; costPrice?: string; salePrice?: string;
  taxRate?: string; taxCodeId?: number; reorderLevel?: number; trackBatch?: boolean; trackExpiry?: boolean;
}) {
  const db = await getDb(); if (!db) throw new Error("Database not available");
  return db.transaction(async (tx) => {
    const tax = await resolveProductTaxCode(tx, data.taxCodeId, data.taxRate);
    const result = await tx.insert(products).values({ ...data, ...tax });
    return { id: Number(result[0].insertId) };
  });
}
export async function updateProduct(id: number, data: Partial<Record<string, any>>) {
  const db = await getDb(); if (!db) throw new Error("Database not available");
  await db.transaction(async (tx) => {
    const taxCodeIsChanging = Object.prototype.hasOwnProperty.call(data, "taxCodeId");
    const taxRateIsChanging = Object.prototype.hasOwnProperty.call(data, "taxRate");
    const currentRows = await tx.select({ taxCodeId: products.taxCodeId, taxRate: products.taxRate }).from(products).where(eq(products.id, id)).limit(1);
    const current = currentRows[0];
    if (!current) throw new Error("Product not found");
    const effectiveTaxCodeId = taxCodeIsChanging ? data.taxCodeId : current.taxCodeId;
    const fallbackRate = effectiveTaxCodeId ? undefined : (taxRateIsChanging ? data.taxRate : current.taxRate);
    const tax = taxCodeIsChanging || taxRateIsChanging ? await resolveProductTaxCode(tx, effectiveTaxCodeId, fallbackRate) : undefined;
    await tx.update(products).set(tax ? { ...data, ...tax } : data).where(eq(products.id, id));
  });
}

export async function listProductAddons(parentProductId: number) {
  const db = await getDb(); if (!db) return [];
  return db.select({
    id: productAddons.id, parentProductId: productAddons.parentProductId, addonProductId: productAddons.addonProductId,
    pricingMode: productAddons.pricingMode, salePrice: productAddons.salePrice, isActive: productAddons.isActive,
    addonName: products.name, addonNameEn: products.nameEn,
  }).from(productAddons).innerJoin(products, eq(productAddons.addonProductId, products.id)).where(eq(productAddons.parentProductId, parentProductId));
}

export async function createProductAddon(data: { parentProductId: number; addonProductId: number; pricingMode: "included" | "free" | "separate"; salePrice?: string }) {
  const db = await getDb(); if (!db) throw new Error("Database not available");
  if (data.parentProductId === data.addonProductId) throw new Error("A product cannot be its own add-on");
  const price = Number(data.salePrice || "0");
  if (!Number.isFinite(price) || price < 0) throw new Error("Add-on sale price is invalid");
  if (data.pricingMode === "separate" && price <= 0) throw new Error("A separately priced add-on requires a positive sale price");
  return db.transaction(async (tx) => {
    const productRows = await tx.select({ id: products.id, isActive: products.isActive }).from(products).where(inArray(products.id, [data.parentProductId, data.addonProductId]));
    if (productRows.length !== 2 || productRows.some((product) => !product.isActive)) throw new Error("Parent and add-on products must exist and be active");
    const result = await tx.insert(productAddons).values({ ...data, salePrice: data.pricingMode === "separate" ? price.toFixed(2) : "0.00" });
    return { id: Number(result[0].insertId) };
  });
}

export async function deleteProductAddon(id: number) {
  const db = await getDb(); if (!db) throw new Error("Database not available");
  await db.delete(productAddons).where(eq(productAddons.id, id));
}

export async function getProductTaxCodeConsistency() {
  const db = await getDb(); if (!db) return { mismatches: [], invalidTaxCodes: [] };
  const productRows = await db.select({ id: products.id, name: products.name, taxCodeId: products.taxCodeId, taxRate: products.taxRate }).from(products);
  const codeIds = Array.from(new Set(productRows.map((product) => product.taxCodeId).filter((id): id is number => typeof id === "number")));
  const codeRows = codeIds.length ? await db.select({ id: taxCodes.id, code: taxCodes.code, rate: taxCodes.rate, isActive: taxCodes.isActive }).from(taxCodes).where(inArray(taxCodes.id, codeIds)) : [];
  const codeById = new Map(codeRows.map((code) => [code.id, code]));
  const mismatches = productRows.filter((product) => {
    if (!product.taxCodeId) return false;
    const code = codeById.get(product.taxCodeId);
    return code ? code.isActive && Number(product.taxRate) !== Number(code.rate) : false;
  }).map((product) => ({ productId: product.id, productName: product.name, taxCodeId: product.taxCodeId!, productRate: String(product.taxRate), taxCodeRate: String(codeById.get(product.taxCodeId!)!.rate) }));
  const invalidTaxCodes = productRows.filter((product) => product.taxCodeId && (!codeById.get(product.taxCodeId)?.isActive)).map((product) => ({ productId: product.id, productName: product.name, taxCodeId: product.taxCodeId! }));
  return { mismatches, invalidTaxCodes };
}

export async function synchronizeProductTaxCodeRates() {
  const db = await getDb(); if (!db) throw new Error("Database not available");
  return db.transaction(async (tx) => {
    const productRows = await tx.select({ id: products.id, taxCodeId: products.taxCodeId, taxRate: products.taxRate }).from(products);
    const codeIds = Array.from(new Set(productRows.map((product) => product.taxCodeId).filter((id): id is number => typeof id === "number")));
    const codeRows = codeIds.length ? await tx.select({ id: taxCodes.id, rate: taxCodes.rate, isActive: taxCodes.isActive }).from(taxCodes).where(inArray(taxCodes.id, codeIds)) : [];
    const codeById = new Map(codeRows.map((code) => [code.id, code]));
    const invalidCount = productRows.filter((product) => product.taxCodeId && !codeById.get(product.taxCodeId)?.isActive).length;
    if (invalidCount) throw new Error("Cannot synchronize products with invalid or inactive tax codes");
    const mismatches = productRows.filter((product) => product.taxCodeId && Number(product.taxRate) !== Number(codeById.get(product.taxCodeId)?.rate));
    for (const product of mismatches) {
      await tx.update(products).set({ taxRate: String(codeById.get(product.taxCodeId!)!.rate) }).where(eq(products.id, product.id));
    }
    return { synchronized: mismatches.length, invalidTaxCodes: invalidCount };
  });
}

// ============ WAREHOUSES ============
export async function listWarehouses() {
  const db = await getDb(); if (!db) return [];
  return db.select().from(warehouses).orderBy(asc(warehouses.name));
}
export async function createWarehouse(data: { name: string; branchId?: number; parentWarehouseId?: number; type?: "central" | "branch" | "kitchen"; storageCategory?: "general" | "dry" | "chilled" | "frozen" | "ingredients" | "packaging" | "finished_goods" | "other" }) {
  const db = await getDb(); if (!db) throw new Error("Database not available");
  const name = data.name.trim();
  if (!name) throw new Error("Warehouse name is required");
  let branchId = data.branchId;
  if (data.parentWarehouseId) {
    const parents = await db.select().from(warehouses).where(eq(warehouses.id, data.parentWarehouseId)).limit(1);
    const parent = parents[0];
    if (!parent || !parent.isActive) throw new Error("Parent warehouse is invalid or inactive");
    if (branchId && parent.branchId && branchId !== parent.branchId) throw new Error("Sub-warehouse must use the same branch as its parent");
    branchId = branchId || parent.branchId || undefined;
  }
  const result = await db.insert(warehouses).values({ ...data, name, branchId });
  return { id: Number(result[0].insertId) };
}

// ============ STOCK ============
export async function getStockByWarehouse(warehouseId: number) {
  const db = await getDb(); if (!db) return [];
  return db.select().from(stock).where(eq(stock.warehouseId, warehouseId));
}
export async function getStockByProduct(productId: number) {
  const db = await getDb(); if (!db) return [];
  return db.select().from(stock).where(eq(stock.productId, productId));
}
export async function listAvailableInventoryBatches(warehouseId: number, productId: number) {
  const db = await getDb(); if (!db) return [];
  const batches = await db.select().from(inventoryBatches).where(and(eq(inventoryBatches.warehouseId, warehouseId), eq(inventoryBatches.productId, productId))).orderBy(asc(inventoryBatches.expiryDate));
  return batches.filter((batch) => Number(batch.quantity) > 0);
}
export async function getAllStock() {
  const db = await getDb(); if (!db) return [];
  return db.select().from(stock);
}

// ============ STOCK MOVEMENTS ============
export type StockMovementInput = {
  productId: number; warehouseId: number;
  type: "purchase" | "sale" | "transfer_in" | "transfer_out" | "production_in" | "production_out" | "waste" | "adjustment" | "return";
  quantity: string; unitCost?: string; referenceType?: string; referenceId?: number;
  batchNumber?: string; expiryDate?: Date; notes?: string; createdBy?: number;
};

export function shouldCreateReorderAlert(input: { hasExistingBalance: boolean; currentQuantity: number; nextQuantity: number; reorderLevel: number }) {
  return input.reorderLevel > 0
    && input.nextQuantity <= input.reorderLevel
    && (!input.hasExistingBalance || input.currentQuantity > input.reorderLevel);
}

export function pickFefoBatch<T extends { quantity: string | number; expiryDate?: Date | null; id?: number; batchNumber?: string }>(batches: T[]): T | undefined {
  return batches
    .filter((batch) => Number(batch.quantity) > 0)
    .sort((a, b) => {
      const expiryDiff = (a.expiryDate?.getTime?.() || Number.MAX_SAFE_INTEGER) - (b.expiryDate?.getTime?.() || Number.MAX_SAFE_INTEGER);
      if (expiryDiff !== 0) return expiryDiff;
      const idDiff = (a.id || Number.MAX_SAFE_INTEGER) - (b.id || Number.MAX_SAFE_INTEGER);
      return idDiff !== 0 ? idDiff : (a.batchNumber || "").localeCompare(b.batchNumber || "");
    })[0];
}

export function calculateBatchBalanceNext(currentQuantity: string | number, movementQuantity: string | number, direction: "incoming" | "outgoing") {
  const current = Number(currentQuantity);
  const quantity = Number(movementQuantity);
  if (!Number.isFinite(current) || current < 0 || !Number.isFinite(quantity) || quantity <= 0) throw new Error("Invalid batch balance quantity");
  const next = direction === "incoming" ? current + quantity : current - quantity;
  if (next < -0.000001) throw new Error("Insufficient stock in batch");
  return Math.max(0, next);
}

export async function applyInventoryBatchBalance(tx: any, data: StockMovementInput, isIncoming: boolean, quantity: number, unitCost: number, trackBatch: boolean) {
  if (!trackBatch) return;
  if (!data.batchNumber && isIncoming) throw new Error("Batch number is required for incoming stock of a batch-tracked product");
  if (!data.batchNumber && !isIncoming) {
    const first = pickFefoBatch(await tx.select().from(inventoryBatches).where(and(eq(inventoryBatches.productId, data.productId), eq(inventoryBatches.warehouseId, data.warehouseId))));
    if (!first || Number(first.quantity) + 0.000001 < quantity) throw new Error("Select a batch for an outgoing movement that spans batch balances");
    data.batchNumber = first.batchNumber;
  }
  const resolvedBatchNumber = data.batchNumber;
  if (!resolvedBatchNumber) throw new Error("Batch number could not be resolved for batch-tracked stock");
  const rows = await tx.select().from(inventoryBatches).where(and(eq(inventoryBatches.productId, data.productId), eq(inventoryBatches.warehouseId, data.warehouseId), eq(inventoryBatches.batchNumber, resolvedBatchNumber))).limit(1);
  const current = rows[0];
  if (isIncoming) {
    if (current) {
      const currentQuantity = Number(current.quantity);
      const nextQuantity = calculateBatchBalanceNext(currentQuantity, quantity, "incoming");
      const nextCost = nextQuantity > 0 ? ((currentQuantity * Number(current.unitCost)) + (quantity * unitCost)) / nextQuantity : unitCost;
      await tx.update(inventoryBatches).set({ quantity: nextQuantity.toFixed(4), unitCost: nextCost.toFixed(4), expiryDate: data.expiryDate || current.expiryDate }).where(eq(inventoryBatches.id, current.id));
    } else {
      await tx.insert(inventoryBatches).values({ productId: data.productId, warehouseId: data.warehouseId, batchNumber: resolvedBatchNumber, expiryDate: data.expiryDate, quantity: quantity.toFixed(4), unitCost: unitCost.toFixed(4) });
    }
    return;
  }
  if (!current) throw new Error(`Insufficient stock in batch ${resolvedBatchNumber}`);
  const nextQuantity = calculateBatchBalanceNext(current.quantity, quantity, "outgoing");
  data.expiryDate = data.expiryDate || current.expiryDate || undefined;
  await tx.update(inventoryBatches).set({ quantity: nextQuantity.toFixed(4) }).where(eq(inventoryBatches.id, current.id));
}

export async function applyStockMovement(tx: any, data: StockMovementInput) {
  const quantity = Number(data.quantity);
  const unitCost = Number(data.unitCost || "0");
  if (!Number.isFinite(quantity) || quantity === 0) throw new Error("Stock movement quantity must be non-zero");
  if (!Number.isFinite(unitCost) || unitCost < 0) throw new Error("Stock movement unit cost is invalid");
  const incomingTypes = ["purchase", "transfer_in", "production_in", "return"];
  const isIncoming = (incomingTypes.includes(data.type) && quantity > 0) || (data.type === "adjustment" && quantity > 0);
  const signedQuantity = Math.abs(quantity);
  const existing = await tx.select().from(stock).where(and(eq(stock.productId, data.productId), eq(stock.warehouseId, data.warehouseId))).limit(1);
  const currentQuantity = Number(existing[0]?.quantity || 0);
  const currentCost = Number(existing[0]?.avgCost || 0);
  const nextQuantity = isIncoming ? currentQuantity + signedQuantity : currentQuantity - signedQuantity;
  if (nextQuantity < -0.000001) throw new Error("Insufficient stock for this movement");
  const nextCost = isIncoming && nextQuantity > 0
    ? ((currentQuantity * currentCost) + (signedQuantity * unitCost)) / nextQuantity
    : currentCost;
  const productRows = await tx.select({ id: products.id, name: products.name, reorderLevel: products.reorderLevel, trackBatch: products.trackBatch }).from(products).where(eq(products.id, data.productId)).limit(1);
  const product = productRows[0];
  if (!product) throw new Error("Product not found for stock movement");
  await applyInventoryBatchBalance(tx, data, isIncoming, signedQuantity, unitCost, product.trackBatch);
  await tx.insert(stockMovements).values({ ...data, quantity: String(quantity), unitCost: unitCost.toFixed(4) });
  if (existing[0]) {
    await tx.update(stock).set({ quantity: Math.max(0, nextQuantity).toFixed(4), avgCost: Math.max(0, nextCost).toFixed(4) }).where(eq(stock.id, existing[0].id));
  } else if (isIncoming) {
    await tx.insert(stock).values({ productId: data.productId, warehouseId: data.warehouseId, quantity: signedQuantity.toFixed(4), avgCost: unitCost.toFixed(4) });
  } else {
    throw new Error("No stock balance exists for this outgoing movement");
  }
  const safeNextQuantity = Math.max(0, nextQuantity);
  const reorderLevel = Number(product.reorderLevel || 0);
    const notificationRuleRows = await tx.select().from(systemSettings).where(eq(systemSettings.settingKey, NOTIFICATION_RULES_KEY)).limit(1);
    let notificationRules: NotificationRules;
    try { notificationRules = normalizeNotificationRules(notificationRuleRows[0]?.value ? JSON.parse(notificationRuleRows[0].value) : undefined); } catch { notificationRules = { ...DEFAULT_NOTIFICATION_RULES }; }
    if (isNotificationRuleEnabled(notificationRules, "inventoryReorder") && shouldCreateReorderAlert({ hasExistingBalance: Boolean(existing[0]), currentQuantity, nextQuantity: safeNextQuantity, reorderLevel })) {
    await tx.insert(notifications).values({
      type: "inventory_reorder",
      title: `Reorder alert: ${product.name}`,
      content: `Stock reached ${safeNextQuantity.toFixed(4)} at warehouse ${data.warehouseId}; reorder level is ${reorderLevel}.`,
      entityType: "product",
      entityId: product.id,
    });
  }
    if (isNotificationRuleEnabled(notificationRules, "inventoryExpiry") && isIncoming && data.expiryDate) {
    const settings = await tx.select().from(systemSettings).where(eq(systemSettings.settingKey, INVENTORY_EXPIRY_ALERT_DAYS_KEY)).limit(1);
    const thresholdDays = Number(settings[0]?.value || 0);
    const batchReference = data.batchNumber || "without-batch";
    if (shouldCreateExpiryAlert(data.expiryDate, thresholdDays)) {
      const duplicate = await tx.select({ id: notifications.id }).from(notifications).where(and(eq(notifications.type, "inventory_expiry"), eq(notifications.entityType, "product"), eq(notifications.entityId, product.id), like(notifications.content, `%${batchReference}%`))).limit(1);
      if (!duplicate[0]) await tx.insert(notifications).values({
        type: "inventory_expiry", title: `Expiry alert: ${product.name}`,
        content: `Batch ${batchReference} at warehouse ${data.warehouseId} expires on ${data.expiryDate.toISOString().slice(0, 10)}.`,
        entityType: "product", entityId: product.id,
      });
    }
  }
}
export async function listStockMovements(limit = 100) {
  const db = await getDb(); if (!db) return [];
  return db.select().from(stockMovements).orderBy(desc(stockMovements.createdAt)).limit(limit);
}
export async function createStockMovement(data: StockMovementInput) {
  const db = await getDb(); if (!db) throw new Error("Database not available");
  await db.transaction(async (tx) => applyStockMovement(tx, data));
}

// ============ INTERNAL TRANSFERS ============
export async function listTransfers() {
  const db = await getDb(); if (!db) return [];
  return db.select().from(internalTransfers).orderBy(desc(internalTransfers.createdAt));
}
export async function getTransferById(id: number) {
  const db = await getDb(); if (!db) return undefined;
  const rows = await db.select().from(internalTransfers).where(eq(internalTransfers.id, id)).limit(1);
  return rows[0];
}
export async function createTransfer(data: {
  transferNumber?: string; fromWarehouseId: number; toWarehouseId: number;
  notes?: string; createdBy?: number;
  lines: Array<{ productId: number; quantity: string; unitCost?: string }>;
}) {
  const db = await getDb(); if (!db) throw new Error("Database not available");
  if (data.fromWarehouseId === data.toWarehouseId) throw new Error("Source and destination warehouses must differ");
  if (!data.lines.length) throw new Error("Transfer requires at least one line");
  const lines = data.lines.map((line, index) => {
    const quantity = Number(line.quantity);
    const unitCost = Number(line.unitCost || 0);
    if (!Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(unitCost) || unitCost < 0) throw new Error(`Invalid transfer line ${index + 1}`);
    return { ...line, unitCost: unitCost.toFixed(4) };
  });
  return db.transaction(async (tx) => {
    const sequence = await reserveDocumentSequence(tx, "inventory_transfer");
    const transferNumber = `TR-${String(sequence).padStart(8, "0")}`;
    const duplicate = await tx.select({ id: internalTransfers.id }).from(internalTransfers).where(eq(internalTransfers.transferNumber, transferNumber)).limit(1);
    if (duplicate[0]) throw new Error("Transfer number already exists");
    const result = await tx.insert(internalTransfers).values({ transferNumber, fromWarehouseId: data.fromWarehouseId, toWarehouseId: data.toWarehouseId, notes: data.notes, createdBy: data.createdBy });
    const transferId = Number(result[0].insertId);
    await tx.insert(internalTransferLines).values(lines.map((line) => ({ transferId, productId: line.productId, quantity: line.quantity, unitCost: line.unitCost })));
    return { id: transferId };
  });
}
export async function approveTransfer(id: number, approvedBy: number) {
  const db = await getDb(); if (!db) throw new Error("Database not available");
  const update = await db.update(internalTransfers).set({ status: "approved", approvedBy, approvedAt: new Date() }).where(and(eq(internalTransfers.id, id), eq(internalTransfers.status, "draft")));
  if (Number(update[0].affectedRows || 0) !== 1) throw new Error("Transfer cannot be approved in its current status");
}
export async function dispatchTransfer(id: number, dispatchedBy: number) {
  const db = await getDb(); if (!db) throw new Error("Database not available");
  return db.transaction(async (tx) => {
    const transfers = await tx.select().from(internalTransfers).where(eq(internalTransfers.id, id)).limit(1);
    const transfer = transfers[0];
    if (!transfer || transfer.status !== "approved") throw new Error("Transfer cannot be dispatched in its current status");
    const lines = await tx.select().from(internalTransferLines).where(eq(internalTransferLines.transferId, id));
    if (!lines.length) throw new Error("Transfer has no lines");
    for (const line of lines) {
      const movement: StockMovementInput = { productId: line.productId, warehouseId: transfer.fromWarehouseId, type: "transfer_out", quantity: String(line.quantity), unitCost: String(line.unitCost || 0), referenceType: "internal_transfer", referenceId: transfer.id, createdBy: dispatchedBy, notes: `Dispatched transfer ${transfer.transferNumber}` };
      await applyStockMovement(tx, movement);
      if (movement.batchNumber) await tx.update(internalTransferLines).set({ batchNumber: movement.batchNumber, expiryDate: movement.expiryDate }).where(eq(internalTransferLines.id, line.id));
    }
    const update = await tx.update(internalTransfers).set({ status: "in_transit" }).where(and(eq(internalTransfers.id, id), eq(internalTransfers.status, "approved")));
    if (Number(update[0].affectedRows || 0) !== 1) throw new Error("Transfer was dispatched by another process");
  });
}
export async function receiveTransfer(id: number, receivedBy: number) {
  const db = await getDb(); if (!db) throw new Error("Database not available");
  return db.transaction(async (tx) => {
    const transfers = await tx.select().from(internalTransfers).where(eq(internalTransfers.id, id)).limit(1);
    const transfer = transfers[0];
    if (!transfer || transfer.status !== "in_transit") throw new Error("Transfer cannot be received in its current status");
    const lines = await tx.select().from(internalTransferLines).where(eq(internalTransferLines.transferId, id));
    for (const line of lines) await applyStockMovement(tx, { productId: line.productId, warehouseId: transfer.toWarehouseId, type: "transfer_in", quantity: String(line.quantity), unitCost: String(line.unitCost || 0), batchNumber: line.batchNumber || undefined, expiryDate: line.expiryDate || undefined, referenceType: "internal_transfer", referenceId: transfer.id, createdBy: receivedBy, notes: `Received transfer ${transfer.transferNumber}` });
    const update = await tx.update(internalTransfers).set({ status: "received", receivedAt: new Date() }).where(and(eq(internalTransfers.id, id), eq(internalTransfers.status, "in_transit")));
    if (Number(update[0].affectedRows || 0) !== 1) throw new Error("Transfer was received by another process");
  });
}
export async function getNextTransferNumber() {
  const db = await getDb(); if (!db) return "TR-PENDING";
  const result = await db.select({ currentValue: documentSequences.currentValue }).from(documentSequences).where(eq(documentSequences.sequenceKey, "inventory_transfer")).limit(1);
  return `TR-${String(Number(result[0]?.currentValue || 0) + 1).padStart(8, "0")}`;
}

// ============ INVENTORY COUNT ============
export async function listInventoryCounts() {
  const db = await getDb(); if (!db) return [];
  return db.select().from(inventoryCounts).orderBy(desc(inventoryCounts.createdAt));
}
export async function getInventoryCountById(id: number) {
  const db = await getDb(); if (!db) return undefined;
  const rows = await db.select().from(inventoryCounts).where(eq(inventoryCounts.id, id)).limit(1);
  return rows[0];
}
export async function createInventoryCount(data: {
  countNumber?: string; warehouseId: number; type?: "periodic" | "surprise";
  notes?: string; createdBy?: number;
  lines: Array<{ productId: number; systemQuantity: string; actualQuantity: string }>;
}) {
  const db = await getDb(); if (!db) throw new Error("Database not available");
  if (!data.lines.length) throw new Error("Inventory count requires at least one line");
  return db.transaction(async (tx) => {
    const sequence = await reserveDocumentSequence(tx, "inventory_count");
    const countNumber = `CNT-${String(sequence).padStart(8, "0")}`;
    const duplicate = await tx.select({ id: inventoryCounts.id }).from(inventoryCounts).where(eq(inventoryCounts.countNumber, countNumber)).limit(1);
    if (duplicate[0]) throw new Error("Inventory count number already exists");
    const result = await tx.insert(inventoryCounts).values({ countNumber, warehouseId: data.warehouseId, type: data.type || "periodic", status: "in_progress", notes: data.notes, createdBy: data.createdBy });
    const countId = Number(result[0].insertId);
    const lineValues = [] as Array<{ countId: number; productId: number; systemQuantity: string; actualQuantity: string; difference: string }>;
    for (const line of data.lines) {
      const actualQuantity = Number(line.actualQuantity);
      if (!Number.isFinite(actualQuantity) || actualQuantity < 0) throw new Error("Inventory actual quantity is invalid");
      const stockRows = await tx.select().from(stock).where(and(eq(stock.productId, line.productId), eq(stock.warehouseId, data.warehouseId))).limit(1);
      const systemQuantity = Number(stockRows[0]?.quantity || 0);
      lineValues.push({ countId, productId: line.productId, systemQuantity: systemQuantity.toFixed(4), actualQuantity: actualQuantity.toFixed(4), difference: (actualQuantity - systemQuantity).toFixed(4) });
    }
    await tx.insert(inventoryCountLines).values(lineValues);
    return { id: countId };
  });
}
export async function approveInventoryCount(id: number, approvedBy: number) {
  const db = await getDb(); if (!db) throw new Error("Database not available");
  return db.transaction(async (tx) => {
    const counts = await tx.select().from(inventoryCounts).where(eq(inventoryCounts.id, id)).limit(1);
    const count = counts[0];
    if (!count || count.status !== "in_progress") throw new Error("Inventory count cannot be approved in its current status");
    const lines = await tx.select().from(inventoryCountLines).where(eq(inventoryCountLines.countId, id));
    const mapRows = await tx.select().from(systemSettings).where(eq(systemSettings.settingKey, POS_POSTING_MAP_KEY)).limit(1);
    if (!mapRows[0]?.value) throw new Error("Posting account map must be configured before approving an inventory count");
    let postingMap: PosPostingAccountMap;
    try { postingMap = normalizePosPostingAccountMap(JSON.parse(mapRows[0].value)); } catch { throw new Error("Posting account map is invalid"); }
    await assertActivePostingAccounts(tx, postingMap);
    const warehouseRows = await tx.select({ branchId: warehouses.branchId }).from(warehouses).where(eq(warehouses.id, count.warehouseId)).limit(1);
    const branchId = warehouseRows[0]?.branchId || undefined;
    let gainCents = 0;
    let lossCents = 0;
    const gainByInventoryAccount = new Map<number, number>();
    const lossByInventoryAccount = new Map<number, number>();
    const countedProductIds = Array.from(new Set(lines.map((line) => line.productId)));
    const countedProducts = await tx.select({ id: products.id, type: products.type }).from(products).where(inArray(products.id, countedProductIds));
    const productTypeById = new Map(countedProducts.map((product) => [product.id, product.type as InventoryPostingProductType]));
    for (const line of lines) {
      const difference = Number(line.difference);
      if (Math.abs(difference) < 0.000001) continue;
      const stockRows = await tx.select().from(stock).where(and(eq(stock.productId, line.productId), eq(stock.warehouseId, count.warehouseId))).limit(1);
      const unitCost = String(stockRows[0]?.avgCost || 0);
      const unitCostCents = Math.round(Number(unitCost) * 100);
      if (!Number.isFinite(unitCostCents) || unitCostCents < 0) throw new Error("Inventory adjustment unit cost is invalid");
      const movementValueCents = Math.round(Math.abs(difference) * unitCostCents);
      const inventoryAccountId = getInventoryPostingAccountId(postingMap, productTypeById.get(line.productId) || "raw_material");
      if (difference > 0) {
        gainCents += movementValueCents;
        gainByInventoryAccount.set(inventoryAccountId, (gainByInventoryAccount.get(inventoryAccountId) || 0) + movementValueCents);
      } else {
        lossCents += movementValueCents;
        lossByInventoryAccount.set(inventoryAccountId, (lossByInventoryAccount.get(inventoryAccountId) || 0) + movementValueCents);
      }
      await applyStockMovement(tx, { productId: line.productId, warehouseId: count.warehouseId, type: "adjustment", quantity: difference.toFixed(4), unitCost, referenceType: "inventory_count", referenceId: count.id, createdBy: approvedBy, notes: `Approved inventory count ${count.countNumber}` });
    }
    if (gainCents || lossCents) {
      await createPostedOperationalJournalEntry(tx, {
        date: new Date(), referenceType: "inventory_count", referenceId: count.id, description: `Inventory count adjustment ${count.countNumber}`, postedBy: approvedBy,
        lines: [
          ...(gainCents ? [
            ...Array.from(gainByInventoryAccount.entries()).map(([accountId, cents]) => ({ accountId, branchId, debit: (cents / 100).toFixed(2), credit: "0", description: `Inventory gain from ${count.countNumber}` })),
            { accountId: postingMap.inventoryGainAccountId, branchId, debit: "0", credit: (gainCents / 100).toFixed(2), description: `Inventory gain offset for ${count.countNumber}` },
          ] : []),
          ...(lossCents ? [
            { accountId: postingMap.inventoryLossAccountId, branchId, debit: (lossCents / 100).toFixed(2), credit: "0", description: `Inventory loss from ${count.countNumber}` },
            ...Array.from(lossByInventoryAccount.entries()).map(([accountId, cents]) => ({ accountId, branchId, debit: "0", credit: (cents / 100).toFixed(2), description: `Inventory loss offset for ${count.countNumber}` })),
          ] : []),
        ],
      });
    }
    const update = await tx.update(inventoryCounts).set({ status: "approved", approvedBy, completedAt: new Date() }).where(and(eq(inventoryCounts.id, id), eq(inventoryCounts.status, "in_progress")));
    if (Number(update[0].affectedRows || 0) !== 1) throw new Error("Inventory count was approved by another process");
  });
}

// ============ WASTE VOUCHERS (أذون التوالف متعددة البنود) ============
export async function listWasteVouchers() {
  const db = await getDb(); if (!db) return [];
  return db.select().from(wasteVouchers).orderBy(desc(wasteVouchers.createdAt));
}

export async function getWasteVoucherWithLines(id: number) {
  const db = await getDb(); if (!db) return null;
  const vouchers = await db.select().from(wasteVouchers).where(eq(wasteVouchers.id, id)).limit(1);
  if (!vouchers[0]) return null;
  const lines = await db.select().from(wasteVoucherLines).where(eq(wasteVoucherLines.voucherId, id));
  return { ...vouchers[0], lines };
}

export async function createWasteVoucher(data: {
  warehouseId: number; reason?: string; notes?: string; createdBy?: number;
  lines: Array<{ productId: number; quantity: string; notes?: string }>;
}) {
  const db = await getDb(); if (!db) throw new Error("Database not available");
  if (!data.lines.length) throw new Error("Waste voucher requires at least one line");
  return db.transaction(async (tx) => {
    const sequence = await reserveDocumentSequence(tx, "waste_voucher");
    const voucherNumber = `WST-${String(sequence).padStart(8, "0")}`;
    const result = await tx.insert(wasteVouchers).values({ voucherNumber, warehouseId: data.warehouseId, reason: data.reason?.trim() || null, notes: data.notes?.trim() || null, createdBy: data.createdBy });
    const voucherId = Number(result[0].insertId);
    const lineValues = data.lines.map((line) => {
      const quantity = Number(line.quantity);
      if (!Number.isInteger(line.productId) || line.productId <= 0 || !Number.isFinite(quantity) || quantity <= 0) throw new Error("Waste voucher line is invalid");
      return { voucherId, productId: line.productId, quantity: quantity.toFixed(4), unitCost: "0", notes: line.notes?.trim() || null };
    });
    await tx.insert(wasteVoucherLines).values(lineValues);
    return { id: voucherId, voucherNumber };
  });
}

export async function approveWasteVoucher(id: number, approvedBy: number) {
  const db = await getDb(); if (!db) throw new Error("Database not available");
  return db.transaction(async (tx) => {
    const vouchers = await tx.select().from(wasteVouchers).where(eq(wasteVouchers.id, id)).limit(1);
    const voucher = vouchers[0];
    if (!voucher || voucher.status !== "draft") throw new Error("Waste voucher cannot be approved in its current status");
    const lines = await tx.select().from(wasteVoucherLines).where(eq(wasteVoucherLines.voucherId, id));
    if (!lines.length) throw new Error("Waste voucher has no lines");
    const mapRows = await tx.select().from(systemSettings).where(eq(systemSettings.settingKey, POS_POSTING_MAP_KEY)).limit(1);
    if (!mapRows[0]?.value) throw new Error("Posting account map must be configured before approving a waste voucher");
    let postingMap: PosPostingAccountMap;
    try { postingMap = normalizePosPostingAccountMap(JSON.parse(mapRows[0].value)); } catch { throw new Error("Posting account map is invalid"); }
    await assertActivePostingAccounts(tx, postingMap);
    const warehouseRows = await tx.select({ branchId: warehouses.branchId }).from(warehouses).where(eq(warehouses.id, voucher.warehouseId)).limit(1);
    const branchId = warehouseRows[0]?.branchId || undefined;
    let totalCents = 0;
    const wasteByInventoryAccount = new Map<number, number>();
    const wasteProductIds = Array.from(new Set(lines.map((line) => line.productId)));
    const wasteProducts = await tx.select({ id: products.id, type: products.type }).from(products).where(inArray(products.id, wasteProductIds));
    const wasteProductTypeById = new Map(wasteProducts.map((product) => [product.id, product.type as InventoryPostingProductType]));
    for (const line of lines) {
      const stockRows = await tx.select().from(stock).where(and(eq(stock.productId, line.productId), eq(stock.warehouseId, voucher.warehouseId))).limit(1);
      const unitCost = String(stockRows[0]?.avgCost || 0);
      const unitCostCents = Math.round(Number(unitCost) * 100);
      const quantity = Number(line.quantity);
      if (!Number.isFinite(unitCostCents) || unitCostCents < 0 || !Number.isFinite(quantity) || quantity <= 0) throw new Error("Waste voucher line cost is invalid");
      const movementCents = Math.round(quantity * unitCostCents);
      totalCents += movementCents;
      const inventoryAccountId = getInventoryPostingAccountId(postingMap, wasteProductTypeById.get(line.productId) || "raw_material");
      wasteByInventoryAccount.set(inventoryAccountId, (wasteByInventoryAccount.get(inventoryAccountId) || 0) + movementCents);
      const movement: StockMovementInput = { productId: line.productId, warehouseId: voucher.warehouseId, type: "waste", quantity: (-quantity).toFixed(4), unitCost, batchNumber: line.batchNumber || undefined, expiryDate: line.expiryDate || undefined, referenceType: "waste_voucher", referenceId: voucher.id, createdBy: approvedBy, notes: `Approved waste voucher ${voucher.voucherNumber}` };
      await applyStockMovement(tx, movement);
      await tx.update(wasteVoucherLines).set({ unitCost, batchNumber: movement.batchNumber || null, expiryDate: movement.expiryDate || null }).where(eq(wasteVoucherLines.id, line.id));
    }
    if (totalCents > 0) {
      const amount = (totalCents / 100).toFixed(2);
      await createPostedOperationalJournalEntry(tx, {
        date: new Date(), referenceType: "waste_voucher", referenceId: voucher.id, description: `Waste voucher ${voucher.voucherNumber}`, postedBy: approvedBy,
        lines: [
          { accountId: postingMap.wasteExpenseAccountId, branchId, debit: amount, credit: "0", description: `Waste expense for ${voucher.voucherNumber}` },
          ...Array.from(wasteByInventoryAccount.entries()).map(([accountId, cents]) => ({ accountId, branchId, debit: "0", credit: (cents / 100).toFixed(2), description: `Inventory reduction for ${voucher.voucherNumber}` })),
        ],
      });
    }
    const update = await tx.update(wasteVouchers).set({ status: "approved", approvedBy, approvedAt: new Date() }).where(and(eq(wasteVouchers.id, id), eq(wasteVouchers.status, "draft")));
    if (Number(update[0].affectedRows || 0) !== 1) throw new Error("Waste voucher was approved by another process");
    return { id, voucherNumber: voucher.voucherNumber, totalAmount: (totalCents / 100).toFixed(2) };
  });
}

export async function cancelWasteVoucher(id: number) {
  const db = await getDb(); if (!db) throw new Error("Database not available");
  const update = await db.update(wasteVouchers).set({ status: "cancelled", cancelledAt: new Date() }).where(and(eq(wasteVouchers.id, id), eq(wasteVouchers.status, "draft")));
  if (Number(update[0].affectedRows || 0) !== 1) throw new Error("Only draft waste vouchers can be cancelled");
}

// ============ RECIPES (BOM) ============
export function calculateRecipeCostBreakdown(input: {
  lines: Array<{ quantity: string | number; unitCost: string | number | null; wastePercent?: string | number | null }>;
  includedAddons: Array<{ unitCost: string | number | null }>;
  outputQuantity: string | number;
  yieldPercent?: string | number | null;
}) {
  const ingredientCost = input.lines.reduce((total, line) => {
    const quantity = Number(line.quantity); const unitCost = Number(line.unitCost || 0); const wastePercent = Number(line.wastePercent || 0);
    if (!Number.isFinite(quantity) || !Number.isFinite(unitCost) || !Number.isFinite(wastePercent) || quantity < 0 || unitCost < 0 || wastePercent < 0) throw new Error("Recipe cost input is invalid");
    return total + quantity * unitCost * (1 + wastePercent / 100);
  }, 0);
  const includedAddonCost = input.includedAddons.reduce((total, addon) => {
    const unitCost = Number(addon.unitCost || 0);
    if (!Number.isFinite(unitCost) || unitCost < 0) throw new Error("Included add-on cost is invalid");
    return total + unitCost;
  }, 0);
  const outputQuantity = Number(input.outputQuantity); const yieldPercent = Number(input.yieldPercent ?? 100);
  if (!Number.isFinite(outputQuantity) || outputQuantity <= 0 || !Number.isFinite(yieldPercent) || yieldPercent <= 0) throw new Error("Recipe output or yield is invalid");
  const totalCost = ingredientCost + includedAddonCost;
  const effectiveOutputQuantity = outputQuantity * yieldPercent / 100;
  return { ingredientCost: ingredientCost.toFixed(2), includedAddonCost: includedAddonCost.toFixed(2), totalCost: totalCost.toFixed(2), unitCost: (totalCost / effectiveOutputQuantity).toFixed(2) };
}

export function selectIncludedAddonsForRecipeCost<T extends { pricingMode: "included" | "free" | "separate"; unitCost: string | number | null }>(addons: T[]) {
  return addons.filter((addon) => addon.pricingMode === "included");
}

export type RecipeDetailRecord = { id: number; productId: number; outputQuantity: string | number; yieldPercent?: string | number | null; [key: string]: unknown };
export type RecipeDetailPort = {
  getRecipe: (id: number) => Promise<RecipeDetailRecord | undefined>;
  listLines: (recipeId: number) => Promise<Array<{ quantity: string | number; unitCost: string | number | null; wastePercent?: string | number | null; [key: string]: unknown }>>;
  listIncludedAddons: (productId: number) => Promise<Array<{ addonProductId: number; pricingMode: "included" | "free" | "separate"; unitCost: string | number | null; name: string }>>;
};
let recipeDetailPortForTesting: RecipeDetailPort | undefined;
export function setRecipeDetailPortForTesting(port?: RecipeDetailPort) {
  recipeDetailPortForTesting = port;
}

export async function runRecipeWithLines(id: number, port: RecipeDetailPort) {
  const recipe = await port.getRecipe(id);
  if (!recipe) return null;
  const lines = await port.listLines(id);
  const includedAddons = selectIncludedAddonsForRecipeCost(await port.listIncludedAddons(recipe.productId));
  return { ...recipe, lines, includedAddons, costBreakdown: calculateRecipeCostBreakdown({ lines, includedAddons, outputQuantity: recipe.outputQuantity, yieldPercent: recipe.yieldPercent }) };
}

export async function listRecipes() {
  const db = await getDb(); if (!db) return [];
  const rows = await db.select().from(recipes).orderBy(asc(recipes.name));
  const detailedRecipes = await Promise.all(rows.map((recipe) => getRecipeWithLines(recipe.id)));
  return detailedRecipes.filter((recipe): recipe is NonNullable<typeof recipe> => Boolean(recipe));
}
export async function getRecipeWithLines(id: number) {
  if (recipeDetailPortForTesting) return runRecipeWithLines(id, recipeDetailPortForTesting);
  const db = await getDb(); if (!db) return null;
  return runRecipeWithLines(id, {
    getRecipe: async (recipeId) => (await db.select().from(recipes).where(eq(recipes.id, recipeId)).limit(1))[0],
    listLines: async (recipeId) => db.select().from(recipeLines).where(eq(recipeLines.recipeId, recipeId)),
    listIncludedAddons: async (productId) => db.select({ addonProductId: productAddons.addonProductId, pricingMode: productAddons.pricingMode, unitCost: products.costPrice, name: products.name })
      .from(productAddons).innerJoin(products, eq(productAddons.addonProductId, products.id))
      .where(and(eq(productAddons.parentProductId, productId), eq(productAddons.isActive, true))),
  });
}
export type RecipeCreateInput = {
  productId: number; name: string; outputQuantity?: string; yieldPercent?: string;
  standardCost?: string; instructions?: string;
  lines: Array<{ ingredientId: number; quantity: string; wastePercent?: string; unitCost?: string }>;
};
export type RecipeCreationPort = {
  listIncludedAddons: (productId: number) => Promise<Array<{ pricingMode: "included" | "free" | "separate"; unitCost: string | number | null }>>;
  createRecipe: (recipe: { productId: number; name: string; outputQuantity: string; yieldPercent: string; standardCost: string; instructions?: string }) => Promise<number>;
  createLines: (recipeId: number, lines: Array<{ ingredientId: number; quantity: string; wastePercent: string; unitCost: string }>) => Promise<void>;
};

export async function runRecipeCreation(data: RecipeCreateInput, port: RecipeCreationPort) {
  const outputQuantity = data.outputQuantity || "1";
  const yieldPercent = data.yieldPercent || "100";
  const includedAddons = selectIncludedAddonsForRecipeCost(await port.listIncludedAddons(data.productId));
  const costBreakdown = calculateRecipeCostBreakdown({ lines: data.lines.map((line) => ({ ...line, unitCost: line.unitCost || "0", wastePercent: line.wastePercent || "0" })), includedAddons, outputQuantity, yieldPercent });
  const recipeId = await port.createRecipe({ productId: data.productId, name: data.name, outputQuantity, yieldPercent, standardCost: costBreakdown.totalCost, instructions: data.instructions });
  if (data.lines.length > 0) await port.createLines(recipeId, data.lines.map((line) => ({ ingredientId: line.ingredientId, quantity: line.quantity, wastePercent: line.wastePercent || "0", unitCost: line.unitCost || "0" })));
  return { id: recipeId, standardCost: costBreakdown.totalCost, costBreakdown };
}

export async function createRecipe(data: RecipeCreateInput, testPort?: RecipeCreationPort) {
  if (testPort) return runRecipeCreation(data, testPort);
  const db = await getDb(); if (!db) throw new Error("Database not available");
  return runRecipeCreation(data, {
    listIncludedAddons: async (productId) => db.select({ pricingMode: productAddons.pricingMode, unitCost: products.costPrice }).from(productAddons).innerJoin(products, eq(productAddons.addonProductId, products.id))
      .where(and(eq(productAddons.parentProductId, productId), eq(productAddons.isActive, true))),
    createRecipe: async (recipe) => Number((await db.insert(recipes).values(recipe))[0].insertId),
    createLines: async (recipeId, lines) => { await db.insert(recipeLines).values(lines.map((line) => ({ ...line, recipeId }))); },
  });
}

// ============ PRODUCTION ORDERS ============
export async function listProductionOrders() {
  const db = await getDb(); if (!db) return [];
  return db.select().from(productionOrders).orderBy(desc(productionOrders.createdAt));
}
export async function getProductionOrderById(id: number) {
  const db = await getDb(); if (!db) return undefined;
  const rows = await db.select().from(productionOrders).where(eq(productionOrders.id, id)).limit(1);
  return rows[0];
}
export async function createProductionOrder(data: {
  orderNumber?: string; recipeId: number; productId: number; warehouseId: number; sourceWarehouseId?: number;
  branchId?: number; plannedQuantity: string; plannedCost?: string; batchNumber?: string;
  notes?: string; createdBy?: number;
  lines: Array<{ ingredientId: number; requiredQuantity: string; unitCost?: string }>;
}) {
  const db = await getDb(); if (!db) throw new Error("Database not available");
  return db.transaction(async (tx) => {
    const sourceWarehouseId = data.sourceWarehouseId || data.warehouseId;
    const warehouseRows = await tx.select({ id: warehouses.id, branchId: warehouses.branchId, isActive: warehouses.isActive })
      .from(warehouses).where(inArray(warehouses.id, Array.from(new Set([sourceWarehouseId, data.warehouseId]))));
    const warehousesById = new Map(warehouseRows.map((warehouse) => [warehouse.id, warehouse]));
    const sourceWarehouse = warehousesById.get(sourceWarehouseId);
    const destinationWarehouse = warehousesById.get(data.warehouseId);
    if (!sourceWarehouse || !destinationWarehouse || !sourceWarehouse.isActive || !destinationWarehouse.isActive) throw new Error("Production source and destination warehouses must exist and be active");
    if (data.branchId && destinationWarehouse.branchId !== data.branchId) throw new Error("Production branch must match the destination warehouse branch");
    const sequence = await reserveDocumentSequence(tx, "production_order");
    const result = await tx.insert(productionOrders).values({
      orderNumber: `PRD-${String(sequence).padStart(8, "0")}`, recipeId: data.recipeId, productId: data.productId,
      sourceWarehouseId, warehouseId: data.warehouseId, branchId: data.branchId || destinationWarehouse.branchId, plannedQuantity: data.plannedQuantity,
      plannedCost: data.plannedCost || "0", batchNumber: data.batchNumber, notes: data.notes, createdBy: data.createdBy,
    });
    const orderId = Number(result[0].insertId);
    if (data.lines.length > 0) await tx.insert(productionOrderLines).values(data.lines.map(l => ({ productionOrderId: orderId, ingredientId: l.ingredientId, requiredQuantity: l.requiredQuantity, unitCost: l.unitCost || "0" })));
    return { id: orderId };
  });
}
export async function completeProductionOrder(id: number, actualQty: string, wasteQty: string, actualCost: string) {
  const db = await getDb(); if (!db) throw new Error("Database not available");
  const producedQuantity = Number(actualQty);
  const wasteQuantity = Number(wasteQty);
  if (!Number.isFinite(producedQuantity) || producedQuantity <= 0) throw new Error("Actual production quantity must be positive");
  if (!Number.isFinite(wasteQuantity) || wasteQuantity < 0) throw new Error("Production waste quantity is invalid");
  if (!Number.isFinite(Number(actualCost)) || Number(actualCost) < 0) throw new Error("Actual production cost is invalid");
  return db.transaction(async (tx) => {
    const ordersFound = await tx.select().from(productionOrders).where(eq(productionOrders.id, id)).limit(1);
    const order = ordersFound[0];
    if (!order || order.status === "completed" || order.status === "cancelled") throw new Error("Production order cannot be completed in its current status");
    const plannedQuantity = Number(order.plannedQuantity);
    if (!Number.isFinite(plannedQuantity) || plannedQuantity <= 0) throw new Error("Production order planned quantity is invalid");
    const lines = await tx.select().from(productionOrderLines).where(eq(productionOrderLines.productionOrderId, id));
    if (!lines.length) throw new Error("Production order has no material lines");
    const sourceWarehouseId = order.sourceWarehouseId || order.warehouseId;
    const factor = producedQuantity / plannedQuantity;
    let calculatedCost = 0;
    for (const line of lines) {
      const baseQuantity = Number(line.actualQuantity || 0) > 0 ? Number(line.actualQuantity) : Number(line.requiredQuantity);
      const consumedQuantity = baseQuantity * factor;
      const unitCost = Number(line.unitCost || 0);
      if (!Number.isFinite(consumedQuantity) || consumedQuantity <= 0 || !Number.isFinite(unitCost) || unitCost < 0) throw new Error("Production material line is invalid");
      calculatedCost += consumedQuantity * unitCost;
      const movement: StockMovementInput = { productId: line.ingredientId, warehouseId: sourceWarehouseId, type: "production_out", quantity: consumedQuantity.toFixed(4), unitCost: unitCost.toFixed(4), batchNumber: line.batchNumber || undefined, expiryDate: line.expiryDate || undefined, referenceType: "production_order", referenceId: order.id, notes: `Consumed by production order ${order.orderNumber}`, createdBy: order.createdBy || undefined };
      await applyStockMovement(tx, movement);
      await tx.update(productionOrderLines).set({ batchNumber: movement.batchNumber || null, expiryDate: movement.expiryDate || null }).where(eq(productionOrderLines.id, line.id));
    }
    const outputUnitCost = calculatedCost / producedQuantity;
    await applyStockMovement(tx, { productId: order.productId, warehouseId: order.warehouseId, type: "production_in", quantity: producedQuantity.toFixed(4), unitCost: outputUnitCost.toFixed(4), referenceType: "production_order", referenceId: order.id, batchNumber: order.batchNumber || undefined, notes: `Produced by production order ${order.orderNumber}`, createdBy: order.createdBy || undefined });
    const mapRows = await tx.select().from(systemSettings).where(eq(systemSettings.settingKey, POS_POSTING_MAP_KEY)).limit(1);
    if (!mapRows[0]?.value) throw new Error("Posting account map must be configured before completing a production order");
    let postingMap: PosPostingAccountMap;
    try { postingMap = normalizePosPostingAccountMap(JSON.parse(mapRows[0].value)); } catch { throw new Error("Posting account map is invalid"); }
    await assertActivePostingAccounts(tx, postingMap);
    const costAmount = calculatedCost.toFixed(2);
    await createPostedOperationalJournalEntry(tx, {
      date: new Date(), referenceType: "production_order", referenceId: order.id, description: `Production completion ${order.orderNumber}`, postedBy: order.createdBy || 0,
      lines: [
        { accountId: postingMap.workInProgressAccountId, branchId: order.branchId || undefined, debit: costAmount, credit: "0", description: `Materials consumed by ${order.orderNumber}` },
        { accountId: postingMap.inventoryAccountId, branchId: order.branchId || undefined, debit: "0", credit: costAmount, description: `Raw inventory consumed by ${order.orderNumber}` },
        { accountId: postingMap.finishedGoodsInventoryAccountId, branchId: order.branchId || undefined, debit: costAmount, credit: "0", description: `Finished goods produced by ${order.orderNumber}` },
        { accountId: postingMap.workInProgressAccountId, branchId: order.branchId || undefined, debit: "0", credit: costAmount, description: `Production completed for ${order.orderNumber}` },
      ],
    });
    const variance = calculatedCost - Number(order.plannedCost || 0);
    const update = await tx.update(productionOrders).set({
      status: "completed", actualQuantity: producedQuantity.toFixed(4), wasteQuantity: wasteQuantity.toFixed(4),
      actualCost: calculatedCost.toFixed(2), variance: variance.toFixed(2), completedAt: new Date(),
    }).where(and(eq(productionOrders.id, id), sql`${productionOrders.status} <> 'completed'`, sql`${productionOrders.status} <> 'cancelled'`));
    if (Number(update[0].affectedRows || 0) !== 1) throw new Error("Production order was completed by another process");
    return { id, actualCost: calculatedCost.toFixed(2), variance: variance.toFixed(2) };
  });
}
export async function getNextProductionNumber() {
  const db = await getDb(); if (!db) return "PRD-PENDING";
  const result = await db.select({ currentValue: documentSequences.currentValue }).from(documentSequences).where(eq(documentSequences.sequenceKey, "production_order")).limit(1);
  return `PRD-${String(Number(result[0]?.currentValue || 0) + 1).padStart(8, "0")}`;
}

// ============ SUPPLIERS ============
export async function listSuppliers() {
  const db = await getDb(); if (!db) return [];
  return db.select().from(suppliers).orderBy(asc(suppliers.name));
}
export async function createSupplier(data: { name: string; contactPerson?: string; phone?: string; email?: string; address?: string; taxNumber?: string }) {
  const db = await getDb(); if (!db) throw new Error("Database not available");
  const result = await db.insert(suppliers).values(data);
  return { id: Number(result[0].insertId) };
}
export async function updateSupplier(id: number, data: Partial<Record<string, any>>) {
  const db = await getDb(); if (!db) throw new Error("Database not available");
  await db.update(suppliers).set(data).where(eq(suppliers.id, id));
}

// ============ PURCHASE ORDERS ============
export async function listPurchaseOrders() {
  const db = await getDb(); if (!db) return [];
  return db.select().from(purchaseOrders).orderBy(desc(purchaseOrders.createdAt));
}
export async function createPurchaseOrder(data: {
  orderNumber?: string; supplierId: number; warehouseId: number; notes?: string; createdBy?: number;
  lines: Array<{ productId: number; quantity: string; unitPrice: string }>;
}) {
  const db = await getDb(); if (!db) throw new Error("Database not available");
  let totalAmount = 0;
  const lineValues = data.lines.map(l => {
    const total = parseFloat(l.quantity) * parseFloat(l.unitPrice);
    totalAmount += total;
    return { purchaseOrderId: 0, productId: l.productId, quantity: l.quantity, unitPrice: l.unitPrice, totalPrice: total.toFixed(2) };
  });
  const taxAmount = totalAmount * 0.15;
  return db.transaction(async (tx) => {
    const sequence = await reserveDocumentSequence(tx, "purchase_order");
    const result = await tx.insert(purchaseOrders).values({
      orderNumber: `PUR-${String(sequence).padStart(8, "0")}`, supplierId: data.supplierId, warehouseId: data.warehouseId,
      totalAmount: totalAmount.toFixed(2), taxAmount: taxAmount.toFixed(2), notes: data.notes, createdBy: data.createdBy,
    });
    const orderId = Number(result[0].insertId);
    if (lineValues.length > 0) await tx.insert(purchaseOrderLines).values(lineValues.map(l => ({ ...l, purchaseOrderId: orderId })));
    return { id: orderId };
  });
}
export async function getNextPurchaseNumber() {
  const db = await getDb(); if (!db) return "PUR-PENDING";
  const result = await db.select({ currentValue: documentSequences.currentValue }).from(documentSequences).where(eq(documentSequences.sequenceKey, "purchase_order")).limit(1);
  return `PUR-${String(Number(result[0]?.currentValue || 0) + 1).padStart(8, "0")}`;
}

// ============ TABLES ============
export async function listTables(branchId?: number) {
  const db = await getDb(); if (!db) return [];
  if (branchId) return db.select().from(tables).where(eq(tables.branchId, branchId)).orderBy(asc(tables.sortOrder));
  return db.select().from(tables).orderBy(asc(tables.sortOrder));
}
export async function createTable(data: { branchId: number; name: string; capacity?: number }) {
  const db = await getDb(); if (!db) throw new Error("Database not available");
  const result = await db.insert(tables).values(data);
  return { id: Number(result[0].insertId) };
}
export async function updateTableStatus(id: number, status: "available" | "occupied" | "reserved" | "maintenance") {
  const db = await getDb(); if (!db) throw new Error("Database not available");
  await db.update(tables).set({ status }).where(eq(tables.id, id));
}

// ============ POS SESSIONS ============
export async function listPosSessions(branchId?: number) {
  const db = await getDb(); if (!db) return [];
  if (branchId) return db.select().from(posSessions).where(eq(posSessions.branchId, branchId)).orderBy(desc(posSessions.createdAt));
  return db.select().from(posSessions).orderBy(desc(posSessions.createdAt));
}
export async function getPosSessionById(id: number) {
  const db = await getDb(); if (!db) return undefined;
  const result = await db.select().from(posSessions).where(eq(posSessions.id, id)).limit(1);
  return result[0];
}
export async function openPosSession(data: { branchId: number; cashierId: number; openingBalance: string }) {
  const db = await getDb(); if (!db) throw new Error("Database not available");
  const openingBalance = (toCents(data.openingBalance, "opening balance") / 100).toFixed(2);
  return db.transaction(async (tx) => {
    const active = await tx.select({ id: posSessions.id }).from(posSessions)
      .where(and(eq(posSessions.cashierId, data.cashierId), eq(posSessions.status, "open"))).limit(1);
    if (active[0]) throw new Error("Cashier already has an open POS session");
    const result = await tx.insert(posSessions).values({ ...data, openingBalance });
    return { id: Number(result[0].insertId) };
  });
}
export async function closePosSession(id: number, closingBalance: string, closedBy: number) {
  const db = await getDb(); if (!db) throw new Error("Database not available");
  const actualCash = toCents(closingBalance, "closing balance");
  return db.transaction(async (tx) => {
    const sessions = await tx.select().from(posSessions).where(eq(posSessions.id, id)).limit(1);
    const session = sessions[0];
    if (!session || session.status !== "open") throw new Error("POS session was not found or is already closed");
    const paidSales = await tx.select({ total: sql<string>`COALESCE(SUM(${orders.totalAmount}), 0)` }).from(orders)
      .where(and(eq(orders.sessionId, id), eq(orders.status, "paid")));
    const cashSales = await tx.select({ total: sql<string>`COALESCE(SUM(${orderPayments.amount}), 0)` }).from(orderPayments)
      .innerJoin(orders, eq(orderPayments.orderId, orders.id))
      .where(and(eq(orders.sessionId, id), eq(orders.status, "paid"), eq(orderPayments.paymentMethod, "cash")));
    const totalSales = toCents(paidSales[0]?.total || "0", "paid sales");
    const expectedCash = toCents(session.openingBalance, "opening balance") + toCents(cashSales[0]?.total || "0", "cash sales") - toCents(session.totalReturns, "returns");
    const variance = actualCash - expectedCash;
    const thresholdRows = await tx.select().from(systemSettings).where(eq(systemSettings.settingKey, POS_CASH_VARIANCE_ALERT_THRESHOLD_KEY)).limit(1);
    const notificationRuleRows = await tx.select().from(systemSettings).where(eq(systemSettings.settingKey, NOTIFICATION_RULES_KEY)).limit(1);
    const thresholdCents = thresholdRows[0]?.value ? toCents(thresholdRows[0].value, "cash variance alert threshold") : 0;
    let notificationRules: NotificationRules;
    try { notificationRules = normalizeNotificationRules(notificationRuleRows[0]?.value ? JSON.parse(notificationRuleRows[0].value) : undefined); } catch { notificationRules = { ...DEFAULT_NOTIFICATION_RULES }; }
    const update = await tx.update(posSessions).set({
      status: "closed", closingBalance: (actualCash / 100).toFixed(2), totalSales: (totalSales / 100).toFixed(2),
      expectedCash: (expectedCash / 100).toFixed(2), cashVariance: (variance / 100).toFixed(2), closedBy, closedAt: new Date(),
    }).where(and(eq(posSessions.id, id), eq(posSessions.status, "open")));
    if (Number(update[0].affectedRows || 0) !== 1) throw new Error("POS session was closed by another process");
    if (isNotificationRuleEnabled(notificationRules, "posCashVariance") && shouldCreateCashVarianceAlert(variance, thresholdCents)) {
      await tx.insert(notifications).values({
        type: "pos_cash_variance",
        title: `Cash variance alert: session ${id}`,
        content: `Cash variance is ${(variance / 100).toFixed(2)} and exceeds configured threshold ${(thresholdCents / 100).toFixed(2)}.`,
        entityType: "pos_session",
        entityId: id,
      });
    }
    return { id, totalSales: (totalSales / 100).toFixed(2), expectedCash: (expectedCash / 100).toFixed(2), cashVariance: (variance / 100).toFixed(2) };
  });
}

// ============ ORDERS ============
export async function listOrders(limit = 50, branchId?: number) {
  const db = await getDb(); if (!db) return [];
  if (branchId) return db.select().from(orders).where(eq(orders.branchId, branchId)).orderBy(desc(orders.createdAt)).limit(limit);
  return db.select().from(orders).orderBy(desc(orders.createdAt)).limit(limit);
}
export async function getOrderWithLines(id: number) {
  const db = await getDb(); if (!db) return null;
  const order = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
  if (!order[0]) return null;
  const lines = await db.select().from(orderLines).where(eq(orderLines.orderId, id));
  return { ...order[0], lines };
}

export function calculatePosLineTaxes<T extends { productId: number; total: number }>(
  lines: T[],
  productsById: Map<number, { taxRate: string | number; taxCodeId: number | null }>,
  discount: number,
) {
  const subtotal = lines.reduce((sum, line) => sum + line.total, 0);
  if (!Number.isInteger(discount) || discount < 0 || discount > subtotal) throw new Error("Discount cannot exceed order subtotal");
  let remainingDiscount = discount;
  return lines.map((line, index) => {
    const product = productsById.get(line.productId);
    if (!product) throw new Error(`Product ${line.productId} was not found`);
    const taxRate = Number(product.taxRate);
    if (!Number.isFinite(taxRate) || taxRate < 0 || taxRate > 100) throw new Error(`Product ${line.productId} has an invalid tax rate`);
    const lineDiscount = subtotal === 0 || index === lines.length - 1
      ? remainingDiscount
      : Math.min(line.total, Math.floor((discount * line.total) / subtotal));
    remainingDiscount -= lineDiscount;
    const taxableCents = line.total - lineDiscount;
    return { ...line, taxCodeId: product.taxCodeId, taxRate, taxAmount: Math.round(taxableCents * (taxRate / 100)), discountAmount: lineDiscount };
  });
}

export function requirePosWarehouseId(warehouseId: unknown): number {
  if (!Number.isInteger(warehouseId) || Number(warehouseId) <= 0) throw new Error("POS order requires an explicit warehouse");
  return Number(warehouseId);
}

export function assertPosWarehouseForBranch(input: { branchId: number; warehouseId: number; warehouse?: { id: number; branchId: number | null; isActive: boolean } }) {
  if (!input.warehouse || input.warehouse.id !== input.warehouseId || input.warehouse.branchId !== input.branchId || !input.warehouse.isActive) {
    throw new Error("Selected POS warehouse is not active for this branch");
  }
  return input.warehouse;
}

export async function createOrder(data: {
  orderNumber?: string; branchId: number; warehouseId: number; costCenterId?: number; tableId?: number;
  sessionId?: number; cashierId?: number; type?: "dine_in" | "takeaway" | "delivery";
  notes?: string; discountAmount?: string; paymentMethod?: "cash" | "card" | "transfer" | "mixed";
  payments?: Array<{ paymentMethod: "cash" | "card" | "transfer"; amount: string; reference?: string }>;
  lines: Array<{ productId: number; quantity: string; unitPrice: string; costPrice?: string; batchNumber?: string; parentProductId?: number; addonPricingMode?: "included" | "free" | "separate"; notes?: string }>;
}) {
  const db = await getDb(); if (!db) throw new Error("Database not available");
  const warehouseId = requirePosWarehouseId(data.warehouseId);
  if (!data.lines.length) throw new Error("A POS order requires at least one line");
  const lineValues = data.lines.map((line, index) => {
    const quantity = Number(line.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0) throw new Error(`Invalid quantity at line ${index + 1}`);
    const unitPrice = toCents(line.unitPrice, `unit price at line ${index + 1}`);
    const costPrice = toCents(line.costPrice || "0", `cost price at line ${index + 1}`);
    return { productId: line.productId, quantity: line.quantity, unitPrice, costPrice, total: Math.round(quantity * unitPrice), batchNumber: line.batchNumber?.trim() || undefined, parentProductId: line.parentProductId, addonPricingMode: line.addonPricingMode, notes: line.notes };
  });
  const subtotal = lineValues.reduce((sum, line) => sum + line.total, 0);
  const discount = toCents(data.discountAmount || "0", "discount");
  if (discount > subtotal) throw new Error("Discount cannot exceed order subtotal");
  const paymentMethod = data.paymentMethod || "cash";
  return db.transaction(async (tx) => {
    if (data.sessionId) {
      const sessions = await tx.select().from(posSessions).where(eq(posSessions.id, data.sessionId)).limit(1);
      const session = sessions[0];
      if (!session || session.status !== "open" || session.branchId !== data.branchId || session.cashierId !== data.cashierId) throw new Error("POS session is not open for this cashier and branch");
    }
    const selectedWarehouseRows = await tx.select().from(warehouses)
      .where(and(eq(warehouses.branchId, data.branchId), eq(warehouses.isActive, true), eq(warehouses.id, warehouseId))).limit(1);
    const selectedWarehouse = assertPosWarehouseForBranch({ branchId: data.branchId, warehouseId, warehouse: selectedWarehouseRows[0] });
    const productIds = Array.from(new Set(lineValues.map((line) => line.productId)));
    const productsInOrder = await tx.select({ id: products.id, isActive: products.isActive, taxRate: products.taxRate, taxCodeId: products.taxCodeId, costPrice: products.costPrice }).from(products).where(inArray(products.id, productIds));
    if (productsInOrder.length !== productIds.length || productsInOrder.some((product) => !product.isActive)) throw new Error("Order contains an invalid or inactive product");
    const productById = new Map(productsInOrder.map((product) => [product.id, product]));
    const addonParentIds = Array.from(new Set(lineValues.map((line) => line.parentProductId).filter((id): id is number => typeof id === "number")));
    const configuredAddons = addonParentIds.length ? await tx.select().from(productAddons).where(inArray(productAddons.parentProductId, addonParentIds)) : [];
    const addonByPair = new Map(configuredAddons.filter((addon) => addon.isActive).map((addon) => [`${addon.parentProductId}:${addon.addonProductId}`, addon]));
    for (const line of lineValues) {
      if (!line.parentProductId) continue;
      const addon = addonByPair.get(`${line.parentProductId}:${line.productId}`);
      if (!addon || line.addonPricingMode !== addon.pricingMode) throw new Error("POS add-on is not configured for its parent product");
      line.unitPrice = addon.pricingMode === "separate" ? toCents(addon.salePrice, "configured add-on price") : 0;
      line.costPrice = toCents(productById.get(line.productId)?.costPrice || "0", "add-on product cost");
      line.total = Math.round(Number(line.quantity) * line.unitPrice);
    }
    const addonAdjustedSubtotal = lineValues.reduce((sum, line) => sum + line.total, 0);
    if (addonAdjustedSubtotal !== subtotal) {
      const adjustedDiscount = toCents(data.discountAmount || "0", "discount");
      if (adjustedDiscount > addonAdjustedSubtotal) throw new Error("Discount cannot exceed POS subtotal after add-on pricing");
    }
    const calculatedLines = calculatePosLineTaxes(lineValues, productById, discount);
    const taxAmount = calculatedLines.reduce((sum, line) => sum + line.taxAmount, 0);
    const totalAmount = addonAdjustedSubtotal - discount + taxAmount;
    const paymentAllocations = data.payments?.length
      ? data.payments.map((payment, index) => ({ ...payment, cents: toCents(payment.amount, `payment amount at line ${index + 1}`) }))
      : paymentMethod === "mixed" ? [] : [{ paymentMethod, amount: (totalAmount / 100).toFixed(2), cents: totalAmount }];
    if (!paymentAllocations.length) throw new Error("Mixed-payment order requires documented payment allocations");
    if (paymentMethod === "mixed" && paymentAllocations.length < 2) throw new Error("Mixed-payment order requires at least two payment allocations");
    if (paymentAllocations.some((payment) => payment.cents <= 0) || paymentAllocations.reduce((sum, payment) => sum + payment.cents, 0) !== totalAmount) {
      throw new Error("Payment allocations must be positive and equal the order total");
    }
    const sequence = await reserveDocumentSequence(tx, "pos_order");
    const orderNumber = `POS-${String(sequence).padStart(8, "0")}`;
    const duplicate = await tx.select({ id: orders.id }).from(orders).where(eq(orders.orderNumber, orderNumber)).limit(1);
    if (duplicate[0]) throw new Error("Order number already exists");
    const result = await tx.insert(orders).values({
      orderNumber, branchId: data.branchId, warehouseId: selectedWarehouse.id, costCenterId: data.costCenterId,
      tableId: data.tableId, sessionId: data.sessionId, cashierId: data.cashierId,
      type: data.type || "dine_in", subtotal: (addonAdjustedSubtotal / 100).toFixed(2), taxAmount: (taxAmount / 100).toFixed(2),
      discountAmount: (discount / 100).toFixed(2), totalAmount: (totalAmount / 100).toFixed(2),
      paymentMethod, notes: data.notes,
    });
    const orderId = Number(result[0].insertId);
    for (const line of calculatedLines) {
      const orderLine = await tx.insert(orderLines).values({ orderId, productId: line.productId, parentProductId: line.parentProductId, addonPricingMode: line.addonPricingMode, batchNumber: line.batchNumber, quantity: line.quantity, unitPrice: (line.unitPrice / 100).toFixed(2), totalPrice: (line.total / 100).toFixed(2), costPrice: (line.costPrice / 100).toFixed(2), discountAmount: (line.discountAmount / 100).toFixed(2), taxCodeId: line.taxCodeId, taxRate: line.taxRate.toFixed(2), taxAmount: (line.taxAmount / 100).toFixed(2), notes: line.notes });
      await tx.insert(kitchenOrders).values({ orderId, orderLineId: Number(orderLine[0].insertId), branchId: data.branchId });
    }
    await tx.insert(orderPayments).values(paymentAllocations.map((payment) => ({
      orderId, paymentMethod: payment.paymentMethod, amount: (payment.cents / 100).toFixed(2), reference: payment.reference,
    })));
    return { id: orderId, totalAmount: (totalAmount / 100).toFixed(2) };
  });
}
export function calculatePosOrderCostCents(lines: Array<{ quantity: string | number; costPrice: string | number | null }>) {
  return lines.reduce((total, line) => total + Math.round(Number(line.quantity) * toCents(line.costPrice || "0", "line cost")), 0);
}

export async function updateOrderStatus(id: number, status: "new" | "preparing" | "ready" | "served" | "paid" | "cancelled", postedBy?: number) {
  const db = await getDb(); if (!db) throw new Error("Database not available");
  return db.transaction(async (tx) => {
    const result = await tx.select().from(orders).where(eq(orders.id, id)).limit(1);
    const order = result[0];
    if (!order) throw new Error("Order not found");
    const transitions: Record<typeof order.status, Array<typeof order.status>> = {
      new: ["preparing", "cancelled"], preparing: ["ready", "cancelled"], ready: ["served", "paid", "cancelled"], served: ["paid", "cancelled"], paid: [], cancelled: [],
    };
    if (!transitions[order.status].includes(status)) throw new Error(`Invalid order status transition from ${order.status} to ${status}`);
    if (status === "paid") {
      if (!postedBy) throw new Error("A user is required to post a paid POS order");
      const warehouseRows = await tx.select().from(warehouses).where(and(eq(warehouses.branchId, order.branchId), eq(warehouses.isActive, true), ...(order.warehouseId ? [eq(warehouses.id, order.warehouseId)] : []))).limit(1);
      const saleWarehouse = warehouseRows[0];
      if (!saleWarehouse) throw new Error("No active sales warehouse is configured for this branch");
      const lines = await tx.select().from(orderLines).where(eq(orderLines.orderId, id));
      if (!lines.length) throw new Error("Order has no lines to fulfil");
      const mapRows = await tx.select().from(systemSettings).where(eq(systemSettings.settingKey, POS_POSTING_MAP_KEY)).limit(1);
      if (!mapRows[0]?.value) throw new Error("POS posting account map must be configured before posting a paid order");
      let postingMap: PosPostingAccountMap;
      try { postingMap = normalizePosPostingAccountMap(JSON.parse(mapRows[0].value)); } catch { throw new Error("POS posting account map is invalid"); }
      await assertActivePostingAccounts(tx, postingMap);
      const salesNetCents = toCents(order.subtotal, "order subtotal") - toCents(order.discountAmount, "order discount");
      const taxCents = toCents(order.taxAmount, "order tax");
      const paymentCents = toCents(order.totalAmount, "order total");
      if (salesNetCents < 0 || salesNetCents + taxCents !== paymentCents) throw new Error("POS order totals are invalid for accounting");
      const orderedProductIds = Array.from(new Set(lines.map((line) => line.productId)));
      const orderedProducts = await tx.select({ id: products.id, type: products.type }).from(products).where(inArray(products.id, orderedProductIds));
      const orderedProductTypeById = new Map(orderedProducts.map((product) => [product.id, product.type as InventoryPostingProductType]));
      const costByInventoryAccount = new Map<number, number>();
      const costCents = lines.reduce((total, line) => {
        const lineCents = Math.round(Number(line.quantity) * toCents(line.costPrice || "0", "line cost"));
        const inventoryAccountId = getInventoryPostingAccountId(postingMap, orderedProductTypeById.get(line.productId) || "raw_material");
        costByInventoryAccount.set(inventoryAccountId, (costByInventoryAccount.get(inventoryAccountId) || 0) + lineCents);
        return total + lineCents;
      }, 0);
      const paymentRows = await tx.select().from(orderPayments).where(eq(orderPayments.orderId, order.id));
      if (!paymentRows.length) throw new Error("POS order has no documented payment allocations");
      const allocatedCents = paymentRows.reduce((sum, payment) => sum + toCents(payment.amount, "payment allocation"), 0);
      if (allocatedCents !== paymentCents) throw new Error("POS payment allocations do not equal the order total");
      const settlementCents = new Map<number, number>();
      for (const payment of paymentRows) {
        const accountId = payment.paymentMethod === "cash" ? postingMap.cashAccountId : postingMap.cardClearingAccountId;
        settlementCents.set(accountId, (settlementCents.get(accountId) || 0) + toCents(payment.amount, "payment allocation"));
      }
      const journalLines = [
        ...Array.from(settlementCents.entries()).map(([accountId, cents]) => ({ accountId, branchId: order.branchId, costCenterId: order.costCenterId || undefined, debit: (cents / 100).toFixed(2), credit: "0", description: `POS collection for ${order.orderNumber}` })),
        { accountId: postingMap.salesRevenueAccountId, branchId: order.branchId, costCenterId: order.costCenterId || undefined, debit: "0", credit: (salesNetCents / 100).toFixed(2), description: `POS revenue for ${order.orderNumber}` },
        { accountId: postingMap.outputVatAccountId, branchId: order.branchId, costCenterId: order.costCenterId || undefined, debit: "0", credit: (taxCents / 100).toFixed(2), description: `POS output VAT for ${order.orderNumber}` },
      ];
      if (costCents > 0) journalLines.push(
        { accountId: postingMap.cogsAccountId, branchId: order.branchId, costCenterId: order.costCenterId || undefined, debit: (costCents / 100).toFixed(2), credit: "0", description: `POS cost of sales for ${order.orderNumber}` },
        ...Array.from(costByInventoryAccount.entries()).map(([accountId, cents]) => ({ accountId, branchId: order.branchId, costCenterId: order.costCenterId || undefined, debit: "0", credit: (cents / 100).toFixed(2), description: `POS inventory reduction for ${order.orderNumber}` })),
      );
      await createPostedOperationalJournalEntry(tx, {
        entryNumber: `JEPO-${order.orderNumber}`, date: new Date(), description: `POS sale ${order.orderNumber}`,
        referenceType: "pos_order", referenceId: order.id, postedBy, lines: journalLines,
      });
      for (const line of lines) {
        const stockRows = await tx.select().from(stock).where(and(eq(stock.productId, line.productId), eq(stock.warehouseId, saleWarehouse.id))).limit(1);
        await applyStockMovement(tx, { productId: line.productId, warehouseId: saleWarehouse.id, type: "sale", quantity: String(line.quantity), unitCost: String(stockRows[0]?.avgCost || line.costPrice || 0), batchNumber: line.batchNumber || undefined, referenceType: "pos_order", referenceId: order.id, createdBy: order.cashierId || undefined, notes: `Fulfilled POS order ${order.orderNumber}` });
      }
    }
    const values = status === "paid" ? { status, paidAmount: order.totalAmount } : { status };
    const update = await tx.update(orders).set(values).where(and(eq(orders.id, id), eq(orders.status, order.status)));
    if (Number(update[0].affectedRows || 0) !== 1) throw new Error("Order status was changed by another process");
  });
}

// ============ POS REFUNDS ============
export async function listPosRefunds(limit = 100, branchId?: number) {
  const db = await getDb(); if (!db) return [];
  const query = db.select().from(posRefunds).orderBy(desc(posRefunds.createdAt)).limit(limit);
  return branchId ? query.where(eq(posRefunds.branchId, branchId)) : query;
}

export async function getNextPosRefundNumber() {
  const db = await getDb(); if (!db) return "RF-PENDING";
  const result = await db.select({ currentValue: documentSequences.currentValue }).from(documentSequences).where(eq(documentSequences.sequenceKey, "pos_refund")).limit(1);
  return `RF-${String(Number(result[0]?.currentValue || 0) + 1).padStart(8, "0")}`;
}

export async function requestPosRefund(data: { refundNumber?: string; orderId: number; branchId: number; reason: string; requestedBy: number }) {
  const db = await getDb(); if (!db) throw new Error("Database not available");
  const reason = data.reason.trim();
  if (reason.length < 3) throw new Error("Refund reason must contain at least 3 characters");
  return db.transaction(async (tx) => {
    const orderRows = await tx.select().from(orders).where(eq(orders.id, data.orderId)).limit(1);
    const order = orderRows[0];
    if (!order) throw new Error("POS order was not found");
    if (order.branchId !== data.branchId) throw new Error("Refund branch does not match the POS order");
    if (order.status !== "paid") throw new Error("Only a paid POS order can have a refund request");
    const existing = await tx.select({ id: posRefunds.id }).from(posRefunds).where(eq(posRefunds.orderId, order.id)).limit(1);
    if (existing[0]) throw new Error("A refund document already exists for this POS order");
    const sequence = await reserveDocumentSequence(tx, "pos_refund");
    const refundNumber = `RF-${String(sequence).padStart(8, "0")}`;
    const duplicateNumber = await tx.select({ id: posRefunds.id }).from(posRefunds).where(eq(posRefunds.refundNumber, refundNumber)).limit(1);
    if (duplicateNumber[0]) throw new Error("Refund number already exists");
    const result = await tx.insert(posRefunds).values({
      refundNumber, orderId: order.id, branchId: order.branchId, sessionId: order.sessionId,
      paymentMethod: order.paymentMethod || "cash", amount: order.totalAmount, reason, requestedBy: data.requestedBy,
    });
    return { id: Number(result[0].insertId), amount: String(order.totalAmount) };
  });
}

export async function approvePosRefund(id: number, branchId: number, approvedBy: number) {
  const db = await getDb(); if (!db) throw new Error("Database not available");
  return db.transaction(async (tx) => {
    const rows = await tx.select().from(posRefunds).where(eq(posRefunds.id, id)).limit(1);
    const refund = rows[0];
    if (!refund || refund.branchId !== branchId) throw new Error("Refund document was not found for this branch");
    if (refund.status !== "requested") throw new Error("Refund cannot be approved in its current status");
    if (refund.requestedBy === approvedBy) throw new Error("Refund requester cannot approve the same document");
    const update = await tx.update(posRefunds).set({ status: "approved", approvedBy, approvedAt: new Date() })
      .where(and(eq(posRefunds.id, id), eq(posRefunds.status, "requested")));
    if (Number(update[0].affectedRows || 0) !== 1) throw new Error("Refund was changed by another process");
    return { id, status: "approved" as const };
  });
}

export async function completePosRefund(id: number, branchId: number, completedBy: number) {
  const db = await getDb(); if (!db) throw new Error("Database not available");
  return db.transaction(async (tx) => {
    const refundRows = await tx.select().from(posRefunds).where(eq(posRefunds.id, id)).limit(1);
    const refund = refundRows[0];
    if (!refund || refund.branchId !== branchId) throw new Error("Refund document was not found for this branch");
    if (refund.status !== "approved") throw new Error("Only an approved refund can be completed");
    const orderRows = await tx.select().from(orders).where(eq(orders.id, refund.orderId)).limit(1);
    const order = orderRows[0];
    if (!order || order.status !== "paid") throw new Error("Original POS order is not eligible for refund completion");
    const paymentRows = await tx.select().from(orderPayments).where(eq(orderPayments.orderId, order.id));
    if (!paymentRows.length) throw new Error("Original POS order has no documented payment allocations");
    const originalPaymentCents = paymentRows.reduce((sum, payment) => sum + toCents(payment.amount, "payment allocation"), 0);
    const cashRefundCents = paymentRows.filter((payment) => payment.paymentMethod === "cash").reduce((sum, payment) => sum + toCents(payment.amount, "cash payment allocation"), 0);
    if (cashRefundCents > 0) {
      if (!order.sessionId) throw new Error("Cash refund requires an original POS session");
      const sessionRows = await tx.select().from(posSessions).where(eq(posSessions.id, order.sessionId)).limit(1);
      const session = sessionRows[0];
      if (!session || session.status !== "open") throw new Error("Cash refund requires an open original POS session");
    }
    const warehouseRows = await tx.select().from(warehouses).where(and(eq(warehouses.branchId, order.branchId), eq(warehouses.isActive, true), ...(order.warehouseId ? [eq(warehouses.id, order.warehouseId)] : []))).limit(1);
    const saleWarehouse = warehouseRows[0];
    if (!saleWarehouse) throw new Error("No active sales warehouse is configured for this branch");
    const lines = await tx.select().from(orderLines).where(eq(orderLines.orderId, order.id));
    if (!lines.length) throw new Error("POS order has no lines to return");
    const mapRows = await tx.select().from(systemSettings).where(eq(systemSettings.settingKey, POS_POSTING_MAP_KEY)).limit(1);
    if (!mapRows[0]?.value) throw new Error("POS posting account map must be configured before completing a refund");
    let postingMap: PosPostingAccountMap;
    try { postingMap = normalizePosPostingAccountMap(JSON.parse(mapRows[0].value)); } catch { throw new Error("POS posting account map is invalid"); }
    await assertActivePostingAccounts(tx, postingMap);
    const salesNetCents = toCents(order.subtotal, "order subtotal") - toCents(order.discountAmount, "order discount");
    const taxCents = toCents(order.taxAmount, "order tax");
    const refundCents = toCents(refund.amount, "refund amount");
    if (salesNetCents < 0 || salesNetCents + taxCents !== refundCents) throw new Error("POS order totals are invalid for refund accounting");
    if (originalPaymentCents !== refundCents) throw new Error("Original payment allocations do not equal the approved refund amount");
    const costCents = lines.reduce((total, line) => total + Math.round(Number(line.quantity) * toCents(line.costPrice, "line cost")), 0);
    const settlementCents = new Map<number, number>();
    for (const payment of paymentRows) {
      const accountId = payment.paymentMethod === "cash" ? postingMap.cashAccountId : postingMap.cardClearingAccountId;
      settlementCents.set(accountId, (settlementCents.get(accountId) || 0) + toCents(payment.amount, "payment allocation"));
    }
    const journalLines = [
      { accountId: postingMap.salesRevenueAccountId, branchId: order.branchId, costCenterId: order.costCenterId || undefined, debit: (salesNetCents / 100).toFixed(2), credit: "0", description: `Reverse revenue for ${refund.refundNumber}` },
      { accountId: postingMap.outputVatAccountId, branchId: order.branchId, costCenterId: order.costCenterId || undefined, debit: (taxCents / 100).toFixed(2), credit: "0", description: `Reverse output VAT for ${refund.refundNumber}` },
      ...Array.from(settlementCents.entries()).map(([accountId, cents]) => ({ accountId, branchId: order.branchId, costCenterId: order.costCenterId || undefined, debit: "0", credit: (cents / 100).toFixed(2), description: `Refund settlement for ${refund.refundNumber}` })),
    ];
    if (costCents > 0) {
      journalLines.push(
        { accountId: postingMap.inventoryAccountId, branchId: order.branchId, costCenterId: order.costCenterId || undefined, debit: (costCents / 100).toFixed(2), credit: "0", description: `Restore inventory for ${refund.refundNumber}` },
        { accountId: postingMap.cogsAccountId, branchId: order.branchId, costCenterId: order.costCenterId || undefined, debit: "0", credit: (costCents / 100).toFixed(2), description: `Reverse cost of sales for ${refund.refundNumber}` },
      );
    }
    const refundJournal = await createPostedOperationalJournalEntry(tx, {
      entryNumber: `JERF-${refund.refundNumber}`, date: new Date(), description: `POS refund ${refund.refundNumber} for order ${order.orderNumber}`,
      referenceType: "pos_refund", referenceId: refund.id, postedBy: completedBy, lines: journalLines,
    });
    for (const line of lines) {
      await applyStockMovement(tx, {
        productId: line.productId, warehouseId: saleWarehouse.id, type: "return", quantity: String(line.quantity),
        unitCost: String(line.costPrice || 0), batchNumber: line.batchNumber || undefined, referenceType: "pos_refund", referenceId: refund.id,
        createdBy: completedBy, notes: `Returned by approved POS refund ${refund.refundNumber}`,
      });
    }
    if (cashRefundCents > 0 && order.sessionId) {
      await tx.update(posSessions).set({
        totalReturns: sql`${posSessions.totalReturns} + ${(cashRefundCents / 100).toFixed(2)}`,
      }).where(and(eq(posSessions.id, order.sessionId), eq(posSessions.status, "open")));
    }
    const orderUpdate = await tx.update(orders).set({ status: "cancelled", paidAmount: "0" })
      .where(and(eq(orders.id, order.id), eq(orders.status, "paid")));
    if (Number(orderUpdate[0].affectedRows || 0) !== 1) throw new Error("POS order was changed by another process");
    const refundUpdate = await tx.update(posRefunds).set({ status: "completed", completedBy, completedAt: new Date(), stockRestoredAt: new Date(), journalEntryId: refundJournal.id })
      .where(and(eq(posRefunds.id, refund.id), eq(posRefunds.status, "approved")));
    if (Number(refundUpdate[0].affectedRows || 0) !== 1) throw new Error("Refund was changed by another process");
    return { id: refund.id, orderId: order.id, amount: String(refund.amount), status: "completed" as const };
  });
}

export async function payPosOrder(id: number, branchId: number, postedBy: number) {
  const db = await getDb(); if (!db) throw new Error("Database not available");
  const rows = await db.select({ id: orders.id, branchId: orders.branchId }).from(orders).where(eq(orders.id, id)).limit(1);
  if (!rows[0] || rows[0].branchId !== branchId) throw new Error("POS order was not found for this branch");
  return updateOrderStatus(id, "paid", postedBy);
}

export async function getNextOrderNumber() {
  const db = await getDb(); if (!db) return "POS-PENDING";
  const result = await db.select({ currentValue: documentSequences.currentValue }).from(documentSequences).where(eq(documentSequences.sequenceKey, "pos_order")).limit(1);
  return `POS-${String(Number(result[0]?.currentValue || 0) + 1).padStart(8, "0")}`;
}

// ============ KITCHEN ORDERS ============
export async function listKitchenOrders(branchId: number) {
  const db = await getDb(); if (!db) return [];
  return db.select().from(kitchenOrders).where(and(eq(kitchenOrders.branchId, branchId), or(eq(kitchenOrders.status, "new"), eq(kitchenOrders.status, "preparing")))).orderBy(asc(kitchenOrders.createdAt));
}
export async function updateKitchenOrderStatus(id: number, status: "new" | "preparing" | "ready" | "served") {
  const db = await getDb(); if (!db) throw new Error("Database not available");
  const updates: any = { status };
  if (status === "preparing") updates.startedAt = new Date();
  if (status === "ready" || status === "served") updates.completedAt = new Date();
  await db.update(kitchenOrders).set(updates).where(eq(kitchenOrders.id, id));
}

// ============ PURCHASE REQUESTS ============
export async function listPurchaseRequests() {
  const db = await getDb(); if (!db) return [];
  return db.select().from(purchaseRequests).orderBy(desc(purchaseRequests.createdAt));
}
export async function createPurchaseRequest(data: { requestNumber: string; branchId: number; requestedBy?: number; notes?: string; lines: Array<{ productId: number; quantity: string }> }) {
  const db = await getDb(); if (!db) throw new Error("Database not available");
  const result = await db.insert(purchaseRequests).values({ requestNumber: data.requestNumber, branchId: data.branchId, requestedBy: data.requestedBy, notes: data.notes });
  const requestId = Number(result[0].insertId);
  if (data.lines.length > 0) {
    await db.insert(purchaseRequestLines).values(data.lines.map(l => ({ requestId, productId: l.productId, quantity: l.quantity })));
  }
  return { id: requestId };
}

// ============ PURCHASE INVOICES ============
export async function listPurchaseInvoices() {
  const db = await getDb(); if (!db) return [];
  return db.select().from(purchaseInvoices).orderBy(desc(purchaseInvoices.createdAt));
}
export async function getPurchaseInvoiceById(id: number) {
  const db = await getDb(); if (!db) return undefined;
  const rows = await db.select().from(purchaseInvoices).where(eq(purchaseInvoices.id, id)).limit(1);
  return rows[0];
}
export type PurchaseInvoiceInput = { invoiceNumber: string; purchaseOrderId?: number; supplierId: number; warehouseId: number; invoiceDate: Date; dueDate?: Date; notes?: string; createdBy?: number; lines: Array<{ productId: number; quantity: string; unitPrice: string; batchNumber?: string; expiryDate?: Date }> };
type PurchaseInvoicePreparedLine = { invoiceId: number; productId: number; quantity: string; unitPrice: string; lineTotal: string; taxCodeId: number | null; taxRate: string; taxAmount: string; batchNumber?: string; expiryDate?: Date };
export type PurchaseInvoiceCreationPort = {
  getProducts: (productIds: number[]) => Promise<Array<{ id: number; isActive: boolean; taxRate: string | null; taxCodeId: number | null }>>;
  hasDuplicateInvoice: (supplierId: number, invoiceNumber: string) => Promise<boolean>;
  createInvoice: (invoice: { invoiceNumber: string; poId?: number; supplierId: number; warehouseId: number; invoiceDate: Date; dueDate?: Date; notes?: string; createdBy?: number; totalAmount: string; tax: string }) => Promise<number>;
  createLines: (lines: PurchaseInvoicePreparedLine[]) => Promise<void>;
};

export async function runPurchaseInvoiceCreation(data: PurchaseInvoiceInput, port: PurchaseInvoiceCreationPort) {
  if (!data.lines.length) throw new Error("Purchase invoice requires at least one line");
  const lineInputs = data.lines.map((l, index) => {
    const quantity = Number(l.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0) throw new Error(`Invalid purchase quantity at line ${index + 1}`);
    const unitPrice = toCents(l.unitPrice, `purchase price at line ${index + 1}`);
    return { ...l, quantity, unitPrice };
  });
  const productIds = Array.from(new Set(lineInputs.map((line) => line.productId)));
  const productRows = await port.getProducts(productIds);
  if (productRows.length !== productIds.length || productRows.some((product) => !product.isActive)) throw new Error("Purchase invoice contains an invalid or inactive product");
  const productsById = new Map(productRows.map((product) => [product.id, product]));
  const calculatedLines = lineInputs.map((line) => {
    const product = productsById.get(line.productId);
    if (!product) throw new Error(`Product ${line.productId} was not found`);
    const taxRate = Number(product.taxRate);
    if (!Number.isFinite(taxRate) || taxRate < 0 || taxRate > 100) throw new Error(`Product ${line.productId} has an invalid tax rate`);
    const netCents = Math.round(line.quantity * line.unitPrice);
    const taxCents = Math.round(netCents * (taxRate / 100));
    return { invoiceId: 0, productId: line.productId, quantity: line.quantity.toString(), unitPrice: (line.unitPrice / 100).toFixed(2), lineTotal: (netCents / 100).toFixed(2), taxCodeId: product.taxCodeId, taxRate: taxRate.toFixed(2), taxAmount: (taxCents / 100).toFixed(2), totalCents: netCents + taxCents, taxCents, batchNumber: line.batchNumber, expiryDate: line.expiryDate };
  });
  const totalCents = calculatedLines.reduce((sum, line) => sum + line.totalCents, 0);
  const totalTaxCents = calculatedLines.reduce((sum, line) => sum + line.taxCents, 0);
  const invoiceNumber = data.invoiceNumber.trim();
  if (await port.hasDuplicateInvoice(data.supplierId, invoiceNumber)) throw new Error("Supplier invoice number already exists");
  const invoiceId = await port.createInvoice({ invoiceNumber, poId: data.purchaseOrderId, supplierId: data.supplierId, warehouseId: data.warehouseId, invoiceDate: data.invoiceDate, dueDate: data.dueDate, notes: data.notes, createdBy: data.createdBy, totalAmount: (totalCents / 100).toFixed(2), tax: (totalTaxCents / 100).toFixed(2) });
  await port.createLines(calculatedLines.map(({ totalCents: _totalCents, taxCents: _taxCents, ...line }) => ({ ...line, invoiceId })));
  return { id: invoiceId, totalAmount: (totalCents / 100).toFixed(2), totalTax: (totalTaxCents / 100).toFixed(2) };
}

export async function createPurchaseInvoice(data: PurchaseInvoiceInput, testPort?: PurchaseInvoiceCreationPort) {
  if (testPort) return runPurchaseInvoiceCreation(data, testPort);
  const db = await getDb(); if (!db) throw new Error("Database not available");
  return db.transaction(async (tx) => runPurchaseInvoiceCreation(data, {
    getProducts: async (productIds) => tx.select({ id: products.id, isActive: products.isActive, taxRate: products.taxRate, taxCodeId: products.taxCodeId }).from(products).where(inArray(products.id, productIds)),
    hasDuplicateInvoice: async (supplierId, invoiceNumber) => Boolean((await tx.select({ id: purchaseInvoices.id }).from(purchaseInvoices).where(and(eq(purchaseInvoices.supplierId, supplierId), eq(purchaseInvoices.invoiceNumber, invoiceNumber))).limit(1))[0]),
    createInvoice: async (invoice) => Number((await tx.insert(purchaseInvoices).values(invoice))[0].insertId),
    createLines: async (lines) => { await tx.insert(purchaseInvoiceLines).values(lines); },
  }));
}

export function buildPurchaseReceiptStockMovement(input: {
  invoiceId: number;
  invoiceNumber: string;
  warehouseId: number;
  approvedBy?: number;
  line: { productId: number; quantity: string | number; unitPrice: string | number; batchNumber?: string | null; expiryDate?: Date | null };
}) {
  return {
    productId: input.line.productId,
    warehouseId: input.warehouseId,
    type: "purchase" as const,
    quantity: String(input.line.quantity),
    unitCost: String(input.line.unitPrice),
    referenceType: "purchase_invoice",
    referenceId: input.invoiceId,
    batchNumber: input.line.batchNumber || undefined,
    expiryDate: input.line.expiryDate || undefined,
    createdBy: input.approvedBy,
    notes: `Received from purchase invoice ${input.invoiceNumber}`,
  };
}

export type PurchaseInvoiceReceiptRecord = { id: number; invoiceNumber: string; warehouseId: number | null; status: string };
export type PurchaseInvoiceReceiptLine = { productId: number; quantity: string | number; unitPrice: string | number; batchNumber?: string | null; expiryDate?: Date | null };
export type PurchaseInvoiceItemsApprovalPort = {
  getInvoice: (id: number) => Promise<PurchaseInvoiceReceiptRecord | undefined>;
  listLines: (invoiceId: number) => Promise<PurchaseInvoiceReceiptLine[]>;
  applyStockMovement: (movement: ReturnType<typeof buildPurchaseReceiptStockMovement>) => Promise<void>;
  markItemsApproved: (input: { id: number; approvedBy?: number; notes?: string }) => Promise<number>;
};

export async function runPurchaseInvoiceItemsApproval(id: number, approvedBy: number | undefined, notes: string | undefined, port: PurchaseInvoiceItemsApprovalPort) {
  const invoice = await port.getInvoice(id);
  if (!invoice || invoice.status !== "draft") throw new Error("Purchase invoice cannot be received in its current status");
  if (!invoice.warehouseId) throw new Error("Purchase invoice warehouse is required for receipt");
  const lines = await port.listLines(id);
  if (!lines.length) throw new Error("Purchase invoice has no lines to receive");
  for (const line of lines) {
    await port.applyStockMovement(buildPurchaseReceiptStockMovement({ invoiceId: invoice.id, invoiceNumber: invoice.invoiceNumber, warehouseId: invoice.warehouseId, approvedBy, line }));
  }
  if (await port.markItemsApproved({ id, approvedBy, notes }) !== 1) throw new Error("Purchase invoice was approved by another process");
  return { id, receivedLines: lines.length };
}

export async function approvePurchaseInvoiceItems(id: number, approvedBy?: number, notes?: string, testPort?: PurchaseInvoiceItemsApprovalPort) {
  if (testPort) return runPurchaseInvoiceItemsApproval(id, approvedBy, notes, testPort);
  const db = await getDb(); if (!db) throw new Error("Database not available");
  return db.transaction(async (tx) => runPurchaseInvoiceItemsApproval(id, approvedBy, notes, {
    getInvoice: async (invoiceId) => (await tx.select().from(purchaseInvoices).where(eq(purchaseInvoices.id, invoiceId)).limit(1))[0],
    listLines: async (invoiceId) => tx.select().from(purchaseInvoiceLines).where(eq(purchaseInvoiceLines.invoiceId, invoiceId)),
    applyStockMovement: async (movement) => applyStockMovement(tx, movement),
    markItemsApproved: async (input) => Number((await tx.update(purchaseInvoices).set({ status: "items_approved", itemsApprovedBy: input.approvedBy, itemsApprovalNotes: input.notes }).where(and(eq(purchaseInvoices.id, input.id), eq(purchaseInvoices.status, "draft"))))[0].affectedRows || 0),
  }));
}
export async function approvePurchaseInvoiceAccounts(id: number, approvedBy?: number, notes?: string) {
  const db = await getDb(); if (!db) throw new Error("Database not available");
  if (!approvedBy) throw new Error("A user is required to approve purchase invoice accounts");
  return db.transaction(async (tx) => {
    const invoiceRows = await tx.select().from(purchaseInvoices).where(eq(purchaseInvoices.id, id)).limit(1);
    const invoice = invoiceRows[0];
    if (!invoice || invoice.status !== "items_approved") throw new Error("Purchase invoice accounts cannot be approved in its current status");
    const mapRows = await tx.select().from(systemSettings).where(eq(systemSettings.settingKey, POS_POSTING_MAP_KEY)).limit(1);
    if (!mapRows[0]?.value) throw new Error("POS posting account map must be configured before approving purchase invoice accounts");
    let postingMap: PosPostingAccountMap;
    try { postingMap = normalizePosPostingAccountMap(JSON.parse(mapRows[0].value)); } catch { throw new Error("POS posting account map is invalid"); }
    await assertActivePostingAccounts(tx, postingMap);
    const grossCents = toCents(invoice.totalAmount, "purchase invoice total");
    const taxCents = toCents(invoice.tax, "purchase invoice tax");
    const netCents = grossCents - taxCents;
    if (netCents < 0) throw new Error("Purchase invoice totals are invalid for accounting");
    await createPostedOperationalJournalEntry(tx, {
      entryNumber: `JEPI-${invoice.invoiceNumber}`, date: invoice.invoiceDate, description: `Purchase invoice ${invoice.invoiceNumber}`,
      referenceType: "purchase_invoice", referenceId: invoice.id, postedBy: approvedBy,
      lines: [
        { accountId: postingMap.inventoryAccountId, debit: (netCents / 100).toFixed(2), credit: "0", description: `Inventory from purchase invoice ${invoice.invoiceNumber}` },
        { accountId: postingMap.inputVatAccountId, debit: (taxCents / 100).toFixed(2), credit: "0", description: `Input VAT from purchase invoice ${invoice.invoiceNumber}` },
        { accountId: postingMap.accountsPayableAccountId, debit: "0", credit: (grossCents / 100).toFixed(2), description: `Supplier liability for purchase invoice ${invoice.invoiceNumber}` },
      ],
    });
    const update = await tx.update(purchaseInvoices).set({ status: "accounts_approved", accountsApprovedBy: approvedBy, accountsApprovalNotes: notes })
      .where(and(eq(purchaseInvoices.id, id), eq(purchaseInvoices.status, "items_approved")));
    if (Number(update[0].affectedRows || 0) !== 1) throw new Error("Purchase invoice was changed by another process");
    return { id, status: "accounts_approved" as const };
  });
}

// ============ BACKUPS ============
export async function listBackups() {
  const db = await getDb(); if (!db) return [];
  return db.select().from(backups).orderBy(desc(backups.createdAt));
}
export async function getBackupById(id: number) {
  const db = await getDb(); if (!db) return undefined;
  const result = await db.select().from(backups).where(eq(backups.id, id)).limit(1);
  return result[0];
}
export async function createBackup(data: { backupName: string; backupSize?: number; backupPath?: string; backupType?: "manual" | "automatic"; createdBy?: number }) {
  const db = await getDb(); if (!db) throw new Error("Database not available");
  const result = await db.insert(backups).values({
    name: data.backupName,
    description: data.backupType ? `Backup type: ${data.backupType}` : null,
    fileKey: data.backupPath,
    fileSize: data.backupSize,
    status: "creating",
    createdBy: data.createdBy,
  });
  return { id: Number(result[0].insertId) };
}

// ============ AUDIT LOG ============
export async function logAudit(data: { userId?: number; action: string; entityType: string; entityId?: number; oldValues?: unknown; newValues?: unknown; ipAddress?: string }) {
  const db = await getDb(); if (!db) return;
  await db.insert(auditLog).values({
    userId: data.userId, action: data.action, entityType: data.entityType, entityId: data.entityId,
    oldValues: data.oldValues ? JSON.stringify(data.oldValues) : null,
    newValues: data.newValues ? JSON.stringify(data.newValues) : null, ipAddress: data.ipAddress,
  });
}
export async function listAuditLog(limit = 100) {
  const db = await getDb(); if (!db) return [];
  return db.select().from(auditLog).orderBy(desc(auditLog.createdAt)).limit(limit);
}

// ============ DOCUMENTS ============
export async function listDocuments() {
  const db = await getDb(); if (!db) return [];
  return db.select().from(documents).orderBy(desc(documents.createdAt));
}
export async function createDocument(data: { name: string; fileUrl: string; fileKey: string; mimeType?: string; fileSize?: number; entityType?: string; entityId?: number; uploadedBy?: number }) {
  const db = await getDb(); if (!db) throw new Error("Database not available");
  const result = await db.insert(documents).values(data);
  return { id: Number(result[0].insertId) };
}

// ============ SAUDI ERP COMPLIANCE CORE ==========
function zatcaTlvField(tag: number, value: string) {
  const bytes = Buffer.from(value, "utf8");
  if (bytes.length > 255) throw new Error(`ZATCA QR field ${tag} is too long`);
  return Buffer.concat([Buffer.from([tag, bytes.length]), bytes]);
}

export function buildZatcaPhaseOneQrPayload(data: { sellerName: string; vatNumber: string; issueDate: Date; totalAmount: string; taxAmount: string }) {
  if (!data.sellerName.trim()) throw new Error("Seller name is required for ZATCA QR");
  if (!data.vatNumber.trim()) throw new Error("VAT number is required for ZATCA QR");
  return Buffer.concat([
    zatcaTlvField(1, data.sellerName.trim()),
    zatcaTlvField(2, data.vatNumber.trim()),
    zatcaTlvField(3, data.issueDate.toISOString()),
    zatcaTlvField(4, data.totalAmount),
    zatcaTlvField(5, data.taxAmount),
  ]).toString("base64");
}

export async function getCompanyProfile() {
  const db = await getDb(); if (!db) return undefined;
  const result = await db.select().from(companyProfiles).limit(1);
  return result[0];
}

export async function saveCompanyProfile(data: {
  legalName: string; tradeName?: string; vatNumber?: string; commercialRegistrationNumber?: string;
  addressLine1?: string; addressLine2?: string; city?: string; district?: string; postalCode?: string;
  countryCode: string; currencyCode: string; isVatRegistered?: boolean; eInvoicingMode?: "disabled" | "sandbox" | "production";
}) {
  const db = await getDb(); if (!db) throw new Error("Database not available");
  const existing = await getCompanyProfile();
  if (existing) {
    await db.update(companyProfiles).set(data).where(eq(companyProfiles.id, existing.id));
    return { id: existing.id, updated: true };
  }
  const result = await db.insert(companyProfiles).values({
    ...data,
    isVatRegistered: data.isVatRegistered ?? false,
    eInvoicingMode: data.eInvoicingMode ?? "disabled",
  });
  return { id: Number(result[0].insertId), updated: false };
}

export async function listTaxCodes() {
  const db = await getDb(); if (!db) return [];
  return db.select().from(taxCodes).orderBy(asc(taxCodes.code));
}

export function normalizeTaxCodeRate(category: "standard" | "zero_rated" | "exempt" | "out_of_scope", value: string) {
  const rate = Number(value);
  if (!Number.isFinite(rate) || rate < 0 || rate > 100) throw new Error("Tax code rate must be between 0 and 100");
  if (category === "standard" && rate <= 0) throw new Error("Standard tax code must have a positive rate");
  if (category !== "standard" && rate !== 0) throw new Error("Zero-rated, exempt, and out-of-scope tax codes must have a zero rate");
  return rate.toFixed(2);
}

export async function createTaxCode(data: {
  code: string; name: string; category: "standard" | "zero_rated" | "exempt" | "out_of_scope"; rate: string;
}) {
  const db = await getDb(); if (!db) throw new Error("Database not available");
  const code = data.code.trim().toUpperCase();
  const name = data.name.trim();
  if (!code || !name) throw new Error("Tax code and name are required");
  const rate = normalizeTaxCodeRate(data.category, data.rate);
  const result = await db.insert(taxCodes).values({ ...data, code, name, rate, isActive: true });
  return { id: Number(result[0].insertId) };
}

export async function listCustomers() {
  const db = await getDb(); if (!db) return [];
  return db.select().from(customers).where(eq(customers.isActive, true)).orderBy(asc(customers.name));
}

export async function createCustomer(data: {
  code?: string; name: string; customerType?: "individual" | "business"; vatNumber?: string;
  commercialRegistrationNumber?: string; addressLine1?: string; city?: string; countryCode?: string;
  email?: string; phone?: string;
}) {
  const db = await getDb(); if (!db) throw new Error("Database not available");
  const result = await db.insert(customers).values({ ...data, customerType: data.customerType ?? "individual", isActive: true });
  return { id: Number(result[0].insertId) };
}

export async function getNextSalesInvoiceNumber() {
  const db = await getDb(); if (!db) return "INV-000001";
  const result = await db.select({ count: sql<number>`COUNT(*)` }).from(salesInvoices);
  return `INV-${String((result[0]?.count || 0) + 1).padStart(6, "0")}`;
}

export function calculateSalesInvoiceSourceTotals(lines: Array<{
  quantity: string | number; unitPrice: string | number; discountAmount?: string | number | null;
  taxRate: string | number; taxAmount: string | number;
}>) {
  return lines.reduce((totals, line) => {
    const quantity = Number(line.quantity);
    const unitPrice = Number(line.unitPrice);
    const discountAmount = Number(line.discountAmount ?? 0);
    const taxRate = Number(line.taxRate);
    const taxAmount = Number(line.taxAmount);
    if (!Number.isFinite(quantity) || !Number.isFinite(unitPrice) || !Number.isFinite(discountAmount) || !Number.isFinite(taxRate) || !Number.isFinite(taxAmount) || taxRate < 0 || taxAmount < 0) {
      throw new Error("Order line tax data is invalid for invoicing");
    }
    const netAmount = quantity * unitPrice - discountAmount;
    if (netAmount < 0) throw new Error("Order line discount exceeds its subtotal");
    return {
      subtotalAmount: totals.subtotalAmount + quantity * unitPrice,
      discountAmount: totals.discountAmount + discountAmount,
      taxAmount: totals.taxAmount + taxAmount,
      totalAmount: totals.totalAmount + netAmount + taxAmount,
    };
  }, { subtotalAmount: 0, discountAmount: 0, taxAmount: 0, totalAmount: 0 });
}

export type SalesInvoiceIssueInput = { orderId: number; branchId: number; customerId?: number; invoiceType: "simplified" | "tax"; createdBy?: number };
export type SalesInvoiceOrderRecord = { id: number; status: string; branchId: number; taxAmount: string | number; totalAmount: string | number };
export type SalesInvoiceSourceLine = { productId: number; quantity: string | number; unitPrice: string | number; discountAmount?: string | number | null; taxCodeId?: number | null; taxRate: string | number; taxAmount: string | number };
export type SalesInvoiceIssuePort = {
  getCompanyProfile: () => Promise<{ legalName: string; vatNumber: string | null; currencyCode: string } | undefined>;
  getOrder: (orderId: number) => Promise<SalesInvoiceOrderRecord | undefined>;
  hasExistingInvoice: (orderId: number) => Promise<boolean>;
  listOrderLines: (orderId: number) => Promise<SalesInvoiceSourceLine[]>;
  getProducts: (productIds: number[]) => Promise<Array<{ id: number; name: string }>>;
  createInvoice: (invoice: Record<string, unknown>) => Promise<number>;
  createInvoiceLines: (lines: Array<Record<string, unknown>>) => Promise<void>;
  queueZatcaSubmission: (invoiceId: number) => Promise<void>;
};

export async function runSalesInvoiceIssuance(data: SalesInvoiceIssueInput, port: SalesInvoiceIssuePort) {
  const profile = await port.getCompanyProfile();
  if (!profile) throw new Error("Company profile must be configured before issuing invoices");
  const order = await port.getOrder(data.orderId);
  if (!order || order.status !== "paid") throw new Error("A sales invoice can only be issued for a paid order");
  if (order.branchId !== data.branchId) throw new Error("Invoice branch must match the order branch");
  if (await port.hasExistingInvoice(data.orderId)) throw new Error("A sales invoice already exists for this order");
  const lines = await port.listOrderLines(data.orderId);
  if (lines.length === 0) throw new Error("Order has no lines");
  const productRows = await port.getProducts(Array.from(new Set(lines.map((line) => line.productId))));
  const productsById = new Map(productRows.map((product) => [product.id, product]));
  const invoiceNumber = `INV-${String(order.id).padStart(8, "0")}`;
  const invoiceUuid = randomUUID();
  const invoiceLines = lines.map((line) => {
    const product = productsById.get(line.productId);
    const quantity = Number(line.quantity); const unitPrice = Number(line.unitPrice); const discountAmount = Number(line.discountAmount ?? 0); const taxRate = Number(line.taxRate); const taxAmount = Number(line.taxAmount);
    if (!Number.isFinite(quantity) || !Number.isFinite(unitPrice) || !Number.isFinite(discountAmount) || !Number.isFinite(taxRate) || !Number.isFinite(taxAmount) || taxRate < 0 || taxAmount < 0) throw new Error("Order line tax data is invalid for invoicing");
    const netAmount = quantity * unitPrice - discountAmount;
    if (netAmount < 0) throw new Error("Order line discount exceeds its subtotal");
    return { productId: line.productId, description: product?.name ?? `Product #${line.productId}`, quantity: String(quantity), unitPrice: unitPrice.toFixed(2), discountAmount: discountAmount.toFixed(2), taxCodeId: line.taxCodeId, taxRate: taxRate.toFixed(2), taxAmount: taxAmount.toFixed(2), lineTotal: (netAmount + taxAmount).toFixed(2) };
  });
  const { subtotalAmount, discountAmount, taxAmount, totalAmount } = calculateSalesInvoiceSourceTotals(lines);
  if (Math.abs(taxAmount - Number(order.taxAmount)) > 0.005 || Math.abs(totalAmount - Number(order.totalAmount)) > 0.005) throw new Error("Order tax totals do not match stored invoice source data");
  const issueDate = new Date();
  const qrPayload = buildZatcaPhaseOneQrPayload({ sellerName: profile.legalName, vatNumber: profile.vatNumber || "", issueDate, totalAmount: totalAmount.toFixed(2), taxAmount: taxAmount.toFixed(2) });
  const canonicalPayload = JSON.stringify({ invoiceUuid, invoiceNumber, orderId: data.orderId, issueDate: issueDate.toISOString(), totalAmount: totalAmount.toFixed(2) });
  const invoiceHash = createHash("sha256").update(canonicalPayload).digest("hex");
  const id = await port.createInvoice({ invoiceUuid, invoiceNumber, orderId: data.orderId, branchId: data.branchId, customerId: data.customerId, invoiceType: data.invoiceType, status: "issued", issueDate, currencyCode: profile.currencyCode, subtotalAmount: subtotalAmount.toFixed(2), discountAmount: discountAmount.toFixed(2), taxAmount: taxAmount.toFixed(2), totalAmount: totalAmount.toFixed(2), invoiceHash, qrPayload, complianceStatus: "not_submitted", createdBy: data.createdBy });
  await port.createInvoiceLines(invoiceLines.map((line) => ({ ...line, invoiceId: id })));
  await port.queueZatcaSubmission(id);
  const issued = { id, invoiceNumber, invoiceUuid, totalAmount: totalAmount.toFixed(2) };
  return issued;
}

export async function issueSalesInvoiceFromOrder(data: SalesInvoiceIssueInput, testPort?: SalesInvoiceIssuePort) {
  if (testPort) return runSalesInvoiceIssuance(data, testPort);
  const db = await getDb(); if (!db) throw new Error("Database not available");
  const profile = await getCompanyProfile();
  if (!profile) throw new Error("Company profile must be configured before issuing invoices");
  const issued = await db.transaction(async (tx) => runSalesInvoiceIssuance(data, {
    getCompanyProfile: async () => profile,
    getOrder: async (orderId) => (await tx.select().from(orders).where(eq(orders.id, orderId)).limit(1))[0],
    hasExistingInvoice: async (orderId) => Boolean((await tx.select({ id: salesInvoices.id }).from(salesInvoices).where(eq(salesInvoices.orderId, orderId)).limit(1))[0]),
    listOrderLines: async (orderId) => tx.select().from(orderLines).where(eq(orderLines.orderId, orderId)),
    getProducts: async (productIds) => tx.select().from(products).where(inArray(products.id, productIds)),
    createInvoice: async (invoice) => Number((await tx.insert(salesInvoices).values(invoice as any))[0].insertId),
    createInvoiceLines: async (lines) => { await tx.insert(salesInvoiceLines).values(lines as any); },
    queueZatcaSubmission: async () => undefined,
  }));
  await queueZatcaSubmission(issued.id);
  return issued;
}

export async function listSalesInvoices(limit = 50) {
  const db = await getDb(); if (!db) return [];
  return db.select().from(salesInvoices).orderBy(desc(salesInvoices.createdAt)).limit(limit);
}

export function calculateVatSummaryFromDocuments(startDate: Date, endDate: Date, outputRows: Array<{ subtotal: string | number | null; tax: string | number | null }>, inputRows: Array<{ subtotal: string | number | null; tax: string | number | null }>) {
  const outputTax = outputRows.reduce((sum, row) => sum + Number(row.tax || 0), 0);
  const outputTaxableSales = outputRows.reduce((sum, row) => sum + Number(row.subtotal || 0), 0);
  const inputTax = inputRows.reduce((sum, row) => sum + Number(row.tax || 0), 0);
  const inputPurchasesGross = inputRows.reduce((sum, row) => sum + Number(row.subtotal || 0), 0);
  return {
    startDate, endDate,
    outputTaxableSales: outputTaxableSales.toFixed(2), outputTax: outputTax.toFixed(2),
    inputPurchasesGross: inputPurchasesGross.toFixed(2), inputTax: inputTax.toFixed(2),
    netVatPayable: (outputTax - inputTax).toFixed(2),
  };
}

export async function getVatSummary(startDate: Date, endDate: Date) {
  const db = await getDb(); if (!db) throw new Error("Database not available");
  const outputRows = await db.select({ subtotal: salesInvoices.subtotalAmount, tax: salesInvoices.taxAmount })
    .from(salesInvoices).where(and(eq(salesInvoices.status, "issued"), gte(salesInvoices.issueDate, startDate), lte(salesInvoices.issueDate, endDate)));
  const inputRows = await db.select({ subtotal: purchaseInvoices.totalAmount, tax: purchaseInvoices.tax })
    .from(purchaseInvoices).where(and(eq(purchaseInvoices.status, "accounts_approved"), gte(purchaseInvoices.invoiceDate, startDate), lte(purchaseInvoices.invoiceDate, endDate)));
  return calculateVatSummaryFromDocuments(startDate, endDate, outputRows, inputRows);
}

export function calculateVatLedgerReconciliation(summary: { outputTax: string | number; inputTax: string | number }, input: { refundOutputTax: string | number; outputVatAccountId: number; inputVatAccountId: number; ledgerLines: Array<{ accountId: number; debit: string | number | null; credit: string | number | null }> }) {
  const refundOutputTax = Number(input.refundOutputTax || 0);
  const outputTaxLedger = input.ledgerLines.filter((line) => line.accountId === input.outputVatAccountId).reduce((sum, line) => sum + Number(line.credit || 0) - Number(line.debit || 0), 0);
  const inputTaxLedger = input.ledgerLines.filter((line) => line.accountId === input.inputVatAccountId).reduce((sum, line) => sum + Number(line.debit || 0) - Number(line.credit || 0), 0);
  const documentOutputTax = Number(summary.outputTax) - refundOutputTax;
  const documentInputTax = Number(summary.inputTax);
  const outputDifference = documentOutputTax - outputTaxLedger;
  const inputDifference = documentInputTax - inputTaxLedger;
  const netDocumentVat = documentOutputTax - documentInputTax;
  const netLedgerVat = outputTaxLedger - inputTaxLedger;
  return { refundOutputTax: refundOutputTax.toFixed(2), documentOutputTax: documentOutputTax.toFixed(2), documentInputTax: documentInputTax.toFixed(2), netDocumentVat: netDocumentVat.toFixed(2), outputTaxLedger: outputTaxLedger.toFixed(2), inputTaxLedger: inputTaxLedger.toFixed(2), netLedgerVat: netLedgerVat.toFixed(2), outputDifference: outputDifference.toFixed(2), inputDifference: inputDifference.toFixed(2), netDifference: (netDocumentVat - netLedgerVat).toFixed(2), matched: Math.abs(outputDifference) < 0.01 && Math.abs(inputDifference) < 0.01 };
}

export async function getVatLedgerReconciliation(startDate: Date, endDate: Date) {
  const summary = await getVatSummary(startDate, endDate);
  const map = await getPosPostingAccountMap();
  if (!map) return { ...summary, configured: false as const, message: "Configure the POS posting account map before ledger reconciliation" };
  const db = await getDb(); if (!db) throw new Error("Database not available");
  const completedRefunds = await db.select({ orderId: posRefunds.orderId }).from(posRefunds)
    .where(and(eq(posRefunds.status, "completed"), gte(posRefunds.completedAt, startDate), lte(posRefunds.completedAt, endDate)));
  const refundedOrderIds = completedRefunds.map((refund) => refund.orderId);
  const refundedOrders = refundedOrderIds.length
    ? await db.select({ taxAmount: orders.taxAmount }).from(orders).where(inArray(orders.id, refundedOrderIds))
    : [];
  const refundOutputTax = refundedOrders.reduce((sum, order) => sum + Number(order.taxAmount || 0), 0);
  const ledgerLines = await db.select({ accountId: journalEntryLines.accountId, debit: journalEntryLines.debit, credit: journalEntryLines.credit })
    .from(journalEntryLines).innerJoin(journalEntries, eq(journalEntryLines.journalEntryId, journalEntries.id))
    .where(and(eq(journalEntries.status, "posted"), gte(journalEntries.date, startDate), lte(journalEntries.date, endDate)));
  const reconciliation = calculateVatLedgerReconciliation(summary, { refundOutputTax, outputVatAccountId: map.outputVatAccountId, inputVatAccountId: map.inputVatAccountId, ledgerLines });
  return {
    ...summary,
    configured: true as const,
    ...reconciliation,
  };
}

// ============ ZATCA / FATOORA ==========
export async function getZatcaConnection(companyProfileId: number, environment?: "sandbox" | "production") {
  const db = await getDb(); if (!db) return null;
  const conditions = [eq(zatcaConnections.companyProfileId, companyProfileId)];
  if (environment) conditions.push(eq(zatcaConnections.environment, environment));
  const result = await db.select().from(zatcaConnections).where(and(...conditions)).orderBy(desc(zatcaConnections.updatedAt)).limit(1);
  return result[0] ?? null;
}

export async function getZatcaReadiness() {
  const profile = await getCompanyProfile();
  if (!profile) return { ready: false, environment: "sandbox" as const, issues: ["company_profile_missing"], connection: undefined };
  const environment = profile.eInvoicingMode === "production" ? "production" as const : "sandbox" as const;
  const connection = await getZatcaConnection(profile.id, environment);
  const issues = getZatcaReadinessIssues({
    legalName: profile.legalName,
    vatNumber: profile.vatNumber,
    isVatRegistered: profile.isVatRegistered,
    eInvoicingMode: profile.eInvoicingMode,
    connectionStatus: connection?.status,
  });
  return { ready: issues.length === 0, environment, issues, connection };
}

export async function saveZatcaConnection(data: {
  companyProfileId: number;
  environment: "sandbox" | "production";
  status?: "not_configured" | "ready" | "testing" | "active" | "error" | "suspended";
  credentialReference?: string | null;
  csidReference?: string | null;
  lastVerifiedAt?: Date | null;
  lastError?: string | null;
  createdBy?: number;
}) {
  const db = await getDb(); if (!db) throw new Error("Database not available");
  const existing = await getZatcaConnection(data.companyProfileId, data.environment);
  if (existing) {
    await db.update(zatcaConnections).set({
      status: data.status ?? existing.status,
      credentialReference: data.credentialReference === undefined ? existing.credentialReference : data.credentialReference,
      csidReference: data.csidReference === undefined ? existing.csidReference : data.csidReference,
      lastVerifiedAt: data.lastVerifiedAt === undefined ? existing.lastVerifiedAt : data.lastVerifiedAt,
      lastError: data.lastError === undefined ? existing.lastError : data.lastError,
    }).where(eq(zatcaConnections.id, existing.id));
    return getZatcaConnection(data.companyProfileId, data.environment);
  }
  await db.insert(zatcaConnections).values({
    companyProfileId: data.companyProfileId,
    environment: data.environment,
    status: data.status ?? "not_configured",
    credentialReference: data.credentialReference ?? null,
    csidReference: data.csidReference ?? null,
    lastVerifiedAt: data.lastVerifiedAt ?? null,
    lastError: data.lastError ?? null,
    createdBy: data.createdBy ?? null,
  });
  return getZatcaConnection(data.companyProfileId, data.environment);
}

export async function queueZatcaSubmission(salesInvoiceId: number) {
  const db = await getDb(); if (!db) throw new Error("Database not available");
  const rows = await db.select().from(salesInvoices).where(eq(salesInvoices.id, salesInvoiceId)).limit(1);
  const invoice = rows[0];
  if (!invoice) throw new Error("Sales invoice not found");
  if (invoice.status !== "issued") throw new Error("Only issued invoices can be queued for ZATCA");
  const pending = await db.select().from(zatcaSubmissionAttempts).where(and(
    eq(zatcaSubmissionAttempts.salesInvoiceId, salesInvoiceId),
    eq(zatcaSubmissionAttempts.status, "queued"),
  )).limit(1);
  if (pending[0]) return pending[0];
  const attempts = await db.select({ id: zatcaSubmissionAttempts.id }).from(zatcaSubmissionAttempts).where(eq(zatcaSubmissionAttempts.salesInvoiceId, salesInvoiceId));
  const submissionType = getZatcaSubmissionType(invoice.invoiceType);
  const result = await db.insert(zatcaSubmissionAttempts).values({
    salesInvoiceId,
    submissionType,
    status: "queued",
    attemptNumber: attempts.length + 1,
  });
  await db.update(salesInvoices).set({ complianceStatus: "pending" }).where(eq(salesInvoices.id, salesInvoiceId));
  const created = await db.select().from(zatcaSubmissionAttempts).where(eq(zatcaSubmissionAttempts.id, Number(result[0].insertId))).limit(1);
  return created[0];
}

export async function listZatcaSubmissionAttempts(salesInvoiceId?: number, limit = 50) {
  const db = await getDb(); if (!db) return [];
  if (salesInvoiceId) {
    return db.select().from(zatcaSubmissionAttempts).where(eq(zatcaSubmissionAttempts.salesInvoiceId, salesInvoiceId)).orderBy(desc(zatcaSubmissionAttempts.createdAt)).limit(limit);
  }
  return db.select().from(zatcaSubmissionAttempts).orderBy(desc(zatcaSubmissionAttempts.createdAt)).limit(limit);
}

// ============ NOTIFICATIONS ============
export async function listNotifications(limit = 50) {
  const db = await getDb(); if (!db) return [];
  return db.select().from(notifications).orderBy(desc(notifications.createdAt)).limit(limit);
}
export async function createNotification(data: { type: string; title: string; content?: string; entityType?: string; entityId?: number }) {
  const db = await getDb(); if (!db) throw new Error("Database not available");
  await db.insert(notifications).values(data);
}
export async function markNotificationRead(id: number) {
  const db = await getDb(); if (!db) throw new Error("Database not available");
  await db.update(notifications).set({ isRead: true }).where(eq(notifications.id, id));
}

// ============ DASHBOARD STATS ============
export async function getDashboardStats() {
  const db = await getDb();
  if (!db) return { totalAccounts: 0, totalBranches: 0, totalCostCenters: 0, totalEntries: 0, totalProducts: 0, totalOrders: 0, totalEmployees: 0, todaySales: "0" };
  const [accountsCount] = await db.select({ count: sql<number>`COUNT(*)` }).from(accounts);
  const [branchesCount] = await db.select({ count: sql<number>`COUNT(*)` }).from(branches).where(eq(branches.isActive, true));
  const [centersCount] = await db.select({ count: sql<number>`COUNT(*)` }).from(costCenters).where(eq(costCenters.isActive, true));
  const [entriesCount] = await db.select({ count: sql<number>`COUNT(*)` }).from(journalEntries);
  const [productsCount] = await db.select({ count: sql<number>`COUNT(*)` }).from(products);
  const [ordersCount] = await db.select({ count: sql<number>`COUNT(*)` }).from(orders);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const [todaySalesResult] = await db.select({ total: sql<string>`COALESCE(SUM(totalAmount), 0)` }).from(orders).where(gte(orders.createdAt, today));
  return {
    totalAccounts: accountsCount?.count || 0,
    totalBranches: branchesCount?.count || 0,
    totalCostCenters: centersCount?.count || 0,
    totalEntries: entriesCount?.count || 0,
    totalProducts: productsCount?.count || 0,
    totalOrders: ordersCount?.count || 0,
    todaySales: todaySalesResult?.total || "0",
  };
}

export async function getAdminDashboardOverview() {
  const db = await getDb();
  if (!db) return {
    stats: await getDashboardStats(),
    system: { totalUsers: 0, openPosSessions: 0, unreadNotifications: 0, draftJournalEntries: 0 },
    recentActivity: [],
  };
  const [stats, usersCount, openSessions, unreadNotifications, draftEntries, recentActivity] = await Promise.all([
    getDashboardStats(),
    db.select({ count: sql<number>`COUNT(*)` }).from(users),
    db.select({ count: sql<number>`COUNT(*)` }).from(posSessions).where(eq(posSessions.status, "open")),
    db.select({ count: sql<number>`COUNT(*)` }).from(notifications).where(eq(notifications.isRead, false)),
    db.select({ count: sql<number>`COUNT(*)` }).from(journalEntries).where(eq(journalEntries.status, "draft")),
    listAuditLog(8),
  ]);
  return {
    stats,
    system: {
      totalUsers: usersCount[0]?.count || 0,
      openPosSessions: openSessions[0]?.count || 0,
      unreadNotifications: unreadNotifications[0]?.count || 0,
      draftJournalEntries: draftEntries[0]?.count || 0,
    },
    recentActivity,
  };
}

// ============ REPORTS ============
export async function getSalesReport(startDate: Date, endDate: Date, branchId?: number) {
  const db = await getDb(); if (!db) return [];
  const conditions = [gte(orders.createdAt, startDate), lte(orders.createdAt, endDate)];
  if (branchId) conditions.push(eq(orders.branchId, branchId));
  return db.select({
    date: sql<string>`DATE(createdAt)`,
    totalSales: sql<string>`SUM(totalAmount)`,
    totalOrders: sql<number>`COUNT(*)`,
    avgOrderValue: sql<string>`AVG(totalAmount)`,
  }).from(orders).where(and(...conditions)).groupBy(sql`DATE(createdAt)`).orderBy(sql`DATE(createdAt)`);
}

export async function getProfitabilityReport(startDate: Date, endDate: Date) {
  const db = await getDb(); if (!db) return [];
  return db.select({
    branchId: orders.branchId,
    totalRevenue: sql<string>`SUM(totalAmount)`,
    totalCost: sql<string>`SUM(subtotal * 0.6)`,
    orderCount: sql<number>`COUNT(*)`,
  }).from(orders).where(and(gte(orders.createdAt, startDate), lte(orders.createdAt, endDate))).groupBy(orders.branchId);
}

export async function getProductionReport(startDate: Date, endDate: Date) {
  const db = await getDb(); if (!db) return [];
  return db.select().from(productionOrders).where(and(gte(productionOrders.createdAt, startDate), lte(productionOrders.createdAt, endDate))).orderBy(desc(productionOrders.createdAt));
}

export type InventoryReportBalance = { productId: number; warehouseId: number; quantity: string | number; avgCost: string | number; productName?: string; warehouseName?: string; reorderLevel?: string | number | null };
export type InventoryReportMovement = { productId: number; warehouseId: number; type: StockMovementInput["type"]; quantity: string | number; createdAt: Date };
export type InventoryReportPort = {
  listBalances: () => Promise<InventoryReportBalance[]>;
  listMovementsThrough: (endDate: Date) => Promise<InventoryReportMovement[]>;
};
let inventoryReportPortForTesting: InventoryReportPort | undefined;
export function setInventoryReportPortForTesting(port?: InventoryReportPort) {
  inventoryReportPortForTesting = port;
}

export function calculateInventoryMovementReport(balances: InventoryReportBalance[], movements: InventoryReportMovement[], startDate: Date, endDate: Date) {
  const incomingTypes = new Set<StockMovementInput["type"]>(["purchase", "transfer_in", "production_in", "return"]);
  const keyOf = (productId: number, warehouseId: number) => `${productId}:${warehouseId}`;
  const movementTotals = new Map<string, { totalNet: number; beforeNet: number; inbound: number; outbound: number }>();
  for (const movement of movements) {
    const key = keyOf(movement.productId, movement.warehouseId);
    const totals = movementTotals.get(key) ?? { totalNet: 0, beforeNet: 0, inbound: 0, outbound: 0 };
    const quantity = Math.abs(Number(movement.quantity));
    if (!Number.isFinite(quantity)) continue;
    const net = incomingTypes.has(movement.type) || (movement.type === "adjustment" && Number(movement.quantity) > 0) ? quantity : -quantity;
    totals.totalNet += net;
    if (movement.createdAt < startDate) totals.beforeNet += net;
    else if (movement.createdAt <= endDate) {
      if (net >= 0) totals.inbound += net;
      else totals.outbound += Math.abs(net);
    }
    movementTotals.set(key, totals);
  }
  return balances.map((balance) => {
    const quantity = Number(balance.quantity) || 0;
    const avgCost = Number(balance.avgCost) || 0;
    const totals = movementTotals.get(keyOf(balance.productId, balance.warehouseId)) ?? { totalNet: 0, beforeNet: 0, inbound: 0, outbound: 0 };
    const openingQuantity = quantity - totals.totalNet + totals.beforeNet;
    const closingQuantity = openingQuantity + totals.inbound - totals.outbound;
    return { ...balance, openingQuantity: openingQuantity.toFixed(4), inboundQuantity: totals.inbound.toFixed(4), outboundQuantity: totals.outbound.toFixed(4), closingQuantity: closingQuantity.toFixed(4), avgCost: avgCost.toFixed(4), inventoryValue: (closingQuantity * avgCost).toFixed(2) };
  });
}

export async function runInventoryReport(period: { startDate?: Date; endDate?: Date } | undefined, port: InventoryReportPort) {
  const endDate = period?.endDate ?? new Date();
  const startDate = period?.startDate ?? new Date(endDate.getFullYear(), endDate.getMonth(), 1);
  if (startDate > endDate) throw new Error("Inventory report start date must not be after end date");
  const balances = await port.listBalances();
  const movements = await port.listMovementsThrough(endDate);
  return calculateInventoryMovementReport(balances, movements, startDate, endDate);
}

export async function getInventoryReport(period?: { startDate?: Date; endDate?: Date }, testPort?: InventoryReportPort) {
  const port = testPort || inventoryReportPortForTesting;
  if (port) return runInventoryReport(period, port);
  const db = await getDb(); if (!db) return [];
  return runInventoryReport(period, {
    listBalances: async () => db.select({ productId: stock.productId, productName: products.name, warehouseId: stock.warehouseId, warehouseName: warehouses.name, reorderLevel: products.reorderLevel, quantity: sql<string>`COALESCE(${stock.quantity}, 0)`, avgCost: sql<string>`COALESCE(${stock.avgCost}, 0)` })
      .from(stock).innerJoin(products, eq(stock.productId, products.id)).innerJoin(warehouses, eq(stock.warehouseId, warehouses.id)),
    listMovementsThrough: async (endDate) => db.select({ productId: stockMovements.productId, warehouseId: stockMovements.warehouseId, type: stockMovements.type, quantity: stockMovements.quantity, createdAt: stockMovements.createdAt })
      .from(stockMovements).where(lte(stockMovements.createdAt, endDate)),
  });
}
