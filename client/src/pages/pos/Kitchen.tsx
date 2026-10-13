import { useI18n } from "@/lib/i18n";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, ChefHat, Clock, CheckCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function Kitchen() {
  const { t } = useI18n();
  const utils = trpc.useUtils();
  const { data: branchesList } = trpc.branches.list.useQuery();
  const [branchId, setBranchId] = useState<number>(0);
  const { data: kitchenOrders, isLoading } = trpc.kitchen.list.useQuery({ branchId: branchId || 1 }, { enabled: branchId > 0, refetchInterval: 5000 });
  const updateMut = trpc.kitchen.updateStatus.useMutation({ onSuccess: () => { utils.kitchen.list.invalidate(); toast.success(t.success); } });

  const statusColors: Record<string, string> = { new: "border-blue-400 bg-blue-50", preparing: "border-orange-400 bg-orange-50", ready: "border-green-400 bg-green-50" };
  const statusLabels: Record<string, string> = { new: t.pos.newOrderAlert, preparing: t.pos.preparing, ready: t.pos.ready };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2"><ChefHat className="h-6 w-6" />{t.pos.kitchenDisplay}</h1>
        <Select value={String(branchId || "")} onValueChange={v => setBranchId(Number(v))}>
          <SelectTrigger className="w-48"><SelectValue placeholder={t.nav.branches} /></SelectTrigger>
          <SelectContent>{branchesList?.map((b: any) => <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      {!branchId ? (
        <div className="flex flex-col items-center justify-center p-12 text-muted-foreground"><ChefHat className="h-12 w-12 mb-3 opacity-50" /><p>اختر الفرع أولاً</p></div>
      ) : isLoading ? (
        <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : !kitchenOrders?.length ? (
        <div className="flex flex-col items-center justify-center p-12 text-muted-foreground"><CheckCircle className="h-12 w-12 mb-3 opacity-50" /><p>لا توجد طلبات معلقة</p></div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {kitchenOrders.map((order: any) => (
            <Card key={order.id} className={`border-2 ${statusColors[order.status] || ""}`}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg font-mono">#{order.orderNumber}</CardTitle>
                  <Badge variant="outline">{statusLabels[order.status] || order.status}</Badge>
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground"><Clock className="h-3 w-3" />{new Date(order.createdAt).toLocaleTimeString()}</div>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="text-sm">{order.notes || ""}</div>
                <div className="flex gap-2">
                  {order.status === "new" && <Button size="sm" className="flex-1" onClick={() => updateMut.mutate({ id: order.id, status: "preparing" })}>{t.pos.preparing}</Button>}
                  {order.status === "preparing" && <Button size="sm" className="flex-1" onClick={() => updateMut.mutate({ id: order.id, status: "ready" })}>{t.pos.ready}</Button>}
                  {order.status === "ready" && <Button size="sm" variant="outline" className="flex-1" onClick={() => updateMut.mutate({ id: order.id, status: "served" })}>{t.pos.served}</Button>}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
