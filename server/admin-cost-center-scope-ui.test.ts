import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(resolve(process.cwd(), "client/src/pages/admin/Users.tsx"), "utf8");

describe("ربط نطاق مركز التكلفة في واجهة المستخدمين", () => {
  it("يوفر اختيار مركز التكلفة لإسناد الدور ويرسل القيمة العددية إلى tRPC", () => {
    expect(source).toContain('const [assignment, setAssignment] = useState({ roleId: "", branchId: "all", warehouseId: "all", costCenterId: "" })');
    expect(source).toContain('نطاق مركز التكلفة');
    expect(source).toContain('value={assignment.costCenterId}');
    expect(source).toContain('costCenterId: assignment.costCenterId ? Number(assignment.costCenterId) : undefined');
  });

  it("يوفر اختيار مركز التكلفة للتجاوز الفردي ويرسل القيمة العددية إلى tRPC", () => {
    expect(source).toContain('const [override, setOverride] = useState({ permissionId: "", effect: "allow" as "allow" | "deny", branchId: "all", warehouseId: "all", costCenterId: "", reason: "" })');
    expect(source).toContain('value={override.costCenterId}');
    expect(source).toContain('costCenterId: override.costCenterId ? Number(override.costCenterId) : undefined');
    expect(source).toContain('مركز تكلفة #${item.costCenterId}');
  });
});
