import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("وكيل تخزين أصول PWA", () => {
  const proxy = readFileSync(resolve(process.cwd(), "server/_core/storageProxy.ts"), "utf8");
  const index = readFileSync(resolve(process.cwd(), "server/_core/index.ts"), "utf8");
  const manifest = readFileSync(resolve(process.cwd(), "client/public/manifest.webmanifest"), "utf8");

  it("يسجل مسار manus-storage قبل مسارات التطبيق ويصدر توجيهاً آمناً", () => {
    expect(index).toContain("registerStorageProxy(app);");
    expect(proxy).toContain('app.get("/manus-storage/*"');
    expect(proxy).toContain("res.redirect(307, url)");
  });

  it("يربط manifest بالأيقونة المرفوعة عبر وكيل التخزين", () => {
    expect(manifest).toContain('/manus-storage/doktra-pwa-icon_eacc1249.png');
  });
});
