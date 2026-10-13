import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import path from "node:path";

describe("تدقيق توافق المخطط مع قاعدة البيانات", () => {
  it("لا يرصد اختلافاً في الجداول أو الأعمدة أو الأنواع أو قابلية القيم الخالية", () => {
    const projectRoot = path.resolve(import.meta.dirname, "..");
    const output = execFileSync("pnpm", ["tsx", "server/schema-audit.mjs"], {
      cwd: projectRoot,
      encoding: "utf8",
      env: process.env,
    });
    const report = JSON.parse(output);
    expect(report.mismatches).toEqual([]);
  });
});
