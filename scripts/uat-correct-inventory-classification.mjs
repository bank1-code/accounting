import mysql from "mysql2/promise";
import * as db from "../server/db.ts";

const UAT_CODE = "UAT-ONLY-20260825";
const PREFIX = "UAT-ONLY";
const pool = await mysql.createPool(process.env.DATABASE_URL);
const connection = await pool.getConnection();

try {
  const [runRows] = await connection.execute("SELECT id FROM uat_runs WHERE code = ? LIMIT 1", [UAT_CODE]);
  const runId = Number(runRows[0]?.id);
  const [ownerRows] = await connection.execute("SELECT id FROM users WHERE username = 'admina' LIMIT 1");
  const ownerId = Number(ownerRows[0]?.id);
  const [mapRows] = await connection.execute("SELECT value FROM system_settings WHERE settingKey = 'accounting.pos_posting_map.v1' LIMIT 1");
  const map = JSON.parse(mapRows[0]?.value || "{}");
  const [existing] = await connection.execute("SELECT id FROM journal_entries WHERE description = ? LIMIT 1", [`${PREFIX} تصحيح تصنيف مخزون تام`]);
  if (!existing[0]) {
    const correction = await db.createJournalEntry({ date: new Date("2026-03-31T23:00:00.000Z"), description: `${PREFIX} تصحيح تصنيف مخزون تام`, reference: UAT_CODE, createdBy: ownerId, lines: [
      { accountId: Number(map.inventoryAccountId), debit: "280.00", credit: "0", description: `${PREFIX} إعادة تصنيف من مواد` },
      { accountId: Number(map.finishedGoodsInventoryAccountId), debit: "0", credit: "280.00", description: `${PREFIX} إعادة تصنيف إلى منتجات تامة` },
    ] });
    await db.postJournalEntry(correction.id, ownerId);
    await connection.execute("INSERT IGNORE INTO uat_entity_registry (uatRunId, tableName, entityId) VALUES (?, 'journal_entries', ?)", [runId, correction.id]);
    console.log(JSON.stringify({ correctionJournalId: correction.id, amount: "280.00" }, null, 2));
  } else console.log(JSON.stringify({ correctionJournalId: Number(existing[0].id), reused: true }, null, 2));
} finally {
  connection.release();
  await pool.end();
}
