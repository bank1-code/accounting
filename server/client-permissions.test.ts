import { describe, expect, it } from "vitest";
import { canAccessAdmin, canShowNavigationGroup } from "../client/src/lib/permissions";

describe("سياسة الوصول لواجهة الإدارة", () => {
  it("تسمح للمدير المحلي بمسارات الإدارة وتمنع المستخدم العادي", () => {
    expect(canAccessAdmin("admin")).toBe(true);
    expect(canAccessAdmin("user")).toBe(false);
    expect(canAccessAdmin(null)).toBe(false);
  });

  it("تظهر قسم الإدارة للمدير وتخفيه عن المستخدم العادي مع بقاء الأقسام التشغيلية", () => {
    expect(canShowNavigationGroup("admin", "admin")).toBe(true);
    expect(canShowNavigationGroup("admin", "user")).toBe(false);
    expect(canShowNavigationGroup("inventory", "user")).toBe(true);
  });
});
