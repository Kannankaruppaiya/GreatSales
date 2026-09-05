import { useEffect, useMemo, useState } from "react";
import {
  FileSpreadsheet,
  LayoutList,
  Loader2,
  Plus,
  Printer,
} from "lucide-react";
import { useAuthRole } from "@/store/auth";
import { useUi } from "@/store/ui";
import { inr } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button, Card } from "@/components/ui";
import { StatusBadge } from "@/components/StatusBadge";
import { QueryBoundary } from "@/components/common/QueryBoundary";
import { CreateSalesOrderModal } from "@/features/orders/CreateSalesOrderModal";
import { SalesOrderDetailModal } from "@/features/orders/SalesOrderDetailModal";
import { InvoicePrintModal } from "@/features/orders/InvoicePrintModal";
import { useOrders, flattenOrders } from "@/features/orders/queries";
import {
  ORDER_STATUS_VALUES,
  ORDER_STATUS_LABELS,
  type OrderStatusValue,
  type OrderRow,
} from "@/features/orders/types";

function fmtDur(ms: number | null): string {
  if (ms == null || isNaN(ms)) return "—";
  if (ms < 0) ms = 0;
  const mins = Math.round(ms / 60000);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  const remM = mins % 60;
  if (hrs < 24) return `${hrs}h ${remM}m`;
  const days = Math.floor(hrs / 24);
  const remH = hrs % 24;
  return `${days}d ${remH}h`;
}

function fmtDT(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Raw-enum-keyed tone map for the status badge — mirrors data/constants.ts
 * soTone(), but keyed by the wire's raw OrderStatusValue instead of the old
 * mock's display-label strings (see features/orders/types.ts doc comment on
 * why status is a raw DB enum on the wire). */
function orderTone(status: string): "won" | "lost" | "open" | "hot" {
  if (status === "Cancelled") return "lost";
  if (status === "CustomerReceiptConfirmed") return "won";
  if (status === "Created") return "open";
  return "hot";
}

