import mysql from "mysql2/promise";
import * as db from "../server/db.ts";

const UAT_CODE = "UAT-ONLY-20260825";
const PREFIX = "UAT-ONLY";
const pool = await mysql.createPool(process.env.DATABASE_URL);
const connection = await pool.getConnection();

try {
  const [[period]] = await connection.execute("SELECT id, isClosed FROM fiscal_periods WHERE name = ? LIMIT 1", [`${PREFIX} السنة المالية 2026`]);
  const [[owner]] = await connection.execute("SELECT id FROM users WHERE username = 'admina' LIMIT 1");
  const [[retained]] = await connection.execute("SELECT id FROM accounts WHERE code = 'UAT-3100' LIMIT 1");
  if (!period || !owner || !retained) throw new Error("UAT fiscal close prerequisites are missing");
  if (!period.isClosed) await db.closeFiscalPeriod(Number(period.id), Number(owner.id), Number(retained.id));
  const [[closingJournal]] = await connection.execute("SELECT id, totalDebit, totalCredit FROM journal_entries WHERE referenceType = 'fiscal_year_close' AND referenceId = ? LIMIT 1", [period.id]);
  const [[run]] = await connection.execute("SELECT id FROM uat_runs WHERE code = ? LIMIT 1", [UAT_CODE]);
  if (closingJournal?.id && run?.id) await connection.execute("INSERT IGNORE INTO uat_entity_registry (uatRunId, tableName, entityId) VALUES (?, 'journal_entries', ?)", [run.id, closingJournal.id]);
  console.log(JSON.stringify({ fiscalPeriodId: Number(period.id), isClosed: true, closingJournalId: Number(closingJournal?.id), totalDebit: closingJournal?.totalDebit, totalCredit: closingJournal?.totalCredit }, null, 2));
} finally {
  connection.release();
  await pool.end();
}
