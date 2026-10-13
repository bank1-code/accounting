# DELIVERY CHECKLIST — دكتره Doktra ERP

تاريخ الحزمة: 2026-10-13

## المحتوى

- [x] Source code included — الواجهة والخادم والمكونات المشتركة.
- [x] Frontend included — `client/` وملفات PWA وAssets المستخدمة.
- [x] Backend included — `server/` وtRPC وطبقة الخدمات.
- [x] Database files included — `drizzle/` و`drizzle-live/` و`drizzle.config.ts`.
- [x] Scripts included — `scripts/` للترحيل والتحقق وUAT.
- [x] Dependencies documented — `package.json` و`pnpm-lock.yaml`.
- [x] Environment variables documented — `.env.example` وREADME.
- [x] Secrets removed — لم يتم تضمين `.env` أو مفاتيح/شهادات حقيقية بعد الفحص النصي.
- [x] README created — تعليمات تثبيت وتشغيل وبناء ونشر.
- [x] Handover documentation created — `HANDOVER.md`.
- [x] Unnecessary files removed — لا `node_modules` ولا `.git` ولا سجلات أو cache أو build قديم.
- [x] Project structure verified — تم الحفاظ على Architecture الأصلية.

## الفحص

- [x] فحص الملفات الشبيهة بالأسرار (`.env`, private keys, credential files).
- [x] فحص نصي للأنماط الشائعة لمفاتيح API وكلمات المرور المضمنة.
- [x] مراجعة متغيرات البيئة المستخدمة في المصدر وتوثيقها.
- [x] التحقق من أن المستودع البعيد فارغ قبل الرفع.
- [x] `pnpm install --frozen-lockfile` داخل نسخة التسليم.
- [x] `pnpm check` — نجح دون أخطاء TypeScript.
- [x] `pnpm test` — نجحت 54 مجموعة اختبار و217 اختباراً.
- [x] `pnpm build` — نجح بناء الواجهة والخادم.
- [ ] `pnpm db:verify` — يتطلب `DATABASE_URL` صالحاً وقاعدة اختبار معزولة.

## ملاحظات

- لا تعتبر علامة `[x]` في وثائق الجاهزية إثباتاً لاعتماد ZATCA الرسمي.
- بيانات UAT ليست جزءاً من الحزمة؛ أي قاعدة خارجية يجب التعامل معها وفق سياسة العميل.
- قبل الإنتاج يجب تدوير جميع الأسرار وإنشاء نسخة احتياطية واختبار الاستعادة.
