import { useI18n } from "@/lib/i18n";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { PermissionAction } from "@/components/PermissionAction";
import { toast } from "sonner";
import { Plus, Edit2, ChevronLeft, ChevronRight, BookOpen, Loader2 } from "lucide-react";
import { useState, useMemo } from "react";

const ACCOUNT_TYPES = ["asset", "liability", "equity", "revenue", "expense"] as const;

export default function ChartOfAccounts() {
  const { t, locale } = useI18n();
  const utils = trpc.useUtils();
  const { data: accounts, isLoading } = trpc.accounts.list.useQuery();
  const createMutation = trpc.accounts.create.useMutation({
    onSuccess: () => { utils.accounts.list.invalidate(); setDialogOpen(false); resetForm(); toast.success(t.success); },
    onError: (err) => toast.error(err.message),
  });
  const updateMutation = trpc.accounts.update.useMutation({
    onSuccess: () => { utils.accounts.list.invalidate(); setDialogOpen(false); resetForm(); toast.success(t.success); },
    onError: (err) => toast.error(err.message),
  });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState({ code: "", name: "", nameEn: "", type: "asset" as typeof ACCOUNT_TYPES[number], parentId: undefined as number | undefined, level: 1 });

  const resetForm = () => setForm({ code: "", name: "", nameEn: "", type: "asset", parentId: undefined, level: 1 });

  const openCreate = () => { resetForm(); setEditId(null); setDialogOpen(true); };
  const openEdit = (acc: NonNullable<typeof accounts>[0]) => {
    setEditId(acc.id);
    setForm({ code: acc.code, name: acc.name, nameEn: acc.nameEn || "", type: acc.type as typeof ACCOUNT_TYPES[number], parentId: acc.parentId ?? undefined, level: acc.level ?? 1 });
    setDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!form.code || !form.name) { toast.error(t.required); return; }
    if (editId) {
      updateMutation.mutate({ id: editId, ...form });
    } else {
      createMutation.mutate(form);
    }
  };

  const typeLabel = (type: string) => {
    const map: Record<string, string> = { asset: t.acc.asset, liability: t.acc.liability, equity: t.acc.equity, revenue: t.acc.revenue, expense: t.acc.expense };
    return map[type] || type;
  };

  const typeColor = (type: string) => {
    const map: Record<string, string> = { asset: "bg-blue-100 text-blue-800", liability: "bg-red-100 text-red-800", equity: "bg-purple-100 text-purple-800", revenue: "bg-green-100 text-green-800", expense: "bg-orange-100 text-orange-800" };
    return map[type] || "";
  };

  // Build tree structure
  const tree = useMemo(() => {
    if (!accounts) return [];
    const map = new Map<number, typeof accounts[0] & { children: typeof accounts }>();
    const roots: (typeof accounts[0] & { children: typeof accounts })[] = [];
    accounts.forEach((a) => map.set(a.id, { ...a, children: [] }));
    accounts.forEach((a) => {
      const node = map.get(a.id)!;
      if (a.parentId && map.has(a.parentId)) {
        map.get(a.parentId)!.children.push(node);
      } else {
        roots.push(node);
      }
    });
    return roots;
  }, [accounts]);

  const renderRow = (acc: typeof tree[0], depth = 0): React.ReactNode => (
    <tr key={acc.id} className="hover:bg-muted/50">
      <td className="px-4 py-2.5 border-t">
        <span style={{ paddingInlineStart: `${depth * 24}px` }} className="flex items-center gap-2">
          {acc.children.length > 0 && <ChevronLeft className="h-3 w-3 text-muted-foreground rtl:rotate-180" />}
          <span className="font-mono text-xs text-muted-foreground">{acc.code}</span>
        </span>
      </td>
      <td className="px-4 py-2.5 border-t font-medium">
        <span style={{ paddingInlineStart: `${depth * 24}px` }}>
          {locale === "ar" ? acc.name : (acc.nameEn || acc.name)}
        </span>
      </td>
      <td className="px-4 py-2.5 border-t">
        <Badge variant="secondary" className={`text-xs ${typeColor(acc.type)}`}>{typeLabel(acc.type)}</Badge>
      </td>
      <td className="px-4 py-2.5 border-t text-end tabular-nums font-medium">
        {parseFloat(String(acc.balance || 0)).toLocaleString(locale === "ar" ? "ar-SA" : "en-US", { minimumFractionDigits: 2 })}
      </td>
      <td className="px-4 py-2.5 border-t">
        <PermissionAction permissions={["accounting.coa.manage"]}>
          <Button variant="ghost" size="sm" onClick={() => openEdit(acc)}>
            <Edit2 className="h-3.5 w-3.5" />
          </Button>
        </PermissionAction>
      </td>
      {(acc.children as typeof tree).map((child) => renderRow(child, depth + 1))}
    </tr>
  );

  return (
    <div className="space-y-4">
      <div className="page-header">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-blue-50 flex items-center justify-center">
            <BookOpen className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <h1 className="page-title">{t.acc.chartOfAccounts}</h1>
            <p className="text-sm text-muted-foreground">{accounts?.length ?? 0} {t.acc.chartOfAccounts}</p>
          </div>
        </div>
        <PermissionAction permissions={["accounting.coa.manage"]}>
          <Button onClick={openCreate}><Plus className="h-4 w-4 me-2" />{t.acc.addAccount}</Button>
        </PermissionAction>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center h-40"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : !accounts?.length ? (
            <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
              <BookOpen className="h-8 w-8 mb-2" />
              <p>{t.noData}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr className="bg-muted/30">
                    <th className="px-4 py-3 text-start text-sm font-medium text-muted-foreground">{t.acc.accountCode}</th>
                    <th className="px-4 py-3 text-start text-sm font-medium text-muted-foreground">{t.acc.accountName}</th>
                    <th className="px-4 py-3 text-start text-sm font-medium text-muted-foreground">{t.acc.accountType}</th>
                    <th className="px-4 py-3 text-end text-sm font-medium text-muted-foreground">{t.acc.balance}</th>
                    <th className="px-4 py-3 w-16"></th>
                  </tr>
                </thead>
                <tbody>
                  {tree.map((acc) => renderRow(acc))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editId ? t.acc.editAccount : t.acc.addAccount}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{t.acc.accountCode}</Label>
                <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="1100" dir="ltr" />
              </div>
              <div>
                <Label>{t.acc.accountType}</Label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v as typeof ACCOUNT_TYPES[number] })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ACCOUNT_TYPES.map((t2) => (
                      <SelectItem key={t2} value={t2}>{typeLabel(t2)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>{t.acc.accountName} ({t.language === "اللغة" ? "عربي" : "Arabic"})</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <Label>{t.acc.accountName} (English)</Label>
              <Input value={form.nameEn} onChange={(e) => setForm({ ...form, nameEn: e.target.value })} dir="ltr" />
            </div>
            <div>
              <Label>{t.acc.parentAccount}</Label>
              <Select value={form.parentId?.toString() || "none"} onValueChange={(v) => setForm({ ...form, parentId: v === "none" ? undefined : parseInt(v) })}>
                <SelectTrigger><SelectValue placeholder={t.optional} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">-- {t.optional} --</SelectItem>
                  {accounts?.map((a) => (
                    <SelectItem key={a.id} value={a.id.toString()}>{a.code} - {locale === "ar" ? a.name : (a.nameEn || a.name)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{t.cancel}</Button>
            <Button onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending}>
              {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="h-4 w-4 me-2 animate-spin" />}
              {t.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
