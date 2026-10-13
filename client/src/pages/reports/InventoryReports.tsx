import { useI18n } from "@/lib/i18n";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Loader2, Package } from "lucide-react";
import { useMemo, useState } from "react";

const safeNumber = (value: unknown) => {
  const result = Number(value);
  return Number.isFinite(result) ? result : 0;
};

const formatLocalDate = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

export default function InventoryReports() {
  const { t } = useI18n();
  const [startDate, setStartDate] = useState(() => { const today = new Date(); return formatLocalDate(new Date(today.getFullYear(), today.getMonth(), 1)); });
  const [endDate, setEndDate] = useState(() => formatLocalDate(new Date()));
  const period = useMemo(() => ({ startDate: new Date(`${startDate}T00:00:00`), endDate: new Date(`${endDate}T23:59:59.999`) }), [startDate, endDate]);
  const { data: report, isLoading } = trpc.reports.inventory.useQuery(period);

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end"><div><h1 className="text-2xl font-bold tracking-tight">{t.rep.inventoryReport}</h1><p className="mt-1 text-sm text-muted-foreground">{t.inv.periodMovements}</p></div><div className="grid grid-cols-2 gap-2"><label className="text-xs text-muted-foreground">{t.inv.dateFrom}<Input type="date" value={startDate} max={endDate} onChange={(event) => setStartDate(event.target.value)} /></label><label className="text-xs text-muted-foreground">{t.inv.dateTo}<Input type="date" value={endDate} min={startDate} onChange={(event) => setEndDate(event.target.value)} /></label></div></div>
      {isLoading ? <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin" /></div> : !report?.length ? (
        <Card><CardContent className="flex flex-col items-center justify-center p-12 text-muted-foreground"><Package className="h-12 w-12 mb-3 opacity-50" /><p>{t.noData}</p></CardContent></Card>
      ) : (
        <Card>
          <CardHeader><CardTitle>{t.rep.inventoryReport}</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader><TableRow><TableHead>{t.inv.productName}</TableHead><TableHead>{t.inv.warehouse}</TableHead><TableHead>{t.inv.openingBalance}</TableHead><TableHead>{t.inv.inbound}</TableHead><TableHead>{t.inv.outbound}</TableHead><TableHead>{t.inv.closingBalance}</TableHead><TableHead>{t.inv.avgCost}</TableHead><TableHead>{t.inv.inventoryValue}</TableHead><TableHead>{t.status}</TableHead></TableRow></TableHeader>
              <TableBody>{report.map((r: any, i: number) => {
                const qty = safeNumber(r.closingQuantity);
                const cost = safeNumber(r.avgCost);
                const value = safeNumber(r.inventoryValue);
                const isLow = r.reorderLevel && qty <= r.reorderLevel;
                return (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{r.productName || "-"}</TableCell>
                    <TableCell>{r.warehouseName || "-"}</TableCell>
                    <TableCell className="font-mono">{safeNumber(r.openingQuantity)}</TableCell>
                    <TableCell className="font-mono text-emerald-700">{safeNumber(r.inboundQuantity)}</TableCell>
                    <TableCell className="font-mono text-rose-700">{safeNumber(r.outboundQuantity)}</TableCell>
                    <TableCell className="font-mono">{qty}</TableCell>
                    <TableCell>{cost.toFixed(2)} SAR</TableCell>
                    <TableCell className="font-bold">{value.toLocaleString()} SAR</TableCell>
                    <TableCell>{isLow ? <Badge variant="destructive">{t.dash.lowStock}</Badge> : <Badge variant="default">{t.active}</Badge>}</TableCell>
                  </TableRow>
                );
              })}</TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
