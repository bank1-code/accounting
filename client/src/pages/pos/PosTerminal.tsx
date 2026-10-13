import { useI18n } from "@/lib/i18n";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { PermissionAction } from "@/components/PermissionAction";
import { useAuth } from "@/_core/hooks/useAuth";
import { Plus, Minus, Trash2, ShoppingBag, CreditCard, Banknote, Loader2, Search } from "lucide-react";
import { useState, useMemo } from "react";
import { toast } from "sonner";

interface CartItem { key: string; productId: number; name: string; quantity: number; unitPrice: number; costPrice: number; taxRate: number; trackBatch?: boolean; batchNumber?: string; addonMode?: "included" | "free" | "separate"; parentProductId?: number; }

function BatchSelector({ productId, warehouseId, value, onChange }: { productId: number; warehouseId: number; value?: string; onChange: (value: string) => void }) {
  const { t } = useI18n();
  const { data: batches } = trpc.stock.availableBatches.useQuery({ warehouseId, productId }, { enabled: warehouseId > 0 });
  return <Select value={value || "none"} onValueChange={(next) => onChange(next === "none" ? "" : next)}><SelectTrigger className="mt-1 h-7 text-xs"><SelectValue placeholder={t.inv.batchNumber} /></SelectTrigger><SelectContent><SelectItem value="none">{t.inv.batchNumber}</SelectItem>{batches?.map((batch: any) => <SelectItem key={batch.id} value={batch.batchNumber}>{batch.batchNumber} ({Number(batch.quantity).toLocaleString()})</SelectItem>)}</SelectContent></Select>;
}

