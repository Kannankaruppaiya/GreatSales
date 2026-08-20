import { useEffect, useMemo, useState } from "react";
import { FileSpreadsheet, LayoutList, Loader2, Plus, RefreshCw, Upload, X } from "lucide-react";
import { useAuthRole } from "@/store/auth";
import { inr, lakhs } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ApiError } from "@/lib/api";
import { Button, Card } from "@/components/ui";
import { QueryBoundary } from "@/components/common/QueryBoundary";
import { AddPaymentModal } from "@/features/payments/AddPaymentModal";
import { ImportPaymentsModal } from "@/features/payments/ImportPaymentsModal";
import { PaymentDetailModal } from "@/features/payments/PaymentDetailModal";
import { CustomerDrawer } from "@/features/customers/CustomerDrawer";
import {
  usePayments,
  useUpdatePayment,
  useDeletePayment,
  flattenPayments,
} from "@/features/payments/queries";
import {
  PAY_ZONE_VALUES,
  PAY_ZONE_LABELS,
  PAYMENT_STATUS_VALUES,
  PAYMENT_STATUS_LABELS,
  type PayZoneValue,
  type PaymentRow,
} from "@/features/payments/types";

/**
 * Debounces a fast-changing value (e.g. search input) so downstream effects
 * (e.g. a query key) only settle `delayMs` after the user stops typing.
 * Mirrors the same local hook in ProductsPage.tsx / CustomersPage.tsx.
 */
function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

/**
 * Buckets an already server-computed `agingDays` value. This is pure client
 * grouping over a number the API supplied — it never recomputes the number
 * itself (see PaymentRow.agingDays in features/payments/types.ts).
 */
function agingBucket(days: number | null): string {
  if (days == null) return "-";
  if (days <= 30) return "0-30";
  if (days <= 60) return "31-60";
  if (days <= 90) return "61-90";
  if (days <= 120) return "91-120";
  if (days <= 150) return "121-150";
  return "150+";
}

function agingTone(days: number | null): string {
  if (days == null || days <= 60) return "bg-brand-soft text-brand-ink";
  if (days <= 120) return "bg-amber-soft text-amber";
  return "bg-red-soft text-red";
}

const ZONE_CLASSES: Record<string, string> = {
  RedZone: "bg-red-soft text-red border-red/30",
  YellowZone: "bg-amber-soft text-amber border-amber/30",
  GreenZone: "bg-brand-soft text-brand-ink border-brand/30",
  Blacklist: "bg-violet-soft text-violet border-violet/30",
  Unassigned: "bg-surface-2 text-muted border-line",
};

