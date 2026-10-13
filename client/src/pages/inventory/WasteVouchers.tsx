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
import { ClipboardX, Loader2, Plus, Trash2, CheckCircle2, XCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";

type WasteLine = { productId: number; quantity: string; notes: string };

export default function WasteVouchers() {
  const { t } = useI18n();
  const utils = trpc.useUtils();
  const vouchers = trpc.wasteVouchers.list.useQuery();
  const warehouses = trpc.warehouses.list.useQuery();
  const products = trpc.products.list.useQuery();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ warehouseId: 0, reason: "", notes: "" });
  const [lines, setLines] = useState<WasteLine[]>([]);
  const refresh = () => utils.wasteVouchers.list.invalidate();
  const createVoucher = trpc.wasteVouchers.create.useMutation({
    onSuccess: () => { refresh(); setOpen(false); setForm({ warehouseId: 0, reason: "", notes: "" }); setLines([]); toast.success(t.success); },
    onError: (error) => toast.error(error.message),
  });
  const approveVoucher = trpc.wasteVouchers.approve.useMutation({ onSuccess: () => { refresh(); toast.success("تم اعتماد إذن التوالف"); }, onError: (error) => toast.error(error.message) });
  const cancelVoucher = trpc.wasteVouchers.cancel.useMutation({ onSuccess: () => { refresh(); toast.success("تم إلغاء إذن التوالف"); }, onError: (error) => toast.error(error.message) });
  const validLines = lines.filter((line) => line.productId > 0 && Number(line.quantity) > 0);

  return <div className="space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h1 className="text-2xl font-bold tracking-tight">أذون التوالف</h1><p className="mt-1 text-sm text-muted-foreground">إذن واحد يدعم عدة أصناف؛ لا تخصم الكميات ولا ترحل التكلفة إلا بعد اعتماد مستقل.</p></div>
      <Dialog open={open} onOpenChange={setOpen}>
        <PermissionAction permissions={["inventory.waste.create"]}><DialogTrigger asChild><Button><Plus className="me-2 h-4 w-4" />إذن توالف جديد</Button></DialogTrigger></PermissionAction>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto"><DialogHeader><DialogTitle>إنشاء إذن توالف متعدد البنود</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label>المخزن</Label><Select value={String(form.warehouseId || "")} onValueChange={(value) => setForm({ ...form, warehouseId: Number(value) })}><SelectTrigger><SelectValue placeholder="اختر مخزناً" /></SelectTrigger><SelectContent>{warehouses.data?.map((warehouse) => <SelectItem key={warehouse.id} value={String(warehouse.id)}>{warehouse.name}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label>سبب التوالف</Label><Input value={form.reason} onChange={(event) => setForm({ ...form, reason: event.target.value })} placeholder="انتهاء صلاحية، تلف، حريق..." /></div></div>
            <div className="space-y-2"><Label>{t.notes}</Label><Input value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></div>
            <div className="flex items-center justify-between"><Label className="text-base font-semibold">الأصناف المتلفة</Label><Button variant="outline" size="sm" onClick={() => setLines([...lines, { productId: 0, quantity: "1", notes: "" }])}><Plus className="me-1 h-3 w-3" />{t.add}</Button></div>
            {lines.map((line, index) => <div className="grid items-end gap-2 sm:grid-cols-[1fr_9rem_1fr_auto]" key={index}><Select value={String(line.productId || "")} onValueChange={(value) => setLines(lines.map((item, itemIndex) => itemIndex === index ? { ...item, productId: Number(value) } : item))}><SelectTrigger><SelectValue placeholder="الصنف" /></SelectTrigger><SelectContent>{products.data?.map((product) => <SelectItem key={product.id} value={String(product.id)}>{product.name}</SelectItem>)}</SelectContent></Select><Input type="number" min="0.0001" step="0.0001" value={line.quantity} onChange={(event) => setLines(lines.map((item, itemIndex) => itemIndex === index ? { ...item, quantity: event.target.value } : item))} placeholder="الكمية" /><Input value={line.notes} onChange={(event) => setLines(lines.map((item, itemIndex) => itemIndex === index ? { ...item, notes: event.target.value } : item))} placeholder="ملاحظة البند" /><Button variant="ghost" size="icon" className="text-destructive" onClick={() => setLines(lines.filter((_, itemIndex) => itemIndex !== index))}><Trash2 className="h-4 w-4" /></Button></div>)}
            <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setOpen(false)}>{t.cancel}</Button><Button disabled={!form.warehouseId || !validLines.length || createVoucher.isPending} onClick={() => createVoucher.mutate({ ...form, lines: validLines })}>{createVoucher.isPending && <Loader2 className="me-2 h-4 w-4 animate-spin" />}حفظ مسودة الإذن</Button></div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
    <Card><CardContent className="p-0">{vouchers.isLoading ? <div className="flex justify-center p-10"><Loader2 className="h-6 w-6 animate-spin" /></div> : !vouchers.data?.length ? <div className="flex flex-col items-center gap-3 p-12 text-muted-foreground"><ClipboardX className="h-12 w-12 opacity-50" /><p>{t.noData}</p></div> : <Table><TableHeader><TableRow><TableHead>رقم الإذن</TableHead><TableHead>المخزن</TableHead><TableHead>السبب</TableHead><TableHead>{t.status}</TableHead><TableHead>{t.date}</TableHead><TableHead>{t.actions}</TableHead></TableRow></TableHeader><TableBody>{vouchers.data.map((voucher) => <TableRow key={voucher.id}><TableCell className="font-mono">{voucher.voucherNumber}</TableCell><TableCell>{warehouses.data?.find((warehouse) => warehouse.id === voucher.warehouseId)?.name || "-"}</TableCell><TableCell>{voucher.reason || "-"}</TableCell><TableCell><Badge variant={voucher.status === "approved" ? "default" : voucher.status === "cancelled" ? "destructive" : "secondary"}>{voucher.status === "draft" ? "مسودة" : voucher.status === "approved" ? "معتمد" : "ملغي"}</Badge></TableCell><TableCell>{new Date(voucher.createdAt).toLocaleDateString()}</TableCell><TableCell><div className="flex gap-2">{voucher.status === "draft" && <><PermissionAction permissions={["inventory.waste.approve"]}><Button size="sm" onClick={() => approveVoucher.mutate({ id: voucher.id })} disabled={approveVoucher.isPending}><CheckCircle2 className="me-1 h-4 w-4" />اعتماد</Button></PermissionAction><PermissionAction permissions={["inventory.waste.create"]}><Button size="sm" variant="outline" onClick={() => cancelVoucher.mutate({ id: voucher.id })} disabled={cancelVoucher.isPending}><XCircle className="me-1 h-4 w-4" />إلغاء</Button></PermissionAction></>}</div></TableCell></TableRow>)}</TableBody></Table>}</CardContent></Card>
  </div>;
}
