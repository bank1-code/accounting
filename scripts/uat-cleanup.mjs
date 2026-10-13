import mysql from "mysql2/promise";

const UAT_CODE = "UAT-ONLY-20260825";
const confirmed = process.argv.includes("--confirm-delete-uat");
const pool = await mysql.createPool(process.env.DATABASE_URL);
const connection = await pool.getConnection();

const dependentDeletes = [
  ["journal_entry_lines", "journalEntryId", "journal_entries"],
  ["voucher_lines", "voucherId", "vouchers"],
  ["order_payment_allocations", "orderId", "orders"],
  ["order_lines", "orderId", "orders"],
  ["sales_invoice_lines", "invoiceId", "sales_invoices"],
  ["purchase_invoice_lines", "invoiceId", "purchase_invoices"],
  ["production_order_lines", "productionOrderId", "production_orders"],
  ["inventory_count_lines", "inventoryCountId", "inventory_counts"],
  ["cost_allocation_lines", "costAllocationId", "cost_allocations"],
  ["recipe_lines", "recipeId", "recipes"],
  ["waste_voucher_lines", "voucherId", "waste_vouchers"],
  ["kitchen_orders", "orderId", "orders"],
  ["pos_refunds", "orderId", "orders"],
  ["product_addons", "parentProductId", "products"],
  ["stock_movements", "productId", "products"],
  ["inventory_batches", "productId", "products"],
  ["stock", "productId", "products"],
];
const rootDeleteOrder = ["journal_entries", "vouchers", "waste_vouchers", "orders", "sales_invoices", "purchase_invoices", "production_orders", "inventory_counts", "cost_allocations", "recipes", "pos_sessions", "restaurant_tables", "products", "customers", "suppliers", "cost_centers", "warehouses", "branches", "tax_codes", "units", "categories", "accounts", "fiscal_periods", "company_profiles", "system_settings"];

try {
  const [[run]] = await connection.execute("SELECT id, status FROM uat_runs WHERE code = ? LIMIT 1", [UAT_CODE]);
  if (!run) throw new Error("UAT run was not found");
  const [entities] = await connection.execute("SELECT tableName, entityId FROM uat_entity_registry WHERE uatRunId = ? ORDER BY tableName, entityId", [run.id]);
  const idsByTable = new Map();
  for (const entity of entities) idsByTable.set(entity.tableName, [...(idsByTable.get(entity.tableName) || []), Number(entity.entityId)]);
  const plan = Array.from(idsByTable.entries()).map(([tableName, ids]) => ({ tableName, count: ids.length, entityIds: ids }));
  if (!confirmed) {
    console.log(JSON.stringify({ mode: "dry-run", run: UAT_CODE, status: run.status, trackedEntities: entities.length, deletionPlan: plan, instruction: "Run only after explicit approval: node scripts/uat-cleanup.mjs --confirm-delete-uat" }, null, 2));
    process.exit(0);
  }
  await connection.beginTransaction();
  for (const [childTable, fkColumn, parentTable] of dependentDeletes) {
    const ids = idsByTable.get(parentTable) || [];
    if (ids.length) await connection.query(`DELETE FROM \`${childTable}\` WHERE \`${fkColumn}\` IN (${ids.map(() => "?").join(",")})`, ids);
  }
  for (const tableName of rootDeleteOrder) {
    const ids = idsByTable.get(tableName) || [];
    if (ids.length) await connection.query(`DELETE FROM \`${tableName}\` WHERE id IN (${ids.map(() => "?").join(",")})`, ids);
  }
  await connection.execute("DELETE FROM uat_entity_registry WHERE uatRunId = ?", [run.id]);
  await connection.execute("UPDATE uat_runs SET status = 'cleaned', completedAt = NOW(), notes = CONCAT(COALESCE(notes, ''), '\nUAT cleanup executed with explicit confirmation.') WHERE id = ?", [run.id]);
  await connection.commit();
  console.log(JSON.stringify({ mode: "deleted", run: UAT_CODE, deletedTrackedEntities: entities.length }, null, 2));
} catch (error) {
  await connection.rollback();
  throw error;
} finally {
  connection.release();
  await pool.end();
}
