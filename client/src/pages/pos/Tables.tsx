import { useI18n } from "@/lib/i18n";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function Tables() {
  const { t } = useI18n();
  const utils = trpc.useUtils();
  const { data: tablesList, isLoading } = trpc.tables.list.useQuery();
  const { data: branchesList } = trpc.branches.list.useQuery();
  const createMut = trpc.tables.create.useMutation({ onSuccess: () => { utils.tables.list.invalidate(); setOpen(false); toast.success(t.success); }, onError: () => toast.error(t.error) });
  const updateStatusMut = trpc.tables.updateStatus.useMutation({ onSuccess: () => { utils.tables.list.invalidate(); toast.success(t.success); } });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ branchId: 0, name: "", capacity: 4 });

  const statusColors: Record<string, string> = { available: "bg-green-100 text-green-800 border-green-300", occupied: "bg-red-100 text-red-800 border-red-300", reserved: "bg-yellow-100 text-yellow-800 border-yellow-300", maintenance: "bg-gray-100 text-gray-800 border-gray-300" };
  const statusLabels: Record<string, string> = { available: t.pos.available, occupied: t.pos.occupied, reserved: t.pos.reserved, maintenance: t.pos.maintenance };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">{t.nav.tables}</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 me-2" />{t.pos.addTable}</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{t.pos.addTable}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div><Label>{t.nav.branches}</Label>
                <Select value={String(form.branchId || "")} onValueChange={v => setForm({...form, branchId: Number(v)})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{branchesList?.map((b: any) => <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>{t.name_}</Label><Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="T-01" /></div>
              <div><Label>{t.pos.capacity}</Label><Input type="number" value={form.capacity} onChange={e => setForm({...form, capacity: Number(e.target.value)})} /></div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setOpen(false)}>{t.cancel}</Button>
                <Button onClick={() => { if (!form.branchId || !form.name) { toast.error(t.required); return; } createMut.mutate(form); }} disabled={createMut.isPending}>
                  {createMut.isPending && <Loader2 className="h-4 w-4 me-2 animate-spin" />}{t.save}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      {isLoading ? <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin" /></div> : !tablesList?.length ? (
        <div className="flex flex-col items-center justify-center p-12 text-muted-foreground"><p>{t.noData}</p></div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {tablesList.map((tbl: any) => (
            <Card key={tbl.id} className={`border-2 ${statusColors[tbl.status] || ""} cursor-pointer hover:shadow-md transition-shadow`}
              onClick={() => { const next: Record<string, string> = { available: "occupied", occupied: "available", reserved: "occupied", maintenance: "available" }; updateStatusMut.mutate({ id: tbl.id, status: (next[tbl.status] || "available") as any }); }}>
              <CardContent className="p-4 text-center">
                <div className="text-lg font-bold">{tbl.name}</div>
                <div className="text-xs mt-1">{t.pos.capacity}: {tbl.capacity}</div>
                <Badge variant="outline" className="mt-2">{statusLabels[tbl.status] || tbl.status}</Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
