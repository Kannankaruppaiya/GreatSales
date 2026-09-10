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
import { currentPeriod } from "@/data/months";
import { MonthSelect } from "@/components/MonthSelect";
import { ImportCustomersCard } from "@/features/data/ImportCustomersCard";
import { useCustomers } from "@/features/customers/queries";
import { useProducts, usePrincipals } from "@/features/products/queries";
import { useOrders } from "@/features/orders/queries";
import { usePayments } from "@/features/payments/queries";
import { useLeads } from "@/features/leads/queries";
import { useQuery } from "@tanstack/react-query";
import { ApiError, apiFetch } from "@/lib/api";
import {
  useLockPeriod,
  usePeriodLock,
  useUnlockPeriod,
} from "@/features/data/periodQueries";

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

  // The month this card acts on. Deliberately NOT the top-bar month: the Data
  // page does not read the global filters (see features.ts globalFilters), and
  // locking is an explicit act that should name its own period.
  //
  // Starts at the CURRENT month. It used to start at MONTHS[0] — the first
  // entry of a hardcoded fiscal list — so in September the card offered to lock
  // April, and an administrator closing the books had to notice and correct it.
  const [lockPeriod, setLockPeriod] = useState(currentPeriod);
  const [lockError, setLockError] = useState<string | null>(null);
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

  // COUNTS, not rows. These cards used to render `items.length` off a
  // cursor-paginated query whose default page is 20, so a tenant with 417
  // customers was told it had 20 — and the CSV below exported that number.
  // `total` is the server's count for the whole filter, read in the same
  // transaction as the page.
  const countOf = (data?: { pages: { total: number }[] }) =>
    data?.pages[0]?.total;
  const counts = {
    customers: countOf(customersQ.data),
    products: countOf(productsQ.data),
    orders: countOf(ordersQ.data),
    payments: countOf(paymentsQ.data),
    leads: countOf(leadsQ.data),
    // /principals is not paginated — the whole list is the answer.
    principals: principalsQ.data?.items.length,
  };

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
        ["Customers", counts.customers ?? 0, user?.tenantId || "default", now],
        ["Principal Brands", counts.principals ?? 0, user?.tenantId || "default", now],
        ["Product Catalog SKUs", counts.products ?? 0, user?.tenantId || "default", now],
        ["Sales Orders", counts.orders ?? 0, user?.tenantId || "default", now],
        ["Invoices & Receivables", counts.payments ?? 0, user?.tenantId || "default", now],
        ["Sales Leads", counts.leads ?? 0, user?.tenantId || "default", now],
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

  // undefined while loading, null when open, the row when locked.
  const lock = usePeriodLock(lockPeriod);
  const lockQ = lock === undefined ? undefined : lock;
  const isLocked = !!lock;
  const lockMutation = useLockPeriod();
  const unlockMutation = useUnlockPeriod();
  const lockPending = lockMutation.isPending || unlockMutation.isPending;

  const handleToggleLock = async () => {
    setLockError(null);
    try {
      if (isLocked) {
        await unlockMutation.mutateAsync(lockPeriod);
        setStatusMessage(`${lockPeriod} unlocked — projections are editable again.`);
      } else {
        await lockMutation.mutateAsync({
          period: lockPeriod,
          reason: "Locked from Data administration",
        });
        setStatusMessage(`${lockPeriod} locked — projection edits are now refused.`);
      }
      setTimeout(() => setStatusMessage(null), 4000);
    } catch (err) {
      setLockError(
        err instanceof ApiError
          ? err.message
          : "Could not change the lock. Try again.",
      );
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

      <ImportCustomersCard />

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
            value={isLoadingStats ? "…" : `${counts.customers ?? 0}`}
            subvalue="accounts"
            icon={Building2}
            accentColor="brand"
          />
          <MetricCard
            title="Products"
            value={isLoadingStats ? "…" : `${counts.products ?? 0}`}
            subvalue="active SKUs"
            icon={Boxes}
            accentColor="blue"
          />
          <MetricCard
            title="Brands"
            value={isLoadingStats ? "…" : `${counts.principals ?? 0}`}
            subvalue="principals"
            icon={Repeat}
            accentColor="amber"
          />
          <MetricCard
            title="Sales Leads"
            value={isLoadingStats ? "…" : `${counts.leads ?? 0}`}
            subvalue="pipeline deals"
            icon={Target}
            accentColor="violet"
          />
          <MetricCard
            title="Orders"
            value={isLoadingStats ? "…" : `${counts.orders ?? 0}`}
            subvalue="dispatches"
            icon={ShoppingCart}
            accentColor="brand"
          />
          <MetricCard
            title="Invoices"
            value={isLoadingStats ? "…" : `${counts.payments ?? 0}`}
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
            <div className="flex items-center gap-2">
              <label
                htmlFor="lock-period"
                className="text-[11px] font-bold uppercase tracking-wider text-muted"
              >
                Period
              </label>
              <MonthSelect
                value={lockPeriod}
                onChange={setLockPeriod}
                ariaLabel="Period to lock or unlock"
                className="w-[140px]"
              />
            </div>

            <div className="flex items-center justify-between p-3.5 rounded-xl border border-line bg-surface-2">
              <div className="flex items-center gap-2.5">
                <Lock className={`h-4 w-4 ${isLocked ? "text-amber" : "text-muted"}`} />
                <div>
                  <div className="font-bold text-ink text-xs">
                    {lockQ === undefined
                      ? "Checking…"
                      : isLocked
                        ? "Period is Locked"
                        : "Period is Open for Edits"}
                  </div>
                  <div className="text-[11px] text-muted font-medium">
                    {isLocked && lock
                      ? `Locked by ${lock.lockedByName} on ${lock.lockedAt.slice(0, 10)}`
                      : "Sales team can edit quantities & prices"}
                  </div>
                </div>
              </div>
              <Button
                variant={isLocked ? "primary" : "outline"}
                size="sm"
                disabled={lockQ === undefined || lockPending}
                onClick={handleToggleLock}
              >
                {lockPending
                  ? "Saving…"
                  : isLocked
                    ? "Unlock Period"
                    : "Lock Period"}
              </Button>
            </div>

            {lockError && (
              <div className="rounded-xl border border-red-200 bg-red-50/60 p-3 text-xs text-red-900 font-medium">
                {lockError}
              </div>
            )}

            <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3 text-xs text-amber-900 leading-relaxed font-medium">
              Locking a period freezes its projection worksheet server-side:
              every edit to a row in that month is refused for every role,
              including administrators.
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
