import { createCipheriv, createDecipheriv, randomBytes, randomUUID, scryptSync } from "node:crypto";
import mysql from "mysql2/promise";
import { sql } from "drizzle-orm";
import { backups } from "../drizzle/schema";
import { ENV } from "./_core/env";
import { getDb } from "./db";
import { storageGet, storagePut } from "./storage";

type Snapshot = {
  version: 1;
  createdAt: string;
  tables: Record<string, unknown[]>;
};

type EncryptedEnvelope = {
  version: 1;
  algorithm: "aes-256-gcm";
  salt: string;
  iv: string;
  tag: string;
  ciphertext: string;
};

function backupKey() {
  if (!ENV.cookieSecret || ENV.cookieSecret.length < 16) throw new Error("Backup encryption key is not configured");
  return ENV.cookieSecret;
}

export function encryptSnapshot(snapshot: Snapshot): Buffer {
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const key = scryptSync(backupKey(), salt, 32);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(snapshot), "utf8"), cipher.final()]);
  const envelope: EncryptedEnvelope = {
    version: 1, algorithm: "aes-256-gcm", salt: salt.toString("base64"), iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"), ciphertext: ciphertext.toString("base64"),
  };
  return Buffer.from(JSON.stringify(envelope), "utf8");
}

export function decryptSnapshot(payload: Buffer | string): Snapshot {
  const envelope = JSON.parse(Buffer.isBuffer(payload) ? payload.toString("utf8") : payload) as EncryptedEnvelope;
  if (envelope.version !== 1 || envelope.algorithm !== "aes-256-gcm") throw new Error("Unsupported backup envelope");
  const key = scryptSync(backupKey(), Buffer.from(envelope.salt, "base64"), 32);
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(envelope.iv, "base64"));
  decipher.setAuthTag(Buffer.from(envelope.tag, "base64"));
  const plaintext = Buffer.concat([decipher.update(Buffer.from(envelope.ciphertext, "base64")), decipher.final()]);
  const snapshot = JSON.parse(plaintext.toString("utf8")) as Snapshot;
  if (snapshot.version !== 1 || !snapshot.tables || typeof snapshot.tables !== "object") throw new Error("Invalid backup snapshot");
  return snapshot;
}

export async function createEncryptedDatabaseBackup(createdBy: number, label?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const name = label?.trim() || `ERP-${new Date().toISOString().replace(/[:.]/g, "-")}`;
  const inserted = await db.insert(backups).values({ name, description: "Encrypted logical database backup", status: "creating", createdBy });
  const backupId = Number(inserted[0].insertId);
  try {
    const [tableRows] = await db.execute(sql.raw("SELECT table_name AS tableName FROM information_schema.tables WHERE table_schema = DATABASE() AND table_type = 'BASE TABLE' AND table_name NOT LIKE '__drizzle%'")) as unknown as [Array<{ tableName: string }>];
    const tables: Record<string, unknown[]> = {};
    let recordsCount = 0;
    for (const row of tableRows) {
      if (!/^[a-z0-9_]+$/i.test(row.tableName)) throw new Error("Unexpected table name in backup source");
      const [rows] = await db.execute(sql.raw(`SELECT * FROM \`${row.tableName}\``)) as unknown as [unknown[]];
      tables[row.tableName] = rows;
      recordsCount += rows.length;
    }
    const encrypted = encryptSnapshot({ version: 1, createdAt: new Date().toISOString(), tables });
    const key = `encrypted-backups/${new Date().toISOString().slice(0, 10)}/${backupId}-${randomUUID()}.json.aes`;
    const stored = await storagePut(key, encrypted, "application/octet-stream");
    await db.update(backups).set({ fileKey: stored.key, fileUrl: stored.url, fileSize: encrypted.length, tablesCount: tableRows.length, recordsCount, status: "completed" }).where(sql`${backups.id} = ${backupId}`);
    return { id: backupId, fileKey: stored.key, tablesCount: tableRows.length, recordsCount };
  } catch (error) {
    await db.update(backups).set({ status: "failed", description: error instanceof Error ? error.message.slice(0, 500) : "Backup failed" }).where(sql`${backups.id} = ${backupId}`);
    throw error;
  }
}

