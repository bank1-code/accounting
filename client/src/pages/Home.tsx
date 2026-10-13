import { useI18n } from "@/lib/i18n";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import {
  BookOpen, FileText, Target, ArrowLeftRight,
  Factory, Monitor, TrendingUp, Building2,
  Calculator, Package, BarChart3, Loader2,
} from "lucide-react";

export default function Home() {
  const { t } = useI18n();
  const [, setLocation] = useLocation();
  const { data: stats, isLoading } = trpc.dashboard.stats.useQuery();

  const statCards = [
    { label: t.acc.chartOfAccounts, value: stats?.totalAccounts ?? 0, icon: BookOpen, color: "text-blue-600", bg: "bg-blue-50" },
    { label: t.dash.activeBranches, value: stats?.totalBranches ?? 0, icon: Building2, color: "text-emerald-600", bg: "bg-emerald-50" },
    { label: t.acc.costCenter, value: stats?.totalCostCenters ?? 0, icon: Target, color: "text-purple-600", bg: "bg-purple-50" },
    { label: t.acc.journalEntry, value: stats?.totalEntries ?? 0, icon: FileText, color: "text-orange-600", bg: "bg-orange-50" },
  ];

  const quickActions = [
    { label: t.dash.newJournalEntry, icon: FileText, path: "/accounting/journal-entries", color: "text-blue-600" },
    { label: t.dash.newOrder, icon: Monitor, path: "/pos/terminal", color: "text-emerald-600" },
    { label: t.dash.newProduction, icon: Factory, path: "/manufacturing/production-orders", color: "text-purple-600" },
    { label: t.dash.newTransfer, icon: ArrowLeftRight, path: "/inventory/transfers", color: "text-orange-600" },
    { label: t.dash.newPurchase, icon: Package, path: "/purchasing/purchase-orders", color: "text-red-600" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t.dash.welcome}</h1>
        <p className="text-muted-foreground mt-1">{t.appDesc}</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat) => (
          <Card key={stat.label} className="border shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                  <p className="text-2xl font-bold mt-1">
                    {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : stat.value}
                  </p>
                </div>
                <div className={`h-10 w-10 rounded-lg ${stat.bg} flex items-center justify-center`}>
                  <stat.icon className={`h-5 w-5 ${stat.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">{t.dash.quickActions}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {quickActions.map((action) => (
              <Button
                key={action.label}
                variant="outline"
                className="h-auto py-4 flex-col gap-2 hover:border-primary/50 hover:bg-accent"
                onClick={() => setLocation(action.path)}
              >
                <action.icon className={`h-5 w-5 ${action.color}`} />
                <span className="text-xs font-medium text-center leading-tight">{action.label}</span>
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Module Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[
          { title: t.nav.accounting, desc: t.acc.chartOfAccounts + " - " + t.acc.journalEntry + " - " + t.acc.trialBalance, icon: Calculator, path: "/accounting/chart-of-accounts", color: "text-blue-600", bg: "bg-blue-50" },
          { title: t.nav.inventory, desc: t.nav.products + " - " + t.nav.warehouses + " - " + t.nav.transfers, icon: Package, path: "/inventory/products", color: "text-emerald-600", bg: "bg-emerald-50" },
          { title: t.nav.manufacturing, desc: t.nav.recipes + " - " + t.nav.productionOrders, icon: Factory, path: "/manufacturing/recipes", color: "text-purple-600", bg: "bg-purple-50" },
          { title: t.nav.pos, desc: t.nav.posTerminal + " - " + t.nav.orders + " - " + t.nav.tables, icon: Monitor, path: "/pos/terminal", color: "text-orange-600", bg: "bg-orange-50" },
          { title: t.nav.reports, desc: t.nav.salesReports + " - " + t.nav.profitability + " - " + t.nav.aiAnalysis, icon: BarChart3, path: "/reports/sales", color: "text-red-600", bg: "bg-red-50" },
          { title: t.nav.admin, desc: t.nav.branches + " - " + t.nav.auditLog + " - " + t.nav.systemSettings, icon: Building2, path: "/admin/branches", color: "text-slate-600", bg: "bg-slate-50" },
        ].map((module) => (
          <Card
            key={module.title}
            className="cursor-pointer border shadow-sm hover:shadow-md transition-shadow"
            onClick={() => setLocation(module.path)}
          >
            <CardContent className="p-5">
              <div className="flex items-start gap-4">
                <div className={`h-10 w-10 rounded-lg ${module.bg} flex items-center justify-center shrink-0`}>
                  <module.icon className={`h-5 w-5 ${module.color}`} />
                </div>
                <div className="min-w-0">
                  <h3 className="font-semibold">{module.title}</h3>
                  <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{module.desc}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
