import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useIsMobile } from "@/hooks/useMobile";
import { useI18n } from "@/lib/i18n";
import { trpc } from "@/lib/trpc";
import {
  LayoutDashboard,
  LogOut,
  PanelLeft,
  Calculator,
  ChevronDown,
  Package,
  Factory,
  ShoppingCart,
  Monitor,
  BarChart3,
  Users,
  Settings,
  Globe,
  BookOpen,
  Layers,
  Target,
  FileText,
  TrendingUp,
  ClipboardList,
  Warehouse,
  ArrowLeftRight,
  ClipboardCheck,
  Tag,
  Ruler,
  ChefHat,
  Truck,
  Receipt,
  UtensilsCrossed,
  Table2,
  Bell,
  Clock,
  CalendarDays,
  DollarSign,
  Building2,
  Shield,
  FileArchive,
  Cog,
  BrainCircuit,
  PieChart,
  ReceiptText,
} from "lucide-react";
import React, { CSSProperties, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from "./DashboardLayoutSkeleton";
import { PWAInstallButton } from "./PWAInstallButton";
import { Button } from "./ui/button";

const SIDEBAR_WIDTH_KEY = "sidebar-width";
const DEFAULT_WIDTH = 260;
const MIN_WIDTH = 200;
const MAX_WIDTH = 400;

type MenuItem = {
  icon: React.ElementType;
  labelKey: string;
  path: string;
  requiredAny?: string[];
};

type MenuGroup = {
  titleKey: string;
  icon: React.ElementType;
  items: MenuItem[];
};

const menuGroups: MenuGroup[] = [
  {
    titleKey: "accounting",
    icon: Calculator,
    items: [
      { icon: BookOpen, labelKey: "chartOfAccounts", path: "/accounting/chart-of-accounts", requiredAny: ["accounting.coa.view", "accounting.coa.manage"] },
      { icon: FileText, labelKey: "journalEntries", path: "/accounting/journal-entries", requiredAny: ["accounting.journal.create", "accounting.journal.post", "accounting.journal.reverse"] },
      { icon: Target, labelKey: "costCenters", path: "/accounting/cost-centers", requiredAny: ["accounting.coa.manage", "accounting.reports.view"] },
      { icon: TrendingUp, labelKey: "trialBalance", path: "/accounting/trial-balance", requiredAny: ["accounting.reports.view"] },
      { icon: PieChart, labelKey: "incomeStatement", path: "/accounting/income-statement", requiredAny: ["accounting.reports.view"] },
      { icon: Layers, labelKey: "balanceSheet", path: "/accounting/balance-sheet", requiredAny: ["accounting.reports.view"] },
      { icon: ClipboardList, labelKey: "costAllocation", path: "/accounting/cost-allocation", requiredAny: ["accounting.coa.manage", "accounting.reports.view"] },
      { icon: CalendarDays, labelKey: "fiscalPeriods", path: "/accounting/fiscal-periods", requiredAny: ["accounting.period.close", "accounting.period.reopen"] },
      { icon: ReceiptText, labelKey: "treasuryVouchers", path: "/accounting/treasury-vouchers", requiredAny: ["treasury.receipt.create", "treasury.payment.create", "treasury.voucher.approve", "treasury.voucher.post"] },
    ],
  },
  {
    titleKey: "inventory",
    icon: Package,
    items: [
      { icon: Package, labelKey: "products", path: "/inventory/products", requiredAny: ["inventory.catalog.manage"] },
      { icon: Warehouse, labelKey: "warehouses", path: "/inventory/warehouses", requiredAny: ["inventory.catalog.manage"] },
      { icon: ArrowLeftRight, labelKey: "stockMovements", path: "/inventory/stock-movements", requiredAny: ["inventory.view"] },
      { icon: ArrowLeftRight, labelKey: "transfers", path: "/inventory/transfers", requiredAny: ["inventory.transfer.create", "inventory.transfer.approve"] },
      { icon: ClipboardCheck, labelKey: "inventoryCount", path: "/inventory/count", requiredAny: ["inventory.count.create", "inventory.count.approve"] },
      { icon: ClipboardList, labelKey: "wasteVouchers", path: "/inventory/waste-vouchers", requiredAny: ["inventory.waste.create", "inventory.waste.approve"] },
      { icon: Tag, labelKey: "categories", path: "/inventory/categories", requiredAny: ["inventory.catalog.manage"] },
      { icon: Ruler, labelKey: "units", path: "/inventory/units", requiredAny: ["inventory.catalog.manage"] },
    ],
  },
  {
    titleKey: "manufacturing",
    icon: Factory,
    items: [
      { icon: ChefHat, labelKey: "recipes", path: "/manufacturing/recipes", requiredAny: ["production.recipe.manage"] },
      { icon: Factory, labelKey: "productionOrders", path: "/manufacturing/production-orders", requiredAny: ["production.order.create", "production.order.approve", "production.order.complete"] },
    ],
  },
  {
    titleKey: "purchasing",
    icon: ShoppingCart,
    items: [
      { icon: Truck, labelKey: "suppliers", path: "/purchasing/suppliers", requiredAny: ["purchasing.suppliers.manage"] },
      { icon: Receipt, labelKey: "purchaseOrders", path: "/purchasing/purchase-orders", requiredAny: ["purchasing.request.create", "purchasing.order.create", "purchasing.order.approve", "purchasing.invoice.items_approve", "purchasing.invoice.accounts_approve"] },
      { icon: Receipt, labelKey: "purchaseInvoices", path: "/purchasing/purchase-invoices", requiredAny: ["purchasing.order.create", "purchasing.invoice.items_approve", "purchasing.invoice.accounts_approve"] },
    ],
  },
  {
    titleKey: "pos",
    icon: Monitor,
    items: [
      { icon: Monitor, labelKey: "posTerminal", path: "/pos/terminal", requiredAny: ["pos.order.create"] },
      { icon: ClipboardList, labelKey: "orders", path: "/pos/orders", requiredAny: ["pos.order.create", "pos.order.cancel", "pos.order.refund"] },
      { icon: Table2, labelKey: "tables", path: "/pos/tables", requiredAny: ["pos.tables.manage"] },
      { icon: UtensilsCrossed, labelKey: "kitchen", path: "/pos/kitchen", requiredAny: ["pos.kitchen.manage"] },
      { icon: Clock, labelKey: "posSessions", path: "/pos/sessions", requiredAny: ["pos.session.open", "pos.session.close"] },
    ],
  },
  {
    titleKey: "reports",
    icon: BarChart3,
    items: [
      { icon: BarChart3, labelKey: "salesReports", path: "/reports/sales", requiredAny: ["accounting.reports.view"] },
      { icon: TrendingUp, labelKey: "profitability", path: "/reports/profitability", requiredAny: ["accounting.reports.view"] },
      { icon: Factory, labelKey: "productionReports", path: "/reports/production", requiredAny: ["production.order.approve", "production.order.complete"] },
      { icon: Package, labelKey: "inventoryReports", path: "/reports/inventory", requiredAny: ["inventory.view"] },
      { icon: BrainCircuit, labelKey: "aiAnalysis", path: "/reports/ai-analysis", requiredAny: ["accounting.reports.view"] },
    ],
  },
  {
    titleKey: "hr",
    icon: Users,
    items: [],
  },
  {
    titleKey: "admin",
    icon: Settings,
    items: [
      { icon: LayoutDashboard, labelKey: "dashboard", path: "/admin/overview", requiredAny: ["admin.audit.view", "admin.settings.view"] },
      { icon: Building2, labelKey: "branches", path: "/admin/branches", requiredAny: ["admin.settings.manage"] },
      { icon: Users, labelKey: "users", path: "/admin/users", requiredAny: ["admin.roles.manage"] },
      { icon: Shield, labelKey: "auditLog", path: "/admin/audit-log", requiredAny: ["admin.audit.view"] },
      { icon: FileArchive, labelKey: "documents", path: "/admin/documents", requiredAny: ["admin.settings.view", "admin.settings.manage", "admin.documents.manage"] },
      { icon: Bell, labelKey: "notifications", path: "/admin/notifications", requiredAny: ["admin.settings.view", "admin.settings.manage"] },
      { icon: FileArchive, labelKey: "backups", path: "/admin/backups", requiredAny: ["admin.backups.manage"] },
      { icon: Shield, labelKey: "saudiCompliance", path: "/admin/saudi-compliance", requiredAny: ["compliance.zatca.view", "compliance.zatca.manage", "compliance.vat.manage"] },
      { icon: Cog, labelKey: "systemSettings", path: "/admin/settings", requiredAny: ["admin.settings.manage"] },
    ],
  },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    return saved ? parseInt(saved, 10) : DEFAULT_WIDTH;
  });
  const { loading, user } = useAuth({ redirectOnUnauthenticated: true });
  const { t } = useI18n();

  useEffect(() => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, sidebarWidth.toString());
  }, [sidebarWidth]);

  if (loading) {
    return <DashboardLayoutSkeleton />;
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-8 p-8 max-w-md w-full">
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-xl bg-primary/10 flex items-center justify-center">
              <Calculator className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-center">
              {t.appName}
            </h1>
            <p className="text-sm text-muted-foreground text-center max-w-sm">
              {t.signInDesc}
            </p>
          </div>
          <Button
            onClick={() => {
              window.location.href = "/login";
            }}
            size="lg"
            className="w-full shadow-lg hover:shadow-xl transition-all"
          >
            {t.signIn}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": `${sidebarWidth}px`,
        } as CSSProperties
      }
    >
      <DashboardLayoutContent setSidebarWidth={setSidebarWidth}>
        {children}
      </DashboardLayoutContent>
    </SidebarProvider>
  );
}

