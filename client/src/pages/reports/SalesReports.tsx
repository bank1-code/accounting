import { useI18n } from "@/lib/i18n";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, BarChart3, TrendingUp, DollarSign, ShoppingCart } from "lucide-react";
import { useState, useMemo } from "react";

export default function SalesReports() {
  const { t } = useI18n();
  const { data: branchesList } = trpc.branches.list.useQuery();
  const [startDate] = useState(() => { const d = new Date(); d.setMonth(d.getMonth() - 1); return d; });
  const [endDate] = useState(() => new Date());
  const [branchId, setBranchId] = useState<number | undefined>(undefined);
  const { data: report, isLoading } = trpc.reports.sales.useQuery({ startDate, endDate, branchId });

  const stats = useMemo(() => {
    if (!report) return null;
    return {
      totalRevenue: report.reduce((s: number, r: any) => s + parseFloat(r.totalAmount || "0"), 0),
      totalOrders: report.length,
      avgOrder: report.length ? report.reduce((s: number, r: any) => s + parseFloat(r.totalAmount || "0"), 0) / report.length : 0,
    };
  }, [report]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">{t.rep.salesReport}</h1>
        <Select value={branchId ? String(branchId) : "all"} onValueChange={v => setBranchId(v === "all" ? undefined : Number(v))}>
          <SelectTrigger className="w-48"><SelectValue placeholder={t.rep.allBranches} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t.rep.allBranches}</SelectItem>
            {branchesList?.map((b: any) => <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      {isLoading ? <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin" /></div> : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card><CardContent className="p-6 flex items-center gap-4"><div className="p-3 rounded-lg bg-primary/10"><DollarSign className="h-6 w-6 text-primary" /></div><div><p className="text-sm text-muted-foreground">{t.rep.totalRevenue}</p><p className="text-2xl font-bold">{(stats?.totalRevenue || 0).toLocaleString()} SAR</p></div></CardContent></Card>
            <Card><CardContent className="p-6 flex items-center gap-4"><div className="p-3 rounded-lg bg-blue-100"><ShoppingCart className="h-6 w-6 text-blue-600" /></div><div><p className="text-sm text-muted-foreground">{t.dash.todayOrders}</p><p className="text-2xl font-bold">{stats?.totalOrders || 0}</p></div></CardContent></Card>
            <Card><CardContent className="p-6 flex items-center gap-4"><div className="p-3 rounded-lg bg-green-100"><TrendingUp className="h-6 w-6 text-green-600" /></div><div><p className="text-sm text-muted-foreground">متوسط الطلب</p><p className="text-2xl font-bold">{(stats?.avgOrder || 0).toFixed(0)} SAR</p></div></CardContent></Card>
          </div>
          {!report?.length ? (
            <Card><CardContent className="flex flex-col items-center justify-center p-12 text-muted-foreground"><BarChart3 className="h-12 w-12 mb-3 opacity-50" /><p>{t.noData}</p></CardContent></Card>
          ) : (
            <Card>
              <CardHeader><CardTitle>{t.rep.salesReport}</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {report.slice(0, 20).map((o: any, i: number) => (
                    <div key={i} className="flex items-center justify-between py-2 border-b last:border-0">
                      <div><span className="font-mono text-sm">{o.orderNumber}</span><span className="text-muted-foreground text-sm ms-3">{new Date(o.createdAt).toLocaleDateString()}</span></div>
                      <span className="font-bold">{parseFloat(o.totalAmount || "0").toLocaleString()} SAR</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