export default function PaymentsPage() {
  const role = useAuthRole();
  const canEdit = role !== "mgmt";
  const isAdmin = role === "admin";

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 300);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [ownerId, setOwnerId] = useState("ALL");
  const [zoneChip, setZoneChip] = useState("ALL");
  const [tab, setTab] = useState<"list" | "report">("list");

  const [showAddPayment, setShowAddPayment] = useState(false);
  const [showImportExcel, setShowImportExcel] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<PaymentRow | null>(null);
  const [selectedDrawerCustId, setSelectedDrawerCustId] = useState<string | null>(null);

  const params = {
    search: debouncedSearch.trim() || undefined,
    status: statusFilter === "ALL" ? undefined : statusFilter,
    ownerId: ownerId === "ALL" ? undefined : ownerId,
  };
  const q = usePayments(params);
  const update = useUpdatePayment();
  const del = useDeletePayment();
  const rows = flattenPayments(q.data);

  // Auto-fetch every page before computing KPI/report aggregates below, so
  // "Total pending" etc. reflect the full filtered ledger rather than just
  // whatever page happened to load first. Guarded on hasNextPage &&
  // !isFetchingNextPage so this terminates once the last page (nextCursor:
  // null) comes back; it re-runs whenever the filters change the query key.
  useEffect(() => {
    if (q.hasNextPage && !q.isFetchingNextPage) {
      q.fetchNextPage();
    }
  }, [q.hasNextPage, q.isFetchingNextPage, q.fetchNextPage]);

  // True while rows are still incomplete (initial load, or more pages left
  // to auto-fetch) — every financial aggregate below is only accurate once
  // this is false.
  const isLoadingFullTotals = q.isLoading || q.hasNextPage === true;

  // Salesperson filter options — no dedicated endpoint, derived from the
  // loaded rows (same pattern as ProductsPage's principals / CustomersPage's
  // salespersonOptions).
  const salespersonOptions = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of rows) {
      if (r.salespersonId) m.set(r.salespersonId, r.salespersonName || r.salespersonId);
    }
    return [...m.entries()].map(([id, name]) => ({ id, name }));
  }, [rows]);

  // Customer options for AddPaymentModal's name→id match — derived the same
  // way, from currently loaded rows only (no dedicated customer-search fetch
  // wired into this modal — see the brief's "derive FK options from rows").
  const customerOptions = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of rows) {
      if (r.customerId && r.customerName) m.set(r.customerId, r.customerName);
    }
    return [...m.entries()].map(([id, name]) => ({ id, name }));
  }, [rows]);

  const existingRefNos = useMemo(() => rows.map((r) => r.refNo || "").filter(Boolean), [rows]);

  // Zone filter is client-side grouping over the fetched rows (there is no
  // server-side payZone filter param) — this only ever narrows the page's
  // already-loaded rows, it does not fetch anything new.
  const scopedRows = useMemo(() => {
    if (zoneChip === "ALL") return rows;
    if (zoneChip === "Unassigned") return rows.filter((r) => !r.payZone);
    return rows.filter((r) => r.payZone === zoneChip);
  }, [rows, zoneChip]);

  // KPI + aging/zone report aggregation — pure grouping over `rows` using the
  // server-supplied `pending`/`agingDays`/`payZone`/`status`. None of this
  // recomputes those fields.
  const totalPending = rows.reduce((s, r) => s + r.pending, 0);
  const redTotal = rows.filter((r) => r.payZone === "RedZone").reduce((s, r) => s + r.pending, 0);
  const over90Total = rows
    .filter((r) => r.agingDays != null && r.agingDays > 90)
    .reduce((s, r) => s + r.pending, 0);
  const todayStr = new Date().toISOString().slice(0, 10);
  const fuTodayCount = rows.filter((r) => r.nextFollowUp && r.nextFollowUp <= todayStr).length;

  const buckets = ["0-30", "31-60", "61-90", "91-120", "121-150", "150+"];
  const zoneList = [...PAY_ZONE_VALUES, "Unassigned"];

  const byZone: Record<string, { count: number; pending: number }> = {};
  zoneList.forEach((z) => (byZone[z] = { count: 0, pending: 0 }));
  rows.forEach((r) => {
    const z = r.payZone || "Unassigned";
    if (!byZone[z]) byZone[z] = { count: 0, pending: 0 };
    byZone[z].count++;
    byZone[z].pending += r.pending;
  });

  const bySp: Record<string, Record<string, number> & { total: number }> = {};
  rows.forEach((r) => {
    const spName = r.salespersonName || "Unassigned";
    if (!bySp[spName]) {
      bySp[spName] = { total: 0 };
      buckets.forEach((b) => (bySp[spName][b] = 0));
    }
    const b = agingBucket(r.agingDays);
    if (b !== "-") bySp[spName][b] = (bySp[spName][b] || 0) + r.pending;
    bySp[spName].total += r.pending;
  });
  const spRows = Object.entries(bySp).sort((a, b) => b[1].total - a[1].total);

  const byOrg: Record<string, { pending: number; count: number; oldest: number; zones: Set<string> }> = {};
  rows.forEach((r) => {
    const party = r.customerName || "Customer";
    if (!byOrg[party]) byOrg[party] = { pending: 0, count: 0, oldest: 0, zones: new Set() };
    byOrg[party].pending += r.pending;
    byOrg[party].count++;
    if ((r.agingDays || 0) > byOrg[party].oldest) byOrg[party].oldest = r.agingDays || 0;
    if (r.payZone) byOrg[party].zones.add(r.payZone);
  });
  const orgRows = Object.entries(byOrg).sort((a, b) => b[1].pending - a[1].pending);

  const toggleMail = (p: PaymentRow, mk: "mail1" | "mail2" | "mail3" | "mail4") => {
    update.mutate({ id: p.id, patch: { [mk]: !p[mk] } });
  };

  const handleDelete = (p: PaymentRow) => {
    if (!confirm(`Delete invoice ${p.refNo || p.id}?`)) return;
    del.mutate(p.id);
  };

  return (
    <div className="space-y-4">
      {/* Loading-full-totals indicator — every KPI card and the Reports tab
          below aggregate over ALL filtered invoices (not just one page), so
          this is the only state where those numbers are still partial. */}
      {isLoadingFullTotals && (
        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-muted">
          <Loader2 className="h-3 w-3 animate-spin" />
          Loading full totals… ({rows.length} invoices so far)
        </div>
      )}

      {/* Top 4 KPI Cards — computed over ALL filtered invoices (see the
          auto-fetch-all effect above), not just one page. */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-line bg-surface p-3.5 shadow-xs">
          <div className="text-[10.5px] font-bold uppercase tracking-wider text-muted">Total pending</div>
          <div className="text-xl font-black text-ink mt-1 tabular-nums">{lakhs(totalPending)}</div>
          <div className="text-xs text-muted mt-0.5">
            {isLoadingFullTotals ? "loading…" : `${rows.length} invoices`}
          </div>
        </div>

        <div className={cn("rounded-xl border p-3.5 shadow-xs", redTotal > 0 ? "border-red/40 bg-red-soft/70" : "border-line bg-surface")}>
          <div className={cn("text-[10.5px] font-bold uppercase tracking-wider", redTotal > 0 ? "text-red" : "text-muted")}>
            Red zone
          </div>
          <div className={cn("text-xl font-black mt-1 tabular-nums", redTotal > 0 ? "text-red" : "text-ink")}>
            {lakhs(redTotal)}
          </div>
        </div>

        <div className={cn("rounded-xl border p-3.5 shadow-xs", over90Total > 0 ? "border-amber/40 bg-amber-soft/70" : "border-line bg-surface")}>
          <div className={cn("text-[10.5px] font-bold uppercase tracking-wider", over90Total > 0 ? "text-amber" : "text-muted")}>
            Overdue 90+ days
          </div>
          <div className={cn("text-xl font-black mt-1 tabular-nums", over90Total > 0 ? "text-amber" : "text-ink")}>
            {lakhs(over90Total)}
          </div>
        </div>

        <div className={cn("rounded-xl border p-3.5 shadow-xs", fuTodayCount > 0 ? "border-amber/40 bg-amber-soft/70" : "border-line bg-surface")}>
          <div className={cn("text-[10.5px] font-bold uppercase tracking-wider", fuTodayCount > 0 ? "text-amber" : "text-muted")}>
            Follow-ups due
          </div>
          <div className={cn("text-xl font-black mt-1 tabular-nums", fuTodayCount > 0 ? "text-amber" : "text-ink")}>
            {fuTodayCount}
          </div>
        </div>
      </div>

      <Card className="p-0 overflow-hidden shadow-xs border-line">
        {/* Top Tab Bar & Action Buttons */}
        <div className="p-3 border-b border-line flex items-center justify-between gap-2.5 flex-wrap bg-surface">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setTab("list")}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-semibold transition-all cursor-pointer inline-flex items-center gap-1",
                tab === "list"
                  ? "border-brand bg-brand text-white shadow-2xs"
                  : "border-line bg-surface text-muted hover:border-muted/50 hover:text-ink"
              )}
            >
              <LayoutList className="h-3 w-3" /> Invoices ({scopedRows.length})
            </button>
            <button
              onClick={() => setTab("report")}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-semibold transition-all cursor-pointer inline-flex items-center gap-1",
                tab === "report"
                  ? "border-brand bg-brand text-white shadow-2xs"
                  : "border-line bg-surface text-muted hover:border-muted/50 hover:text-ink"
              )}
            >
              <FileSpreadsheet className="h-3 w-3" /> Aging Matrix Reports
            </button>
          </div>

          <Button size="sm" variant="outline" onClick={() => q.refetch()}>
            <RefreshCw className={cn("h-3.5 w-3.5 mr-1", q.isFetching && "animate-spin")} />
            Refresh
          </Button>

          {canEdit && (
            <div className="flex items-center gap-2 ml-auto">
              <Button size="sm" onClick={() => setShowImportExcel(true)}>
                <Upload className="h-3.5 w-3.5 mr-1" /> Import Tally Excel
              </Button>
              <Button variant="outline" size="sm" onClick={() => setShowAddPayment(true)}>
                <Plus className="h-3.5 w-3.5 mr-1" /> + Add Invoice
              </Button>
            </div>
          )}
        </div>

        {tab === "list" ? (
          <div>
            {/* Filter Toolbar */}
            <div className="p-3 border-b border-line flex items-center justify-between gap-2.5 flex-wrap bg-surface-2/30">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search party or ref no…"
                className="rounded-xl border border-line bg-surface px-3 py-1.5 text-xs text-ink placeholder:text-muted focus:outline-brand focus:border-brand w-64 shadow-2xs"
              />

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs font-medium text-ink focus:outline-brand focus:border-brand"
              >
                <option value="ALL">All statuses</option>
                {PAYMENT_STATUS_VALUES.map((s) => (
                  <option key={s} value={s}>
                    {PAYMENT_STATUS_LABELS[s]}
                  </option>
                ))}
              </select>

              {salespersonOptions.length > 0 && (
                <select
                  value={ownerId}
                  onChange={(e) => setOwnerId(e.target.value)}
                  className="rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs font-medium text-ink focus:outline-brand focus:border-brand"
                >
                  <option value="ALL">All salespersons</option>
                  {salespersonOptions.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              )}

              <div className="flex items-center gap-1.5 overflow-x-auto">
                {["ALL", ...PAY_ZONE_VALUES, "Unassigned"].map((z) => (
                  <button
                    key={z}
                    onClick={() => setZoneChip(z)}
                    className={cn(
                      "rounded-full border px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap transition-all cursor-pointer",
                      zoneChip === z
                        ? "border-brand bg-brand text-white shadow-2xs"
                        : "border-line bg-surface text-muted hover:border-muted/50 hover:text-ink"
                    )}
                  >
                    {z === "ALL" ? "All zones" : z === "Unassigned" ? "Unassigned" : PAY_ZONE_LABELS[z as PayZoneValue]}
                  </button>
                ))}
              </div>
            </div>

            {/* Invoices Table */}
            <div className="overflow-x-auto max-h-[68vh]">
              <QueryBoundary
                isLoading={q.isLoading}
                isError={q.isError}
                error={q.error}
                isEmpty={scopedRows.length === 0}
                emptyLabel="No invoices match this filter."
              >
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-surface-2 text-[10.5px] font-extrabold uppercase tracking-wider text-muted sticky top-0 z-10 border-b border-line shadow-2xs">
                    <tr>
                      <th className="py-2.5 px-3">Ref no.</th>
                      <th className="py-2.5 px-3">Date</th>
                      <th className="py-2.5 px-3 min-w-[210px]">Party</th>
                      <th className="py-2.5 px-3 text-right">Aging</th>
                      <th className="py-2.5 px-3 text-right">Amount</th>
                      <th className="py-2.5 px-3 text-right font-bold text-ink">Pending</th>
                      <th className="py-2.5 px-3 text-right">Received</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3">Salesperson</th>
                      <th className="py-2.5 px-3">Zone</th>
                      <th className="py-2.5 px-3 text-center">Reminders</th>
                      {isAdmin && <th className="py-2.5 px-2 w-8"></th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line/60">
                    {scopedRows.map((p) => {
                      const bucket = agingBucket(p.agingDays);
                      const toneCls = agingTone(p.agingDays);
                      const statusLabel =
                        PAYMENT_STATUS_LABELS[p.status as keyof typeof PAYMENT_STATUS_LABELS] ?? p.status;

                      return (
                        <tr key={p.id} className="hover:bg-surface-2/70 transition-colors">
                          <td className="py-2.5 px-3 font-bold text-ink tabular-nums">
                            <button
                              type="button"
                              onClick={() => setSelectedPayment(p)}
                              className="hover:text-brand hover:underline cursor-pointer"
                            >
                              {p.refNo || "—"}
                            </button>
                          </td>
                          <td className="py-2.5 px-3 text-muted tabular-nums">{p.invoiceDate || "—"}</td>
                          <td className="py-2.5 px-3">
                            {p.customerId ? (
                              <button
                                type="button"
                                onClick={() => setSelectedDrawerCustId(p.customerId)}
                                className="font-bold text-ink hover:text-brand hover:underline cursor-pointer text-left block"
                              >
                                {p.customerName || "—"}
                              </button>
                            ) : (
                              <span className="font-bold text-ink">{p.customerName || "—"}</span>
                            )}
                          </td>

                          {/* Aging badge — server-supplied agingDays, rendered as-is */}
                          <td className="py-2.5 px-3 text-right">
                            <span className={cn("rounded-lg px-2 py-0.5 text-[11px] font-bold tabular-nums", toneCls)}>
                              {p.agingDays != null ? `${p.agingDays}d · ${bucket}` : "—"}
                            </span>
                          </td>

                          <td className="py-2.5 px-3 text-right tabular-nums text-muted">{inr(p.amount)}</td>

                          {/* Pending — server-computed, rendered as-is */}
                          <td className="py-2.5 px-3 text-right tabular-nums font-bold text-ink">{inr(p.pending)}</td>

                          <td className="py-2.5 px-3 text-right tabular-nums text-muted">
                            {p.received ? inr(p.received) : "—"}
                          </td>

                          {/* Status — server-computed, rendered as-is */}
                          <td className="py-2.5 px-3">
                            <span className="rounded px-2 py-0.5 text-[10.5px] font-bold bg-surface-2 text-ink border border-line">
                              {statusLabel}
                            </span>
                          </td>

                          <td className="py-2.5 px-3 text-muted text-xs">{p.salespersonName || "—"}</td>

                          <td className="py-2.5 px-3">
                            <span
                              className={cn(
                                "rounded px-2 py-0.5 text-[11px] font-bold border",
                                ZONE_CLASSES[p.payZone || "Unassigned"]
                              )}
                            >
                              {p.payZone ? PAY_ZONE_LABELS[p.payZone as PayZoneValue] : "Unassigned"}
                            </span>
                          </td>

                          {/* 4 Mail Reminder chips */}
                          <td className="py-2.5 px-3 text-center">
                            <div className="flex items-center justify-center gap-1">
                              {(["mail1", "mail2", "mail3", "mail4"] as const).map((mk, mi) => (
                                <button
                                  key={mk}
                                  type="button"
                                  disabled={!canEdit}
                                  onClick={() => toggleMail(p, mk)}
                                  title={`Reminder ${mi + 1} sent`}
                                  className={cn(
                                    "w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold border transition-all cursor-pointer",
                                    p[mk]
                                      ? "bg-brand text-white border-brand shadow-2xs"
                                      : "bg-surface text-muted border-line hover:border-muted"
                                  )}
                                >
                                  {mi + 1}
                                </button>
                              ))}
                            </div>
                          </td>

                          {/* Admin-only delete action */}
                          {isAdmin && (
                            <td className="py-2.5 px-2 text-center">
                              <button
                                type="button"
                                onClick={() => handleDelete(p)}
                                disabled={del.isPending}
                                className="text-red/60 hover:text-red p-1 cursor-pointer disabled:opacity-50"
                                title="Delete invoice"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </QueryBoundary>
            </div>

            {/* All pages fetch automatically (see the auto-fetch-all effect
                above) so KPI/report aggregates are never silently partial —
                this is a passive progress note, not a manual "Load more"
                trigger. */}
            {q.hasNextPage && (
              <div className="p-3 border-t border-line flex items-center justify-center gap-1.5 text-[11px] font-medium text-muted">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Loading remaining invoices…
              </div>
            )}

            {update.isError && (
              <div className="px-3.5 pb-3 text-[11px] font-medium text-red">
                {update.error instanceof ApiError ? update.error.message : "Failed to save change."}
              </div>
            )}
            {del.isError && (
              <div className="px-3.5 pb-3 text-[11px] font-medium text-red">
                {del.error instanceof ApiError ? del.error.message : "Failed to delete invoice."}
              </div>
            )}
          </div>
        ) : (
          /* Aging Reports View — pure client grouping over `rows`, using the
             server's agingDays/payZone/pending; nothing here recomputes them. */
          <div className="p-4 space-y-6">
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-muted mb-2">Zone-wise pending</div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                {zoneList.map((z) => (
                  <div key={z} className={cn("rounded-xl border p-3 shadow-xs", ZONE_CLASSES[z])}>
                    <div className="text-[10.5px] font-bold uppercase tracking-wider">
                      {z === "Unassigned" ? z : PAY_ZONE_LABELS[z as PayZoneValue]}
                    </div>
                    <div className="text-lg font-black mt-1 tabular-nums">{lakhs(byZone[z]?.pending || 0)}</div>
                    <div className="text-xs opacity-80 mt-0.5">{byZone[z]?.count || 0} invoices</div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-muted mb-2">Salesperson-wise aging (₹)</div>
              <div className="overflow-x-auto border border-line rounded-xl">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-surface-2 text-[10.5px] font-extrabold uppercase tracking-wider text-muted border-b border-line">
                    <tr>
                      <th className="py-2.5 px-3">Salesperson</th>
                      {buckets.map((b) => (
                        <th key={b} className="py-2.5 px-3 text-right">
                          {b}
                        </th>
                      ))}
                      <th className="py-2.5 px-3 text-right font-bold text-ink">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line/60">
                    {spRows.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-6 text-center text-xs text-muted">
                          No data available.
                        </td>
                      </tr>
                    ) : (
                      spRows.map(([spName, row]) => (
                        <tr key={spName} className="hover:bg-surface-2/60 transition-colors">
                          <td className="py-2 px-3 font-bold text-ink">{spName}</td>
                          {buckets.map((b) => (
                            <td key={b} className="py-2 px-3 text-right tabular-nums text-muted">
                              {row[b] ? inr(row[b]) : "—"}
                            </td>
                          ))}
                          <td className="py-2 px-3 text-right tabular-nums font-bold text-ink">
                            {inr(row.total)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-muted mb-2">Organization-wise pending</div>
              <div className="overflow-x-auto border border-line rounded-xl">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-surface-2 text-[10.5px] font-extrabold uppercase tracking-wider text-muted border-b border-line">
                    <tr>
                      <th className="py-2.5 px-3">Party</th>
                      <th className="py-2.5 px-3 text-right">Invoices</th>
                      <th className="py-2.5 px-3 text-right">Oldest (days)</th>
                      <th className="py-2.5 px-3">Zones</th>
                      <th className="py-2.5 px-3 text-right font-bold text-ink">Total pending</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line/60">
                    {orgRows.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-6 text-center text-xs text-muted">
                          No data available.
                        </td>
                      </tr>
                    ) : (
                      orgRows.map(([party, o]) => (
                        <tr key={party} className="hover:bg-surface-2/60 transition-colors">
                          <td className="py-2 px-3 font-bold text-ink">{party}</td>
                          <td className="py-2 px-3 text-right tabular-nums text-muted">{o.count}</td>
                          <td className="py-2 px-3 text-right tabular-nums text-muted">{o.oldest}</td>
                          <td className="py-2 px-3">
                            <div className="flex items-center gap-1 flex-wrap">
                              {Array.from(o.zones).map((z) => (
                                <span
                                  key={z}
                                  className={cn(
                                    "rounded px-1.5 py-0.2 text-[10px] font-bold border",
                                    ZONE_CLASSES[z || "Unassigned"]
                                  )}
                                >
                                  {PAY_ZONE_LABELS[z as PayZoneValue] || z}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="py-2 px-3 text-right tabular-nums font-bold text-ink">
                            {inr(o.pending)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* Customer 360 Drawer */}
      <CustomerDrawer customerId={selectedDrawerCustId} onClose={() => setSelectedDrawerCustId(null)} />

      {/* Modals */}
      <AddPaymentModal
        open={showAddPayment}
        onClose={() => setShowAddPayment(false)}
        salespeople={salespersonOptions}
        customers={customerOptions}
      />
      <ImportPaymentsModal
        open={showImportExcel}
        onClose={() => setShowImportExcel(false)}
        existingRefNos={existingRefNos}
      />

      {selectedPayment && (
        <PaymentDetailModal
          open={!!selectedPayment}
          onClose={() => setSelectedPayment(null)}
          payment={selectedPayment}
          salespeople={salespersonOptions}
        />
      )}
    </div>
  );
}
