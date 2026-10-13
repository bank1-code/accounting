import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("PWA دكتره / Doktra", () => {
  const manifest = readFileSync(resolve(process.cwd(), "client/public/manifest.webmanifest"), "utf8");
  const serviceWorker = readFileSync(resolve(process.cwd(), "client/public/sw.js"), "utf8");
  const main = readFileSync(resolve(process.cwd(), "client/src/main.tsx"), "utf8");
  const layout = readFileSync(resolve(process.cwd(), "client/src/components/DashboardLayout.tsx"), "utf8");

  it("يعرّف manifest باسم التطبيق المعتمد ويدعم التثبيت المستقل", () => {
    expect(manifest).toContain('"name": "دكتره | Doktra"');
    expect(manifest).toContain('"display": "standalone"');
    expect(manifest).toContain('"start_url": "/"');
    expect(manifest).toContain('"src": "/manus-storage/doktra-pwa-icon_eacc1249.png"');
  });

  it("يسجل خدمة PWA ويوفر زر تثبيت بجوار أدوات المستخدم", () => {
    expect(serviceWorker).toContain("doktra-shell-v1");
    expect(main).toContain('navigator.serviceWorker.register("/sw.js")');
    expect(layout).toContain("<PWAInstallButton />");
  });

  it("يعرض إرشاداً بديلاً للتثبيت على iPhone وiPad عند غياب prompt المتصفح", () => {
    const button = readFileSync(resolve(process.cwd(), "client/src/components/PWAInstallButton.tsx"), "utf8");
    expect(button).toContain("iphone|ipad|ipod");
    expect(button).toContain("إضافة إلى الشاشة الرئيسية");
  });

  it("يمنع رجوع الاسم القديم في ملفات الواجهة وPWA الأساسية", () => {
    const files = [manifest, serviceWorker, main, layout, readFileSync(resolve(process.cwd(), "client/index.html"), "utf8")];
    for (const content of files) {
      expect(content).not.toMatch(/ديجيترا ERP|DgTera ERP|دكتره ERP/);
    }
  });
});
