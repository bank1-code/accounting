import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch, useLocation } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { I18nProvider } from "./contexts/I18nContext";
import DashboardLayout from "./components/DashboardLayout";
import { lazy, Suspense, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { useAuth } from "./_core/hooks/useAuth";
import { PermissionAccessGate } from "./components/PermissionAccessGate";
import { trpc } from "@/lib/trpc";

// Lazy load pages for performance
const Home = lazy(() => import("./pages/Home"));
const Login = lazy(() => import("./pages/Login"));
// Accounting
const ChartOfAccounts = lazy(() => import("./pages/accounting/ChartOfAccounts"));
const JournalEntries = lazy(() => import("./pages/accounting/JournalEntries"));
const CostCenters = lazy(() => import("./pages/accounting/CostCenters"));
const TrialBalance = lazy(() => import("./pages/accounting/TrialBalance"));
const IncomeStatement = lazy(() => import("./pages/accounting/IncomeStatement"));
const BalanceSheet = lazy(() => import("./pages/accounting/BalanceSheet"));
const CostAllocation = lazy(() => import("./pages/accounting/CostAllocation"));
const FiscalPeriods = lazy(() => import("./pages/accounting/FiscalPeriods"));
const TreasuryVouchers = lazy(() => import("./pages/accounting/TreasuryVouchers"));
// Inventory
const Products = lazy(() => import("./pages/inventory/Products"));
const Warehouses = lazy(() => import("./pages/inventory/Warehouses"));
const StockMovements = lazy(() => import("./pages/inventory/StockMovements"));
const Transfers = lazy(() => import("./pages/inventory/Transfers"));
const InventoryCount = lazy(() => import("./pages/inventory/InventoryCount"));
const WasteVouchers = lazy(() => import("./pages/inventory/WasteVouchers"));
const Categories = lazy(() => import("./pages/inventory/Categories"));
// Manufacturing
const Recipes = lazy(() => import("./pages/manufacturing/Recipes"));
const ProductionOrders = lazy(() => import("./pages/manufacturing/ProductionOrders"));
// POS
const PosTerminal = lazy(() => import("./pages/pos/PosTerminal"));
const Orders = lazy(() => import("./pages/pos/Orders"));
const Tables = lazy(() => import("./pages/pos/Tables"));
const Kitchen = lazy(() => import("./pages/pos/Kitchen"));
const PosSessions = lazy(() => import("./pages/pos/PosSessions"));
// Purchasing
const Suppliers = lazy(() => import("./pages/purchasing/Suppliers"));
const PurchaseOrders = lazy(() => import("./pages/purchasing/PurchaseOrders"));
const PurchaseInvoices = lazy(() => import("./pages/purchasing/PurchaseInvoices"));
// Reports
const SalesReports = lazy(() => import("./pages/reports/SalesReports"));
const Profitability = lazy(() => import("./pages/reports/Profitability"));
const ProductionReports = lazy(() => import("./pages/reports/ProductionReports"));
const InventoryReports = lazy(() => import("./pages/reports/InventoryReports"));
const AiAnalysis = lazy(() => import("./pages/reports/AiAnalysis"));

// Admin
const Branches = lazy(() => import("./pages/admin/Branches"));
const Users = lazy(() => import("./pages/admin/Users"));
const Settings = lazy(() => import("./pages/admin/Settings"));
const Documents = lazy(() => import("./pages/admin/Documents"));
const AuditLog = lazy(() => import("./pages/admin/AuditLog"));
const Notifications = lazy(() => import("./pages/admin/Notifications"));
const SaudiCompliance = lazy(() => import("./pages/admin/SaudiCompliance"));
const Backups = lazy(() => import("./pages/admin/Backups"));
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));

function PageLoader() {
  return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}

function PermissionOnly({ permissions, children }: { permissions: string[]; children: ReactNode }) {
  const { loading, user } = useAuth({ redirectOnUnauthenticated: true });
  const permissionsQuery = trpc.accessControl.myPermissions.useQuery(undefined, { enabled: Boolean(user) });
  if (loading || permissionsQuery.isLoading) return <PageLoader />;
  const allowed = permissions.some((permission) => permissionsQuery.data?.includes(permission));
  return <PermissionAccessGate allowed={allowed}>{children}</PermissionAccessGate>;
}

