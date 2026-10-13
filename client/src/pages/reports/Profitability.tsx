import { useI18n } from "@/lib/i18n";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, TrendingUp } from "lucide-react";
import { useState } from "react";

export default function Profitability() {
  const { t } = useI18n();
  const [startDate] = useState(() => { const d = new Date(); d.setMonth(d.getMonth() - 1); return d; });
  const [endDate] = useState(() => new Date());
  const { data: report, isLoading } = trpc.reports.profitability.useQuery({ startDate, endDate });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">{t.rep.profitabilityReport}</h1>
      {isLoading ? <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin" /></div> : !report?.length ? (
        <Card><CardContent className="flex flex-col items-center justify-center p-12 text-muted-foreground"><TrendingUp className="h-12 w-12 mb-3 opacity-50" /><p>{t.noData}</p></CardContent></Card>
      ) : (
        <Card>
          <CardHeader><CardTitle>{t.rep.profitabilityReport} - {t.rep.monthly}</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader><TableRow><TableHead>{t.nav.branches}</TableHead><TableHead>{t.rep.totalRevenue}</TableHead><TableHead>{t.rep.totalCost}</TableHead><TableHead>{t.rep.grossProfit}</TableHead><TableHead>%</TableHead></TableRow></TableHeader>
              <TableBody>{report.map((r: any, i: number) => {
                const revenue = parseFloat(r.totalRevenue || "0");
                const cost = parseFloat(r.totalCost || "0");
                const profit = revenue - cost;
                const margin = revenue > 0 ? (profit / revenue * 100) : 0;
                return (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{r.branchName || `فرع ${r.branchId}`}</TableCell>
                    <TableCell>{revenue.toLocaleString()} SAR</TableCell>
                    <TableCell>{cost.toLocaleString()} SAR</TableCell>
                    <TableCell className={profit >= 0 ? "text-green-600 font-bold" : "text-destructive font-bold"}>{profit.toLocaleString()} SAR</TableCell>
                    <TableCell><span className={margin >= 0 ? "text-green-600" : "text-destructive"}>{margin.toFixed(1)}%</span></TableCell>
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
