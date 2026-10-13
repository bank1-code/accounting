import mysql from "mysql2/promise";

const UAT_CODE = "UAT-ONLY-20260825";
const PREFIX = "UAT-ONLY";
const pool = await mysql.createPool(process.env.DATABASE_URL);
const connection = await pool.getConnection();

try {
  await connection.beginTransaction();
  const [runRows] = await connection.execute("SELECT id, status FROM uat_runs WHERE code = ? LIMIT 1", [UAT_CODE]);
  const run = runRows[0];
  if (!run || !["active", "failed", "completed"].includes(run.status)) throw new Error("Restartable UAT run was not found");
  const runId = Number(run.id);
  const accountDefinitions = [
    ["UAT-1210", `${PREFIX} إنتاج تحت التشغيل`, "asset"], ["UAT-1220", `${PREFIX} مخزون تام`, "asset"], ["UAT-4010", `${PREFIX} مكاسب مخزون`, "revenue"], ["UAT-5210", `${PREFIX} هالك`, "expense"], ["UAT-3100", `${PREFIX} أرباح محتجزة`, "equity"],
  ];
  for (const [code, name, type] of accountDefinitions) {
    const [existing] = await connection.execute("SELECT id FROM accounts WHERE code = ? LIMIT 1", [code]);
    if (!existing[0]) {
      const [created] = await connection.execute("INSERT INTO accounts (code, name, nameEn, type, level, isActive, isSystem, balance) VALUES (?, ?, ?, ?, 1, true, false, 0)", [code, name, code, type]);
      await connection.execute("INSERT INTO uat_entity_registry (uatRunId, tableName, entityId) VALUES (?, 'accounts', ?)", [runId, Number(created.insertId)]);
    }
  }
  const [accountRows] = await connection.execute("SELECT id, code FROM accounts WHERE code IN ('UAT-1100','UAT-1110','UAT-1200','UAT-1210','UAT-1220','UAT-1300','UAT-2000','UAT-2100','UAT-4000','UAT-4010','UAT-5000','UAT-5100','UAT-5200','UAT-5210')");
  const accounts = Object.fromEntries(accountRows.map((row) => [row.code, Number(row.id)]));
  const map = { cashAccountId: accounts["UAT-1100"], cardClearingAccountId: accounts["UAT-1110"], salesRevenueAccountId: accounts["UAT-4000"], outputVatAccountId: accounts["UAT-2100"], inputVatAccountId: accounts["UAT-1300"], inventoryAccountId: accounts["UAT-1200"], workInProgressAccountId: accounts["UAT-1210"], finishedGoodsInventoryAccountId: accounts["UAT-1220"], inventoryGainAccountId: accounts["UAT-4010"], inventoryLossAccountId: accounts["UAT-5200"], wasteExpenseAccountId: accounts["UAT-5210"], cogsAccountId: accounts["UAT-5000"], accountsPayableAccountId: accounts["UAT-2000"] };
  if (Object.values(map).some((id) => !Number.isInteger(id) || id <= 0)) throw new Error("UAT posting map remains incomplete");
  await connection.execute("UPDATE system_settings SET value = ?, settingGroup = 'UAT' WHERE settingKey = 'accounting.pos_posting_map.v1'", [JSON.stringify(map)]);
  if (run.status === "failed") await connection.execute("UPDATE uat_runs SET status = 'active', notes = CONCAT(COALESCE(notes, ''), '\nPosting map repaired for UAT resumption.') WHERE id = ?", [runId]);
  await connection.commit();
  console.log(JSON.stringify(map, null, 2));
} catch (error) {
  await connection.rollback();
  console.error(error);
  process.exitCode = 1;
} finally {
  connection.release();
  await pool.end();
  process.exit(process.exitCode || 0);
}
