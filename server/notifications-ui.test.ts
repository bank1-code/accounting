import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const page = readFileSync(resolve(process.cwd(), "client/src/pages/admin/Notifications.tsx"), "utf8");

describe("سجل الإشعارات الفعلي", () => {
  it("يقرأ الإشعارات من tRPC ويدعم تعليمها كمقروء", () => {
    expect(page).toContain("trpc.notifications.list.useQuery()");
    expect(page).toContain("trpc.notifications.markRead.useMutation");
    expect(page).toContain("utils.notifications.list.invalidate()");
  });

  it("لا يعرض بطاقات تنبيه ثابتة أو حالة مفعلة موهّمة", () => {
    expect(page).not.toContain("notificationTypes");
    expect(page).not.toContain("مفعّل");
    expect(page).toContain("notification.isRead");
  });
});
