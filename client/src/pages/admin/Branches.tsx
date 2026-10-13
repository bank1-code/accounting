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
import { Switch } from "@/components/ui/switch";
import { Plus, Loader2, Building2, Pencil } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function Branches() {
  const { t } = useI18n();
  const utils = trpc.useUtils();
  const { data: branchesList, isLoading } = trpc.branches.list.useQuery();
  const createMut = trpc.branches.create.useMutation({
    onSuccess: () => { utils.branches.list.invalidate(); setOpen(false); resetForm(); toast.success(t.success); },
    onError: () => toast.error(t.error),
  });
  const updateMut = trpc.branches.update.useMutation({
    onSuccess: () => { utils.branches.list.invalidate(); setEditOpen(false); toast.success(t.success); },
    onError: () => toast.error(t.error),
  });

  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [form, setForm] = useState({ name: "", nameEn: "", type: "restaurant" as const, address: "", phone: "", isCentralKitchen: false, isCentralWarehouse: false });
  const [editForm, setEditForm] = useState<any>(null);

  const resetForm = () => setForm({ name: "", nameEn: "", type: "restaurant", address: "", phone: "", isCentralKitchen: false, isCentralWarehouse: false });

  const typeLabels: Record<string, string> = {
    restaurant: t.adm.restaurant, grocery: t.adm.grocery, accessories: t.adm.accessories,
    warehouse: t.adm.warehouseType, kitchen: t.adm.kitchenType,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t.nav.branches}</h1>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 me-2" />{t.adm.addBranch}</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{t.adm.addBranch}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><Label>{t.adm.branchName} (AR)</Label><Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} /></div>
                <div><Label>{t.adm.branchName} (EN)</Label><Input value={form.nameEn} onChange={e => setForm({...form, nameEn: e.target.value})} /></div>
              </div>
              <div>
                <Label>{t.adm.branchType}</Label>
                <Select value={form.type} onValueChange={v => setForm({...form, type: v as typeof form.type})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="restaurant">{t.adm.restaurant}</SelectItem>
                    <SelectItem value="grocery">{t.adm.grocery}</SelectItem>
                    <SelectItem value="accessories">{t.adm.accessories}</SelectItem>
                    <SelectItem value="warehouse">{t.adm.warehouseType}</SelectItem>
                    <SelectItem value="kitchen">{t.adm.kitchenType}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>{t.adm.address}</Label><Input value={form.address} onChange={e => setForm({...form, address: e.target.value})} /></div>
              <div><Label>{t.adm.phone}</Label><Input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} /></div>
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2"><Switch checked={form.isCentralKitchen} onCheckedChange={v => setForm({...form, isCentralKitchen: v})} /><Label>{t.adm.centralKitchen}</Label></div>
                <div className="flex items-center gap-2"><Switch checked={form.isCentralWarehouse} onCheckedChange={v => setForm({...form, isCentralWarehouse: v})} /><Label>{t.adm.centralWarehouse}</Label></div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setOpen(false)}>{t.cancel}</Button>
                <Button onClick={() => createMut.mutate(form)} disabled={createMut.isPending || !form.name}>
                  {createMut.isPending && <Loader2 className="h-4 w-4 me-2 animate-spin" />}{t.save}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : !branchesList?.length ? (
            <div className="flex flex-col items-center justify-center p-12 text-muted-foreground">
              <Building2 className="h-12 w-12 mb-3 opacity-50" /><p>{t.noData}</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.adm.branchName}</TableHead>
                  <TableHead>{t.adm.branchType}</TableHead>
                  <TableHead>{t.adm.address}</TableHead>
                  <TableHead>{t.adm.phone}</TableHead>
                  <TableHead>{t.status}</TableHead>
                  <TableHead>{t.actions}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {branchesList.map(b => (
                  <TableRow key={b.id}>
                    <TableCell className="font-medium">{b.name}</TableCell>
                    <TableCell><Badge variant="outline">{typeLabels[b.type] || b.type}</Badge></TableCell>
                    <TableCell>{b.address || "-"}</TableCell>
                    <TableCell>{b.phone || "-"}</TableCell>
                    <TableCell><Badge variant={b.isActive ? "default" : "secondary"}>{b.isActive ? t.active : t.inactive}</Badge></TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" onClick={() => { setEditForm({ ...b }); setEditOpen(true); }}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t.adm.editBranch}</DialogTitle></DialogHeader>
          {editForm && (
            <div className="space-y-4">
              <div><Label>{t.adm.branchName}</Label><Input value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})} /></div>
              <div className="flex items-center gap-4">
                <Label>{t.status}</Label>
                <Switch checked={editForm.isActive} onCheckedChange={v => setEditForm({...editForm, isActive: v})} />
                <span className="text-sm">{editForm.isActive ? t.active : t.inactive}</span>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setEditOpen(false)}>{t.cancel}</Button>
                <Button onClick={() => updateMut.mutate({ id: editForm.id, name: editForm.name, isActive: editForm.isActive })} disabled={updateMut.isPending}>
                  {updateMut.isPending && <Loader2 className="h-4 w-4 me-2 animate-spin" />}{t.save}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