type DashboardLayoutContentProps = {
  children: React.ReactNode;
  setSidebarWidth: (width: number) => void;
};

function DashboardLayoutContent({
  children,
  setSidebarWidth,
}: DashboardLayoutContentProps) {
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === "collapsed";
  const [isResizing, setIsResizing] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    // Auto-open the group that contains the current path
    const initial: Record<string, boolean> = {};
    menuGroups.forEach((group) => {
      if (group.items.some((item) => location.startsWith(item.path))) {
        initial[group.titleKey] = true;
      }
    });
    return initial;
  });
  const sidebarRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();
  const { t, locale, setLocale, dir } = useI18n();
  const { data: permissionCodes = [] } = trpc.accessControl.myPermissions.useQuery(undefined, { enabled: Boolean(user) });
  const canAccessItem = (group: MenuGroup, item: MenuItem) => {
    return item.requiredAny?.some((code) => permissionCodes.includes(code)) ?? false;
  };
  const visibleMenuGroups = menuGroups
    .map((group) => ({ ...group, items: group.items.filter((item) => canAccessItem(group, item)) }))
    .filter((group) => group.items.length > 0);

  const toggleGroup = (key: string) => {
    setOpenGroups((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  useEffect(() => {
    if (isCollapsed) {
      setIsResizing(false);
    }
  }, [isCollapsed]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const sidebarEl = sidebarRef.current;
      if (!sidebarEl) return;
      const rect = sidebarEl.getBoundingClientRect();
      const newWidth = dir === "rtl" ? rect.right - e.clientX : e.clientX - rect.left;
      if (newWidth >= MIN_WIDTH && newWidth <= MAX_WIDTH) {
        setSidebarWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, setSidebarWidth, dir]);

  const getNavLabel = (key: string): string => {
    return (t.nav as Record<string, string>)[key] || key;
  };

  return (
    <>
      <div className="relative" ref={sidebarRef}>
        <Sidebar
          collapsible="icon"
          className="border-r-0"
          side={dir === "rtl" ? "right" : "left"}
          disableTransition={isResizing}
        >
          <SidebarHeader className="h-14 justify-center border-b border-sidebar-border">
            <div className="flex items-center gap-3 px-2 transition-all w-full">
              <button
                onClick={toggleSidebar}
                className="h-8 w-8 flex items-center justify-center hover:bg-accent rounded-lg transition-colors focus:outline-none shrink-0"
                aria-label="Toggle navigation"
              >
                <PanelLeft className="h-4 w-4 text-muted-foreground" />
              </button>
              {!isCollapsed && (
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-bold text-primary tracking-tight truncate">
                    {t.appName}
                  </span>
                </div>
              )}
            </div>
          </SidebarHeader>

          <SidebarContent className="gap-0 overflow-y-auto">
            {/* Dashboard link */}
            <SidebarMenu className="px-2 py-1">
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={location === "/"}
                  onClick={() => setLocation("/")}
                  tooltip={t.nav.dashboard}
                  className="h-9 font-medium"
                >
                  <LayoutDashboard className={`h-4 w-4 ${location === "/" ? "text-primary" : ""}`} />
                  <span>{t.nav.dashboard}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>

            {/* Grouped menu items */}
            {visibleMenuGroups.map((group) => {
              const isOpen = openGroups[group.titleKey] ?? false;
              const hasActiveChild = group.items.some((item) =>
                location.startsWith(item.path)
              );
              return (
                <Collapsible
                  key={group.titleKey}
                  open={isOpen || isCollapsed}
                  onOpenChange={() => toggleGroup(group.titleKey)}
                >
                  <SidebarMenu className="px-2">
                    <SidebarMenuItem>
                      <CollapsibleTrigger asChild>
                        <SidebarMenuButton
                          tooltip={getNavLabel(group.titleKey)}
                          className={`h-9 font-medium ${hasActiveChild ? "text-primary" : ""}`}
                        >
                          <group.icon className={`h-4 w-4 ${hasActiveChild ? "text-primary" : ""}`} />
                          <span className="flex-1">{getNavLabel(group.titleKey)}</span>
                          {!isCollapsed && (
                            <ChevronDown
                              className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${
                                isOpen ? "rotate-180" : ""
                              }`}
                            />
                          )}
                        </SidebarMenuButton>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <SidebarMenu className={isCollapsed ? "" : "ps-4 border-s border-border ms-3"}>
                          {group.items.map((item) => {
                            const isActive = location === item.path;
                            return (
                              <SidebarMenuItem key={item.path}>
                                <SidebarMenuButton
                                  isActive={isActive}
                                  onClick={() => setLocation(item.path)}
                                  tooltip={getNavLabel(item.labelKey)}
                                  className="h-8 text-[13px]"
                                >
                                  <item.icon className={`h-3.5 w-3.5 ${isActive ? "text-primary" : ""}`} />
                                  <span>{getNavLabel(item.labelKey)}</span>
                                </SidebarMenuButton>
                              </SidebarMenuItem>
                            );
                          })}
                        </SidebarMenu>
                      </CollapsibleContent>
                    </SidebarMenuItem>
                  </SidebarMenu>
                </Collapsible>
              );
            })}
          </SidebarContent>

          <SidebarFooter className="p-2 border-t border-sidebar-border">
            <div className="flex justify-end px-1 pb-1 group-data-[collapsible=icon]:justify-center">
              <PWAInstallButton />
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-accent/50 transition-colors w-full text-start group-data-[collapsible=icon]:justify-center focus:outline-none">
                  <Avatar className="h-8 w-8 border shrink-0">
                    <AvatarFallback className="text-xs font-medium bg-primary/10 text-primary">
                      {user?.name?.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0 group-data-[collapsible=icon]:hidden">
                    <p className="text-sm font-medium truncate leading-none">
                      {user?.name || "-"}
                    </p>
                    <p className="text-xs text-muted-foreground truncate mt-1">
                      {user?.email || "-"}
                    </p>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem
                  onClick={() => setLocale(locale === "ar" ? "en" : "ar")}
                  className="cursor-pointer"
                >
                  <Globe className="me-2 h-4 w-4" />
                  <span>{locale === "ar" ? "English" : "العربية"}</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={logout}
                  className="cursor-pointer text-destructive focus:text-destructive"
                >
                  <LogOut className="me-2 h-4 w-4" />
                  <span>{t.signOut}</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarFooter>
        </Sidebar>
        {!isCollapsed && (
          <div
            className={`absolute top-0 ${dir === "rtl" ? "left-0" : "right-0"} w-1 h-full cursor-col-resize hover:bg-primary/20 transition-colors`}
            onMouseDown={() => {
              if (isCollapsed) return;
              setIsResizing(true);
            }}
            style={{ zIndex: 50 }}
          />
        )}
      </div>

      <SidebarInset>
        {isMobile && (
          <div className="flex border-b h-12 items-center justify-between bg-background/95 px-3 backdrop-blur sticky top-0 z-40">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="h-8 w-8 rounded-lg" />
              <span className="font-bold text-primary text-sm">{t.appName}</span>
            </div>
            <div className="flex items-center gap-2">
              <PWAInstallButton />
              <button
                onClick={() => setLocale(locale === "ar" ? "en" : "ar")}
                className="h-8 w-8 flex items-center justify-center hover:bg-accent rounded-lg transition-colors focus:outline-none"
                title={locale === "ar" ? "English" : "العربية"}
              >
                <Globe className="h-4 w-4" />
              </button>
              <button
                onClick={logout}
                className="h-8 w-8 flex items-center justify-center hover:bg-destructive/10 rounded-lg transition-colors focus:outline-none"
                title={t.signOut}
              >
                <LogOut className="h-4 w-4 text-destructive" />
              </button>
            </div>
          </div>
        )}
        <main className="flex-1 p-4 lg:p-6">{children}</main>
      </SidebarInset>
    </>
  );
}
