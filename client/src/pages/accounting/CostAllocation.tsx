import { useI18n } from "@/lib/i18n";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Loader2, ClipboardList, CheckCircle2, Send } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function CostAllocation() {
  const { t } = useI18n();
  const utils = trpc.useUtils();
  const { data: allocations, isLoading } = trpc.costAllocations.list.useQuery();
  const { data: centers } = trpc.costCenters.list.useQuery();
  const { data: accounts } = trpc.accounts.list.useQuery();
  const createMut = trpc.costAllocations.create.useMutation({
    onSuccess: () => { utils.costAllocations.list.invalidate(); setOpen(false); toast.success(t.success); },
    onError: () => toast.error(t.error),
  });
  const approveMut = trpc.costAllocations.approve.useMutation({ onSuccess: () => { utils.costAllocations.list.invalidate(); toast.success(t.acc.allocationApproved); }, onError: (error) => toast.error(error.message) });
  const postMut = trpc.costAllocations.post.useMutation({ onSuccess: () => { utils.costAllocations.list.invalidate(); toast.success(t.acc.allocationPosted); }, onError: (error) => toast.error(error.message) });

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", method: "sales_ratio" as const, periodStart: "", periodEnd: "", totalAmount: "", sourceAccountId: 0, sourceCostCenterId: 0 });
  const [lines, setLines] = useState<Array<{ costCenterId: number; amount: string; ratio: string }>>([]);

  const addLine = () => setLines([...lines, { costCenterId: 0, amount: "0", ratio: "0" }]);
  const removeLine = (i: number) => setLines(lines.filter((_, idx) => idx !== i));

  const distributeEvenly = () => {
    if (!lines.length || !form.totalAmount) return;
    const perCenter = (parseFloat(form.totalAmount) / lines.length).toFixed(2);
    const ratio = (100 / lines.length).toFixed(2);
    setLines(lines.map(l => ({ ...l, amount: perCenter, ratio })));
  };

  const handleSubmit = () => {
    if (!form.name || !form.periodStart || !form.periodEnd || !form.totalAmount || form.sourceAccountId <= 0 || lines.filter((line) => line.costCenterId > 0).length === 0) {
      toast.error(t.required); return;
    }
    createMut.mutate({
      ...form,
      method: form.method as "sales_ratio" | "branch_count" | "employee_count" | "custom",
      periodStart: new Date(form.periodStart),
      periodEnd: new Date(form.periodEnd),
      lines: lines.filter(l => l.costCenterId > 0),
    });
  };

  const methodLabels: Record<string, string> = {
    sales_ratio: t.acc.salesRatio,
    branch_count: t.acc.branchCount,
    employee_count: t.acc.employeeCount,
    custom: t.acc.custom,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t.acc.costAllocation}</h1>
          <p className="text-muted-foreground mt-1">{t.acc.allocationMethod}</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 me-2" />{t.add}</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{t.acc.costAllocation}</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label>{t.name_}</Label>
                <Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
              </div>
              <div>
                <Label>{t.acc.allocationMethod}</Label>
                <Select value={form.method} onValueChange={v => setForm({...form, method: v as typeof form.method})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sales_ratio">{t.acc.salesRatio}</SelectItem>
                    <SelectItem value="branch_count">{t.acc.branchCount}</SelectItem>
                    <SelectItem value="employee_count">{t.acc.employeeCount}</SelectItem>
                    <SelectItem value="custom">{t.acc.custom}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{t.amount}</Label>
                <Input type="number" value={form.totalAmount} onChange={e => setForm({...form, totalAmount: e.target.value})} />
              </div>
              <div>
                <Label>{t.acc.sourceAccount}</Label>
                <Select value={form.sourceAccountId ? String(form.sourceAccountId) : "none"} onValueChange={v => setForm({ ...form, sourceAccountId: v === "none" ? 0 : Number(v) })}>
                  <SelectTrigger><SelectValue placeholder={t.acc.sourceAccount} /></SelectTrigger>
                  <SelectContent><SelectItem value="none">{t.acc.selectAccount}</SelectItem>{accounts?.filter(a => a.isActive).map(a => <SelectItem key={a.id} value={String(a.id)}>{a.code} — {a.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>{t.acc.sourceCostCenter}</Label>
                <Select value={form.sourceCostCenterId ? String(form.sourceCostCenterId) : "none"} onValueChange={v => setForm({ ...form, sourceCostCenterId: v === "none" ? 0 : Number(v) })}>
                  <SelectTrigger><SelectValue placeholder={t.optional} /></SelectTrigger>
                  <SelectContent><SelectItem value="none">{t.optional}</SelectItem>{centers?.filter(c => c.isActive).map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>{t.from}</Label>
                <Input type="date" value={form.periodStart} onChange={e => setForm({...form, periodStart: e.target.value})} />
              </div>
              <div>
                <Label>{t.to}</Label>
                <Input type="date" value={form.periodEnd} onChange={e => setForm({...form, periodEnd: e.target.value})} />
              </div>
            </div>
            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-base font-semibold">{t.acc.costCenter}</Label>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={distributeEvenly}>{t.acc.apply}</Button>
                  <Button variant="outline" size="sm" onClick={addLine}><Plus className="h-3 w-3 me-1" />{t.add}</Button>
                </div>
              </div>
              {lines.map((line, i) => (
                <div key={i} className="grid grid-cols-4 gap-2 items-end">
                  <Select value={String(line.costCenterId || "")} onValueChange={v => { const nl = [...lines]; nl[i].costCenterId = Number(v); setLines(nl); }}>
                    <SelectTrigger><SelectValue placeholder={t.acc.costCenter} /></SelectTrigger>
                    <SelectContent>{centers?.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}</SelectContent>
                  </Select>
                  <Input type="number" placeholder={t.amount} value={line.amount} onChange={e => { const nl = [...lines]; nl[i].amount = e.target.value; setLines(nl); }} />
                  <Input type="number" placeholder="%" value={line.ratio} onChange={e => { const nl = [...lines]; nl[i].ratio = e.target.value; setLines(nl); }} />
                  <Button variant="ghost" size="sm" className="text-destructive" onClick={() => removeLine(i)}>{t.delete}</Button>
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={() => setOpen(false)}>{t.cancel}</Button>
              <Button onClick={handleSubmit} disabled={createMut.isPending}>
                {createMut.isPending && <Loader2 className="h-4 w-4 me-2 animate-spin" />}{t.save}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : !allocations?.length ? (
            <div className="flex flex-col items-center justify-center p-12 text-muted-foreground">
              <ClipboardList className="h-12 w-12 mb-3 opacity-50" />
              <p>{t.noData}</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.name_}</TableHead>
                  <TableHead>{t.acc.allocationMethod}</TableHead>
                  <TableHead>{t.acc.period}</TableHead>
                  <TableHead>{t.amount}</TableHead>
                  <TableHead>{t.status}</TableHead>
                  <TableHead>{t.actions}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allocations.map(a => (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium">{a.name}</TableCell>
                    <TableCell>{methodLabels[a.method] || a.method}</TableCell>
                    <TableCell>{new Date(a.periodStart).toLocaleDateString()} - {new Date(a.periodEnd).toLocaleDateString()}</TableCell>
                    <TableCell>{parseFloat(String(a.totalAmount)).toLocaleString()} SAR</TableCell>
                    <TableCell><Badge variant={a.status === "posted" || a.status === "applied" ? "default" : a.status === "approved" ? "outline" : "secondary"}>{a.status === "posted" || a.status === "applied" ? t.acc.posted : a.status === "approved" ? t.acc.approved : t.acc.draft}</Badge></TableCell>
                    <TableCell><div className="flex gap-1"><Button variant="outline" size="sm" onClick={() => approveMut.mutate({ id: a.id })} disabled={a.status !== "draft" || approveMut.isPending}><CheckCircle2 className="h-3.5 w-3.5 me-1" />{t.acc.approve}</Button><Button size="sm" onClick={() => postMut.mutate({ id: a.id })} disabled={a.status !== "approved" || postMut.isPending}><Send className="h-3.5 w-3.5 me-1" />{t.acc.post}</Button></div></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
