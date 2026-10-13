import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(resolve(process.cwd(), "server/routers.ts"), "utf8");
const lines = source.split("\n");

describe("تدقيق جميع إجراءات التعديل في tRPC", () => {
  it("يمنع أي mutation حساس من العمل دون حارس صلاحية ذرية أو استثناء موثق", () => {
    const exceptions = [
      "login: publicProcedure",
      "logout: protectedProcedure",
    ];
    const uncovered: Array<{ line: number; procedure: string }> = [];

    lines.forEach((line, index) => {
      if (!line.includes(".mutation(")) return;
      const procedure = lines.slice(Math.max(0, index - 14), index + 1).join("\n");
      const protectedByAtomicPermission = procedure.includes("atomicPermissionProcedure(") || procedure.includes("atomicAnyPermissionProcedure(");
      const documentedException = exceptions.some((signature) => procedure.includes(signature));
      if (!protectedByAtomicPermission && !documentedException) {
        uncovered.push({ line: index + 1, procedure: procedure.trim().slice(0, 240) });
      }
    });

    expect(uncovered, `Mutations require RBAC review: ${JSON.stringify(uncovered, null, 2)}`).toEqual([]);
  });
});
