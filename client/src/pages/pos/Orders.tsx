import { useI18n } from "@/lib/i18n";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PermissionAction } from "@/components/PermissionAction";
import { AlertTriangle, CheckCircle2, Loader2, Receipt, RotateCcw, WalletCards } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function Orders() {
  const { t } = useI18n();
  const utils = trpc.useUtils();
  const { data: orders, isLoading } = trpc.orders.list.useQuery();
  const { data: branchesList } = trpc.branches.list.useQuery();
  const permissions = trpc.accessControl.myPermissions.useQuery();
  const refundAccess = Boolean(permissions.data?.some((permission) => ["pos.order.refund", "treasury.refund.approve", "treasury.voucher.post"].includes(permission)));
  const refunds = trpc.posRefunds.list.useQuery(undefined, { enabled: refundAccess });
  const nextRefundNumber = trpc.posRefunds.nextNumber.useQuery(undefined, { enabled: false });
  const [refundOpen, setRefundOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [reason, setReason] = useState("");

  const requestRefund = trpc.posRefunds.request.useMutation({
    onSuccess: async () => {
      await Promise.all([utils.posRefunds.list.invalidate(), utils.posRefunds.nextNumber.invalidate()]);
      setRefundOpen(false);
      setSelectedOrder(null);
      setReason("");
      toast.success("تم إنشاء سند المردود بانتظار الاعتماد");
    },
    onError: (error) => toast.error(error.message),
  });
  const approveRefund = trpc.posRefunds.approve.useMutation({
    onSuccess: () => { utils.posRefunds.list.invalidate(); toast.success("تم اعتماد سند المردود"); },
    onError: (error) => toast.error(error.message),
  });
  const completeRefund = trpc.posRefunds.complete.useMutation({
    onSuccess: async () => { await Promise.all([utils.posRefunds.list.invalidate(), utils.orders.list.invalidate(), utils.posSessions.list.invalidate()]); toast.success("اكتمل المردود وعادت الكمية إلى المخزون"); },
    onError: (error) => toast.error(error.message),
  });

  const statusLabels: Record<string, string> = { new: t.pos.newOrder, preparing: t.pos.preparing, ready: t.pos.ready, served: t.pos.served, paid: t.hr.paid, cancelled: t.inv.cancelled };
  const statusColors: Record<string, string> = { new: "default", preparing: "secondary", ready: "default", served: "default", paid: "default", cancelled: "destructive" };
  const typeLabels: Record<string, string> = { dine_in: t.pos.dineIn, takeaway: t.pos.takeaway, delivery: t.pos.delivery };
  const refundStatusLabel: Record<string, string> = { requested: "بانتظار الاعتماد", approved: "معتمد للصرف", completed: "مكتمل", rejected: "مرفوض" };

  const openRefundRequest = async (order: any) => {
    setSelectedOrder(order);
    setReason("");
    setRefundOpen(true);
    await nextRefundNumber.refetch();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div><h1 className="text-2xl font-bold tracking-tight">{t.nav.orders}</h1><p className="text-sm text-muted-foreground">الطلبات المدفوعة لا تُلغى مباشرة؛ تمر عبر سند مردود معتمد يعكس المخزون وتسوية النقد.</p></div>
      </div>
      <Card>
        <CardContent className="p-0">
          {isLoading ? <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin" /></div> : !orders?.length ? (
            <div className="flex flex-col items-center justify-center p-12 text-muted-foreground"><Receipt className="h-12 w-12 mb-3 opacity-50" /><p>{t.noData}</p></div>
          ) : (
            <Table><TableHeader><TableRow><TableHead>#</TableHead><TableHead>{t.nav.branches}</TableHead><TableHead>{t.type}</TableHead><TableHead>{t.total}</TableHead><TableHead>{t.pos.paymentMethod}</TableHead><TableHead>{t.date}</TableHead><TableHead>{t.status}</TableHead><TableHead>{t.actions}</TableHead></TableRow></TableHeader>
              <TableBody>{orders.map((order: any) => (
                <TableRow key={order.id}>
                  <TableCell className="font-mono">{order.orderNumber}</TableCell>
                  <TableCell>{branchesList?.find((branch: any) => branch.id === order.branchId)?.name || "-"}</TableCell>
                  <TableCell><Badge variant="outline">{typeLabels[order.type] || order.type}</Badge></TableCell>
                  <TableCell className="font-bold">{parseFloat(order.totalAmount || "0").toLocaleString()} SAR</TableCell>
                  <TableCell>{order.paymentMethod}</TableCell>
                  <TableCell>{new Date(order.createdAt).toLocaleDateString()}</TableCell>
                  <TableCell><Badge variant={(statusColors[order.status] || "outline") as any}>{statusLabels[order.status] || order.status}</Badge></TableCell>
                  <TableCell>{order.status === "paid" && <PermissionAction permissions={["pos.order.refund"]}><Button variant="outline" size="sm" onClick={() => openRefundRequest(order)}><RotateCcw className="me-1.5 h-3.5 w-3.5" />طلب مردود</Button></PermissionAction>}</TableCell>
                </TableRow>
              ))}</TableBody></Table>
          )}
        </CardContent>
      </Card>

      {refundAccess && <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-base"><WalletCards className="h-5 w-5 text-primary" />سندات المردود</CardTitle></CardHeader>
        <CardContent className="p-0"><Table><TableHeader><TableRow><TableHead>السند</TableHead><TableHead>الطلب</TableHead><TableHead>{t.nav.branches}</TableHead><TableHead>{t.total}</TableHead><TableHead>الحالة</TableHead><TableHead>{t.actions}</TableHead></TableRow></TableHeader>
          <TableBody>{refunds.isLoading ? <TableRow><TableCell colSpan={6} className="py-8 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></TableCell></TableRow> : !refunds.data?.length ? <TableRow><TableCell colSpan={6} className="py-8 text-center text-muted-foreground">لا توجد سندات مردود.</TableCell></TableRow> : refunds.data.map((refund) => <TableRow key={refund.id}><TableCell className="font-mono">{refund.refundNumber}</TableCell><TableCell>#{refund.orderId}</TableCell><TableCell>{branchesList?.find((branch: any) => branch.id === refund.branchId)?.name || `#${refund.branchId}`}</TableCell><TableCell>{refund.amount} SAR</TableCell><TableCell><Badge variant={refund.status === "completed" ? "default" : refund.status === "requested" ? "secondary" : "outline"}>{refundStatusLabel[refund.status]}</Badge></TableCell><TableCell className="space-x-1 rtl:space-x-reverse">{refund.status === "requested" && <PermissionAction permissions={["treasury.refund.approve"]}><Button size="sm" variant="outline" onClick={() => approveRefund.mutate({ id: refund.id, branchId: refund.branchId })} disabled={approveRefund.isPending}><CheckCircle2 className="me-1 h-3.5 w-3.5" />اعتماد</Button></PermissionAction>}{refund.status === "approved" && <PermissionAction permissions={["treasury.voucher.post"]}><Button size="sm" onClick={() => completeRefund.mutate({ id: refund.id, branchId: refund.branchId })} disabled={completeRefund.isPending}><WalletCards className="me-1 h-3.5 w-3.5" />إتمام وصرف</Button></PermissionAction>}</TableCell></TableRow>)}</TableBody>
        </Table></CardContent>
      </Card>}

      <Dialog open={refundOpen} onOpenChange={setRefundOpen}>
        <DialogContent><DialogHeader><DialogTitle>طلب سند مردود</DialogTitle></DialogHeader>
          <div className="space-y-4"><div className="rounded-lg border border-amber-500/30 bg-amber-50 p-3 text-sm text-amber-900"><AlertTriangle className="me-2 inline h-4 w-4" />لن يُلغى الطلب أو يعاد المخزون قبل اعتماد السند وإتمامه.</div><div className="grid grid-cols-2 gap-3 text-sm"><div><Label>رقم السند</Label><p className="mt-1 font-mono">{nextRefundNumber.data || "..."}</p></div><div><Label>المبلغ</Label><p className="mt-1 font-semibold">{selectedOrder?.totalAmount || "0"} SAR</p></div></div><div className="space-y-2"><Label>سبب المردود</Label><Input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="سبب موثق للمردود" maxLength={2000} /></div></div>
          <DialogFooter><Button variant="outline" onClick={() => setRefundOpen(false)}>إلغاء</Button><Button disabled={!selectedOrder || reason.trim().length < 3 || requestRefund.isPending || !nextRefundNumber.data} onClick={() => requestRefund.mutate({ refundNumber: nextRefundNumber.data!, orderId: selectedOrder.id, branchId: selectedOrder.branchId, reason: reason.trim() })}>{requestRefund.isPending && <Loader2 className="me-2 h-4 w-4 animate-spin" />}إرسال للاعتماد</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
