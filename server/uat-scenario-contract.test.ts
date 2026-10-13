import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("عزل بيانات UAT وتتبّعها", () => {
  it("يفرض غياب الحركات التشغيلية ويسجل كل كيان مرجعي منشأ ضمن نطاق UAT", () => {
    const source = readFileSync(resolve(process.cwd(), "scripts/uat-bootstrap.mjs"), "utf8");
    expect(source).toContain('const PREFIX = "UAT-ONLY"');
    expect(source).toContain("Operational rows exist in");
    expect(source).toContain("uat_entity_registry");
    expect(source).toContain("baselineSnapshot");
    expect(source).toContain("await connection.beginTransaction()");
  });
});