export async function verifyEncryptedBackup(fileKey: string) {
  const download = await storageGet(fileKey);
  const response = await fetch(download.url);
  if (!response.ok) throw new Error("Unable to download backup for verification");
  const snapshot = decryptSnapshot(Buffer.from(await response.arrayBuffer()));
  return { createdAt: snapshot.createdAt, tablesCount: Object.keys(snapshot.tables).length, recordsCount: Object.values(snapshot.tables).reduce((total, rows) => total + rows.length, 0) };
}

function restoreDatabaseName() {
  return `dgtera_restore_${randomUUID().replace(/-/g, "").slice(0, 20)}`;
}

function quoteIdentifier(identifier: string) {
  if (!/^[a-z0-9_]+$/i.test(identifier)) throw new Error("Unsafe backup table identifier");
  return `\`${identifier}\``;
}

export async function testRestoreEncryptedBackupInIsolation(fileKey: string) {
  if (!ENV.databaseUrl) throw new Error("Database connection is not configured");
  const download = await storageGet(fileKey);
  const response = await fetch(download.url);
  if (!response.ok) throw new Error("Unable to download backup for isolated restore");
  const snapshot = decryptSnapshot(Buffer.from(await response.arrayBuffer()));
  const tableNames = Object.keys(snapshot.tables);
  if (!tableNames.length || tableNames.some((tableName) => !/^[a-z0-9_]+$/i.test(tableName))) throw new Error("Backup snapshot has no safe tables to restore");
  const databaseName = restoreDatabaseName();
  const startedAt = Date.now();
  const sourceConnection = await mysql.createConnection({ uri: ENV.databaseUrl });
  let targetConnection: mysql.Connection | undefined;
  try {
    try {
      await sourceConnection.query(`CREATE DATABASE ${quoteIdentifier(databaseName)}`);
    } catch (error: unknown) {
      const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
      if (code === "ER_DBACCESS_DENIED_ERROR" || code === "ER_ACCESS_DENIED_ERROR") {
        throw new Error("Isolated restore requires CREATE/DROP DATABASE permission; no production data was changed");
      }
      throw error;
    }
    const targetUrl = new URL(ENV.databaseUrl);
    targetUrl.pathname = `/${databaseName}`;
    targetUrl.search = "";
    targetConnection = await mysql.createConnection({ uri: targetUrl.toString() });
    for (const tableName of tableNames) {
      const quotedTable = quoteIdentifier(tableName);
      const [definitionRows] = await sourceConnection.query(`SHOW CREATE TABLE ${quotedTable}`) as unknown as [Array<Record<string, string>>];
      const createStatement = definitionRows[0]?.["Create Table"];
      if (!createStatement) throw new Error(`Unable to read schema for ${tableName}`);
      await targetConnection.query(createStatement);
    }
    let restoredRecords = 0;
    for (const tableName of tableNames) {
      const rows = snapshot.tables[tableName];
      if (!Array.isArray(rows)) throw new Error(`Backup table ${tableName} has invalid rows`);
      for (const row of rows) {
        if (!row || typeof row !== "object" || Array.isArray(row)) throw new Error(`Backup row for ${tableName} is invalid`);
        const entries = Object.entries(row as Record<string, unknown>);
        if (!entries.length) continue;
        const columns = entries.map(([column]) => quoteIdentifier(column)).join(", ");
        const placeholders = entries.map(() => "?").join(", ");
        await targetConnection.execute(`INSERT INTO ${quoteIdentifier(tableName)} (${columns}) VALUES (${placeholders})`, entries.map(([, value]) => value));
        restoredRecords += 1;
      }
      const [countRows] = await targetConnection.query(`SELECT COUNT(*) AS count FROM ${quoteIdentifier(tableName)}`) as unknown as [Array<{ count: number }>];
      if (Number(countRows[0]?.count || 0) !== rows.length) throw new Error(`Restored row count mismatch for ${tableName}`);
    }
    return { isolated: true as const, tablesCount: tableNames.length, recordsCount: restoredRecords, durationMs: Date.now() - startedAt };
  } finally {
    await targetConnection?.end().catch(() => undefined);
    await sourceConnection.query(`DROP DATABASE IF EXISTS ${quoteIdentifier(databaseName)}`).catch(() => undefined);
    await sourceConnection.end().catch(() => undefined);
  }
}
