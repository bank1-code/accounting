import { getTableColumns, sql } from "drizzle-orm";
import { getTableConfig } from "drizzle-orm/mysql-core";
import * as schema from "../drizzle/schema.ts";
import { getDb } from "./db.ts";

const normalizeType = (value) => String(value)
  .toLowerCase()
  .replace(/\s+/g, "")
  .replace(/`/g, "")
  .replace(/integer/g, "int")
  .replace(/boolean/g, "tinyint(1)")
  .replace(/tinyint\(1\)/g, "tinyint(1)");

const normalizeDefault = (value) => {
  if (value === null || value === undefined || value === "NULL") return null;
  return String(value)
    .toLowerCase()
    .replace(/[()'\s]/g, "")
    .replace("current_timestamp", "now")
    .replace("currenttimestamp", "now");
};

const tableEntries = Object.entries(schema).flatMap(([exportName, value]) => {
  try {
    const columns = getTableColumns(value);
    return Object.keys(columns).length ? [{ exportName, value, columns }] : [];
  } catch {
    return [];
  }
});

const expectedNonUniqueIndexes = new Set();
const expectedCompositeUniqueColumns = new Set();
for (const { value } of tableEntries) {
  const tableName = value[Symbol.for("drizzle:Name")];
  const config = getTableConfig(value);
  for (const tableIndex of config.indexes) {
    expectedNonUniqueIndexes.add(`${tableName}:${tableIndex.config.name}`);
    if (tableIndex.config.unique || tableIndex.config.isUnique) {
      for (const column of tableIndex.config.columns ?? []) expectedCompositeUniqueColumns.add(`${tableName}:${column.name}`);
    }
  }
  for (const uniqueConstraint of config.uniqueConstraints ?? []) {
    for (const column of uniqueConstraint.columns) expectedCompositeUniqueColumns.add(`${tableName}:${column.name}`);
  }
}

const db = await getDb();
if (!db) throw new Error("Database connection is unavailable for schema audit.");
const queryResult = await db.execute(sql`
  SELECT table_name, column_name, column_type, is_nullable, column_default
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
  ORDER BY table_name, ordinal_position
`);
const rows = Array.isArray(queryResult) && Array.isArray(queryResult[0]) ? queryResult[0] : queryResult;
const constraintResult = await db.execute(sql`
  SELECT tc.table_name, tc.constraint_name, tc.constraint_type, kcu.column_name
  FROM information_schema.table_constraints AS tc
  JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_schema = kcu.constraint_schema
    AND tc.table_name = kcu.table_name
    AND tc.constraint_name = kcu.constraint_name
  WHERE tc.constraint_schema = DATABASE()
    AND tc.constraint_type IN ('PRIMARY KEY', 'UNIQUE')
  ORDER BY tc.table_name, tc.constraint_name, kcu.ordinal_position
`);
const constraints = Array.isArray(constraintResult) && Array.isArray(constraintResult[0]) ? constraintResult[0] : constraintResult;
const infrastructureResult = await db.execute(sql`
  SELECT 'non_unique_index' AS issue_type, table_name, index_name AS object_name
  FROM information_schema.statistics
  WHERE table_schema = DATABASE() AND index_name <> 'PRIMARY' AND non_unique = 1
  UNION ALL
  SELECT 'foreign_key' AS issue_type, table_name, constraint_name AS object_name
  FROM information_schema.referential_constraints
  WHERE constraint_schema = DATABASE()
`);
const infrastructure = Array.isArray(infrastructureResult) && Array.isArray(infrastructureResult[0]) ? infrastructureResult[0] : infrastructureResult;

const actualByTable = new Map();
for (const row of rows) {
  if (!actualByTable.has(row.table_name)) actualByTable.set(row.table_name, new Map());
  actualByTable.get(row.table_name).set(row.column_name, row);
}
const constraintsByTable = new Map();
for (const constraint of constraints) {
  if (!constraintsByTable.has(constraint.table_name)) constraintsByTable.set(constraint.table_name, []);
  constraintsByTable.get(constraint.table_name).push(constraint);
}

const report = { tables: [], mismatches: [] };

for (const item of infrastructure) {
  if (item.issue_type === "non_unique_index" && expectedNonUniqueIndexes.has(`${item.table_name}:${item.object_name}`)) continue;
  report.mismatches.push({ tableName: item.table_name, issue: `unexpected_${item.issue_type}`, objectName: item.object_name });
}

for (const { exportName, value, columns } of tableEntries) {
  const tableName = value[Symbol.for("drizzle:Name")];
  const actualColumns = actualByTable.get(tableName);
  const tableReport = { exportName, tableName, columns: [] };

  if (!actualColumns) {
    report.mismatches.push({ tableName, issue: "missing_table" });
    report.tables.push(tableReport);
    continue;
  }

  for (const [propertyName, column] of Object.entries(columns)) {
    const actual = actualColumns.get(column.name);
    const columnReport = { propertyName, columnName: column.name, status: "ok" };

    if (!actual) {
      columnReport.status = "missing_column";
      report.mismatches.push({ tableName, columnName: column.name, issue: "missing_column" });
    } else {
      const expectedType = normalizeType(column.getSQLType());
      const actualType = normalizeType(actual.column_type);
      if (expectedType !== actualType) {
        columnReport.status = "type_mismatch";
        columnReport.expectedType = expectedType;
        columnReport.actualType = actualType;
        report.mismatches.push({ tableName, columnName: column.name, issue: "type_mismatch", expectedType, actualType });
      }

      const expectedNullable = !column.notNull;
      const actualNullable = actual.is_nullable === "YES";
      if (expectedNullable !== actualNullable) {
        columnReport.status = "nullable_mismatch";
        report.mismatches.push({ tableName, columnName: column.name, issue: "nullable_mismatch", expectedNullable, actualNullable });
      }

      if (column.hasDefault && !column.autoIncrement && normalizeDefault(actual.column_default) === null) {
        columnReport.status = "default_mismatch";
        report.mismatches.push({ tableName, columnName: column.name, issue: "default_mismatch", expected: "default value", actual: null });
      }
    }
    tableReport.columns.push(columnReport);
  }

  for (const actualColumnName of actualColumns.keys()) {
    if (!Object.values(columns).some((column) => column.name === actualColumnName)) {
      report.mismatches.push({ tableName, columnName: actualColumnName, issue: "unexpected_column" });
    }
  }

  const actualConstraints = constraintsByTable.get(tableName) ?? [];
  for (const column of Object.values(columns)) {
    const hasActualPrimary = actualConstraints.some((constraint) => constraint.constraint_type === "PRIMARY KEY" && constraint.column_name === column.name);
    const hasActualUnique = actualConstraints.some((constraint) => constraint.constraint_type === "UNIQUE" && constraint.column_name === column.name);
    if (Boolean(column.primary) !== hasActualPrimary) {
      report.mismatches.push({ tableName, columnName: column.name, issue: "primary_key_mismatch", expected: Boolean(column.primary), actual: hasActualPrimary });
    }
    const expectedUnique = Boolean(column.isUnique) || expectedCompositeUniqueColumns.has(`${tableName}:${column.name}`);
    if (expectedUnique !== hasActualUnique) {
      report.mismatches.push({ tableName, columnName: column.name, issue: "unique_constraint_mismatch", expected: expectedUnique, actual: hasActualUnique });
    }
  }
  report.tables.push(tableReport);
}

console.log(JSON.stringify(report, null, 2));
process.exit(report.mismatches.length > 0 ? 1 : 0);
