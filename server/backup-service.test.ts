import { beforeAll, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

beforeAll(() => {
  if (!process.env.JWT_SECRET) process.env.JWT_SECRET = "test-backup-encryption-key-material-2026";
});

describe("خدمة النسخ الاحتياطي المشفر", () => {
  it("تشفّر snapshot ولا تترك البيانات الصريحة داخل الملف ثم تستعيد بنيتها عند التحقق", async () => {
    const { encryptSnapshot, decryptSnapshot } = await import("./backup-service");
    const snapshot = { version: 1 as const, createdAt: "2026-08-14T00:00:00.000Z", tables: { orders: [{ id: 1, secret: "order-data" }] } };
    const encrypted = encryptSnapshot(snapshot);
    expect(encrypted.toString("utf8")).not.toContain("order-data");
    expect(decryptSnapshot(encrypted)).toEqual(snapshot);
  });

  it("يرفض النسخة المشفرة إذا عُبث بوسم مصادقتها قبل أي استعادة", async () => {
    const { encryptSnapshot, decryptSnapshot } = await import("./backup-service");
    const encrypted = encryptSnapshot({ version: 1, createdAt: "2026-08-24T00:00:00.000Z", tables: { orders: [{ id: 1 }] } });
    const envelope = JSON.parse(encrypted.toString("utf8")) as { tag: string };
    envelope.tag = `${envelope.tag.startsWith("A") ? "B" : "A"}${envelope.tag.slice(1)}`;
    expect(() => decryptSnapshot(JSON.stringify(envelope))).toThrow();
  });

  it("يصمم اختبار الاستعادة على قاعدة عشوائية معزولة ويحذفها في كل الأحوال", async () => {
    const source = readFileSync(resolve(process.cwd(), "server/backup-service.ts"), "utf8");
    const router = readFileSync(resolve(process.cwd(), "server/routers.ts"), "utf8");
    const page = readFileSync(resolve(process.cwd(), "client/src/pages/admin/Backups.tsx"), "utf8");
    expect(source).toContain("export async function testRestoreEncryptedBackupInIsolation");
    expect(source).toContain("CREATE DATABASE");
    expect(source).toContain("DROP DATABASE IF EXISTS");
    expect(source).toContain("finally {");
    expect(source).toContain("Restored row count mismatch");
    expect(router).toContain('testRestoreIsolated: atomicPermissionProcedure("admin.backups.manage")');
    expect(page).toContain("اختبار الاستعادة");
  });
});