export default function PosTerminal() {
  const { t } = useI18n();
  const utils = trpc.useUtils();
  const { user } = useAuth();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [branchId, setBranchId] = useState<number>(0);
  const [warehouseId, setWarehouseId] = useState<number>(0);
  const [orderType, setOrderType] = useState<"dine_in" | "takeaway" | "delivery">("dine_in");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "card" | "transfer" | "mixed">("cash");
  const [mixedCashAmount, setMixedCashAmount] = useState("0");
  const [mixedSecondaryMethod, setMixedSecondaryMethod] = useState<"card" | "transfer">("card");
  const [discount, setDiscount] = useState("0");
  const { data: productsList } = trpc.products.list.useQuery();
  const { data: branchesList } = trpc.branches.list.useQuery();
  const { data: warehousesList } = trpc.warehouses.list.useQuery();
  const { data: nextNum } = trpc.orders.nextNumber.useQuery();
  const { data: posSessions } = trpc.posSessions.list.useQuery({ branchId }, { enabled: branchId > 0 });
  const payOrderMut = trpc.orders.pay.useMutation({
    onSuccess: () => { utils.orders.list.invalidate(); utils.posSessions.list.invalidate(); setCart([]); toast.success(t.success); },
    onError: (error) => toast.error(error.message),
  });
  const createOrderMut = trpc.orders.create.useMutation({
    onSuccess: (order) => payOrderMut.mutate({ id: order.id, branchId }),
    onError: (error) => toast.error(error.message),
  });

  const saleProducts = useMemo(() => productsList?.filter((p: any) => p.type === "finished" || p.type === "direct_sale") || [], [productsList]);
  const filtered = useMemo(() => {
    if (!searchTerm) return saleProducts;
    const s = searchTerm.toLowerCase();
    return saleProducts.filter((p: any) => p.name?.toLowerCase().includes(s) || p.sku?.toLowerCase().includes(s) || p.barcode?.includes(s));
  }, [saleProducts, searchTerm]);

  const addToCart = async (product: any) => {
    const addons = await utils.products.addons.fetch({ parentProductId: product.id });
    setCart((current) => {
      const append = (items: CartItem[], line: CartItem) => {
        const existing = items.find((item) => item.key === line.key);
        return existing ? items.map((item) => item.key === line.key ? { ...item, quantity: item.quantity + 1 } : item) : [...items, line];
      };
      let next = append(current, { key: `product-${product.id}`, productId: product.id, name: product.name, quantity: 1, unitPrice: parseFloat(product.salePrice || "0"), costPrice: parseFloat(product.costPrice || "0"), taxRate: parseFloat(product.taxRate || "0"), trackBatch: product.trackBatch });
      for (const addon of addons) {
        const unitPrice = addon.pricingMode === "separate" ? parseFloat(String(addon.salePrice || "0")) : 0;
        const addonProduct = productsList?.find((item: any) => item.id === addon.addonProductId);
        next = append(next, { key: `addon-${product.id}-${addon.addonProductId}-${addon.pricingMode}`, productId: addon.addonProductId, parentProductId: product.id, addonMode: addon.pricingMode, name: addon.addonName, quantity: 1, unitPrice, costPrice: 0, taxRate: 0, trackBatch: addonProduct?.trackBatch });
      }
      return next;
    });
  };

  const updateQty = (key: string, delta: number) => {
    setCart(cart.map(c => c.key === key ? { ...c, quantity: Math.max(1, c.quantity + delta) } : c));
  };
  const updateBatch = (key: string, batchNumber: string) => setCart((current) => current.map((item) => item.key === key ? { ...item, batchNumber: batchNumber || undefined } : item));

  const totals = useMemo(() => {
    const lineTotals = cart.map((item) => ({ item, cents: Math.round(item.quantity * item.unitPrice * 100) }));
    const subtotalCents = lineTotals.reduce((sum, line) => sum + line.cents, 0);
    const requestedDiscountCents = Math.round(Number(discount || "0") * 100);
    const discountCents = Number.isFinite(requestedDiscountCents) ? Math.max(0, Math.min(requestedDiscountCents, subtotalCents)) : 0;
    let remainingDiscount = discountCents;
    const taxCents = lineTotals.reduce((sum, line, index) => {
      const lineDiscount = subtotalCents === 0 || index === lineTotals.length - 1 ? remainingDiscount : Math.min(line.cents, Math.floor((discountCents * line.cents) / subtotalCents));
      remainingDiscount -= lineDiscount;
      return sum + Math.round((line.cents - lineDiscount) * (line.item.taxRate / 100));
    }, 0);
    return { subtotal: subtotalCents / 100, discount: discountCents / 100, tax: taxCents / 100, grandTotal: (subtotalCents - discountCents + taxCents) / 100 };
  }, [cart, discount]);
  const { subtotal, discount: discountAmt, tax, grandTotal } = totals;

  const submitOrder = () => {
    if (!branchId) { toast.error(t.required + ": " + t.nav.branches); return; }
    if (!warehouseId) { toast.error(t.required + ": " + t.inv.warehouse); return; }
    if (!cart.length) { toast.error(t.noData); return; }
    if (cart.some((item) => item.trackBatch && !item.batchNumber)) { toast.error(t.required + ": " + t.inv.batchNumber); return; }
    const requestedDiscount = Number(discount || "0");
    if (!Number.isFinite(requestedDiscount) || requestedDiscount < 0 || requestedDiscount > subtotal) { toast.error("قيمة الخصم غير صالحة"); return; }
    const openSession = posSessions?.find((session: any) => session.status === "open" && session.cashierId === user?.id);
    if (!openSession) { toast.error("يلزم فتح جلسة كاشير نشطة للفرع المحدد قبل التحصيل"); return; }
    const totalCents = Math.round(grandTotal * 100);
    const mixedCashCents = Math.round(Number(mixedCashAmount || "0") * 100);
    if (paymentMethod === "mixed" && (!Number.isFinite(mixedCashCents) || mixedCashCents <= 0 || mixedCashCents >= totalCents)) {
      toast.error("أدخل الجزء النقدي بحيث يكون أكبر من صفر وأقل من إجمالي الطلب"); return;
    }
    createOrderMut.mutate({
      orderNumber: nextNum || `ORD-${Date.now()}`, branchId, warehouseId, sessionId: openSession.id, type: orderType, paymentMethod,
      discountAmount: String(discountAmt),
      payments: paymentMethod === "mixed" ? [
        { paymentMethod: "cash", amount: (mixedCashCents / 100).toFixed(2) },
        { paymentMethod: mixedSecondaryMethod, amount: ((totalCents - mixedCashCents) / 100).toFixed(2) },
      ] : undefined,
      lines: cart.map(c => ({ productId: c.productId, quantity: String(c.quantity), unitPrice: String(c.unitPrice), costPrice: String(c.costPrice), batchNumber: c.batchNumber, parentProductId: c.parentProductId, addonPricingMode: c.addonMode })),
    });
  };

  return (
    <div className="h-[calc(100vh-4rem)] flex gap-4 p-1">
      {/* Products Panel */}
      <div className="flex-1 flex flex-col gap-3">
        <div className="flex gap-2">
          <Select value={String(branchId || "")} onValueChange={v => { setBranchId(Number(v)); setWarehouseId(0); }}>
            <SelectTrigger className="w-48"><SelectValue placeholder={t.nav.branches} /></SelectTrigger>
            <SelectContent>{branchesList?.map((b: any) => <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={String(warehouseId || "")} onValueChange={v => setWarehouseId(Number(v))} disabled={!branchId}>
            <SelectTrigger className="w-48"><SelectValue placeholder={t.inv.warehouse} /></SelectTrigger>
            <SelectContent>{warehousesList?.filter((warehouse: any) => warehouse.branchId === branchId && warehouse.isActive).map((warehouse: any) => <SelectItem key={warehouse.id} value={String(warehouse.id)}>{warehouse.name}</SelectItem>)}</SelectContent>
          </Select>
          <div className="relative flex-1">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="ps-9" placeholder={t.search + "..."} value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
          </div>
        </div>
        <ScrollArea className="flex-1">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {filtered.map((p: any) => (
              <Card key={p.id} className="cursor-pointer hover:border-primary transition-colors" onClick={() => addToCart(p)}>
                <CardContent className="p-3 text-center">
                  <div className="text-sm font-medium truncate">{p.name}</div>
                  <div className="text-lg font-bold text-primary mt-1">{parseFloat(p.salePrice || "0").toLocaleString()} <span className="text-xs">SAR</span></div>
                </CardContent>
              </Card>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Cart Panel */}
      <Card className="w-80 lg:w-96 flex flex-col">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2"><ShoppingBag className="h-4 w-4" />{t.pos.newOrder}</CardTitle>
            <Select value={orderType} onValueChange={(v: any) => setOrderType(v)}>
              <SelectTrigger className="w-28 h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="dine_in">{t.pos.dineIn}</SelectItem>
                <SelectItem value="takeaway">{t.pos.takeaway}</SelectItem>
                <SelectItem value="delivery">{t.pos.delivery}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col p-3 pt-0">
          <ScrollArea className="flex-1 -mx-1 px-1">
            {!cart.length ? (
              <div className="flex flex-col items-center justify-center h-32 text-muted-foreground text-sm"><ShoppingBag className="h-8 w-8 mb-2 opacity-40" />{t.noData}</div>
            ) : cart.map(item => (
              <div key={item.key} className="flex items-center gap-2 py-2 border-b last:border-0">
                <div className="flex-1 min-w-0"><div className="text-sm font-medium truncate">{item.name}</div><div className="text-xs text-muted-foreground">{item.addonMode === "included" ? t.inv.includedWithMeal : item.addonMode === "free" ? t.inv.freeAddon : `${item.unitPrice.toLocaleString()} SAR`}</div>{item.trackBatch && <BatchSelector productId={item.productId} warehouseId={warehouseId} value={item.batchNumber} onChange={(batchNumber) => updateBatch(item.key, batchNumber)} />}</div>
                <div className="flex items-center gap-1">
                  <Button variant="outline" size="icon" className="h-6 w-6" onClick={() => updateQty(item.key, -1)}><Minus className="h-3 w-3" /></Button>
                  <span className="w-6 text-center text-sm font-medium">{item.quantity}</span>
                  <Button variant="outline" size="icon" className="h-6 w-6" onClick={() => updateQty(item.key, 1)}><Plus className="h-3 w-3" /></Button>
                </div>
                <div className="text-sm font-bold w-16 text-end">{(item.quantity * item.unitPrice).toLocaleString()}</div>
                <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => setCart(cart.filter(c => c.key !== item.key))}><Trash2 className="h-3 w-3" /></Button>
              </div>
            ))}
          </ScrollArea>
          <Separator className="my-2" />
          <div className="space-y-1 text-sm">
            <div className="flex justify-between"><span>{t.pos.subtotal}</span><span>{subtotal.toLocaleString()} SAR</span></div>
            <div className="flex justify-between items-center"><span>{t.pos.discount}</span><Input type="number" className="w-20 h-7 text-xs text-end" value={discount} onChange={e => setDiscount(e.target.value)} /></div>
            <div className="flex justify-between"><span>{t.pos.tax}</span><span>{tax.toFixed(2)} SAR</span></div>
            <Separator />
            <div className="flex justify-between text-lg font-bold"><span>{t.pos.grandTotal}</span><span className="text-primary">{grandTotal.toFixed(2)} SAR</span></div>
          </div>
          <div className="grid grid-cols-2 gap-2 mt-3">
            <Button variant={paymentMethod === "cash" ? "default" : "outline"} size="sm" onClick={() => setPaymentMethod("cash")} className="gap-1"><Banknote className="h-3 w-3" />{t.pos.cash}</Button>
            <Button variant={paymentMethod === "card" ? "default" : "outline"} size="sm" onClick={() => setPaymentMethod("card")} className="gap-1"><CreditCard className="h-3 w-3" />{t.pos.card}</Button>
            <Button variant={paymentMethod === "transfer" ? "default" : "outline"} size="sm" onClick={() => setPaymentMethod("transfer")} className="gap-1">تحويل</Button>
            <Button variant={paymentMethod === "mixed" ? "default" : "outline"} size="sm" onClick={() => setPaymentMethod("mixed")} className="gap-1">مختلط</Button>
          </div>
          {paymentMethod === "mixed" && <div className="mt-3 space-y-2 rounded-lg border bg-muted/30 p-3"><p className="text-xs font-medium">توزيع التحصيل المختلط</p><div className="grid grid-cols-2 gap-2"><div><label className="text-xs text-muted-foreground">المبلغ النقدي</label><Input type="number" min="0" step="0.01" value={mixedCashAmount} onChange={(event) => setMixedCashAmount(event.target.value)} /></div><div><label className="text-xs text-muted-foreground">الجزء المتبقي</label><div className="h-9 rounded-md border bg-background px-3 py-2 text-sm">{(grandTotal - Number(mixedCashAmount || 0)).toFixed(2)} SAR</div></div></div><div className="grid grid-cols-2 gap-2"><Button type="button" size="sm" variant={mixedSecondaryMethod === "card" ? "default" : "outline"} onClick={() => setMixedSecondaryMethod("card")}>بطاقة</Button><Button type="button" size="sm" variant={mixedSecondaryMethod === "transfer" ? "default" : "outline"} onClick={() => setMixedSecondaryMethod("transfer")}>تحويل</Button></div></div>}
          <PermissionAction permissions={["pos.order.create"]}>
            <Button className="w-full mt-3" size="lg" onClick={submitOrder} disabled={createOrderMut.isPending || payOrderMut.isPending || !cart.length}>
              {(createOrderMut.isPending || payOrderMut.isPending) ? <Loader2 className="h-4 w-4 me-2 animate-spin" /> : null}{t.pos.pay} - {grandTotal.toFixed(2)} SAR
            </Button>
          </PermissionAction>
        </CardContent>
      </Card>
    </div>
  );
}
