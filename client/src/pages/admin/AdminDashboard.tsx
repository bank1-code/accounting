import { useI18n } from "@/lib/i18n";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Activity, BellRing, BookOpenCheck, Building2, FileText, Loader2, Monitor, Package, ShoppingBag, Users } from "lucide-react";
import { useLocation } from "wouter";

const actionVariant = (action: string) => action === "delete" ? "destructive" : action === "create" ? "default" : "secondary";

export default function AdminDashboard() {
  const { t, locale } = useI18n();
  const [, setLocation] = useLocation();
  const { data, isLoading, error } = trpc.dashboard.adminOverview.useQuery();
  const formatNumber = (value: number | string | undefined) => new Intl.NumberFormat(locale === "ar" ? "ar-SA" : "en-US").format(Number(value || 0));
  const formatMoney = (value: number | string | undefined) => new Intl.NumberFormat(locale === "ar" ? "ar-SA" : "en-US", { style: "currency", currency: "SAR", maximumFractionDigits: 2 }).format(Number(value || 0));
  const activityDate = (value: Date | string) => new Date(value).toLocaleString(locale === "ar" ? "ar-SA" : "en-US", { dateStyle: "medium", timeStyle: "short" });

  const commercialCards = [
    { key: "sales", label: t.dash.todaySales, value: formatMoney(data?.stats.todaySales), description: t.dash.todaySalesHint, icon: ShoppingBag, tint: "text-emerald-700 bg-emerald-50" },
    { key: "orders", label: t.dash.totalOrders, value: formatNumber(data?.stats.totalOrders), description: t.dash.systemOverview, icon: Package, tint: "text-blue-700 bg-blue-50" },
    { key: "branches", label: t.dash.activeBranches, value: formatNumber(data?.stats.totalBranches), description: t.dash.systemOverview, icon: Building2, tint: "text-violet-700 bg-violet-50" },
    { key: "products", label: t.nav.products, value: formatNumber(data?.stats.totalProducts), description: t.dash.systemOverview, icon: Package, tint: "text-amber-700 bg-amber-50" },
  ];
  const systemCards = [
    { key: "users", label: t.dash.systemUsers, value: formatNumber(data?.system.totalUsers), icon: Users, tint: "text-sky-700 bg-sky-50" },
    { key: "sessions", label: t.dash.openPosSessions, value: formatNumber(data?.system.openPosSessions), icon: Monitor, tint: "text-orange-700 bg-orange-50" },
    { key: "alerts", label: t.dash.unreadNotifications, value: formatNumber(data?.system.unreadNotifications), icon: BellRing, tint: "text-rose-700 bg-rose-50" },
    { key: "drafts", label: t.dash.draftJournalEntries, value: formatNumber(data?.system.draftJournalEntries), icon: BookOpenCheck, tint: "text-slate-700 bg-slate-100" },
  ];

  if (isLoading) return <div className="flex h-64 items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div>;
  if (error) return <Card><CardContent className="p-6 text-sm text-destructive">{error.message}</CardContent></Card>;

  return <div className="space-y-6 pb-8">
    <div className="rounded-2xl border bg-gradient-to-br from-primary/10 via-background to-emerald-50 p-6 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><div className="mb-2 flex items-center gap-2 text-primary"><Activity className="h-5 w-5" /><span className="text-sm font-semibold">{t.nav.admin}</span></div><h1 className="text-2xl font-bold tracking-tight">{t.dash.adminTitle}</h1><p className="mt-2 max-w-2xl text-sm text-muted-foreground">{t.dash.adminDescription}</p></div><Button variant="outline" onClick={() => setLocation("/admin/audit-log")}><FileText className="me-2 h-4 w-4" />{t.dash.viewAuditLog}</Button></div>
    </div>

    <section className="space-y-3"><h2 className="text-base font-semibold">{t.dash.systemOverview}</h2><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{commercialCards.map((card) => <Card key={card.key} className="border shadow-sm"><CardContent className="p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-sm text-muted-foreground">{card.label}</p><p className="mt-2 text-2xl font-bold tabular-nums">{card.value}</p><p className="mt-1 text-xs text-muted-foreground">{card.description}</p></div><div className={`rounded-xl p-2.5 ${card.tint}`}><card.icon className="h-5 w-5" /></div></div></CardContent></Card>)}</div></section>

    <section className="space-y-3"><h2 className="text-base font-semibold">{t.nav.admin}</h2><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{systemCards.map((card) => <Card key={card.key} className="border shadow-sm"><CardContent className="flex items-center justify-between gap-3 p-4"><div><p className="text-sm text-muted-foreground">{card.label}</p><p className="mt-2 text-2xl font-bold tabular-nums">{card.value}</p></div><div className={`rounded-xl p-2.5 ${card.tint}`}><card.icon className="h-5 w-5" /></div></CardContent></Card>)}</div></section>

    <Card><CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0"><div><CardTitle className="flex items-center gap-2 text-lg"><Activity className="h-5 w-5 text-primary" />{t.dash.recentActivity}</CardTitle><CardDescription>{t.nav.auditLog}</CardDescription></div><Badge variant="outline">{formatNumber(data?.recentActivity.length)}</Badge></CardHeader><CardContent className="space-y-2">{data?.recentActivity.length ? data.recentActivity.map((entry) => <div key={entry.id} className="flex flex-col gap-2 rounded-xl border bg-muted/20 p-3 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><Badge variant={actionVariant(entry.action)}>{entry.action}</Badge><span className="font-medium">{entry.entityType}{entry.entityId ? ` #${entry.entityId}` : ""}</span></div><p className="mt-1 text-xs text-muted-foreground">{entry.userId ? `#${entry.userId}` : "—"}</p></div><time className="shrink-0 text-xs text-muted-foreground">{activityDate(entry.createdAt)}</time></div>) : <div className="py-10 text-center text-sm text-muted-foreground">{t.dash.activityEmpty}</div>}</CardContent></Card>
  </div>;
}
