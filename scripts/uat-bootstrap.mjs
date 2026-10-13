import mysql from "mysql2/promise";

const UAT_CODE = "UAT-ONLY-20260825";
const PREFIX = "UAT-ONLY";
const SCENARIO_VERSION = "1.0.0";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required for the approved UAT bootstrap");

const pool = await mysql.createPool(process.env.DATABASE_URL);
const connection = await pool.getConnection();

const trackedTables = [
  "branches", "cost_centers", "accounts", "tax_codes", "categories", "units", "warehouses", "products",
  "suppliers", "customers", "fiscal_periods", "restaurant_tables", "company_profiles", "system_settings",
];

async function scalar(sql, params = []) {
  const [rows] = await connection.execute(sql, params);
  return Number(rows[0]?.count ?? rows[0]?.value ?? 0);
}

async function insertTracked(runId, tableName, sql, params) {
  const [result] = await connection.execute(sql, params);
  const entityId = Number(result.insertId);
  if (!entityId) throw new Error(`No insert id returned for ${tableName}`);
  await connection.execute(
    "INSERT INTO uat_entity_registry (uatRunId, tableName, entityId) VALUES (?, ?, ?)",
    [runId, tableName, entityId],
  );
  return entityId;
}

try {
  await connection.beginTransaction();
  const activeUat = await scalar("SELECT COUNT(*) AS count FROM uat_runs WHERE status IN ('active', 'completed', 'cleanup_pending')");
  if (activeUat > 0) throw new Error("An UAT run already exists; complete or clean it before creating another one");
  const existingPostingMap = await scalar("SELECT COUNT(*) AS count FROM system_settings WHERE settingKey = 'accounting.pos_posting_map.v1'");
  if (existingPostingMap > 0) throw new Error("An operational POS posting map already exists; UAT bootstrap is blocked to avoid overwriting settings");

  const baseline = {};
  for (const table of trackedTables) {
    baseline[table] = await scalar(`SELECT COUNT(*) AS count FROM \`${table}\``);
  }
  const operationalTables = ["branches", "products", "purchase_invoices", "orders", "journal_entries", "vouchers", "fiscal_periods"];
  const nonEmptyOperationalTables = operationalTables.filter((table) => Number(baseline[table]) > 0);
  if (nonEmptyOperationalTables.length > 0) {
    throw new Error(`Operational rows exist in ${nonEmptyOperationalTables.join(", ")}; UAT bootstrap is blocked to avoid mixing test and operating data`);
  }

  const [adminRows] = await connection.execute("SELECT id FROM users WHERE username = ? LIMIT 1", ["admina"]);
  const adminId = Number(adminRows[0]?.id);
  if (!adminId) throw new Error("Local owner admina was not found");

  const [runResult] = await connection.execute(
    "INSERT INTO uat_runs (code, status, baselineSnapshot, scenarioVersion, notes, createdBy) VALUES (?, 'active', ?, ?, ?, ?)",
    [UAT_CODE, JSON.stringify(baseline), SCENARIO_VERSION, "Approved UAT-only reference data. Delete through the registered entity manifest after acceptance.", adminId],
  );
  const runId = Number(runResult.insertId);

  const branchId = await insertTracked(runId, "branches", "INSERT INTO branches (name, nameEn, type, address, phone, isActive) VALUES (?, ?, 'restaurant', ?, ?, true)", [`${PREFIX} فرع المطعم`, `${PREFIX} Restaurant Branch`, `${PREFIX} بيئة اختبار`, "0000000000"]);
  const profitCenterId = await insertTracked(runId, "cost_centers", "INSERT INTO cost_centers (name, code, branchId, type, isActive) VALUES (?, ?, ?, 'profit', true)", [`${PREFIX} مركز ربح`, `${PREFIX}-PROFIT`, branchId]);
  const costCenterId = await insertTracked(runId, "cost_centers", "INSERT INTO cost_centers (name, code, branchId, type, isActive) VALUES (?, ?, ?, 'cost', true)", [`${PREFIX} مركز تكلفة`, `${PREFIX}-COST`, branchId]);

  const accountDefinitions = [
    ["UAT-1100", `${PREFIX} نقدية`, "asset"], ["UAT-1110", `${PREFIX} بنك`, "asset"], ["UAT-1200", `${PREFIX} مخزون مواد`, "asset"], ["UAT-1210", `${PREFIX} إنتاج تحت التشغيل`, "asset"], ["UAT-1220", `${PREFIX} مخزون تام`, "asset"], ["UAT-1300", `${PREFIX} ضريبة مدخلات`, "asset"],
    ["UAT-2000", `${PREFIX} موردون`, "liability"], ["UAT-2100", `${PREFIX} ضريبة مخرجات`, "liability"], ["UAT-3000", `${PREFIX} رأس مال`, "equity"],
    ["UAT-4000", `${PREFIX} مبيعات`, "revenue"], ["UAT-4010", `${PREFIX} مكاسب مخزون`, "revenue"], ["UAT-5000", `${PREFIX} تكلفة مبيعات`, "expense"], ["UAT-5100", `${PREFIX} مصروف تشغيلي`, "expense"], ["UAT-5200", `${PREFIX} خسائر مخزون`, "expense"], ["UAT-5210", `${PREFIX} هالك`, "expense"],
  ];
  const accountIds = {};
  for (const [code, name, type] of accountDefinitions) {
    accountIds[code] = await insertTracked(runId, "accounts", "INSERT INTO accounts (code, name, nameEn, type, level, isActive, isSystem, balance) VALUES (?, ?, ?, ?, 1, true, false, 0)", [code, name, code, type]);
  }

  const taxCodeId = await insertTracked(runId, "tax_codes", "INSERT INTO tax_codes (code, name, category, rate, isActive) VALUES (?, ?, 'standard', 15.00, true)", [`${PREFIX}-VAT15`, `${PREFIX} VAT 15%`]);
  const rawCategoryId = await insertTracked(runId, "categories", "INSERT INTO categories (name, type, isActive, sortOrder) VALUES (?, 'raw_material', true, 1)", [`${PREFIX} مواد خام`]);
  const finishedCategoryId = await insertTracked(runId, "categories", "INSERT INTO categories (name, type, isActive, sortOrder) VALUES (?, 'finished', true, 2)", [`${PREFIX} منتجات تامة`]);
  const unitId = await insertTracked(runId, "units", "INSERT INTO units (name, symbol, conversionFactor) VALUES (?, ?, 1)", [`${PREFIX} وحدة`, "U"]);
  const materialsWarehouseId = await insertTracked(runId, "warehouses", "INSERT INTO warehouses (name, branchId, type, storageCategory, isActive) VALUES (?, ?, 'central', 'ingredients', true)", [`${PREFIX} مخزن مواد`, branchId]);
  const finishedWarehouseId = await insertTracked(runId, "warehouses", "INSERT INTO warehouses (name, branchId, parentWarehouseId, type, storageCategory, isActive) VALUES (?, ?, ?, 'branch', 'finished_goods', true)", [`${PREFIX} مخزن مبيعات`, branchId, materialsWarehouseId]);

  const rawProductId = await insertTracked(runId, "products", "INSERT INTO products (name, nameEn, sku, categoryId, unitId, type, costPrice, salePrice, taxRate, taxCodeId, reorderLevel, trackBatch, trackExpiry, isActive) VALUES (?, ?, ?, ?, ?, 'raw_material', 20.00, 0, 15.00, ?, 5, true, true, true)", [`${PREFIX} دجاج خام`, `${PREFIX} Raw Chicken`, `${PREFIX}-RAW-001`, rawCategoryId, unitId, taxCodeId]);
  const finishedProductId = await insertTracked(runId, "products", "INSERT INTO products (name, nameEn, sku, categoryId, unitId, type, costPrice, salePrice, taxRate, taxCodeId, reorderLevel, trackBatch, trackExpiry, isActive) VALUES (?, ?, ?, ?, ?, 'finished', 30.00, 60.00, 15.00, ?, 3, true, false, true)", [`${PREFIX} وجبة اختبار`, `${PREFIX} Test Meal`, `${PREFIX}-MEAL-001`, finishedCategoryId, unitId, taxCodeId]);
  const drinkProductId = await insertTracked(runId, "products", "INSERT INTO products (name, nameEn, sku, categoryId, unitId, type, costPrice, salePrice, taxRate, taxCodeId, reorderLevel, trackBatch, trackExpiry, isActive) VALUES (?, ?, ?, ?, ?, 'direct_sale', 3.00, 10.00, 15.00, ?, 3, false, false, true)", [`${PREFIX} مشروب`, `${PREFIX} Test Drink`, `${PREFIX}-DRINK-001`, finishedCategoryId, unitId, taxCodeId]);

  const supplierId = await insertTracked(runId, "suppliers", "INSERT INTO suppliers (name, contactPerson, phone, address, taxNumber, isActive, balance) VALUES (?, ?, ?, ?, ?, true, 0)", [`${PREFIX} مورد`, "UAT Contact", "0000000001", "UAT", "300000000000003"]);
  const customerId = await insertTracked(runId, "customers", "INSERT INTO customers (code, name, customerType, vatNumber, city, countryCode, isActive) VALUES (?, ?, 'business', ?, ?, 'SA', true)", [`${PREFIX}-CUST-001`, `${PREFIX} عميل`, "300000000000003", "Riyadh"]);
  await insertTracked(runId, "fiscal_periods", "INSERT INTO fiscal_periods (name, startDate, endDate, isClosed) VALUES (?, ?, ?, false)", [`${PREFIX} السنة المالية 2026`, "2026-01-01 00:00:00", "2026-12-31 23:59:59"]);
  await insertTracked(runId, "restaurant_tables", "INSERT INTO restaurant_tables (name, capacity, status, branchId, sortOrder) VALUES (?, 4, 'available', ?, 1)", [`${PREFIX} طاولة 1`, branchId]);
  await insertTracked(runId, "company_profiles", "INSERT INTO company_profiles (legalName, tradeName, vatNumber, addressLine1, city, postalCode, countryCode, currencyCode, isVatRegistered, eInvoicingMode) VALUES (?, ?, ?, ?, ?, ?, 'SA', 'SAR', true, 'disabled')", [`${PREFIX} منشأة اختبار`, `${PREFIX} UAT`, "300000000000003", "UAT Address", "Riyadh", "00000"]);

  const posMap = { cashAccountId: accountIds["UAT-1100"], cardClearingAccountId: accountIds["UAT-1110"], salesRevenueAccountId: accountIds["UAT-4000"], outputVatAccountId: accountIds["UAT-2100"], inputVatAccountId: accountIds["UAT-1300"], inventoryAccountId: accountIds["UAT-1200"], workInProgressAccountId: accountIds["UAT-1210"], finishedGoodsInventoryAccountId: accountIds["UAT-1220"], inventoryGainAccountId: accountIds["UAT-4010"], inventoryLossAccountId: accountIds["UAT-5200"], wasteExpenseAccountId: accountIds["UAT-5210"], cogsAccountId: accountIds["UAT-5000"], accountsPayableAccountId: accountIds["UAT-2000"] };
  const [settingsResult] = await connection.execute("INSERT INTO system_settings (settingKey, value, settingGroup) VALUES ('accounting.pos_posting_map.v1', ?, 'UAT')", [JSON.stringify(posMap)]);
  await connection.execute("INSERT INTO uat_entity_registry (uatRunId, tableName, entityId) VALUES (?, 'system_settings', ?)", [runId, Number(settingsResult.insertId)]);

  await connection.commit();
  console.log(JSON.stringify({ runId, code: UAT_CODE, adminId, branchId, profitCenterId, costCenterId, taxCodeId, rawProductId, finishedProductId, drinkProductId, supplierId, customerId, materialsWarehouseId, finishedWarehouseId, accountIds }, null, 2));
} catch (error) {
  await connection.rollback();
  console.error(error);
  process.exitCode = 1;
} finally {
  connection.release();
  await pool.end();
}
