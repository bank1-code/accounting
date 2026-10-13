import { useI18n } from "@/lib/i18n";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, Factory } from "lucide-react";
import { useState } from "react";

export default function ProductionReports() {
  const { t } = useI18n();
  const [startDate] = useState(() => { const d = new Date(); d.setMonth(d.getMonth() - 1); return d; });
  const [endDate] = useState(() => new Date());
  const { data: report, isLoading } = trpc.reports.production.useQuery({ startDate, endDate });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">{t.rep.productionReport}</h1>
      {isLoading ? <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin" /></div> : !report?.length ? (
        <Card><CardContent className="flex flex-col items-center justify-center p-12 text-muted-foreground"><Factory className="h-12 w-12 mb-3 opacity-50" /><p>{t.noData}</p></CardContent></Card>
      ) : (
        <Card>
          <CardHeader><CardTitle>{t.rep.varianceAnalysis}</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader><TableRow><TableHead>#</TableHead><TableHead>{t.mfg.outputProduct}</TableHead><TableHead>{t.mfg.plannedQty}</TableHead><TableHead>{t.mfg.actualQty}</TableHead><TableHead>{t.mfg.wasteQty}</TableHead><TableHead>{t.mfg.plannedCost}</TableHead><TableHead>{t.mfg.actualCost}</TableHead><TableHead>{t.mfg.variance}</TableHead></TableRow></TableHeader>
              <TableBody>{report.map((r: any) => {
                const planned = parseFloat(r.plannedCost || "0");
                const actual = parseFloat(r.actualCost || "0");
                const variance = planned > 0 ? ((actual - planned) / planned * 100) : 0;
                return (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono">{r.orderNumber}</TableCell>
                    <TableCell className="font-medium">{r.productName || "-"}</TableCell>
                    <TableCell>{r.plannedQuantity}</TableCell>
                    <TableCell>{r.actualQuantity || "-"}</TableCell>
                    <TableCell>{r.wasteQuantity || "0"}</TableCell>
                    <TableCell>{planned.toLocaleString()} SAR</TableCell>
                    <TableCell>{actual.toLocaleString()} SAR</TableCell>
                    <TableCell><Badge variant={variance > 5 ? "destructive" : variance < -5 ? "default" : "outline"}>{variance.toFixed(1)}%</Badge></TableCell>
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
