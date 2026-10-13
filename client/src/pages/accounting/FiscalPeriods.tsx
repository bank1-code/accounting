import { useI18n } from "@/lib/i18n";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { PermissionAction } from "@/components/PermissionAction";
import { Plus, Loader2, Lock, CalendarDays } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function FiscalPeriods() {
  const { t } = useI18n();
  const utils = trpc.useUtils();
  const { data: periods, isLoading } = trpc.fiscalPeriods.list.useQuery();
  const { data: accounts } = trpc.accounts.list.useQuery();
  const createMut = trpc.fiscalPeriods.create.useMutation({
    onSuccess: () => { utils.fiscalPeriods.list.invalidate(); setOpen(false); toast.success(t.success); },
    onError: () => toast.error(t.error),
  });
  const closeMut = trpc.fiscalPeriods.close.useMutation({
    onSuccess: () => { utils.fiscalPeriods.list.invalidate(); toast.success(t.success); },
    onError: () => toast.error(t.error),
  });

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", startDate: "", endDate: "" });
  const [retainedEarningsAccountId, setRetainedEarningsAccountId] = useState<number | undefined>();
  const equityAccounts = accounts?.filter((account) => account.type === "equity" && account.isActive) || [];

  const handleSubmit = () => {
    if (!form.name || !form.startDate || !form.endDate) { toast.error(t.required); return; }
    createMut.mutate({ name: form.name, startDate: new Date(form.startDate), endDate: new Date(form.endDate) });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{t.acc.fiscalPeriod}</h1>
            <p className="text-sm text-muted-foreground">حدد حساب الأرباح المحتجزة قبل الإقفال السنوي عند وجود إيرادات أو مصروفات.</p>
          </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <PermissionAction permissions={["accounting.period.reopen"]}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 me-2" />{t.add}</Button></DialogTrigger>
          </PermissionAction>
          <DialogContent>
            <DialogHeader><DialogTitle>{t.acc.fiscalPeriod}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div><Label>{t.name_}</Label><Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="2025-Q1" /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>{t.from}</Label><Input type="date" value={form.startDate} onChange={e => setForm({...form, startDate: e.target.value})} /></div>
                <div><Label>{t.to}</Label><Input type="date" value={form.endDate} onChange={e => setForm({...form, endDate: e.target.value})} /></div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setOpen(false)}>{t.cancel}</Button>
                <Button onClick={handleSubmit} disabled={createMut.isPending}>
                  {createMut.isPending && <Loader2 className="h-4 w-4 me-2 animate-spin" />}{t.save}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card><CardContent className="p-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><Label htmlFor="retained-earnings">حساب الأرباح المحتجزة للإقفال السنوي</Label><select id="retained-earnings" className="h-9 rounded-md border bg-background px-3 text-sm sm:w-80" value={retainedEarningsAccountId ?? ""} onChange={(event) => setRetainedEarningsAccountId(event.target.value ? Number(event.target.value) : undefined)}><option value="">اختر حساب حقوق ملكية</option>{equityAccounts.map((account) => <option key={account.id} value={account.id}>{account.code} — {account.name}</option>)}</select></CardContent></Card>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : !periods?.length ? (
            <div className="flex flex-col items-center justify-center p-12 text-muted-foreground">
              <CalendarDays className="h-12 w-12 mb-3 opacity-50" /><p>{t.noData}</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.name_}</TableHead>
                  <TableHead>{t.from}</TableHead>
                  <TableHead>{t.to}</TableHead>
                  <TableHead>{t.status}</TableHead>
                  <TableHead>{t.actions}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {periods.map(p => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell>{new Date(p.startDate).toLocaleDateString()}</TableCell>
                    <TableCell>{new Date(p.endDate).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <Badge variant={p.isClosed ? "destructive" : "default"}>
                        {p.isClosed ? t.acc.periodClosed : t.active}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {!p.isClosed && (
                        <PermissionAction permissions={["accounting.period.close"]}>
                          <Button variant="outline" size="sm" onClick={() => closeMut.mutate({ id: p.id, retainedEarningsAccountId })} disabled={closeMut.isPending}>
                            <Lock className="h-3 w-3 me-1" />{t.acc.closePeriod}
                          </Button>
                        </PermissionAction>
                      )}
                    </TableCell>
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
