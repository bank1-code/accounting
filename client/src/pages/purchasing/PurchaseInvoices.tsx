import { useState } from "react";
import { Plus, Loader2, Receipt, Trash2, CheckCircle2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { trpc } from "@/lib/trpc";
import { PermissionAction } from "@/components/PermissionAction";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

type InvoiceLine = { productId: number; quantity: string; unitPrice: string; batchNumber: string; expiryDate: string };

const localDate = () => new Date().toLocaleDateString("en-CA");
const asUtcDate = (value: string) => new Date(`${value}T00:00:00`);

export default function PurchaseInvoices() {
  const { t } = useI18n();
  const utils = trpc.useUtils();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ invoiceNumber: "", supplierId: 0, warehouseId: 0, invoiceDate: localDate(), dueDate: "", notes: "" });
  const [lines, setLines] = useState<InvoiceLine[]>([]);
  const { data: invoices, isLoading } = trpc.purchaseInvoices.list.useQuery();
  const { data: suppliers } = trpc.suppliers.list.useQuery();
  const { data: warehouses } = trpc.warehouses.list.useQuery();
  const { data: products } = trpc.products.list.useQuery();

  const reset = () => {
    setForm({ invoiceNumber: "", supplierId: 0, warehouseId: 0, invoiceDate: localDate(), dueDate: "", notes: "" });
    setLines([]);
  };
  const create = trpc.purchaseInvoices.create.useMutation({
    onSuccess: () => { utils.purchaseInvoices.list.invalidate(); reset(); setOpen(false); toast.success(t.success); },
    onError: () => toast.error(t.error),
  });
  const approveItems = trpc.purchaseInvoices.approveItems.useMutation({
    onSuccess: () => { utils.purchaseInvoices.list.invalidate(); toast.success(t.success); },
    onError: () => toast.error(t.error),
  });
  const approveAccounts = trpc.purchaseInvoices.approveAccounts.useMutation({
    onSuccess: () => { utils.purchaseInvoices.list.invalidate(); toast.success(t.success); },
    onError: () => toast.error(t.error),
  });

  const total = lines.reduce((sum, line) => sum + Number(line.quantity || 0) * Number(line.unitPrice || 0), 0);
  const validLines = lines.filter((line) => line.productId > 0 && Number(line.quantity) > 0 && Number(line.unitPrice) >= 0);
  const submit = () => {
    if (!form.invoiceNumber || !form.supplierId || !form.warehouseId || !validLines.length) { toast.error(t.required); return; }
    create.mutate({
      invoiceNumber: form.invoiceNumber,
      supplierId: form.supplierId,
      warehouseId: form.warehouseId,
      invoiceDate: asUtcDate(form.invoiceDate),
      dueDate: form.dueDate ? asUtcDate(form.dueDate) : undefined,
      notes: form.notes || undefined,
      lines: validLines.map((line) => ({
        productId: line.productId,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        batchNumber: line.batchNumber || undefined,
        expiryDate: line.expiryDate ? asUtcDate(line.expiryDate) : undefined,
      })),
    });
  };

  return <div className="space-y-6">
    <div className="flex items-center justify-between gap-3">
      <div><h1 className="text-2xl font-bold tracking-tight">{t.pur.purchaseInvoices}</h1><p className="text-sm text-muted-foreground">{t.pur.invoiceWorkflow}</p></div>
      <Dialog open={open} onOpenChange={(value) => { setOpen(value); if (!value) reset(); }}>
        <PermissionAction permissions={["purchasing.order.create"]}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 me-2" />{t.pur.addPurchaseInvoice}</Button></DialogTrigger>
        </PermissionAction>
        <DialogContent className="max-w-3xl max-h-[88vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{t.pur.addPurchaseInvoice}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <div><Label>{t.pur.invoiceNumber}</Label><Input value={form.invoiceNumber} onChange={(event) => setForm({ ...form, invoiceNumber: event.target.value })} /></div>
              <div><Label>{t.pur.supplier}</Label><Select value={String(form.supplierId || "")} onValueChange={(value) => setForm({ ...form, supplierId: Number(value) })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{suppliers?.map((supplier: any) => <SelectItem key={supplier.id} value={String(supplier.id)}>{supplier.name}</SelectItem>)}</SelectContent></Select></div>
              <div><Label>{t.inv.warehouse}</Label><Select value={String(form.warehouseId || "")} onValueChange={(value) => setForm({ ...form, warehouseId: Number(value) })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{warehouses?.map((warehouse: any) => <SelectItem key={warehouse.id} value={String(warehouse.id)}>{warehouse.name}</SelectItem>)}</SelectContent></Select></div>
              <div><Label>{t.date}</Label><Input type="date" value={form.invoiceDate} onChange={(event) => setForm({ ...form, invoiceDate: event.target.value })} /></div>
              <div><Label>{t.pur.dueDate}</Label><Input type="date" value={form.dueDate} onChange={(event) => setForm({ ...form, dueDate: event.target.value })} /></div>
              <div><Label>{t.notes}</Label><Input value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></div>
            </div>
            <div className="flex items-center justify-between"><Label className="font-semibold">{t.pur.invoiceLines}</Label><Button variant="outline" size="sm" onClick={() => setLines([...lines, { productId: 0, quantity: "1", unitPrice: "0", batchNumber: "", expiryDate: "" }])}><Plus className="h-3 w-3 me-1" />{t.add}</Button></div>
            {lines.map((line, index) => <div key={index} className="grid gap-2 rounded-md border p-3 md:grid-cols-6">
              <Select value={String(line.productId || "")} onValueChange={(value) => setLines(lines.map((item, itemIndex) => itemIndex === index ? { ...item, productId: Number(value) } : item))}><SelectTrigger className="md:col-span-2"><SelectValue placeholder={t.inv.productName} /></SelectTrigger><SelectContent>{products?.map((product: any) => <SelectItem key={product.id} value={String(product.id)}>{product.name}</SelectItem>)}</SelectContent></Select>
              <Input type="number" min="0.001" placeholder={t.inv.quantity} value={line.quantity} onChange={(event) => setLines(lines.map((item, itemIndex) => itemIndex === index ? { ...item, quantity: event.target.value } : item))} />
              <Input type="number" min="0" placeholder={t.pur.unitPrice} value={line.unitPrice} onChange={(event) => setLines(lines.map((item, itemIndex) => itemIndex === index ? { ...item, unitPrice: event.target.value } : item))} />
              <Input placeholder={t.pur.batchNumber} value={line.batchNumber} onChange={(event) => setLines(lines.map((item, itemIndex) => itemIndex === index ? { ...item, batchNumber: event.target.value } : item))} />
              <div className="flex gap-1"><Input type="date" aria-label={t.pur.expiryDate} value={line.expiryDate} onChange={(event) => setLines(lines.map((item, itemIndex) => itemIndex === index ? { ...item, expiryDate: event.target.value } : item))} /><Button variant="ghost" size="icon" className="text-destructive" onClick={() => setLines(lines.filter((_, itemIndex) => itemIndex !== index))}><Trash2 className="h-4 w-4" /></Button></div>
            </div>)}
            {lines.length > 0 && <p className="text-end font-bold">{t.total}: {total.toLocaleString()} SAR</p>}
            <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setOpen(false)}>{t.cancel}</Button><Button disabled={create.isPending} onClick={submit}>{create.isPending && <Loader2 className="h-4 w-4 me-2 animate-spin" />}{t.save}</Button></div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
    <Card><CardContent className="p-0">
      {isLoading ? <div className="flex justify-center p-10"><Loader2 className="h-6 w-6 animate-spin" /></div> : !invoices?.length ? <div className="flex flex-col items-center justify-center p-12 text-muted-foreground"><Receipt className="mb-3 h-12 w-12 opacity-50" /><p>{t.noData}</p></div> : <Table><TableHeader><TableRow><TableHead>{t.pur.invoiceNumber}</TableHead><TableHead>{t.pur.supplier}</TableHead><TableHead>{t.inv.warehouse}</TableHead><TableHead>{t.total}</TableHead><TableHead>{t.status}</TableHead><TableHead>{t.actions}</TableHead></TableRow></TableHeader><TableBody>{invoices.map((invoice: any) => <TableRow key={invoice.id}><TableCell className="font-mono">{invoice.invoiceNumber}</TableCell><TableCell>{suppliers?.find((supplier: any) => supplier.id === invoice.supplierId)?.name || "-"}</TableCell><TableCell>{warehouses?.find((warehouse: any) => warehouse.id === invoice.warehouseId)?.name || "-"}</TableCell><TableCell>{Number(invoice.totalAmount || 0).toLocaleString()} SAR</TableCell><TableCell><Badge variant={invoice.status === "accounts_approved" ? "default" : "secondary"}>{invoice.status}</Badge></TableCell><TableCell className="flex gap-1">{invoice.status === "draft" && <PermissionAction permissions={["purchasing.invoice.items_approve"]}><Button size="sm" variant="outline" disabled={approveItems.isPending} onClick={() => approveItems.mutate({ id: invoice.id })}><CheckCircle2 className="h-3 w-3 me-1" />{t.pur.approveItems}</Button></PermissionAction>}{invoice.status === "items_approved" && <PermissionAction permissions={["purchasing.invoice.accounts_approve"]}><Button size="sm" disabled={approveAccounts.isPending} onClick={() => approveAccounts.mutate({ id: invoice.id })}><CheckCircle2 className="h-3 w-3 me-1" />{t.pur.approveAccounts}</Button></PermissionAction>}</TableCell></TableRow>)}</TableBody></Table>}
    </CardContent></Card>
  </div>;
}
