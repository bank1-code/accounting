import { useI18n } from "@/lib/i18n";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Layers, Loader2, Download } from "lucide-react";
import { useState } from "react";

export default function BalanceSheet() {
  const { t, locale } = useI18n();
  const [period] = useState(() => ({ startDate: new Date(new Date().getFullYear(), 0, 1), endDate: new Date() }));
  const { data, isLoading } = trpc.reports.financialStatements.useQuery(period);
  const fmt = (v: number) => v.toLocaleString(locale === "ar" ? "ar-SA" : "en-US", { minimumFractionDigits: 2 });

  const report = data?.balanceSheet;

  const renderSection = (title: string, items: NonNullable<typeof report>["assets"], total: number, color: string, bgColor: string) => (
    <Card>
      <CardContent className="p-0">
        <div className={`px-4 py-3 ${bgColor} border-b font-semibold ${color}`}>{title}</div>
        <table className="data-table">
          <tbody>
            {items.map((a) => (
              <tr key={a.id} className="hover:bg-muted/50">
                <td className="px-4 py-2.5 border-t font-mono text-sm w-24">{a.code}</td>
                <td className="px-4 py-2.5 border-t">{locale === "ar" ? a.name : (a.nameEn || a.name)}</td>
                <td className="px-4 py-2.5 border-t text-end tabular-nums w-40">{fmt(a.closingBalance)}</td>
              </tr>
            ))}
            {!items.length && <tr><td colSpan={3} className="px-4 py-4 text-center text-muted-foreground">{t.noData}</td></tr>}
          </tbody>
          <tfoot>
            <tr className={`${bgColor} font-bold`}>
              <td colSpan={2} className="px-4 py-3">{title}</td>
              <td className="px-4 py-3 text-end tabular-nums">{fmt(total)}</td>
            </tr>
          </tfoot>
        </table>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-4">
      <div className="page-header">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-indigo-50 flex items-center justify-center">
            <Layers className="h-5 w-5 text-indigo-600" />
          </div>
          <div>
            <h1 className="page-title">{t.acc.balanceSheet}</h1>
            <p className="text-sm text-muted-foreground">{new Date().toLocaleDateString(locale === "ar" ? "ar-SA" : "en-US")}</p>
          </div>
        </div>
        <Button variant="outline"><Download className="h-4 w-4 me-2" />{t.export}</Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-40"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : report ? (
        <div className="space-y-4">
          {renderSection(t.acc.totalAssets, report.assets, report.totalAssets, "text-blue-800", "bg-blue-50")}
          {renderSection(t.acc.totalLiabilities, report.liabilities, report.totalLiabilities, "text-red-800", "bg-red-50")}
          {renderSection(t.acc.totalEquity, report.equity, report.totalEquity, "text-purple-800", "bg-purple-50")}

          {/* Balance Check */}
          <Card className="border-2">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-medium">{t.acc.totalAssets}</span>
                <span className="font-bold tabular-nums">{fmt(report.totalAssets)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-medium">{t.acc.totalLiabilities} + {t.acc.totalEquity} + {t.acc.netIncome}</span>
                <span className="font-bold tabular-nums">{fmt(report.totalLiabilitiesAndEquity)}</span>
              </div>
              <div className="border-t pt-3 flex items-center justify-between">
                <span className="font-bold">{t.acc.difference}</span>
                <Badge className={report.isBalanced ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}>
                  {report.isBalanced ? t.acc.balanced : fmt(report.difference)}
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
