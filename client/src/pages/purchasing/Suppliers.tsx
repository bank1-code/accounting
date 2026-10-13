import { useI18n } from "@/lib/i18n";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Loader2, Truck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function Suppliers() {
  const { t } = useI18n();
  const utils = trpc.useUtils();
  const { data: list, isLoading } = trpc.suppliers.list.useQuery();
  const createMut = trpc.suppliers.create.useMutation({
    onSuccess: () => { utils.suppliers.list.invalidate(); setOpen(false); toast.success(t.success); },
    onError: () => toast.error(t.error),
  });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", contactPerson: "", phone: "", email: "", address: "", taxNumber: "" });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">{t.nav.suppliers}</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 me-2" />{t.pur.addSupplier}</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{t.pur.addSupplier}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div><Label>{t.name_}</Label><Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>{t.pur.contactPerson}</Label><Input value={form.contactPerson} onChange={e => setForm({...form, contactPerson: e.target.value})} /></div>
                <div><Label>{t.adm.phone}</Label><Input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>البريد الإلكتروني</Label><Input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} /></div>
                <div><Label>{t.pur.taxNumber}</Label><Input value={form.taxNumber} onChange={e => setForm({...form, taxNumber: e.target.value})} /></div>
              </div>
              <div><Label>{t.adm.address}</Label><Input value={form.address} onChange={e => setForm({...form, address: e.target.value})} /></div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setOpen(false)}>{t.cancel}</Button>
                <Button onClick={() => { if (!form.name) { toast.error(t.required); return; } createMut.mutate(form); }} disabled={createMut.isPending}>
                  {createMut.isPending && <Loader2 className="h-4 w-4 me-2 animate-spin" />}{t.save}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      <Card>
        <CardContent className="p-0">
          {isLoading ? <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin" /></div> : !list?.length ? (
            <div className="flex flex-col items-center justify-center p-12 text-muted-foreground"><Truck className="h-12 w-12 mb-3 opacity-50" /><p>{t.noData}</p></div>
          ) : (
            <Table><TableHeader><TableRow><TableHead>{t.name_}</TableHead><TableHead>{t.pur.contactPerson}</TableHead><TableHead>{t.adm.phone}</TableHead><TableHead>{t.pur.taxNumber}</TableHead><TableHead>{t.status}</TableHead></TableRow></TableHeader>
              <TableBody>{list.map((s: any) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.name}</TableCell>
                  <TableCell>{s.contactPerson || "-"}</TableCell>
                  <TableCell dir="ltr">{s.phone || "-"}</TableCell>
                  <TableCell>{s.taxNumber || "-"}</TableCell>
                  <TableCell><Badge variant={s.isActive ? "default" : "secondary"}>{s.isActive ? t.active : t.inactive}</Badge></TableCell>
                </TableRow>
              ))}</TableBody></Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
