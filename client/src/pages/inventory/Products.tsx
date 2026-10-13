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
import { PermissionAction } from "@/components/PermissionAction";
import { Plus, Loader2, Package, Search, RefreshCw, ShieldCheck, TriangleAlert } from "lucide-react";
import { useState, useMemo } from "react";
import { toast } from "sonner";

export default function Products() {
  const { t } = useI18n();
  const utils = trpc.useUtils();
  const { data: productsList, isLoading } = trpc.products.list.useQuery();
  const { data: taxCodesList } = trpc.products.taxCodes.useQuery();
  const taxConsistency = trpc.products.taxCodeConsistency.useQuery();
  const { data: categoriesList } = trpc.categories.list.useQuery();
  const synchronizeTaxRates = trpc.products.synchronizeTaxCodeRates.useMutation({
    onSuccess: async (result) => { await Promise.all([utils.products.list.invalidate(), utils.products.taxCodeConsistency.invalidate()]); toast.success(`تمت مزامنة ${result.synchronized} صنف`); },
    onError: (error) => toast.error(error.message),
  });
  const { data: unitsList } = trpc.units.list.useQuery();
  const createMut = trpc.products.create.useMutation({
    onSuccess: () => { utils.products.list.invalidate(); setOpen(false); toast.success(t.success); },
    onError: () => toast.error(t.error),
  });

  const [open, setOpen] = useState(false);
  const [addonOpen, setAddonOpen] = useState(false);
  const [addonParentId, setAddonParentId] = useState<number | null>(null);
  const [addonForm, setAddonForm] = useState({ addonProductId: 0, pricingMode: "included" as "included" | "free" | "separate", salePrice: "0" });
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [form, setForm] = useState({
    name: "", nameEn: "", sku: "", barcode: "", type: "raw_material" as string,
    categoryId: 0, unitId: 0, costPrice: "0", salePrice: "0", taxRate: "0", taxCodeId: 0,
    reorderLevel: 0, trackBatch: false, trackExpiry: false,
  });

  const filtered = useMemo(() => {
    if (!productsList) return [];
    return productsList.filter(p => {
      const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase()) || (p.sku || "").toLowerCase().includes(search.toLowerCase());
      const matchType = typeFilter === "all" || p.type === typeFilter;
      return matchSearch && matchType;
    });
  }, [productsList, search, typeFilter]);

  const typeLabels: Record<string, string> = {
    raw_material: t.inv.rawMaterial, semi_finished: t.inv.semiFinished,
    finished: t.inv.finished, direct_sale: t.inv.directSale, service: t.inv.service,
  };
  const productAddons = trpc.products.addons.useQuery({ parentProductId: addonParentId || 0 }, { enabled: Boolean(addonParentId) });
  const createAddon = trpc.products.createAddon.useMutation({
    onSuccess: () => { utils.products.addons.invalidate({ parentProductId: addonParentId || 0 }); setAddonForm({ addonProductId: 0, pricingMode: "included", salePrice: "0" }); toast.success("تم حفظ إضافة الوجبة"); },
    onError: (error) => toast.error(error.message),
  });
  const deleteAddon = trpc.products.deleteAddon.useMutation({
    onSuccess: () => { utils.products.addons.invalidate({ parentProductId: addonParentId || 0 }); toast.success("تم حذف الإضافة"); },
    onError: (error) => toast.error(error.message),
  });

  const handleSubmit = () => {
    if (!form.name || !form.type) { toast.error(t.required); return; }
    createMut.mutate({
      ...form,
      type: form.type as "raw_material" | "semi_finished" | "finished" | "direct_sale" | "service",
      categoryId: form.categoryId || undefined,
      unitId: form.unitId || undefined,
      taxCodeId: form.taxCodeId || undefined,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold tracking-tight">{t.nav.products}</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 me-2" />{t.inv.addProduct}</Button></DialogTrigger>
          <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{t.inv.addProduct}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><Label>{t.inv.productName} (AR)</Label><Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} /></div>
                <div><Label>{t.inv.productName} (EN)</Label><Input value={form.nameEn} onChange={e => setForm({...form, nameEn: e.target.value})} /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>{t.inv.sku}</Label><Input value={form.sku} onChange={e => setForm({...form, sku: e.target.value})} /></div>
                <div><Label>{t.inv.barcode}</Label><Input value={form.barcode} onChange={e => setForm({...form, barcode: e.target.value})} /></div>
              </div>
              <div>
                <Label>{t.type}</Label>
                <Select value={form.type} onValueChange={v => setForm({...form, type: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="raw_material">{t.inv.rawMaterial}</SelectItem>
                    <SelectItem value="semi_finished">{t.inv.semiFinished}</SelectItem>
                    <SelectItem value="finished">{t.inv.finished}</SelectItem>
                    <SelectItem value="direct_sale">{t.inv.directSale}</SelectItem>
                    <SelectItem value="service">{t.inv.service}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>{t.inv.category}</Label>
                  <Select value={String(form.categoryId || "")} onValueChange={v => setForm({...form, categoryId: Number(v)})}>
                    <SelectTrigger><SelectValue placeholder={t.optional} /></SelectTrigger>
                    <SelectContent>{categoriesList?.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>{t.inv.unit}</Label>
                  <Select value={String(form.unitId || "")} onValueChange={v => setForm({...form, unitId: Number(v)})}>
                    <SelectTrigger><SelectValue placeholder={t.optional} /></SelectTrigger>
                    <SelectContent>{unitsList?.map(u => <SelectItem key={u.id} value={String(u.id)}>{u.name} ({u.symbol})</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div><Label>{t.inv.costPrice}</Label><Input type="number" value={form.costPrice} onChange={e => setForm({...form, costPrice: e.target.value})} /></div>
                <div><Label>{t.inv.salePrice}</Label><Input type="number" value={form.salePrice} onChange={e => setForm({...form, salePrice: e.target.value})} /></div>
                <div><Label>{t.inv.taxRate} %</Label><Input type="number" value={form.taxRate} disabled={Boolean(form.taxCodeId)} onChange={e => setForm({...form, taxRate: e.target.value})} /></div>
              </div>
              <div><Label>رمز ضريبة القيمة المضافة</Label><Select value={String(form.taxCodeId || "none")} onValueChange={value => { const selected = taxCodesList?.find((taxCode) => taxCode.id === Number(value)); setForm({ ...form, taxCodeId: value === "none" ? 0 : Number(value), taxRate: selected ? String(selected.rate) : form.taxRate }); }}><SelectTrigger><SelectValue placeholder="اختياري عند مرحلة البناء" /></SelectTrigger><SelectContent><SelectItem value="none">بدون رمز ضريبة</SelectItem>{taxCodesList?.filter((taxCode) => taxCode.isActive).map((taxCode) => <SelectItem key={taxCode.id} value={String(taxCode.id)}>{taxCode.code} — {taxCode.name} ({taxCode.rate}%)</SelectItem>)}</SelectContent></Select><p className="mt-1 text-xs text-muted-foreground">عند اختيار رمز نشط، يشتق الخادم معدل الضريبة منه ولا يقبل معدلاً مخالفاً.</p></div>
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2"><Switch checked={form.trackBatch} onCheckedChange={v => setForm({...form, trackBatch: v})} /><Label>{t.inv.batchNumber}</Label></div>
                <div className="flex items-center gap-2"><Switch checked={form.trackExpiry} onCheckedChange={v => setForm({...form, trackExpiry: v})} /><Label>{t.inv.expiryDate}</Label></div>
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

      {taxConsistency.data && <Card className={taxConsistency.data.mismatches.length || taxConsistency.data.invalidTaxCodes.length ? "border-amber-500/50" : "border-emerald-500/40"}>
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">{taxConsistency.data.mismatches.length || taxConsistency.data.invalidTaxCodes.length ? <TriangleAlert className="mt-0.5 h-5 w-5 text-amber-600" /> : <ShieldCheck className="mt-0.5 h-5 w-5 text-emerald-600" />}<div><p className="font-medium">تدقيق اتساق رمز الضريبة</p><p className="text-sm text-muted-foreground">{taxConsistency.data.mismatches.length || taxConsistency.data.invalidTaxCodes.length ? `${taxConsistency.data.mismatches.length} معدل غير متطابق و${taxConsistency.data.invalidTaxCodes.length} رمز غير صالح.` : "لا توجد فروقات في رموز ومعدلات ضريبة الأصناف الحالية."}</p></div></div>
          {taxConsistency.data.mismatches.length > 0 && <PermissionAction permissions={["inventory.catalog.manage"]}><Button variant="outline" onClick={() => synchronizeTaxRates.mutate()} disabled={synchronizeTaxRates.isPending}>{synchronizeTaxRates.isPending ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <RefreshCw className="me-2 h-4 w-4" />}مزامنة المعدلات</Button></PermissionAction>}
        </CardContent>
      </Card>}

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="ps-9" placeholder={t.search} value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t.all}</SelectItem>
            <SelectItem value="raw_material">{t.inv.rawMaterial}</SelectItem>
            <SelectItem value="semi_finished">{t.inv.semiFinished}</SelectItem>
            <SelectItem value="finished">{t.inv.finished}</SelectItem>
            <SelectItem value="direct_sale">{t.inv.directSale}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : !filtered.length ? (
            <div className="flex flex-col items-center justify-center p-12 text-muted-foreground">
              <Package className="h-12 w-12 mb-3 opacity-50" /><p>{t.noData}</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.inv.sku}</TableHead>
                  <TableHead>{t.inv.productName}</TableHead>
                  <TableHead>{t.type}</TableHead>
                  <TableHead>{t.inv.costPrice}</TableHead>
                  <TableHead>{t.inv.salePrice}</TableHead>
                  <TableHead>{t.inv.taxRate}</TableHead>
                  <TableHead>{t.status}</TableHead>
                  <TableHead>{t.inv.addOns}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(p => (
                  <TableRow key={p.id}>
                    <TableCell className="font-mono text-sm">{p.sku || "-"}</TableCell>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell><Badge variant="outline">{typeLabels[p.type] || p.type}</Badge></TableCell>
                    <TableCell>{parseFloat(String(p.costPrice)).toLocaleString()}</TableCell>
                    <TableCell>{parseFloat(String(p.salePrice)).toLocaleString()}</TableCell>
                    <TableCell>{parseFloat(String(p.taxRate)).toLocaleString()}%</TableCell>
                    <TableCell><Badge variant={p.isActive ? "default" : "secondary"}>{p.isActive ? t.active : t.inactive}</Badge></TableCell>
                    <TableCell><PermissionAction permissions={["inventory.catalog.manage"]}><Button size="sm" variant="outline" onClick={() => { setAddonParentId(p.id); setAddonOpen(true); }}>{t.inv.addOns}</Button></PermissionAction></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={addonOpen} onOpenChange={setAddonOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{t.inv.mealAddOns}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2"><Label>{t.inv.addonProduct}</Label><Select value={String(addonForm.addonProductId || "none")} onValueChange={(value) => setAddonForm({ ...addonForm, addonProductId: value === "none" ? 0 : Number(value) })}><SelectTrigger><SelectValue placeholder={t.inv.addonProduct} /></SelectTrigger><SelectContent><SelectItem value="none">{t.inv.addonProduct}</SelectItem>{productsList?.filter((product) => product.id !== addonParentId && product.isActive).map((product) => <SelectItem key={product.id} value={String(product.id)}>{product.name}</SelectItem>)}</SelectContent></Select></div>
              <div><Label>{t.inv.addonPricing}</Label><Select value={addonForm.pricingMode} onValueChange={(value) => setAddonForm({ ...addonForm, pricingMode: value as typeof addonForm.pricingMode })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="included">{t.inv.included}</SelectItem><SelectItem value="free">{t.inv.free}</SelectItem><SelectItem value="separate">{t.inv.separate}</SelectItem></SelectContent></Select></div>
            </div>
            {addonForm.pricingMode === "separate" && <div><Label>سعر الإضافة</Label><Input type="number" min="0" value={addonForm.salePrice} onChange={(event) => setAddonForm({ ...addonForm, salePrice: event.target.value })} /></div>}
            <PermissionAction permissions={["inventory.catalog.manage"]}><Button className="w-full" disabled={!addonParentId || !addonForm.addonProductId || createAddon.isPending} onClick={() => createAddon.mutate({ parentProductId: addonParentId!, ...addonForm })}>{createAddon.isPending && <Loader2 className="me-2 h-4 w-4 animate-spin" />}{t.inv.addToMeal}</Button></PermissionAction>
            <div className="space-y-2 border-t pt-3">{productAddons.isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : productAddons.data?.length ? productAddons.data.map((addon) => <div key={addon.id} className="flex items-center justify-between rounded-md bg-muted/50 px-3 py-2"><div><span className="font-medium">{addon.addonName}</span><span className="ms-2 text-sm text-muted-foreground">{addon.pricingMode === "included" ? t.inv.includedWithMeal : addon.pricingMode === "free" ? t.inv.free : `${t.inv.separate}: ${addon.salePrice}`}</span></div><PermissionAction permissions={["inventory.catalog.manage"]}><Button size="sm" variant="ghost" className="text-destructive" onClick={() => deleteAddon.mutate({ id: addon.id })}>{t.delete}</Button></PermissionAction></div>) : <p className="text-sm text-muted-foreground">{t.inv.noMealAddOns}</p>}</div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
