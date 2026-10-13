import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createJournalEntryDraftFrom } from "../client/src/lib/journalEntryDraft";
import { appRouter } from "./routers";
import * as db from "./db";
import type { TrpcContext } from "./_core/context";

function journalContext(): TrpcContext {
  return { user: { id: 450001, openId: null, username: "admina", passwordHash: "hidden", email: null, name: "System Owner", loginMethod: "local", role: "admin", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() }, req: { protocol: "https", headers: {} } as TrpcContext["req"], res: {} as TrpcContext["res"] };
}

describe("إضافة من للقيد اليومي", () => {
  it("ينشئ مسودة مستقلة بنسخ الحقول القابلة للتعديل وبنود القيد وتاريخ اليوم", () => {
    const draft = createJournalEntryDraftFrom({
      description: "رواتب شهرية", reference: "PAYROLL-08", lines: [
        { accountId: 10, costCenterId: 3, branchId: 2, debit: "1000.00", credit: "0.00", description: "إجمالي الرواتب" },
        { accountId: 20, costCenterId: null, branchId: 2, debit: "0.00", credit: "1000.00", description: "بنك" },
      ],
    }, new Date(2026, 7, 21, 10, 30));
    expect(draft).toEqual({
      form: { description: "رواتب شهرية", reference: "PAYROLL-08", date: "2026-08-21" },
      lines: [
        { accountId: 10, costCenterId: 3, branchId: 2, debit: "1000.00", credit: "0.00", description: "إجمالي الرواتب" },
        { accountId: 20, branchId: 2, debit: "0.00", credit: "1000.00", description: "بنك" },
      ],
    });
    expect(draft).not.toHaveProperty("entryNumber");
    expect(draft).not.toHaveProperty("id");
  });

  it("يربط الزر بقراءة القيد ويفتح نموذج المسودة دون إنشاء أو ترحيل تلقائي", () => {
    const page = readFileSync(resolve(process.cwd(), "client/src/pages/accounting/JournalEntries.tsx"), "utf8");
    expect(page).toContain("trpc.journalEntries.get.useQuery");
    expect(page).toContain("createJournalEntryDraftFrom(sourceEntry.data)");
    expect(page).toContain("setDialogOpen(true)");
    expect(page).toContain("{t.acc.addFrom}");
    expect(page).not.toContain("startDraftFrom(entry.id); createMutation.mutate");
    expect(page).not.toContain("startDraftFrom(entry.id); postMutation.mutate");
  });

  it("يعرض إشعار نجاح ومرجع القيد المصدر ويقدم حفظ واستدعاء القوالب دون حفظ القيد تلقائياً", () => {
    const page = readFileSync(resolve(process.cwd(), "client/src/pages/accounting/JournalEntries.tsx"), "utf8");
    expect(page).toContain("toast.success(t.acc.copyDraftOpened)");
    expect(page).toContain('data-testid="journal-source-reference"');
    expect(page).toContain("sourceEntryNumber: sourceEntryNumber || undefined");
    expect(page).toContain("trpc.journalTemplates.list.useQuery");
    expect(page).toContain("trpc.journalTemplates.create.useMutation");
    expect(page).toContain("saveCurrentAsTemplate");
    expect(page).not.toContain("loadTemplate(templateId); createMutation.mutate");
    expect(page).not.toContain("loadTemplate(templateId); postMutation.mutate");
  });

  it("يحمي الوصول إلى قوالب القيود بصلاحية إنشاء القيد الذرية", async () => {
    vi.spyOn(db, "hasAtomicPermission").mockResolvedValue(true);
    vi.spyOn(db, "listJournalEntryTemplates").mockResolvedValue([]);
    await expect(appRouter.createCaller(journalContext()).journalTemplates.list()).resolves.toEqual([]);
    expect(db.hasAtomicPermission).toHaveBeenCalledWith(450001, "accounting.journal.create", {});
  });
});