export default function OrdersPage() {
  const role = useAuthRole();
  const globalOwnerFilter = useUi((s) => s.ownerFilter);
  const globalPrincipal = useUi((s) => s.principalId);
  const canEdit = role !== "mgmt";

  const [search, setSearch] = useState("");
  const [statusChip, setStatusChip] = useState<string>("ALL");
  const [ownerId, setOwnerId] = useState("ALL");
  const [tab, setTab] = useState<"list" | "report">("list");
  const [showCreateSo, setShowCreateSo] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<OrderRow | null>(null);
  const [printOrder, setPrintOrder] = useState<OrderRow | null>(null);

  const effectiveOwner = ownerId !== "ALL" ? ownerId : globalOwnerFilter !== "ALL" ? globalOwnerFilter : undefined;

  const params = {
    search: search.trim() || undefined,
    status: statusChip === "ALL" ? undefined : statusChip,
    ownerId: effectiveOwner,
    principalId: globalPrincipal === "ALL" ? undefined : globalPrincipal,
  };
  const q = useOrders(params);
  const orders = flattenOrders(q.data);

  // Salesperson filter options — no dedicated endpoint, derived from the
  // loaded rows (same pattern as PaymentsPage's salespersonOptions). Also
  // handed to CreateSalesOrderModal below; customers/products are
  // deliberately NOT derived from rows and left to that modal's own
  // "no options handed down" fallback fetch (useCustomers/useProducts),
  // since a new order can target a customer/product that has never
  // appeared on an existing order — a rows-derived list here would silently
  // exclude those. See task-7-report.md "FK options" for the full rationale.
  const salespersonOptions = useMemo(() => {
    const m = new Map<string, string>();
    for (const o of orders) {
      if (o.salespersonId) m.set(o.salespersonId, o.salespersonName || o.salespersonId);
    }
    return [...m.entries()].map(([id, name]) => ({ id, name }));
  }, [orders]);

  // Fulfilment report only aggregates over ALL filtered orders (not just one
  // page), the same reason PaymentsPage auto-fetches every page before
  // computing its KPI/aging totals. Unlike Payments, this stays opt-in to
  // the Report tab (rather than always running) so the List tab's manual
  // "Load more" stays meaningful — see task-7-report.md concerns.
  useEffect(() => {
    if (tab === "report" && q.hasNextPage && !q.isFetchingNextPage) {
      q.fetchNextPage();
    }
  }, [tab, q.hasNextPage, q.isFetchingNextPage, q.fetchNextPage]);
  const reportStillLoading = tab === "report" && (q.isLoading || q.hasNextPage === true);

  // Fulfilment SLA metrics — pure grouping over the server's statusHistory
  // entries (raw OrderStatusValue keys); none of this recomputes total/
  // lineTotal, only timestamps already returned by the API.
  const reportOrders = useMemo(() => orders.filter((o) => o.status !== "Cancelled"), [orders]);

  const durAck: number[] = [];
  const durPrep: number[] = [];
  const durTransit: number[] = [];
  const durTotal: number[] = [];
  const durRecv: number[] = [];
  let delayedCount = 0;

  reportOrders.forEach((so) => {
    const created = so.createdAt ? new Date(so.createdAt).getTime() : 0;
    const ackEntry = so.statusHistory.find((h) => h.status === "Acknowledged");
    const prepEntry = so.statusHistory.find((h) => h.status === "DeliveredFromWarehouse");
    const delvEntry = so.statusHistory.find((h) => h.status === "DeliveredToCustomer");
    const recvEntry = so.statusHistory.find((h) => h.status === "CustomerReceiptConfirmed");

    const ackTime = ackEntry ? new Date(ackEntry.at).getTime() : 0;
    const prepTime = prepEntry ? new Date(prepEntry.at).getTime() : 0;
    const delvTime = delvEntry ? new Date(delvEntry.at).getTime() : 0;
    const recvTime = recvEntry ? new Date(recvEntry.at).getTime() : 0;

    if (ackTime && created) durAck.push(ackTime - created);
    if (prepTime && ackTime) durPrep.push(prepTime - ackTime);
    if (delvTime && prepTime) durTransit.push(delvTime - prepTime);
    if (delvTime && created) durTotal.push(delvTime - created);
    if (recvTime && delvTime) durRecv.push(recvTime - delvTime);

    if (so.expectedDelivery && delvTime && delvTime > new Date(so.expectedDelivery).getTime()) {
      delayedCount++;
    }
  });

  const avg = (arr: number[]) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null);

  return (
    <div className="space-y-4">
      <Card className="p-0 overflow-hidden shadow-xs border-line">
        {/* Top Tab Bar */}
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
              <LayoutList className="h-3 w-3" /> Orders ({orders.length})
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
              <FileSpreadsheet className="h-3 w-3" /> Fulfilment SLA Report
            </button>
          </div>

          {canEdit && tab === "list" && (
            <div className="ml-auto">
              <Button size="sm" onClick={() => setShowCreateSo(true)}>
                <Plus className="h-3.5 w-3.5 mr-1" /> + Create Sales Order
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
                placeholder="Search SO no., customer, or transporter…"
                className="rounded-xl border border-line bg-surface px-3 py-1.5 text-xs text-ink placeholder:text-muted focus:outline-brand focus:border-brand w-64 shadow-2xs"
              />

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
                {(["ALL", ...ORDER_STATUS_VALUES] as const).map((c) => (
                  <button
                    key={c}
                    onClick={() => setStatusChip(c)}
                    className={cn(
                      "rounded-full border px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap transition-all cursor-pointer",
                      statusChip === c
                        ? "border-brand bg-brand text-white shadow-2xs"
                        : "border-line bg-surface text-muted hover:border-muted/50 hover:text-ink"
                    )}
                  >
                    {c === "ALL" ? "All" : ORDER_STATUS_LABELS[c as OrderStatusValue]}
                  </button>
                ))}
              </div>
            </div>

            {/* Orders Table */}
            <div className="overflow-x-auto max-h-[68vh]">
              <QueryBoundary
                isLoading={q.isLoading}
                isError={q.isError}
                error={q.error}
                isEmpty={orders.length === 0}
                emptyLabel="No sales orders yet. Click &ldquo;+ Create Sales Order&rdquo; to issue one."
              >
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-surface-2 text-[10.5px] font-extrabold uppercase tracking-wider text-muted sticky top-0 z-10 border-b border-line shadow-2xs">
                    <tr>
                      <th className="py-2.5 px-3">SO no.</th>
                      <th className="py-2.5 px-3 min-w-[180px]">Customer</th>
                      <th className="py-2.5 px-3 min-w-[180px]">Product SKU</th>
                      <th className="py-2.5 px-3 text-right">Qty</th>
                      <th className="py-2.5 px-3 text-right font-bold text-ink">Value</th>
                      {role !== "sales" && (
                        <th className="py-2.5 px-3">Salesperson</th>
                      )}
                      <th className="py-2.5 px-3">Issued</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line/60">
                    {orders.map((so) => {
                      const firstLine = so.items[0];
                      const totalQty = so.items.reduce((s, l) => s + l.qty, 0);

                      return (
                        <tr key={so.id} className="hover:bg-surface-2/70 transition-colors">
                          <td className="py-2.5 px-3 font-bold text-ink tabular-nums">{so.code}</td>
                          <td className="py-2.5 px-3 font-bold text-ink">{so.customerName}</td>
                          <td className="py-2.5 px-3 text-muted">
                            {firstLine ? firstLine.productName : "—"}
                            {so.items.length > 1 && ` (+${so.items.length - 1} more)`}
                          </td>
                          <td className="py-2.5 px-3 text-right tabular-nums font-semibold">{totalQty}</td>
                          {/* total is server-computed — rendered as-is, never recomputed. */}
                          <td className="py-2.5 px-3 text-right tabular-nums font-bold text-ink">
                            {inr(so.total)}
                          </td>
                          {role !== "sales" && (
                            <td className="py-2.5 px-3 text-muted">{so.salespersonName || "—"}</td>
                          )}
                          <td className="py-2.5 px-3 text-muted text-[11px] tabular-nums">
                            {fmtDT(so.createdAt)}
                          </td>
                          <td className="py-2.5 px-3">
                            <StatusBadge
                              label={ORDER_STATUS_LABELS[so.status as OrderStatusValue] ?? so.status}
                              tone={orderTone(so.status)}
                            />
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => setSelectedOrder(so)}
                                className="rounded-lg border border-line bg-surface px-2.5 py-1 text-xs font-bold text-ink hover:border-brand hover:text-brand transition-all cursor-pointer shadow-2xs"
                              >
                                View / Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => setPrintOrder(so)}
                                className="rounded-lg border border-line bg-surface px-2 py-1 text-xs text-muted hover:border-brand hover:text-brand transition-all cursor-pointer shadow-2xs"
                                title="Print commercial invoice"
                              >
                                <Printer className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </QueryBoundary>
            </div>

            {q.hasNextPage && (
              <div className="p-3 border-t border-line flex justify-center">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => q.fetchNextPage()}
                  disabled={q.isFetchingNextPage}
                >
                  {q.isFetchingNextPage && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}
                  Load more
                </Button>
              </div>
            )}
          </div>
        ) : (
          /* Fulfilment Report Tab — aggregates over every filtered order, so
             all remaining pages are fetched first (see the effect above);
             this banner is the only state where the numbers are partial. */
          <div className="p-4 space-y-4">
            {reportStillLoading && (
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-muted">
                <Loader2 className="h-3 w-3 animate-spin" />
                Loading full report… ({orders.length} orders so far)
              </div>
            )}

            {/* 5 KPI Cards */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              <div className="rounded-xl border border-line bg-surface p-3 shadow-xs">
                <div className="text-[10.5px] font-bold uppercase tracking-wider text-muted">Avg acknowledgement time</div>
                <div className="text-lg font-black text-ink mt-1 tabular-nums">{fmtDur(avg(durAck))}</div>
              </div>
              <div className="rounded-xl border border-line bg-surface p-3 shadow-xs">
                <div className="text-[10.5px] font-bold uppercase tracking-wider text-muted">Avg warehouse prep time</div>
                <div className="text-lg font-black text-ink mt-1 tabular-nums">{fmtDur(avg(durPrep))}</div>
              </div>
              <div className="rounded-xl border border-line bg-surface p-3 shadow-xs">
                <div className="text-[10.5px] font-bold uppercase tracking-wider text-muted">Avg transit time</div>
                <div className="text-lg font-black text-ink mt-1 tabular-nums">{fmtDur(avg(durTransit))}</div>
              </div>
              <div className="rounded-xl border border-brand/40 bg-brand-soft p-3 shadow-xs">
                <div className="text-[10.5px] font-bold uppercase tracking-wider text-brand-ink">Avg order → delivery</div>
                <div className="text-lg font-black text-brand-ink mt-1 tabular-nums">{fmtDur(avg(durTotal))}</div>
              </div>
              <div
                className={cn(
                  "rounded-xl border p-3 shadow-xs",
                  delayedCount > 0 ? "border-red/40 bg-red-soft" : "border-line bg-surface"
                )}
              >
                <div className={cn("text-[10.5px] font-bold uppercase tracking-wider", delayedCount > 0 ? "text-red" : "text-muted")}>
                  Delayed deliveries
                </div>
                <div className={cn("text-lg font-black mt-1 tabular-nums", delayedCount > 0 ? "text-red" : "text-ink")}>
                  {delayedCount}
                </div>
              </div>
            </div>

            {/* Fulfilment SLA Table */}
            <div className="overflow-x-auto border border-line rounded-xl">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-surface-2 text-[10.5px] font-extrabold uppercase tracking-wider text-muted border-b border-line">
                  <tr>
                    <th className="py-2.5 px-3">SO no.</th>
                    <th className="py-2.5 px-3">Customer</th>
                    <th className="py-2.5 px-3">Issued</th>
                    <th className="py-2.5 px-3">Acknowledged</th>
                    <th className="py-2.5 px-3 text-right">Ack time</th>
                    <th className="py-2.5 px-3">Left warehouse</th>
                    <th className="py-2.5 px-3 text-right">Prep time</th>
                    <th className="py-2.5 px-3">Delivered</th>
                    <th className="py-2.5 px-3 text-right">Transit time</th>
                    <th className="py-2.5 px-3 text-right font-bold text-ink">Order→Delivery</th>
                    <th className="py-2.5 px-3">Customer receipt</th>
                    <th className="py-2.5 px-3 text-right">Confirm lag</th>
                    <th className="py-2.5 px-3 text-center">SLA</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/60">
                  {reportOrders.length === 0 ? (
                    <tr>
                      <td colSpan={13} className="py-12 text-center text-xs text-muted">
                        No orders to report yet.
                      </td>
                    </tr>
                  ) : (
                    reportOrders.map((so) => {
                      const created = so.createdAt ? new Date(so.createdAt).getTime() : 0;
                      const ackEntry = so.statusHistory.find((h) => h.status === "Acknowledged");
                      const prepEntry = so.statusHistory.find((h) => h.status === "DeliveredFromWarehouse");
                      const delvEntry = so.statusHistory.find((h) => h.status === "DeliveredToCustomer");
                      const recvEntry = so.statusHistory.find((h) => h.status === "CustomerReceiptConfirmed");

                      const ackTime = ackEntry ? new Date(ackEntry.at).getTime() : 0;
                      const prepTime = prepEntry ? new Date(prepEntry.at).getTime() : 0;
                      const delvTime = delvEntry ? new Date(delvEntry.at).getTime() : 0;
                      const recvTime = recvEntry ? new Date(recvEntry.at).getTime() : 0;

                      const isDelayed =
                        so.expectedDelivery &&
                        delvTime &&
                        delvTime > new Date(so.expectedDelivery).getTime();

                      return (
                        <tr key={so.id} className="hover:bg-surface-2/60 transition-colors">
                          <td className="py-2 px-3 font-bold text-ink tabular-nums">{so.code}</td>
                          <td className="py-2 px-3 font-semibold text-ink">{so.customerName}</td>
                          <td className="py-2 px-3 text-muted text-[11px] tabular-nums">{fmtDT(so.createdAt)}</td>
                          <td className="py-2 px-3 text-muted text-[11px] tabular-nums">{fmtDT(ackEntry?.at)}</td>
                          <td className="py-2 px-3 text-right tabular-nums text-muted">
                            {fmtDur(ackTime && created ? ackTime - created : null)}
                          </td>
                          <td className="py-2 px-3 text-muted text-[11px] tabular-nums">{fmtDT(prepEntry?.at)}</td>
                          <td className="py-2 px-3 text-right tabular-nums text-muted">
                            {fmtDur(prepTime && ackTime ? prepTime - ackTime : null)}
                          </td>
                          <td className="py-2 px-3 text-muted text-[11px] tabular-nums">{fmtDT(delvEntry?.at)}</td>
                          <td className="py-2 px-3 text-right tabular-nums text-muted">
                            {fmtDur(delvTime && prepTime ? delvTime - prepTime : null)}
                          </td>
                          <td className="py-2 px-3 text-right tabular-nums font-bold text-ink">
                            {fmtDur(delvTime && created ? delvTime - created : null)}
                          </td>
                          <td className="py-2 px-3 text-muted text-[11px] tabular-nums">{fmtDT(recvEntry?.at)}</td>
                          <td className="py-2 px-3 text-right tabular-nums text-muted">
                            {fmtDur(recvTime && delvTime ? recvTime - delvTime : null)}
                          </td>
                          <td className="py-2 px-3 text-center">
                            {isDelayed ? (
                              <span className="rounded bg-red-soft text-red px-2 py-0.5 text-[10px] font-bold">
                                Delayed
                              </span>
                            ) : delvTime ? (
                              <span className="rounded bg-brand-soft text-brand-ink px-2 py-0.5 text-[10px] font-bold">
                                On time
                              </span>
                            ) : (
                              <span className="text-muted">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Card>

      {/* Modals — customers/products are intentionally NOT passed to
          CreateSalesOrderModal (see the salespersonOptions comment above);
          it falls back to its own real-catalog fetch. */}
      <CreateSalesOrderModal
        open={showCreateSo}
        onClose={() => setShowCreateSo(false)}
        salespeople={salespersonOptions}
      />

      {selectedOrder && (
        <SalesOrderDetailModal
          open={!!selectedOrder}
          onClose={() => setSelectedOrder(null)}
          order={selectedOrder}
        />
      )}

      {printOrder && (
        <InvoicePrintModal
          open={!!printOrder}
          onClose={() => setPrintOrder(null)}
          order={printOrder}
        />
      )}
    </div>
  );
}
