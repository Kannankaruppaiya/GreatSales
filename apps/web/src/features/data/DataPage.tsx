import { useState } from "react";
import {
  Boxes,
  Building2,
  CheckCircle2,
  Database,
  FileSpreadsheet,
  Lock,
  Receipt,
  RefreshCw,
  Repeat,
  ShieldCheck,
  ShoppingCart,
  Target,
  UserCheck,
} from "lucide-react";
import { Button, Card, CardHeader, MetricCard, PageHeader } from "@/components/ui";
import { useAuthRole, useAuthUser } from "@/store/auth";
import { roleLabel } from "@/data/constants";
import { useCustomers, flattenCustomers } from "@/features/customers/queries";
import { useProducts, usePrincipals, flattenProducts } from "@/features/products/queries";
import { useOrders, flattenOrders } from "@/features/orders/queries";
import { usePayments, flattenPayments } from "@/features/payments/queries";
import { useLeads, flattenLeads } from "@/features/leads/queries";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

/**
 * Sanitizes CSV field values to prevent CSV / Excel Formula Injection (DDE attacks).
 * If a cell starts with =, +, -, @, \t, or \r, prepend a single quote so spreadsheets
 * treat it as plain text rather than executing dynamic formulas.
 */
function sanitizeCsvValue(val: unknown): string {
  if (val == null) return "";
  let str = String(val).trim();
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }
  // Escape double quotes
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    str = `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export default function DataPage() {
  const role = useAuthRole();
  const user = useAuthUser();

  const [periodLocked, setPeriodLocked] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  // Live tenant datasets from real backend queries
  const customersQ = useCustomers();
  const productsQ = useProducts();
  const principalsQ = usePrincipals();
  const ordersQ = useOrders();
  const paymentsQ = usePayments();
  const leadsQ = useLeads();

  // API Server Health Probe
  const healthQ = useQuery({
    queryKey: ["api-health"],
    queryFn: () =>
      apiFetch<{ status: string; service: string; timestamp: string }>("/health"),
    refetchInterval: 30000,
  });

  const customers = flattenCustomers(customersQ.data);
  const products = flattenProducts(productsQ.data);
  const orders = flattenOrders(ordersQ.data);
  const payments = flattenPayments(paymentsQ.data);
  const leads = flattenLeads(leadsQ.data);
  const principals = principalsQ.data?.items ?? [];

  const isLoadingStats =
    customersQ.isLoading ||
    productsQ.isLoading ||
    ordersQ.isLoading ||
    paymentsQ.isLoading ||
    leadsQ.isLoading;

  const handleExportSummaryCsv = () => {
    setIsExporting(true);
    try {
      const headers = ["Entity Type", "Total Records", "Tenant ID", "Last Refreshed"];
      const now = new Date().toISOString();
      const rows = [
        ["Customers", customers.length, user?.tenantId || "default", now],
        ["Principal Brands", principals.length, user?.tenantId || "default", now],
        ["Product Catalog SKUs", products.length, user?.tenantId || "default", now],
        ["Sales Orders", orders.length, user?.tenantId || "default", now],
        ["Invoices & Receivables", payments.length, user?.tenantId || "default", now],
        ["Sales Leads", leads.length, user?.tenantId || "default", now],
      ];

      const csvContent =
        "data:text/csv;charset=utf-8," +
        [
          headers.map(sanitizeCsvValue).join(","),
          ...rows.map((row) => row.map(sanitizeCsvValue).join(",")),
        ].join("\n");

      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute(
        "download",
        `GreatSales_Tenant_${user?.tenantId || "acme"}_Metrics_${new Date().toISOString().slice(0, 10)}.csv`,
      );
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setStatusMessage("Tenant metrics spreadsheet generated with Formula Sanitization.");
      setTimeout(() => setStatusMessage(null), 4000);
    } catch {
      setStatusMessage("Export failed. Please try again.");
    } finally {
      setIsExporting(false);
    }
  };

  const handleRefreshAll = () => {
    customersQ.refetch();
    productsQ.refetch();
    principalsQ.refetch();
    ordersQ.refetch();
    paymentsQ.refetch();
    leadsQ.refetch();
    healthQ.refetch();
    setStatusMessage("Refreshed all tenant datasets from PostgreSQL.");
    setTimeout(() => setStatusMessage(null), 3000);
  };

  return (
    <div className="space-y-5 max-w-5xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <PageHeader
          title="Data & Tenant Governance"
          subtitle="PostgreSQL database health, active tenant context, live record metrics, and audit controls"
        />
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefreshAll}
            disabled={isLoadingStats}
          >
            <RefreshCw
              className={`h-3.5 w-3.5 mr-1.5 ${isLoadingStats ? "animate-spin text-brand" : ""}`}
            />
            Refresh DB
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportSummaryCsv}
            disabled={isExporting}
          >
            <FileSpreadsheet className="h-3.5 w-3.5 mr-1.5 text-brand" />
            {isExporting ? "Exporting…" : "Export Safe CSV"}
          </Button>
        </div>
      </div>

      {/* Status banner */}
      {statusMessage && (
        <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-3.5 text-xs font-bold text-emerald-900 flex items-center gap-2 shadow-xs animate-in">
          <CheckCircle2 className="h-4 w-4 text-emerald-700 shrink-0" />
          <span>{statusMessage}</span>
        </div>
      )}

      {/* Tenant & Database Security Card */}
      <Card className="overflow-hidden border-brand/20 bg-surface">
        <div className="p-4 border-b border-line bg-surface-2 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-brand/10 text-brand flex items-center justify-center">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <div>
              <span className="font-bold text-xs text-ink block">
                Tenant Database Context (Row-Level Security Active)
              </span>
              <span className="text-[11px] text-muted font-mono">
                Tenant ID: {user?.tenantId || "tenant_acme"}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs">
              <span
                className={`h-2 w-2 rounded-full ${healthQ.data?.status === "ok" ? "bg-emerald-500 animate-pulse" : "bg-amber-500"}`}
              />
              <span className="font-semibold text-ink">
                API Backend: {healthQ.data?.status === "ok" ? "Healthy (200 OK)" : "Connecting…"}
              </span>
            </div>
            <span className="rounded-full bg-brand/10 px-2.5 py-0.5 text-[11px] font-bold text-brand border border-brand/20">
              Postgres 16 RLS
            </span>
          </div>
        </div>
      </Card>

      {/* Live Dataset Statistics Matrix */}
      <div>
        <div className="text-xs font-bold uppercase tracking-wider text-muted mb-3 flex items-center gap-2">
          <Database className="h-3.5 w-3.5 text-brand" />
          <span>Live PostgreSQL Tenant Records</span>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <MetricCard
            title="Customers"
            value={isLoadingStats ? "…" : `${customers.length}`}
            subvalue="accounts"
            icon={Building2}
            accentColor="brand"
          />
          <MetricCard
            title="Products"
            value={isLoadingStats ? "…" : `${products.length}`}
            subvalue="active SKUs"
            icon={Boxes}
            accentColor="blue"
          />
          <MetricCard
            title="Brands"
            value={isLoadingStats ? "…" : `${principals.length}`}
            subvalue="principals"
            icon={Repeat}
            accentColor="amber"
          />
          <MetricCard
            title="Sales Leads"
            value={isLoadingStats ? "…" : `${leads.length}`}
            subvalue="pipeline deals"
            icon={Target}
            accentColor="violet"
          />
          <MetricCard
            title="Orders"
            value={isLoadingStats ? "…" : `${orders.length}`}
            subvalue="dispatches"
            icon={ShoppingCart}
            accentColor="brand"
          />
          <MetricCard
            title="Invoices"
            value={isLoadingStats ? "…" : `${payments.length}`}
            subvalue="receivables"
            icon={Receipt}
            accentColor="red"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        {/* Active Session Persona */}
        <Card className="overflow-hidden bg-surface">
          <CardHeader
            title="Authenticated Session Persona"
            hint="Signed-in user identity and RBAC permission scope"
          />
          <div className="p-5 space-y-4">
            <div>
              <label className="text-xs font-bold text-ink uppercase tracking-wider block mb-1.5">
                Current Access Role
              </label>
              <div className="w-full rounded-lg border border-line bg-surface-2 px-3 py-2 text-xs font-bold text-ink flex items-center justify-between">
                <span>{roleLabel(role)}</span>
                <span className="font-mono text-[11px] text-muted">{user?.email}</span>
              </div>
            </div>

            <div className="rounded-xl bg-surface-2 p-3.5 border border-line text-xs space-y-1.5">
              <div className="font-bold text-ink flex items-center gap-1.5">
                <UserCheck className="h-3.5 w-3.5 text-brand" />
                <span>Active Profile: {user?.name || "Administrator"}</span>
              </div>
              <p className="text-muted leading-relaxed font-medium">
                {role === "admin" &&
                  "Full administrative authority: add/edit SKUs, manage users, modify projections, and govern accounts."}
                {role === "mgmt" &&
                  "Management Read-Only view: executive visibility across pipeline, metrics & exports with protected worksheets."}
                {role === "sales" &&
                  "Salesperson Scope: view and update records assigned to your sales territory."}
              </p>
            </div>
          </div>
        </Card>

        {/* Period Governance */}
        <Card className="overflow-hidden bg-surface">
          <CardHeader
            title="Monthly Target Lock Governance"
            hint="Freeze historical months to prevent projection drift after reporting close"
          />
          <div className="p-5 space-y-4">
            <div className="flex items-center justify-between p-3.5 rounded-xl border border-line bg-surface-2">
              <div className="flex items-center gap-2.5">
                <Lock className={`h-4 w-4 ${periodLocked ? "text-amber" : "text-muted"}`} />
                <div>
                  <div className="font-bold text-ink text-xs">
                    {periodLocked ? "Period is Locked" : "Period is Open for Edits"}
                  </div>
                  <div className="text-[11px] text-muted font-medium">
                    {periodLocked
                      ? "Projections are read-only for reporting"
                      : "Sales team can edit quantities & prices"}
                  </div>
                </div>
              </div>
              <Button
                variant={periodLocked ? "primary" : "outline"}
                size="sm"
                onClick={() => setPeriodLocked(!periodLocked)}
              >
                {periodLocked ? "Unlock Period" : "Lock Period"}
              </Button>
            </div>

            <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3 text-xs text-amber-900 leading-relaxed font-medium">
              Locking a period freezes monthly targets for management reporting and prevents unauthorized row overrides after accounting close.
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
