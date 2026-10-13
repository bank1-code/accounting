import { useI18n } from "@/lib/i18n";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { PermissionAction } from "@/components/PermissionAction";
import { Plus, Loader2, ClipboardCheck, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function InventoryCount() {
  const { t } = useI18n();
  const utils = trpc.useUtils();
  const { data: counts, isLoading } = trpc.inventoryCounts.list.useQuery();
  const { data: warehousesList } = trpc.warehouses.list.useQuery();
  const { data: productsList } = trpc.products.list.useQuery();
  const createMut = trpc.inventoryCounts.create.useMutation({
    onSuccess: () => { utils.inventoryCounts.list.invalidate(); setOpen(false); toast.success(t.success); },
    onError: () => toast.error(t.error),
  });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ warehouseId: 0, type: "periodic" as "periodic" | "surprise", notes: "" });
  const [lines, setLines] = useState<Array<{ productId: number; systemQuantity: string; actualQuantity: string }>>([]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">{t.nav.inventoryCount}</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <PermissionAction permissions={["inventory.count.create"]}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 me-2" />{t.inv.addCount}</Button></DialogTrigger>
          </PermissionAction>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{t.inv.addCount}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>{t.inv.warehouse}</Label>
                  <Select value={String(form.warehouseId || "")} onValueChange={v => setForm({...form, warehouseId: Number(v)})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{warehousesList?.map((w: any) => <SelectItem key={w.id} value={String(w.id)}>{w.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>{t.type}</Label>
                  <Select value={form.type} onValueChange={(v: "periodic" | "surprise") => setForm({...form, type: v})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="periodic">{t.inv.periodic}</SelectItem>
                      <SelectItem value="surprise">{t.inv.surprise}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div><Label>{t.notes}</Label><Input value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} /></div>
              <div className="flex items-center justify-between">
                <Label className="text-base font-semibold">{t.nav.products}</Label>
                <Button variant="outline" size="sm" onClick={() => setLines([...lines, { productId: 0, systemQuantity: "0", actualQuantity: "0" }])}><Plus className="h-3 w-3 me-1" />{t.add}</Button>
              </div>
              {lines.map((line, i) => (
                <div key={i} className="grid grid-cols-4 gap-2 items-end">
                  <Select value={String(line.productId || "")} onValueChange={v => { const nl = [...lines]; nl[i].productId = Number(v); setLines(nl); }}>
                    <SelectTrigger><SelectValue placeholder={t.inv.productName} /></SelectTrigger>
                    <SelectContent>{productsList?.map((p: any) => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}</SelectContent>
                  </Select>
                  <Input type="number" placeholder={t.inv.systemQty} value={line.systemQuantity} onChange={e => { const nl = [...lines]; nl[i].systemQuantity = e.target.value; setLines(nl); }} />
                  <Input type="number" placeholder={t.inv.actualQty} value={line.actualQuantity} onChange={e => { const nl = [...lines]; nl[i].actualQuantity = e.target.value; setLines(nl); }} />
                  <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setLines(lines.filter((_, idx) => idx !== i))}><Trash2 className="h-4 w-4" /></Button>
                </div>
              ))}
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setOpen(false)}>{t.cancel}</Button>
                <Button onClick={() => { if (!form.warehouseId || !lines.length) { toast.error(t.required); return; } createMut.mutate({ countNumber: `IC-${Date.now()}`, ...form, lines: lines.filter(l => l.productId > 0) }); }} disabled={createMut.isPending}>
                  {createMut.isPending && <Loader2 className="h-4 w-4 me-2 animate-spin" />}{t.save}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      <Card>
        <CardContent className="p-0">
          {isLoading ? <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin" /></div> : !counts?.length ? (
            <div className="flex flex-col items-center justify-center p-12 text-muted-foreground"><ClipboardCheck className="h-12 w-12 mb-3 opacity-50" /><p>{t.noData}</p></div>
          ) : (
            <Table><TableHeader><TableRow><TableHead>#</TableHead><TableHead>{t.inv.warehouse}</TableHead><TableHead>{t.type}</TableHead><TableHead>{t.date}</TableHead><TableHead>{t.status}</TableHead></TableRow></TableHeader>
              <TableBody>{counts.map((c: any) => (
                <TableRow key={c.id}>
                  <TableCell className="font-mono">{c.countNumber}</TableCell>
                  <TableCell>{warehousesList?.find((w: any) => w.id === c.warehouseId)?.name || "-"}</TableCell>
                  <TableCell><Badge variant="outline">{c.type === "periodic" ? t.inv.periodic : t.inv.surprise}</Badge></TableCell>
                  <TableCell>{new Date(c.createdAt).toLocaleDateString()}</TableCell>
                  <TableCell><Badge variant={c.status === "approved" ? "default" : "secondary"}>{c.status}</Badge></TableCell>
                </TableRow>
              ))}</TableBody></Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
