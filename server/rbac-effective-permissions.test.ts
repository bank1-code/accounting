import { describe, expect, it } from "vitest";
import { resolveEffectivePermissionCodes } from "./db";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("استعلام الصلاحيات الفعالة", () => {
  it("يحافظ على أولوية منع المستخدم المباشر ويستبعد المنح المقيدة عن واجهة الصلاحيات العامة", () => {
    const codes = ["inventory.view", "treasury.voucher.post", "accounting.journal.create"];
    const roleGrants = [
      { permissionCode: "inventory.view", effect: "allow" as const, branchId: null, warehouseId: null, costCenterId: null, expiresAt: null },
      { permissionCode: "treasury.voucher.post", effect: "allow" as const, branchId: 5, warehouseId: null, costCenterId: null, expiresAt: null },
      { permissionCode: "accounting.journal.create", effect: "allow" as const, branchId: null, warehouseId: null, costCenterId: null, expiresAt: null },
    ];
    const directGrants = [{ permissionCode: "accounting.journal.create", effect: "deny" as const, branchId: null, warehouseId: null, costCenterId: null, expiresAt: null }];
    expect(resolveEffectivePermissionCodes(codes, directGrants, roleGrants)).toEqual(["inventory.view"]);
  });

  it("يستخدم استعلامات مجمعة ولا يستدعي hasAtomicPermission مرة لكل رمز", () => {
    const source = readFileSync(resolve(process.cwd(), "server/db.ts"), "utf8");
    const implementation = source.slice(source.indexOf("export async function listEffectivePermissionCodes"), source.indexOf("// ============ BRANCHES"));
    expect(implementation).toContain("Promise.all");
    expect(implementation).toContain("resolveEffectivePermissionCodes");
    expect(implementation).not.toContain("await hasAtomicPermission");
  });
});
