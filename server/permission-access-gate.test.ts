import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PermissionAccessGate } from "../client/src/components/PermissionAccessGate";

describe("PermissionAccessGate", () => {
  it("يعرض الوحدة عند نجاح الصلاحية الذرية", () => {
    const html = renderToStaticMarkup(createElement(PermissionAccessGate, { allowed: true }, createElement("span", null, "allowed-module")));
    expect(html).toContain("permission-route-allowed");
    expect(html).toContain("allowed-module");
  });

  it("يرفض المسار المباشر عند غياب الصلاحية الذرية", () => {
    const html = renderToStaticMarkup(createElement(PermissionAccessGate, { allowed: false }, createElement("span", null, "private-module")));
    expect(html).toContain("permission-route-denied");
    expect(html).not.toContain("private-module");
  });
});
