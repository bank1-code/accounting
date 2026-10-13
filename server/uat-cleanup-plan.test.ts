import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("خطة حذف UAT", () => {
  const source = readFileSync(resolve(process.cwd(), "scripts/uat-cleanup.mjs"), "utf8");
  it("تبدأ بمعاينة جافة ولا تنفذ الحذف إلا بعلامة تأكيد صريحة", () => {
    expect(source).toContain('process.argv.includes("--confirm-delete-uat")');
    expect(source).toContain('mode: "dry-run"');
    expect(source).toContain("process.exit(0)");
  });
  it("تحذف السجلات التابعة قبل الجذور وتسجل حالة cleaned", () => {
    expect(source).toContain("journal_entry_lines");
    expect(source).toContain("purchase_invoice_lines");
    expect(source).toContain("waste_voucher_lines");
    expect(source).toContain("stock_movements");
    expect(source).toContain("system_settings");
    expect(source).toContain("rootDeleteOrder");
    expect(source).toContain("status = 'cleaned'");
  });
});
