import { describe, expect, it } from "vitest";
import { LOCAL_LOGIN_MAX_FAILURES, LOCAL_LOGIN_WINDOW_MS, getLocalLoginAttemptStatus, localLoginAttemptKey, recordLocalLoginFailure, recordLocalLoginSuccess } from "./db";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("حارس محاولات الدخول المحلي", () => {
  it("يحظر المفتاح مؤقتاً بعد الحد المسموح من الإخفاقات وينتهي الحظر مع نافذة زمنية جديدة", () => {
    const start = 1_000_000;
    const key = localLoginAttemptKey("AdminA", "127.0.0.1");
    for (let index = 0; index < LOCAL_LOGIN_MAX_FAILURES; index += 1) recordLocalLoginFailure(key, start + index);
    expect(getLocalLoginAttemptStatus(key, start + 100)).toMatchObject({ blocked: true });
    expect(getLocalLoginAttemptStatus(key, start + LOCAL_LOGIN_WINDOW_MS + 100)).toEqual({ blocked: false, retryAfterSeconds: 0 });
  });

  it("يمسح سجل الإخفاقات بعد نجاح الدخول ويعزل مفاتيح المستخدم وعنوان العميل", () => {
    const key = localLoginAttemptKey("AdminA", "127.0.0.2");
    recordLocalLoginFailure(key, 2_000_000);
    recordLocalLoginSuccess(key);
    expect(getLocalLoginAttemptStatus(key, 2_000_001)).toEqual({ blocked: false, retryAfterSeconds: 0 });
    expect(localLoginAttemptKey("admina", "127.0.0.1")).not.toBe(key);
  });

  it("يربط مسار المصادقة الحارس قبل كلمة المرور ويمسح الحارس عند النجاح", () => {
    const router = readFileSync(resolve(process.cwd(), "server/routers.ts"), "utf8");
    expect(router).toContain("getLocalLoginAttemptStatus(loginKey)");
    expect(router).toContain("recordLocalLoginFailure(loginKey)");
    expect(router).toContain("recordLocalLoginSuccess(loginKey)");
  });
});
