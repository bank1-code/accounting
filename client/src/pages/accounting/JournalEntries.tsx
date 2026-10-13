import { useI18n } from "@/lib/i18n";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { PermissionAction } from "@/components/PermissionAction";
import { createJournalEntryDraftFrom } from "@/lib/journalEntryDraft";
import { toast } from "sonner";
import { Plus, FileText, Loader2, Check, X, Trash2, CopyPlus, BookmarkPlus, FolderOpen } from "lucide-react";
import { useEffect, useState } from "react";

type EntryLine = { accountId: number; costCenterId?: number; branchId?: number; debit: string; credit: string; description?: string };

export default function JournalEntries() {
  const { t, locale } = useI18n();
  const utils = trpc.useUtils();
  const { data: entries, isLoading } = trpc.journalEntries.list.useQuery();
  const { data: accounts } = trpc.accounts.list.useQuery();
  const { data: costCenters } = trpc.costCenters.list.useQuery();
  const { data: branches } = trpc.branches.list.useQuery();
  const { data: nextNumber } = trpc.journalEntries.nextNumber.useQuery();
  const { data: templates } = trpc.journalTemplates.list.useQuery();
  const [sourceEntryId, setSourceEntryId] = useState<number | null>(null);
  const sourceEntry = trpc.journalEntries.get.useQuery({ id: sourceEntryId ?? 0 }, { enabled: sourceEntryId !== null });

  const createMutation = trpc.journalEntries.create.useMutation({
    onSuccess: () => { utils.journalEntries.list.invalidate(); utils.journalEntries.nextNumber.invalidate(); setDialogOpen(false); setSourceEntryNumber(null); toast.success(t.success); },
    onError: (err) => toast.error(err.message),
  });
  const postMutation = trpc.journalEntries.post.useMutation({
    onSuccess: () => { utils.journalEntries.list.invalidate(); utils.accounts.list.invalidate(); toast.success(t.success); },
    onError: (err) => toast.error(err.message),
  });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ description: "", reference: "", date: new Date().toISOString().split("T")[0] });
  const [lines, setLines] = useState<EntryLine[]>([{ accountId: 0, debit: "", credit: "", description: "" }, { accountId: 0, debit: "", credit: "", description: "" }]);
  const [sourceEntryNumber, setSourceEntryNumber] = useState<string | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState("none");
  const [templateSaveVisible, setTemplateSaveVisible] = useState(false);
  const [templateName, setTemplateName] = useState("");

  useEffect(() => {
    if (!sourceEntryId || !sourceEntry.data) return;
    const draft = createJournalEntryDraftFrom(sourceEntry.data);
    setForm(draft.form);
    setLines(draft.lines);
    setSourceEntryNumber(sourceEntry.data.entryNumber);
    setDialogOpen(true);
    setSourceEntryId(null);
    toast.success(t.acc.copyDraftOpened);
  }, [sourceEntry.data, sourceEntryId, t.acc.copyDraftOpened]);

  const openBlankDraft = () => {
    setForm({ description: "", reference: "", date: new Date().toISOString().split("T")[0] });
    setLines([{ accountId: 0, debit: "", credit: "" }, { accountId: 0, debit: "", credit: "" }]);
    setSourceEntryNumber(null);
    setTemplateSaveVisible(false);
    setDialogOpen(true);
  };

  const startDraftFrom = (entryId: number) => {
    setSourceEntryId(entryId);
    void utils.journalEntries.nextNumber.invalidate();
  };

  const templateCreateMutation = trpc.journalTemplates.create.useMutation({
    onSuccess: () => { utils.journalTemplates.list.invalidate(); setTemplateSaveVisible(false); setTemplateName(""); toast.success(t.acc.templateSaved); },
    onError: (err) => toast.error(err.message),
  });

  const loadTemplate = (templateId: string) => {
    setSelectedTemplateId(templateId);
    const template = templates?.find((item) => String(item.id) === templateId);
    if (!template) return;
    const draft = createJournalEntryDraftFrom(template.templateData);
    setForm(draft.form);
    setLines(draft.lines);
    setSourceEntryNumber(template.sourceEntryNumber || null);
    setTemplateSaveVisible(false);
    setDialogOpen(true);
    void utils.journalEntries.nextNumber.invalidate();
    toast.success(t.acc.templateLoaded);
  };

  const saveCurrentAsTemplate = () => {
    if (!templateName.trim()) { toast.error(t.required); return; }
    if (!isBalanced || lines.some((line) => !line.accountId)) { toast.error(t.acc.unbalanced); return; }
    templateCreateMutation.mutate({
      name: templateName.trim(), sourceEntryNumber: sourceEntryNumber || undefined,
      templateData: { description: form.description, reference: form.reference, lines: lines.map((line) => ({
        accountId: line.accountId, ...(line.costCenterId ? { costCenterId: line.costCenterId } : {}), ...(line.branchId ? { branchId: line.branchId } : {}),
        debit: line.debit || "0", credit: line.credit || "0", ...(line.description ? { description: line.description } : {}),
      })) },
    });
  };

  const addLine = () => setLines([...lines, { accountId: 0, debit: "", credit: "", description: "" }]);
  const removeLine = (i: number) => { if (lines.length > 2) setLines(lines.filter((_, idx) => idx !== i)); };
  const updateLine = (i: number, field: keyof EntryLine, value: string | number) => {
    const newLines = [...lines];
    (newLines[i] as Record<string, unknown>)[field] = value;
    setLines(newLines);
  };

  const totalDebit = lines.reduce((s, l) => s + parseFloat(l.debit || "0"), 0);
  const totalCredit = lines.reduce((s, l) => s + parseFloat(l.credit || "0"), 0);
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01;

  const handleSubmit = () => {
    if (!isBalanced) { toast.error(t.acc.unbalanced); return; }
    if (lines.some((l) => !l.accountId)) { toast.error(t.required); return; }
    createMutation.mutate({
      entryNumber: nextNumber || "JE-0001",
      date: new Date(form.date),
      description: form.description,
      reference: form.reference,
      sourceEntryNumber: sourceEntryNumber || undefined,
      lines: lines.map((l) => ({ ...l, debit: l.debit || "0", credit: l.credit || "0" })),
    });
  };

  const statusBadge = (status: string) => {
    if (status === "posted") return <Badge className="bg-green-100 text-green-800">{t.acc.posted}</Badge>;
    if (status === "reversed") return <Badge className="bg-red-100 text-red-800">{t.acc.reversed}</Badge>;
    return <Badge variant="secondary">{t.acc.draft}</Badge>;
  };

  const fmt = (v: unknown) => parseFloat(String(v || 0)).toLocaleString(locale === "ar" ? "ar-SA" : "en-US", { minimumFractionDigits: 2 });

  return (
    <div className="space-y-4">
      <div className="page-header">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-blue-50 flex items-center justify-center">
            <FileText className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <h1 className="page-title">{t.acc.journalEntry}</h1>
            <p className="text-sm text-muted-foreground">{entries?.length ?? 0} {t.acc.journalEntry}</p>
          </div>
        </div>
        <PermissionAction permissions={["accounting.journal.create"]}>
          <Button onClick={openBlankDraft}>
            <Plus className="h-4 w-4 me-2" />{t.acc.addJournalEntry}
          </Button>
        </PermissionAction>
      </div>

      <Card className="border-dashed bg-muted/20"><CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-medium">{t.acc.readyTemplates}</p><p className="mt-1 text-xs text-muted-foreground">{t.acc.readyTemplatesHint}</p></div><div className="w-full sm:w-72"><Select value={selectedTemplateId} onValueChange={loadTemplate}><SelectTrigger><FolderOpen className="me-2 h-4 w-4 text-primary" /><SelectValue placeholder={t.acc.selectTemplate} /></SelectTrigger><SelectContent><SelectItem value="none">{t.acc.selectTemplate}</SelectItem>{templates?.map((template) => <SelectItem key={template.id} value={String(template.id)}>{template.name}{template.sourceEntryNumber ? ` — ${template.sourceEntryNumber}` : ""}</SelectItem>)}</SelectContent></Select></div></CardContent></Card>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center h-40"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : !entries?.length ? (
            <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
              <FileText className="h-8 w-8 mb-2" /><p>{t.noData}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr className="bg-muted/30">
                    <th className="px-4 py-3 text-start">{t.acc.entryNumber}</th>
                    <th className="px-4 py-3 text-start">{t.acc.entryDate}</th>
                    <th className="px-4 py-3 text-start">{t.acc.description}</th>
                    <th className="px-4 py-3 text-end">{t.acc.totalDebit}</th>
                    <th className="px-4 py-3 text-end">{t.acc.totalCredit}</th>
                    <th className="px-4 py-3 text-center">{t.status}</th>
                    <th className="px-4 py-3 w-44">{t.actions}</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry) => (
                    <tr key={entry.id} className="hover:bg-muted/50">
                      <td className="px-4 py-2.5 border-t font-mono text-sm">{entry.entryNumber}</td>
                      <td className="px-4 py-2.5 border-t">{new Date(entry.date).toLocaleDateString(locale === "ar" ? "ar-SA" : "en-US")}</td>
                      <td className="px-4 py-2.5 border-t">{entry.description || "-"}</td>
                      <td className="px-4 py-2.5 border-t text-end tabular-nums">{fmt(entry.totalDebit)}</td>
                      <td className="px-4 py-2.5 border-t text-end tabular-nums">{fmt(entry.totalCredit)}</td>
                      <td className="px-4 py-2.5 border-t text-center">{statusBadge(entry.status)}</td>
                      <td className="px-4 py-2.5 border-t">
                        <PermissionAction permissions={["accounting.journal.create"]}>
                          <Button variant="ghost" size="sm" onClick={() => startDraftFrom(entry.id)} disabled={sourceEntry.isFetching}>
                            <CopyPlus className="h-3.5 w-3.5 me-1" />{t.acc.addFrom}
                          </Button>
                        </PermissionAction>
                        {entry.status === "draft" && (
                          <PermissionAction permissions={["accounting.journal.post"]}>
                            <Button variant="ghost" size="sm" onClick={() => postMutation.mutate({ id: entry.id })} disabled={postMutation.isPending}>
                              <Check className="h-3.5 w-3.5 me-1" />{t.acc.postEntry}
                            </Button>
                          </PermissionAction>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Journal Entry Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) { setTemplateSaveVisible(false); setTemplateName(""); } }}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t.acc.addJournalEntry} - {nextNumber}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {sourceEntryNumber && <div className="flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-sm text-primary" data-testid="journal-source-reference"><CopyPlus className="h-4 w-4 shrink-0" /><span>{t.acc.copiedFromEntry}: <strong dir="ltr">{sourceEntryNumber}</strong></span></div>}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>{t.acc.entryDate}</Label>
                <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} dir="ltr" />
              </div>
              <div>
                <Label>{t.acc.description}</Label>
                <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>
              <div>
                <Label>{t.acc.reference}</Label>
                <Input value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} />
              </div>
            </div>

            {/* Entry Lines */}
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/30">
                    <th className="px-3 py-2 text-start">{t.acc.accountName}</th>
                    <th className="px-3 py-2 text-start">{t.acc.costCenter}</th>
                    <th className="px-3 py-2 text-end w-32">{t.acc.debit}</th>
                    <th className="px-3 py-2 text-end w-32">{t.acc.credit}</th>
                    <th className="px-3 py-2 text-start">{t.acc.description}</th>
                    <th className="px-3 py-2 w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line, i) => (
                    <tr key={i}>
                      <td className="px-2 py-1.5 border-t">
                        <Select value={line.accountId?.toString() || "0"} onValueChange={(v) => updateLine(i, "accountId", parseInt(v))}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder={t.acc.accountName} /></SelectTrigger>
                          <SelectContent>
                            {accounts?.map((a) => (
                              <SelectItem key={a.id} value={a.id.toString()}>{a.code} - {locale === "ar" ? a.name : (a.nameEn || a.name)}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-2 py-1.5 border-t">
                        <Select value={line.costCenterId?.toString() || "none"} onValueChange={(v) => updateLine(i, "costCenterId", v === "none" ? 0 : parseInt(v))}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder={t.optional} /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">--</SelectItem>
                            {costCenters?.map((c) => (
                              <SelectItem key={c.id} value={c.id.toString()}>{c.code} - {c.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-2 py-1.5 border-t">
                        <Input className="h-8 text-xs text-end" dir="ltr" value={line.debit} onChange={(e) => updateLine(i, "debit", e.target.value)} placeholder="0.00" />
                      </td>
                      <td className="px-2 py-1.5 border-t">
                        <Input className="h-8 text-xs text-end" dir="ltr" value={line.credit} onChange={(e) => updateLine(i, "credit", e.target.value)} placeholder="0.00" />
                      </td>
                      <td className="px-2 py-1.5 border-t">
                        <Input className="h-8 text-xs" value={line.description || ""} onChange={(e) => updateLine(i, "description", e.target.value)} />
                      </td>
                      <td className="px-2 py-1.5 border-t">
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => removeLine(i)} disabled={lines.length <= 2}>
                          <Trash2 className="h-3 w-3 text-destructive" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-muted/30 font-medium">
                    <td colSpan={2} className="px-3 py-2">
                      <Button variant="ghost" size="sm" onClick={addLine}><Plus className="h-3 w-3 me-1" />{t.add}</Button>
                    </td>
                    <td className="px-3 py-2 text-end tabular-nums">{fmt(totalDebit)}</td>
                    <td className="px-3 py-2 text-end tabular-nums">{fmt(totalCredit)}</td>
                    <td className="px-3 py-2">
                      <Badge className={isBalanced ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}>
                        {isBalanced ? t.acc.balanced : `${t.acc.difference}: ${fmt(Math.abs(totalDebit - totalCredit))}`}
                      </Badge>
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
            {templateSaveVisible && <div className="rounded-lg border bg-muted/20 p-3"><Label>{t.acc.templateName}</Label><div className="mt-2 flex gap-2"><Input value={templateName} onChange={(event) => setTemplateName(event.target.value)} placeholder={t.acc.templateName} maxLength={160} /><Button type="button" variant="secondary" onClick={saveCurrentAsTemplate} disabled={templateCreateMutation.isPending}>{templateCreateMutation.isPending && <Loader2 className="me-2 h-4 w-4 animate-spin" />}{t.acc.saveTemplate}</Button></div></div>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{t.cancel}</Button>
            <Button type="button" variant="outline" onClick={() => setTemplateSaveVisible((visible) => !visible)}><BookmarkPlus className="me-2 h-4 w-4" />{t.acc.saveAsTemplate}</Button>
            <Button onClick={handleSubmit} disabled={!isBalanced || createMutation.isPending}>
              {createMutation.isPending && <Loader2 className="h-4 w-4 me-2 animate-spin" />}
              {t.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
