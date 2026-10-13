import { useI18n } from "@/lib/i18n";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PieChart, Loader2, Download } from "lucide-react";
import { useState } from "react";

export default function IncomeStatement() {
  const { t, locale } = useI18n();
  const [period] = useState(() => ({ startDate: new Date(new Date().getFullYear(), 0, 1), endDate: new Date() }));
  const { data, isLoading } = trpc.reports.financialStatements.useQuery(period);
  const report = data?.incomeStatement;
  const fmt = (value: number) => value.toLocaleString(locale === "ar" ? "ar-SA" : "en-US", { minimumFractionDigits: 2 });

  const renderSection = (title: string, lines: NonNullable<typeof report>["revenue"], total: number, tone: "revenue" | "expense") => (
    <Card>
      <CardContent className="p-0">
        <div className={`px-4 py-3 border-b font-semibold ${tone === "revenue" ? "bg-green-50 text-green-800" : "bg-orange-50 text-orange-800"}`}>{title}</div>
        <table className="data-table">
          <tbody>
            {lines.map((line) => <tr key={line.id} className="hover:bg-muted/50"><td className="px-4 py-2.5 border-t font-mono text-sm w-24">{line.code}</td><td className="px-4 py-2.5 border-t">{locale === "ar" ? line.name : (line.nameEn || line.name)}</td><td className="px-4 py-2.5 border-t text-end tabular-nums w-40">{fmt(line.periodBalance)}</td></tr>)}
            {!lines.length && <tr><td colSpan={3} className="px-4 py-4 text-center text-muted-foreground">{t.noData}</td></tr>}
          </tbody>
          <tfoot><tr className={`${tone === "revenue" ? "bg-green-50/50" : "bg-orange-50/50"} font-bold`}><td colSpan={2} className="px-4 py-3">{title}</td><td className="px-4 py-3 text-end tabular-nums">{fmt(total)}</td></tr></tfoot>
        </table>
      </CardContent>
    </Card>
  );

  return <div className="space-y-4">
    <div className="page-header"><div className="flex items-center gap-3"><div className="h-10 w-10 rounded-lg bg-green-50 flex items-center justify-center"><PieChart className="h-5 w-5 text-green-600" /></div><div><h1 className="page-title">{t.acc.incomeStatement}</h1><p className="text-sm text-muted-foreground">{period.startDate.toLocaleDateString(locale === "ar" ? "ar-SA" : "en-US")} — {period.endDate.toLocaleDateString(locale === "ar" ? "ar-SA" : "en-US")}</p></div></div><Button variant="outline"><Download className="h-4 w-4 me-2" />{t.export}</Button></div>
    {isLoading ? <div className="flex items-center justify-center h-40"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div> : report ? <div className="space-y-4">{renderSection(t.acc.revenue, report.revenue, report.totalRevenue, "revenue")}{renderSection(t.acc.expense, report.expenses, report.totalExpenses, "expense")}<Card className={report.netIncome >= 0 ? "border-green-200" : "border-red-200"}><CardContent className="p-4"><div className="flex items-center justify-between"><span className="text-lg font-bold">{t.acc.netIncome}</span><span className={`text-2xl font-bold tabular-nums ${report.netIncome >= 0 ? "text-green-600" : "text-red-600"}`}>{fmt(report.netIncome)}</span></div></CardContent></Card></div> : null}
  </div>;
}
