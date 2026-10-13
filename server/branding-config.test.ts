import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { resolve } from "node:path";

const visibleExtensions = new Set([".ts", ".tsx", ".html", ".js", ".json", ".webmanifest"]);
function collectVisibleFiles(root: string): string[] {
  return readdirSync(root).flatMap((entry) => {
    const path = resolve(root, entry);
    if (statSync(path).isDirectory()) return collectVisibleFiles(path);
    return visibleExtensions.has(path.slice(path.lastIndexOf("."))) ? [path] : [];
  });
}

describe("إعداد اسم دكتره / Doktra", () => {
  it("يعرض العنوان الموحد في نقطة HTML الخفيفة للتطبيق", async () => {
    const response = await fetch("http://127.0.0.1:3000/");
    const html = await response.text();
    expect(response.ok).toBe(true);
    expect(html).toContain("<title>دكتره | Doktra</title>");
  });

  it("يبقي ترجمتي العربية والإنجليزية متطابقتين مع العنوان المعتمد", () => {
    const arabic = readFileSync(resolve(process.cwd(), "client/src/lib/i18n/ar.ts"), "utf8");
    const english = readFileSync(resolve(process.cwd(), "client/src/lib/i18n/en.ts"), "utf8");
    expect(arabic).toContain('appName: "دكتره"');
    expect(english).toContain('appName: "Doktra"');
  });

  it("يجرد كامل ملفات العرض الفعلية وPWA ولا يعامل وثائق التاريخ أو إعدادات المشروع غير المعروضة كواجهة", () => {
    const visibleFiles = collectVisibleFiles(resolve(process.cwd(), "client"));
    expect(visibleFiles.length).toBeGreaterThan(0);
    for (const path of visibleFiles) {
      const content = readFileSync(path, "utf8");
      expect(content, `Legacy brand found in visible file: ${path}`).not.toMatch(/ديجيترا ERP|DgTera ERP|دكتره ERP/);
    }
  });
});
