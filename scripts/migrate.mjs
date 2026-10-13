import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import mysql from "mysql2/promise";

const mode = process.argv.includes("--baseline") ? "baseline" : process.argv.includes("--check") ? "check" : "migrate";
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required");

const migrationDirectory = path.resolve(process.cwd(), "drizzle-live");
const migrationFiles = (await readdir(migrationDirectory))
  .filter((file) => /^\d{4}_[a-z0-9_]+\.sql$/i.test(file))
  .sort();

const migrations = await Promise.all(migrationFiles.map(async (fileName) => {
  const content = await readFile(path.join(migrationDirectory, fileName), "utf8");
  return { fileName, content, checksum: createHash("sha256").update(content).digest("hex") };
}));

const connection = await mysql.createConnection({ uri: databaseUrl, multipleStatements: true });
try {
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS dgtera_migration_ledger (
      id INT AUTO_INCREMENT PRIMARY KEY,
      file_name VARCHAR(255) NOT NULL UNIQUE,
      checksum CHAR(64) NOT NULL,
      applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB
  `);
  const [rows] = await connection.execute("SELECT file_name, checksum FROM dgtera_migration_ledger ORDER BY file_name");
  const applied = new Map(rows.map((row) => [row.file_name, row.checksum]));

  const drift = migrations.filter((migration) => applied.has(migration.fileName) && applied.get(migration.fileName) !== migration.checksum);
  if (drift.length) throw new Error(`Migration checksum drift: ${drift.map((item) => item.fileName).join(", ")}`);

  if (mode === "check") {
    const pending = migrations.filter((migration) => !applied.has(migration.fileName));
    if (pending.length) throw new Error(`Unapplied migrations: ${pending.map((item) => item.fileName).join(", ")}`);
    console.log(`Migration ledger verified: ${migrations.length} files`);
    process.exit(0);
  }

  const pending = migrations.filter((migration) => !applied.has(migration.fileName));
  if (mode === "baseline") {
    for (const migration of pending) {
      await connection.execute("INSERT INTO dgtera_migration_ledger (file_name, checksum) VALUES (?, ?)", [migration.fileName, migration.checksum]);
    }
    console.log(`Baseline recorded: ${pending.length} existing migration files`);
    process.exit(0);
  }

  for (const migration of pending) {
    await connection.beginTransaction();
    try {
      await connection.query(migration.content);
      await connection.execute("INSERT INTO dgtera_migration_ledger (file_name, checksum) VALUES (?, ?)", [migration.fileName, migration.checksum]);
      await connection.commit();
      console.log(`Applied: ${migration.fileName}`);
    } catch (error) {
      await connection.rollback();
      throw error;
    }
  }
  console.log(`Migration ledger current: ${migrations.length} files`);
} finally {
  await connection.end();
}