function Router() {
  const [location] = useLocation();
  if (location === "/login") {
    return <Suspense fallback={<PageLoader />}><Login /></Suspense>;
  }
  return (
    <DashboardLayout>
      <Suspense fallback={<PageLoader />}>
        <Switch>
          <Route path="/" component={Home} />
          {/* Accounting */}
          <Route path="/accounting/chart-of-accounts"><PermissionOnly permissions={["accounting.coa.view", "accounting.coa.manage"]}><ChartOfAccounts /></PermissionOnly></Route>
          <Route path="/accounting/journal-entries"><PermissionOnly permissions={["accounting.journal.create", "accounting.journal.post", "accounting.journal.reverse"]}><JournalEntries /></PermissionOnly></Route>
          <Route path="/accounting/cost-centers"><PermissionOnly permissions={["accounting.coa.manage", "accounting.reports.view"]}><CostCenters /></PermissionOnly></Route>
          <Route path="/accounting/trial-balance"><PermissionOnly permissions={["accounting.reports.view"]}><TrialBalance /></PermissionOnly></Route>
          <Route path="/accounting/income-statement"><PermissionOnly permissions={["accounting.reports.view"]}><IncomeStatement /></PermissionOnly></Route>
          <Route path="/accounting/balance-sheet"><PermissionOnly permissions={["accounting.reports.view"]}><BalanceSheet /></PermissionOnly></Route>
          <Route path="/accounting/cost-allocation"><PermissionOnly permissions={["accounting.coa.manage", "accounting.reports.view"]}><CostAllocation /></PermissionOnly></Route>
          <Route path="/accounting/fiscal-periods"><PermissionOnly permissions={["accounting.period.close", "accounting.period.reopen"]}><FiscalPeriods /></PermissionOnly></Route>
          <Route path="/accounting/treasury-vouchers"><PermissionOnly permissions={["treasury.receipt.create", "treasury.payment.create", "treasury.voucher.approve", "treasury.voucher.post"]}><TreasuryVouchers /></PermissionOnly></Route>
          {/* Inventory */}
          <Route path="/inventory/products"><PermissionOnly permissions={["inventory.catalog.manage"]}><Products /></PermissionOnly></Route>
          <Route path="/inventory/warehouses"><PermissionOnly permissions={["inventory.catalog.manage"]}><Warehouses /></PermissionOnly></Route>
          <Route path="/inventory/stock-movements"><PermissionOnly permissions={["inventory.view"]}><StockMovements /></PermissionOnly></Route>
          <Route path="/inventory/transfers"><PermissionOnly permissions={["inventory.transfer.create", "inventory.transfer.approve"]}><Transfers /></PermissionOnly></Route>
          <Route path="/inventory/count"><PermissionOnly permissions={["inventory.count.create", "inventory.count.approve"]}><InventoryCount /></PermissionOnly></Route>
          <Route path="/inventory/waste-vouchers"><PermissionOnly permissions={["inventory.waste.create", "inventory.waste.approve"]}><WasteVouchers /></PermissionOnly></Route>
          <Route path="/inventory/categories"><PermissionOnly permissions={["inventory.catalog.manage"]}><Categories /></PermissionOnly></Route>
          <Route path="/inventory/units"><PermissionOnly permissions={["inventory.catalog.manage"]}><Categories /></PermissionOnly></Route>
          {/* Manufacturing */}
          <Route path="/manufacturing/recipes"><PermissionOnly permissions={["production.recipe.manage"]}><Recipes /></PermissionOnly></Route>
          <Route path="/manufacturing/production-orders"><PermissionOnly permissions={["production.order.create", "production.order.approve", "production.order.complete"]}><ProductionOrders /></PermissionOnly></Route>
          {/* POS */}
          <Route path="/pos/terminal"><PermissionOnly permissions={["pos.order.create"]}><PosTerminal /></PermissionOnly></Route>
          <Route path="/pos/orders"><PermissionOnly permissions={["pos.order.create", "pos.order.cancel", "pos.order.refund"]}><Orders /></PermissionOnly></Route>
          <Route path="/pos/tables"><PermissionOnly permissions={["pos.tables.manage"]}><Tables /></PermissionOnly></Route>
          <Route path="/pos/kitchen"><PermissionOnly permissions={["pos.kitchen.manage"]}><Kitchen /></PermissionOnly></Route>
          <Route path="/pos/sessions"><PermissionOnly permissions={["pos.session.open", "pos.session.close"]}><PosSessions /></PermissionOnly></Route>
          {/* Purchasing */}
          <Route path="/purchasing/suppliers"><PermissionOnly permissions={["purchasing.suppliers.manage"]}><Suppliers /></PermissionOnly></Route>
          <Route path="/purchasing/purchase-orders"><PermissionOnly permissions={["purchasing.request.create", "purchasing.order.create", "purchasing.order.approve", "purchasing.invoice.items_approve", "purchasing.invoice.accounts_approve"]}><PurchaseOrders /></PermissionOnly></Route>
          <Route path="/purchasing/purchase-invoices"><PermissionOnly permissions={["purchasing.order.create", "purchasing.invoice.items_approve", "purchasing.invoice.accounts_approve"]}><PurchaseInvoices /></PermissionOnly></Route>
          {/* Reports */}
          <Route path="/reports/sales"><PermissionOnly permissions={["accounting.reports.view"]}><SalesReports /></PermissionOnly></Route>
          <Route path="/reports/profitability"><PermissionOnly permissions={["accounting.reports.view"]}><Profitability /></PermissionOnly></Route>
          <Route path="/reports/production"><PermissionOnly permissions={["production.order.approve", "production.order.complete"]}><ProductionReports /></PermissionOnly></Route>
          <Route path="/reports/inventory"><PermissionOnly permissions={["inventory.view"]}><InventoryReports /></PermissionOnly></Route>
          <Route path="/reports/ai-analysis"><PermissionOnly permissions={["accounting.reports.view"]}><AiAnalysis /></PermissionOnly></Route>

          {/* Admin */}
          <Route path="/admin/overview"><PermissionOnly permissions={["admin.audit.view", "admin.settings.view"]}><AdminDashboard /></PermissionOnly></Route>
          <Route path="/admin/branches"><PermissionOnly permissions={["admin.settings.manage"]}><Branches /></PermissionOnly></Route>
          <Route path="/admin/users"><PermissionOnly permissions={["admin.roles.manage"]}><Users /></PermissionOnly></Route>
          <Route path="/admin/settings"><PermissionOnly permissions={["admin.settings.manage"]}><Settings /></PermissionOnly></Route>
          <Route path="/admin/documents"><PermissionOnly permissions={["admin.settings.view", "admin.settings.manage", "admin.documents.manage"]}><Documents /></PermissionOnly></Route>
          <Route path="/admin/audit-log"><PermissionOnly permissions={["admin.audit.view"]}><AuditLog /></PermissionOnly></Route>
          <Route path="/admin/notifications"><PermissionOnly permissions={["admin.settings.view", "admin.settings.manage"]}><Notifications /></PermissionOnly></Route>
          <Route path="/admin/saudi-compliance"><PermissionOnly permissions={["compliance.zatca.view", "compliance.zatca.manage", "compliance.vat.manage"]}><SaudiCompliance /></PermissionOnly></Route>
          <Route path="/admin/backups"><PermissionOnly permissions={["admin.backups.manage"]}><Backups /></PermissionOnly></Route>
          {/* Fallback */}
          <Route path="/404" component={NotFound} />
          <Route component={NotFound} />
        </Switch>
      </Suspense>
    </DashboardLayout>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <I18nProvider>
          <TooltipProvider>
            <Toaster />
            <Router />
          </TooltipProvider>
        </I18nProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
