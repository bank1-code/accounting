import mysql from "mysql2/promise";
import * as db from "../server/db.ts";

const UAT_CODE = "UAT-ONLY-20260825";
const PREFIX = "UAT-ONLY";
const pool = await mysql.createPool(process.env.DATABASE_URL);
const connection = await pool.getConnection();

async function rows(sql, params = []) {
  const [result] = await connection.execute(sql, params);
  return result;
}

async function scalar(sql, params = []) {
  const result = await rows(sql, params);
  return Number(result[0]?.value ?? result[0]?.count ?? 0);
}

async function track(runId, tableName, entityId) {
  if (!entityId) throw new Error(`Cannot track empty ${tableName} id`);
  await connection.execute("INSERT IGNORE INTO uat_entity_registry (uatRunId, tableName, entityId) VALUES (?, ?, ?)", [runId, tableName, entityId]);
}

async function trackJournalFor(runId, referenceType, referenceId) {
  const found = await rows("SELECT id FROM journal_entries WHERE referenceType = ? AND referenceId = ? ORDER BY id DESC LIMIT 1", [referenceType, referenceId]);
  if (found[0]?.id) await track(runId, "journal_entries", Number(found[0].id));
}

try {
  const runRows = await rows("SELECT id, status FROM uat_runs WHERE code = ? LIMIT 1", [UAT_CODE]);
  const run = runRows[0];
  if (!run || !["active", "failed"].includes(run.status)) throw new Error("Restartable UAT run was not found");
  const runId = Number(run.id);
  if (run.status === "failed") await connection.execute("UPDATE uat_runs SET status = 'active', notes = CONCAT(COALESCE(notes, ''), '\nResuming UAT scenario after controlled correction.') WHERE id = ?", [runId]);

  const [owner] = await rows("SELECT id FROM users WHERE username = 'admina' LIMIT 1");
  const ownerId = Number(owner?.id);
  const lookup = async (table, field, value) => Number((await rows(`SELECT id FROM \`${table}\` WHERE \`${field}\` = ? LIMIT 1`, [value]))[0]?.id);
  const branchId = await lookup("branches", "name", `${PREFIX} فرع المطعم`);
  const profitCenterId = await lookup("cost_centers", "code", `${PREFIX}-PROFIT`);
  const costCenterId = await lookup("cost_centers", "code", `${PREFIX}-COST`);
  const materialsWarehouseId = await lookup("warehouses", "name", `${PREFIX} مخزن مواد`);
  const finishedWarehouseId = await lookup("warehouses", "name", `${PREFIX} مخزن مبيعات`);
  const rawProductId = await lookup("products", "sku", `${PREFIX}-RAW-001`);
  const finishedProductId = await lookup("products", "sku", `${PREFIX}-MEAL-001`);
  const supplierId = await lookup("suppliers", "name", `${PREFIX} مورد`);
  const customerId = await lookup("customers", "code", `${PREFIX}-CUST-001`);
  const accounts = {};
  for (const code of ["UAT-1100", "UAT-1110", "UAT-1200", "UAT-1210", "UAT-1220", "UAT-1300", "UAT-2000", "UAT-2100", "UAT-3000", "UAT-4000", "UAT-4010", "UAT-5000", "UAT-5100", "UAT-5200", "UAT-5210"]) accounts[code] = await lookup("accounts", "code", code);

  const existingOpening = (await rows("SELECT id, status FROM journal_entries WHERE description = ? LIMIT 1", [`${PREFIX} قيد افتتاحي`]))[0];
  const opening = existingOpening ? { id: Number(existingOpening.id) } : await db.createJournalEntry({
    date: new Date("2026-01-01T08:00:00.000Z"), description: `${PREFIX} قيد افتتاحي`, reference: UAT_CODE,
    lines: [
      { accountId: accounts["UAT-1100"], branchId, costCenterId: profitCenterId, debit: "10000.00", credit: "0", description: `${PREFIX} رأس المال النقدي` },
      { accountId: accounts["UAT-3000"], branchId, costCenterId: profitCenterId, debit: "0", credit: "10000.00", description: `${PREFIX} رأس المال` },
    ], createdBy: ownerId,
  });
  if (!existingOpening) await db.postJournalEntry(opening.id, ownerId); await track(runId, "journal_entries", opening.id);

  const existingPurchase = (await rows("SELECT id, status FROM purchase_invoices WHERE invoiceNumber = ? LIMIT 1", [`${PREFIX}-PI-001`]))[0];
  const purchase = existingPurchase ? { id: Number(existingPurchase.id), status: existingPurchase.status } : await db.createPurchaseInvoice({
    invoiceNumber: `${PREFIX}-PI-001`, supplierId, warehouseId: materialsWarehouseId, invoiceDate: new Date("2026-02-01T08:00:00.000Z"), dueDate: new Date("2026-02-28T08:00:00.000Z"), notes: `${PREFIX} شراء مواد مخزنية مع VAT ودفعة`,
    lines: [{ productId: rawProductId, quantity: "100", unitPrice: "20.00", batchNumber: `${PREFIX}-RAW-B1`, expiryDate: new Date("2026-12-31T00:00:00.000Z") }], createdBy: ownerId,
  });
  const purchaseStatus = purchase.status || "draft";
  if (purchaseStatus === "draft") await db.approvePurchaseInvoiceItems(purchase.id, ownerId, `${PREFIX} اعتماد أصناف`);
  if (purchaseStatus === "draft" || purchaseStatus === "items_approved") await db.approvePurchaseInvoiceAccounts(purchase.id, ownerId, `${PREFIX} اعتماد حسابات`);
  await track(runId, "purchase_invoices", purchase.id); await trackJournalFor(runId, "purchase_invoice", purchase.id);

  const existingRecipe = (await rows("SELECT id FROM recipes WHERE name = ? LIMIT 1", [`${PREFIX} وصفة وجبة`]))[0];
  const recipe = existingRecipe ? { id: Number(existingRecipe.id) } : await db.createRecipe({ productId: finishedProductId, name: `${PREFIX} وصفة وجبة`, outputQuantity: "10", yieldPercent: "100", instructions: `${PREFIX} وصفة UAT`, lines: [{ ingredientId: rawProductId, quantity: "2", unitCost: "20.00" }] });
  await track(runId, "recipes", recipe.id);
  const existingProduction = (await rows("SELECT id, status FROM production_orders WHERE notes = ? LIMIT 1", [`${PREFIX} إنتاج UAT`]))[0];
  const production = existingProduction ? { id: Number(existingProduction.id), status: existingProduction.status } : await db.createProductionOrder({ recipeId: recipe.id, productId: finishedProductId, sourceWarehouseId: materialsWarehouseId, warehouseId: finishedWarehouseId, branchId, plannedQuantity: "10", plannedCost: "400.00", batchNumber: `${PREFIX}-FG-B1`, notes: `${PREFIX} إنتاج UAT`, lines: [{ ingredientId: rawProductId, requiredQuantity: "20", unitCost: "20.00" }], createdBy: ownerId });
  if (production.status !== "completed") await db.completeProductionOrder(production.id, "10", "0", "400.00");
  await track(runId, "production_orders", production.id); await trackJournalFor(runId, "production_order", production.id);

  const existingSession = (await rows("SELECT id FROM pos_sessions WHERE cashierId = ? AND branchId = ? AND status = 'open' LIMIT 1", [ownerId, branchId]))[0];
  const session = existingSession ? { id: Number(existingSession.id) } : await db.openPosSession({ branchId, cashierId: ownerId, openingBalance: "500.00" });
  await track(runId, "pos_sessions", session.id);
  const existingOrder = (await rows("SELECT id, status FROM orders WHERE notes = ? LIMIT 1", [`${PREFIX} بيع POS مختلط`]))[0];
  const order = existingOrder ? { id: Number(existingOrder.id), status: existingOrder.status } : await db.createOrder({ branchId, warehouseId: finishedWarehouseId, costCenterId: profitCenterId, sessionId: session.id, cashierId: ownerId, type: "takeaway", paymentMethod: "mixed", notes: `${PREFIX} بيع POS مختلط`, payments: [{ paymentMethod: "cash", amount: "230.00" }, { paymentMethod: "card", amount: "115.00", reference: `${PREFIX}-CARD-001` }], lines: [{ productId: finishedProductId, quantity: "5", unitPrice: "60.00", costPrice: "40.00", batchNumber: `${PREFIX}-FG-B1` }] });
  let orderStatus = order.status || "new";
  if (orderStatus === "new") { await db.updateOrderStatus(order.id, "preparing", ownerId); orderStatus = "preparing"; }
  if (orderStatus === "preparing") { await db.updateOrderStatus(order.id, "ready", ownerId); orderStatus = "ready"; }
  if (orderStatus === "ready") { await db.updateOrderStatus(order.id, "served", ownerId); orderStatus = "served"; }
  if (orderStatus === "served") await db.payPosOrder(order.id, branchId, ownerId);
  await track(runId, "orders", order.id); await trackJournalFor(runId, "pos_order", order.id);
  const salesInvoice = await db.issueSalesInvoiceFromOrder({ orderId: order.id, branchId, customerId, invoiceType: "tax", createdBy: ownerId });
  await track(runId, "sales_invoices", salesInvoice.id);

  const waste = await db.createWasteVoucher({ warehouseId: finishedWarehouseId, reason: `${PREFIX} اختبار هالك`, notes: `${PREFIX} هالك تشغيلي`, lines: [{ productId: finishedProductId, quantity: "1" }], createdBy: ownerId });
  await db.approveWasteVoucher(waste.id, ownerId); await track(runId, "waste_vouchers", waste.id); await trackJournalFor(runId, "waste_voucher", waste.id);
  const count = await db.createInventoryCount({ warehouseId: finishedWarehouseId, type: "periodic", notes: `${PREFIX} جرد UAT`, lines: [{ productId: finishedProductId, systemQuantity: "4", actualQuantity: "3" }], createdBy: ownerId });
  await db.approveInventoryCount(count.id, ownerId); await track(runId, "inventory_counts", count.id); await trackJournalFor(runId, "inventory_count", count.id);

  const paymentVoucher = await db.createTreasuryVoucher({ voucherType: "payment", date: new Date("2026-03-01T08:00:00.000Z"), branchId, settlementAccountId: accounts["UAT-1100"], paymentMethod: "cash", referenceNumber: `${PREFIX}-PV-001`, description: `${PREFIX} سداد مورد`, lines: [{ accountId: accounts["UAT-2000"], costCenterId: costCenterId, amount: "2300.00", description: `${PREFIX} سداد فاتورة شراء` }], createdBy: ownerId });
  await db.approveTreasuryVoucher(paymentVoucher.id, ownerId); await db.postTreasuryVoucher(paymentVoucher.id, ownerId); await track(runId, "vouchers", paymentVoucher.id); await trackJournalFor(runId, "treasury_voucher", paymentVoucher.id);
  const allocation = await db.createCostAllocation({ name: `${PREFIX} توزيع مصروف`, method: "custom", periodStart: new Date("2026-03-01T00:00:00.000Z"), periodEnd: new Date("2026-03-31T23:59:59.000Z"), totalAmount: "100.00", sourceAccountId: accounts["UAT-5100"], sourceCostCenterId: costCenterId, lines: [{ costCenterId: profitCenterId, amount: "100.00", ratio: "1" }], createdBy: ownerId });
  await db.approveCostAllocation(allocation.id, ownerId); await db.postCostAllocation(allocation.id, ownerId); await track(runId, "cost_allocations", allocation.id); await trackJournalFor(runId, "cost_allocation", allocation.id);

  await db.closePosSession(session.id, "730.00", ownerId);
  await connection.execute("UPDATE uat_runs SET status = 'completed', completedAt = NOW() WHERE id = ?", [runId]);
  console.log(JSON.stringify({ runId, openingJournalId: opening.id, purchaseInvoiceId: purchase.id, recipeId: recipe.id, productionOrderId: production.id, posSessionId: session.id, posOrderId: order.id, salesInvoiceId: salesInvoice.id, wasteVoucherId: waste.id, inventoryCountId: count.id, paymentVoucherId: paymentVoucher.id, costAllocationId: allocation.id }, null, 2));
} catch (error) {
  const found = await rows("SELECT id FROM uat_runs WHERE code = ? LIMIT 1", [UAT_CODE]);
  if (found[0]?.id) await connection.execute("UPDATE uat_runs SET status = 'failed', notes = CONCAT(COALESCE(notes, ''), '\nExecution error: ', ?) WHERE id = ?", [String(error?.message || error).slice(0, 1500), found[0].id]);
  console.error(error);
  process.exitCode = 1;
} finally {
  connection.release();
  await pool.end();
  process.exit(process.exitCode || 0);
}
