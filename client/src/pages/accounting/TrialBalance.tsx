import { useI18n } from "@/lib/i18n";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TrendingUp, Loader2, Download } from "lucide-react";

export default function TrialBalance() {
  const { t, locale } = useI18n();
  const { data: accounts, isLoading } = trpc.trialBalance.get.useQuery();

  const fmt = (v: unknown) => parseFloat(String(v || 0)).toLocaleString(locale === "ar" ? "ar-SA" : "en-US", { minimumFractionDigits: 2 });

  const debitAccounts = accounts?.filter((a) => {
    const bal = parseFloat(String(a.balance || 0));
    return (a.type === "asset" || a.type === "expense") ? bal > 0 : bal < 0;
  }) || [];

  const creditAccounts = accounts?.filter((a) => {
    const bal = parseFloat(String(a.balance || 0));
    return (a.type === "liability" || a.type === "equity" || a.type === "revenue") ? bal > 0 : (a.type === "asset" || a.type === "expense") ? bal < 0 : false;
  }).filter((a) => !debitAccounts.includes(a)) || [];

  const allWithBalance = accounts?.filter((a) => parseFloat(String(a.balance || 0)) !== 0) || [];

  const totalDebit = allWithBalance.reduce((sum, a) => {
    const bal = parseFloat(String(a.balance || 0));
    if ((a.type === "asset" || a.type === "expense") && bal > 0) return sum + bal;
    if ((a.type === "liability" || a.type === "equity" || a.type === "revenue") && bal < 0) return sum + Math.abs(bal);
    return sum;
  }, 0);

  const totalCredit = allWithBalance.reduce((sum, a) => {
    const bal = parseFloat(String(a.balance || 0));
    if ((a.type === "liability" || a.type === "equity" || a.type === "revenue") && bal > 0) return sum + bal;
    if ((a.type === "asset" || a.type === "expense") && bal < 0) return sum + Math.abs(bal);
    return sum;
  }, 0);

  const typeLabel = (type: string) => {
    const map: Record<string, string> = { asset: t.acc.asset, liability: t.acc.liability, equity: t.acc.equity, revenue: t.acc.revenue, expense: t.acc.expense };
    return map[type] || type;
  };

  return (
    <div className="space-y-4">
      <div className="page-header">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-emerald-50 flex items-center justify-center">
            <TrendingUp className="h-5 w-5 text-emerald-600" />
          </div>
          <div>
            <h1 className="page-title">{t.acc.trialBalance}</h1>
            <p className="text-sm text-muted-foreground">{new Date().toLocaleDateString(locale === "ar" ? "ar-SA" : "en-US")}</p>
          </div>
        </div>
        <Button variant="outline"><Download className="h-4 w-4 me-2" />{t.export}</Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center h-40"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr className="bg-muted/30">
                    <th className="px-4 py-3 text-start">{t.acc.accountCode}</th>
                    <th className="px-4 py-3 text-start">{t.acc.accountName}</th>
                    <th className="px-4 py-3 text-start">{t.acc.accountType}</th>
                    <th className="px-4 py-3 text-end">{t.acc.debit}</th>
                    <th className="px-4 py-3 text-end">{t.acc.credit}</th>
                  </tr>
                </thead>
                <tbody>
                  {allWithBalance.map((a) => {
                    const bal = parseFloat(String(a.balance || 0));
                    let debit = 0, credit = 0;
                    if ((a.type === "asset" || a.type === "expense") && bal > 0) debit = bal;
                    else if ((a.type === "asset" || a.type === "expense") && bal < 0) credit = Math.abs(bal);
                    else if (bal > 0) credit = bal;
                    else debit = Math.abs(bal);
                    return (
                      <tr key={a.id} className="hover:bg-muted/50">
                        <td className="px-4 py-2.5 border-t font-mono text-sm">{a.code}</td>
                        <td className="px-4 py-2.5 border-t font-medium">{locale === "ar" ? a.name : (a.nameEn || a.name)}</td>
                        <td className="px-4 py-2.5 border-t"><Badge variant="secondary" className="text-xs">{typeLabel(a.type)}</Badge></td>
                        <td className="px-4 py-2.5 border-t text-end tabular-nums">{debit > 0 ? fmt(debit) : "-"}</td>
                        <td className="px-4 py-2.5 border-t text-end tabular-nums">{credit > 0 ? fmt(credit) : "-"}</td>
                      </tr>
                    );
                  })}
                  {(!allWithBalance.length) && (
                    <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">{t.noData}</td></tr>
                  )}
                </tbody>
                <tfoot>
                  <tr className="bg-muted/30 font-bold">
                    <td colSpan={3} className="px-4 py-3">{t.total}</td>
                    <td className="px-4 py-3 text-end tabular-nums">{fmt(totalDebit)}</td>
                    <td className="px-4 py-3 text-end tabular-nums">{fmt(totalCredit)}</td>
                  </tr>
                  <tr>
                    <td colSpan={5} className="px-4 py-2 text-center">
                      <Badge className={Math.abs(totalDebit - totalCredit) < 0.01 ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}>
                        {Math.abs(totalDebit - totalCredit) < 0.01 ? t.acc.balanced : `${t.acc.difference}: ${fmt(Math.abs(totalDebit - totalCredit))}`}
                      </Badge>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
