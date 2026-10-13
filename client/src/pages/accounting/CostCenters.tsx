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
import { toast } from "sonner";
import { Plus, Edit2, Target, Loader2 } from "lucide-react";
import { useState } from "react";

export default function CostCenters() {
  const { t, locale } = useI18n();
  const utils = trpc.useUtils();
  const { data: centers, isLoading } = trpc.costCenters.list.useQuery();
  const { data: branches } = trpc.branches.list.useQuery();
  const createMutation = trpc.costCenters.create.useMutation({
    onSuccess: () => { utils.costCenters.list.invalidate(); setDialogOpen(false); toast.success(t.success); },
    onError: (err) => toast.error(err.message),
  });
  const updateMutation = trpc.costCenters.update.useMutation({
    onSuccess: () => { utils.costCenters.list.invalidate(); setDialogOpen(false); toast.success(t.success); },
    onError: (err) => toast.error(err.message),
  });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState({ name: "", code: "", branchId: undefined as number | undefined, type: "profit" as "profit" | "cost" });

  const resetForm = () => setForm({ name: "", code: "", branchId: undefined, type: "profit" });

  const handleSubmit = () => {
    if (!form.name || !form.code) { toast.error(t.required); return; }
    if (editId) { updateMutation.mutate({ id: editId, ...form }); }
    else { createMutation.mutate(form); }
  };

  return (
    <div className="space-y-4">
      <div className="page-header">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-purple-50 flex items-center justify-center">
            <Target className="h-5 w-5 text-purple-600" />
          </div>
          <div>
            <h1 className="page-title">{t.acc.costCenter}</h1>
            <p className="text-sm text-muted-foreground">{centers?.length ?? 0} {t.acc.costCenter}</p>
          </div>
        </div>
        <PermissionAction permissions={["accounting.coa.manage"]}>
          <Button onClick={() => { resetForm(); setEditId(null); setDialogOpen(true); }}>
            <Plus className="h-4 w-4 me-2" />{t.acc.addCostCenter}
          </Button>
        </PermissionAction>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center h-40"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : !centers?.length ? (
            <div className="flex flex-col items-center justify-center h-40 text-muted-foreground"><Target className="h-8 w-8 mb-2" /><p>{t.noData}</p></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead><tr className="bg-muted/30">
                  <th className="px-4 py-3 text-start">{t.code}</th>
                  <th className="px-4 py-3 text-start">{t.name_}</th>
                  <th className="px-4 py-3 text-start">{t.type}</th>
                  <th className="px-4 py-3 text-start">{t.nav.branches}</th>
                  <th className="px-4 py-3 text-center">{t.status}</th>
                  <th className="px-4 py-3 w-16"></th>
                </tr></thead>
                <tbody>
                  {centers.map((c) => (
                    <tr key={c.id} className="hover:bg-muted/50">
                      <td className="px-4 py-2.5 border-t font-mono text-sm">{c.code}</td>
                      <td className="px-4 py-2.5 border-t font-medium">{c.name}</td>
                      <td className="px-4 py-2.5 border-t">
                        <Badge variant="secondary" className={c.type === "profit" ? "bg-green-100 text-green-800" : "bg-orange-100 text-orange-800"}>
                          {c.type === "profit" ? t.acc.profitCenter : t.acc.costCenter}
                        </Badge>
                      </td>
                      <td className="px-4 py-2.5 border-t">{branches?.find((b) => b.id === c.branchId)?.name || "-"}</td>
                      <td className="px-4 py-2.5 border-t text-center">
                        <Badge variant={c.isActive ? "default" : "secondary"}>{c.isActive ? t.active : t.inactive}</Badge>
                      </td>
                      <td className="px-4 py-2.5 border-t">
                        <PermissionAction permissions={["accounting.coa.manage"]}>
                          <Button variant="ghost" size="sm" onClick={() => { setEditId(c.id); setForm({ name: c.name, code: c.code, branchId: c.branchId ?? undefined, type: c.type as "profit" | "cost" }); setDialogOpen(true); }}>
                            <Edit2 className="h-3.5 w-3.5" />
                          </Button>
                        </PermissionAction>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>{editId ? t.edit : t.acc.addCostCenter}</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div><Label>{t.code}</Label><Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} dir="ltr" /></div>
              <div>
                <Label>{t.type}</Label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v as "profit" | "cost" })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="profit">{t.acc.profitCenter}</SelectItem>
                    <SelectItem value="cost">{t.acc.costCenter}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>{t.name_}</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div>
              <Label>{t.nav.branches}</Label>
              <Select value={form.branchId?.toString() || "none"} onValueChange={(v) => setForm({ ...form, branchId: v === "none" ? undefined : parseInt(v) })}>
                <SelectTrigger><SelectValue placeholder={t.optional} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">-- {t.optional} --</SelectItem>
                  {branches?.map((b) => (<SelectItem key={b.id} value={b.id.toString()}>{b.name}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{t.cancel}</Button>
            <Button onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending}>
              {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="h-4 w-4 me-2 animate-spin" />}{t.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
