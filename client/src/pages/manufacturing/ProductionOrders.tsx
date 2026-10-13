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
import { Plus, Loader2, Factory, CheckCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function ProductionOrders() {
  const { t } = useI18n();
  const utils = trpc.useUtils();
  const { data: orders, isLoading } = trpc.productionOrders.list.useQuery();
  const { data: recipesList } = trpc.recipes.list.useQuery();
  const { data: productsList } = trpc.products.list.useQuery();
  const { data: warehousesList } = trpc.warehouses.list.useQuery();
  const { data: branchesList } = trpc.branches.list.useQuery();
  const { data: nextNum } = trpc.productionOrders.nextNumber.useQuery();
  const createMut = trpc.productionOrders.create.useMutation({
    onSuccess: () => { utils.productionOrders.list.invalidate(); setOpen(false); toast.success(t.success); },
    onError: () => toast.error(t.error),
  });
  const completeMut = trpc.productionOrders.complete.useMutation({
    onSuccess: () => { utils.productionOrders.list.invalidate(); setCompleteOpen(false); toast.success(t.success); },
    onError: () => toast.error(t.error),
  });
  const [open, setOpen] = useState(false);
  const [completeOpen, setCompleteOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [form, setForm] = useState({ recipeId: 0, productId: 0, warehouseId: 0, sourceWarehouseId: 0, branchId: 0, plannedQuantity: "1", batchNumber: "", notes: "" });
  const [completeForm, setCompleteForm] = useState({ actualQuantity: "", wasteQuantity: "0", actualCost: "0" });

  const statusColors: Record<string, string> = { draft: "secondary", in_progress: "default", completed: "default", cancelled: "destructive" };
  const statusLabels: Record<string, string> = { draft: t.acc.draft, in_progress: t.mfg.inProgress, completed: t.mfg.completed, cancelled: t.inv.cancelled };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">{t.nav.productionOrders}</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <PermissionAction permissions={["production.order.create"]}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 me-2" />{t.mfg.addProductionOrder}</Button></DialogTrigger>
          </PermissionAction>
          <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{t.mfg.addProductionOrder}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>{t.mfg.recipe}</Label>
                  <Select value={String(form.recipeId || "")} onValueChange={v => { const r = recipesList?.find((r: any) => r.id === Number(v)); setForm({...form, recipeId: Number(v), productId: r?.productId || 0}); }}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{recipesList?.map((r: any) => <SelectItem key={r.id} value={String(r.id)}>{r.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>{t.mfg.outputProduct}</Label>
                  <Select value={String(form.productId || "")} onValueChange={v => setForm({...form, productId: Number(v)})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{productsList?.map((p: any) => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>{t.mfg.outputWarehouse}</Label>
                  <Select value={String(form.warehouseId || "")} onValueChange={v => setForm({...form, warehouseId: Number(v)})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{warehousesList?.map((w: any) => <SelectItem key={w.id} value={String(w.id)}>{w.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>{t.mfg.sourceWarehouse}</Label>
                  <Select value={String(form.sourceWarehouseId || "same")} onValueChange={v => setForm({...form, sourceWarehouseId: v === "same" ? 0 : Number(v)})}>
                    <SelectTrigger><SelectValue placeholder={t.mfg.sameAsOutputWarehouse} /></SelectTrigger>
                    <SelectContent><SelectItem value="same">{t.mfg.sameAsOutputWarehouse}</SelectItem>{warehousesList?.map((w: any) => <SelectItem key={w.id} value={String(w.id)}>{w.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>{t.nav.branches}</Label>
                <Select value={String(form.branchId || "")} onValueChange={v => setForm({...form, branchId: Number(v)})}>
                  <SelectTrigger><SelectValue placeholder={t.optional} /></SelectTrigger>
                  <SelectContent>{branchesList?.map((b: any) => <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>{t.mfg.plannedQty}</Label><Input type="number" value={form.plannedQuantity} onChange={e => setForm({...form, plannedQuantity: e.target.value})} /></div>
                <div><Label>{t.inv.batchNumber}</Label><Input value={form.batchNumber} onChange={e => setForm({...form, batchNumber: e.target.value})} /></div>
              </div>
              <div><Label>{t.notes}</Label><Input value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} /></div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setOpen(false)}>{t.cancel}</Button>
                <Button onClick={() => { if (!form.recipeId || !form.productId || !form.warehouseId) { toast.error(t.required); return; } createMut.mutate({ orderNumber: nextNum || `PO-${Date.now()}`, ...form, sourceWarehouseId: form.sourceWarehouseId || undefined, branchId: form.branchId || undefined, lines: [] }); }} disabled={createMut.isPending}>
                  {createMut.isPending && <Loader2 className="h-4 w-4 me-2 animate-spin" />}{t.save}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Complete Dialog */}
      <Dialog open={completeOpen} onOpenChange={setCompleteOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t.mfg.completeProduction}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>{t.mfg.actualQty}</Label><Input type="number" value={completeForm.actualQuantity} onChange={e => setCompleteForm({...completeForm, actualQuantity: e.target.value})} /></div>
            <div><Label>{t.mfg.wasteQty}</Label><Input type="number" value={completeForm.wasteQuantity} onChange={e => setCompleteForm({...completeForm, wasteQuantity: e.target.value})} /></div>
            <div><Label>{t.mfg.actualCost}</Label><Input type="number" value={completeForm.actualCost} onChange={e => setCompleteForm({...completeForm, actualCost: e.target.value})} /></div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setCompleteOpen(false)}>{t.cancel}</Button>
              <PermissionAction permissions={["production.order.complete"]}>
                <Button onClick={() => { if (!selectedOrder) return; completeMut.mutate({ id: selectedOrder.id, ...completeForm }); }} disabled={completeMut.isPending}>
                  {completeMut.isPending && <Loader2 className="h-4 w-4 me-2 animate-spin" />}{t.mfg.completeProduction}
                </Button>
              </PermissionAction>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Card>
        <CardContent className="p-0">
          {isLoading ? <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin" /></div> : !orders?.length ? (
            <div className="flex flex-col items-center justify-center p-12 text-muted-foreground"><Factory className="h-12 w-12 mb-3 opacity-50" /><p>{t.noData}</p></div>
          ) : (
            <Table><TableHeader><TableRow><TableHead>#</TableHead><TableHead>{t.mfg.outputProduct}</TableHead><TableHead>{t.mfg.plannedQty}</TableHead><TableHead>{t.mfg.actualQty}</TableHead><TableHead>{t.mfg.variance}</TableHead><TableHead>{t.status}</TableHead><TableHead>{t.actions}</TableHead></TableRow></TableHeader>
              <TableBody>{orders.map((o: any) => {
                const variance = o.actualCost && o.plannedCost ? ((parseFloat(o.actualCost) - parseFloat(o.plannedCost)) / parseFloat(o.plannedCost) * 100).toFixed(1) : null;
                return (
                  <TableRow key={o.id}>
                    <TableCell className="font-mono">{o.orderNumber}</TableCell>
                    <TableCell className="font-medium">{productsList?.find((p: any) => p.id === o.productId)?.name || "-"}</TableCell>
                    <TableCell>{o.plannedQuantity}</TableCell>
                    <TableCell>{o.actualQuantity || "-"}</TableCell>
                    <TableCell>{variance ? <span className={parseFloat(variance) > 0 ? "text-destructive" : "text-green-600"}>{variance}%</span> : "-"}</TableCell>
                    <TableCell><Badge variant={(statusColors[o.status] || "outline") as any}>{statusLabels[o.status] || o.status}</Badge></TableCell>
                    <TableCell>
                      {o.status === "draft" || o.status === "in_progress" ? (
                        <PermissionAction permissions={["production.order.complete"]}>
                          <Button variant="ghost" size="sm" onClick={() => { setSelectedOrder(o); setCompleteForm({ actualQuantity: o.plannedQuantity, wasteQuantity: "0", actualCost: o.plannedCost || "0" }); setCompleteOpen(true); }}>
                            <CheckCircle className="h-4 w-4 me-1" />{t.mfg.completeProduction}
                          </Button>
                        </PermissionAction>
                      ) : null}
                    </TableCell>
                  </TableRow>
                );
              })}</TableBody></Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
