import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { AdminAccessGate } from "../client/src/components/AdminAccessGate";

describe("حارس مسارات الإدارة في الواجهة", () => {
  it("يعرض المحتوى الإداري للحساب المحلي ذو دور المدير", () => {
    const html = renderToStaticMarkup(createElement(AdminAccessGate, { role: "admin" }, createElement("span", null, "Admin content")));
    expect(html).toContain('data-testid="admin-route-allowed"');
    expect(html).toContain("Admin content");
  });

  it("يمنع المستخدم العادي من عرض المحتوى الإداري", () => {
    const html = renderToStaticMarkup(createElement(AdminAccessGate, { role: "user" }, createElement("span", null, "Admin content")));
    expect(html).toContain('data-testid="admin-route-denied"');
    expect(html).not.toContain("Admin content");
  });
});
