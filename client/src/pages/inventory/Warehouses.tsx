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
import { Plus, Loader2, Warehouse } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function Warehouses() {
  const { t } = useI18n();
  const utils = trpc.useUtils();
  const { data: list, isLoading } = trpc.warehouses.list.useQuery();
  const { data: branchesList } = trpc.branches.list.useQuery();
  const createMut = trpc.warehouses.create.useMutation({
    onSuccess: () => { utils.warehouses.list.invalidate(); setOpen(false); toast.success(t.success); },
    onError: () => toast.error(t.error),
  });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", branchId: 0, parentWarehouseId: 0, type: "branch" as "central" | "branch" | "kitchen", storageCategory: "general" as "general" | "dry" | "chilled" | "frozen" | "ingredients" | "packaging" | "finished_goods" | "other" });

  const typeLabels: Record<string, string> = { central: t.inv.central, branch: t.inv.branch, kitchen: t.inv.kitchenWarehouse };
  const categoryLabels: Record<string, string> = { general: "عام", dry: "جاف", chilled: "مبرد", frozen: "مجمد", ingredients: "مواد أولية", packaging: "تعبئة وتغليف", finished_goods: "منتجات تامة", other: "أخرى" };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">{t.nav.warehouses}</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 me-2" />{t.add}</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{t.inv.addWarehouse}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div><Label>{t.name_}</Label><Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} /></div>
              <div>
                <Label>{t.type}</Label>
                <Select value={form.type} onValueChange={(v: "central" | "branch" | "kitchen") => setForm({...form, type: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="central">{t.inv.central}</SelectItem>
                    <SelectItem value="branch">{t.inv.branch}</SelectItem>
                    <SelectItem value="kitchen">{t.inv.kitchenWarehouse}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{t.nav.branches}</Label>
                <Select value={String(form.branchId || "")} onValueChange={v => setForm({...form, branchId: Number(v)})}>
                  <SelectTrigger><SelectValue placeholder={t.optional} /></SelectTrigger>
                  <SelectContent>{branchesList?.map((b: any) => <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>المخزن الأب</Label>
                <Select value={String(form.parentWarehouseId || "")} onValueChange={v => setForm({...form, parentWarehouseId: Number(v)})}>
                  <SelectTrigger><SelectValue placeholder="اختياري للمخزن الفرعي" /></SelectTrigger>
                  <SelectContent><SelectItem value="0">بدون مخزن أب</SelectItem>{list?.filter((warehouse: any) => warehouse.isActive).map((warehouse: any) => <SelectItem key={warehouse.id} value={String(warehouse.id)}>{warehouse.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>فئة التخزين</Label>
                <Select value={form.storageCategory} onValueChange={(value: typeof form.storageCategory) => setForm({...form, storageCategory: value})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(categoryLabels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setOpen(false)}>{t.cancel}</Button>
                <Button onClick={() => createMut.mutate({ ...form, branchId: form.branchId || undefined, parentWarehouseId: form.parentWarehouseId || undefined })} disabled={createMut.isPending || !form.name}>
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
            <div className="flex flex-col items-center justify-center p-12 text-muted-foreground"><Warehouse className="h-12 w-12 mb-3 opacity-50" /><p>{t.noData}</p></div>
          ) : (
            <Table><TableHeader><TableRow><TableHead>{t.name_}</TableHead><TableHead>{t.type}</TableHead><TableHead>الفئة</TableHead><TableHead>المخزن الأب</TableHead><TableHead>{t.nav.branches}</TableHead><TableHead>{t.status}</TableHead></TableRow></TableHeader>
              <TableBody>{list.map((w: any) => (
                <TableRow key={w.id}><TableCell className="font-medium">{w.name}</TableCell><TableCell><Badge variant="outline">{typeLabels[w.type] || w.type}</Badge></TableCell>
                  <TableCell><Badge variant="secondary">{categoryLabels[w.storageCategory] || w.storageCategory}</Badge></TableCell>
                  <TableCell>{list?.find((parent: any) => parent.id === w.parentWarehouseId)?.name || "-"}</TableCell>
                  <TableCell>{branchesList?.find((b: any) => b.id === w.branchId)?.name || "-"}</TableCell>
                  <TableCell><Badge variant={w.isActive ? "default" : "secondary"}>{w.isActive ? t.active : t.inactive}</Badge></TableCell></TableRow>
              ))}</TableBody></Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
