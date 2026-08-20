import { useMemo, useState } from "react";
import {
  FileSpreadsheet,
  LayoutList,
  Plus,
  Printer,
} from "lucide-react";
import { SO_STATUSES, soTone } from "@/data/constants";
import { useTrackerStore } from "@/store/trackerStore";
import { useUi } from "@/store/ui";
import { useAuthRole } from "@/store/auth";
import { useMockOwnerId } from "@/lib/mockOwner";
import { inr } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button, Card } from "@/components/ui";
import { StatusBadge } from "@/components/StatusBadge";
import { CreateSalesOrderModal } from "@/features/orders/CreateSalesOrderModal";
import { SalesOrderDetailModal } from "@/features/orders/SalesOrderDetailModal.mock";
import { InvoicePrintModal } from "@/features/orders/InvoicePrintModal.mock";
import type { SalesOrder } from "@/data/types";

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

export default function OrdersPage() {
  const { ownerFilter } = useUi();
  const role = useAuthRole();
  const ownerId = useMockOwnerId();
  const { orders, users } = useTrackerStore();

  const [search, setSearch] = useState("");
  const [statusChip, setStatusChip] = useState("ALL");
  const [tab, setTab] = useState<"list" | "report">("list");
  const [showCreateSo, setShowCreateSo] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<SalesOrder | null>(null);
  const [printOrder, setPrintOrder] = useState<SalesOrder | null>(null);

  const isReadOnly = role === "mgmt";
  const showSp = role !== "sales";
  const userMap = useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);

  // Filter scoped orders
  const scopedOrders = useMemo(() => {
    const q = search.trim().toLowerCase();
    return orders
      .filter((o) => {
        if (role === "sales" && o.ownerId !== ownerId) return false;
        if (ownerFilter !== "ALL" && o.ownerId !== ownerFilter) return false;
        if (statusChip !== "ALL" && o.status !== statusChip) return false;
        if (q) {
          const cMatch = (o.customerName || "").toLowerCase().includes(q);
          const codeMatch = (o.code || "").toLowerCase().includes(q);
          const trMatch = (o.transporterName || "").toLowerCase().includes(q);
          if (!cMatch && !codeMatch && !trMatch) return false;
        }
        return true;
      })
      .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
  }, [orders, role, ownerId, ownerFilter, statusChip, search]);

  // Fulfillment report metrics
  const reportOrders = useMemo(() => {
    return orders.filter((o) => {
      if (role === "sales" && o.ownerId !== ownerId) return false;
      if (ownerFilter !== "ALL" && o.ownerId !== ownerFilter) return false;
      return o.status !== "Cancelled";
    });
  }, [orders, role, ownerId, ownerFilter]);

  const durAck: number[] = [];
  const durPrep: number[] = [];
  const durTransit: number[] = [];
  const durTotal: number[] = [];
  const durRecv: number[] = [];
  let delayedCount = 0;

  reportOrders.forEach((so) => {
    const created = so.createdAt ? new Date(so.createdAt).getTime() : 0;
    const ackEntry = so.history?.find((h) => h.status === "Acknowledged");
    const prepEntry = so.history?.find((h) => h.status === "Delivered from Warehouse");
    const delvEntry = so.history?.find((h) => h.status === "Delivered to Customer");
    const recvEntry = so.history?.find((h) => h.status === "Customer Receipt Confirmed");

    const ackTime = ackEntry ? new Date(ackEntry.timestamp).getTime() : 0;
    const prepTime = prepEntry ? new Date(prepEntry.timestamp).getTime() : 0;
    const delvTime = delvEntry ? new Date(delvEntry.timestamp).getTime() : 0;
    const recvTime = recvEntry ? new Date(recvEntry.timestamp).getTime() : 0;

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
              <LayoutList className="h-3 w-3" /> Orders ({scopedOrders.length})
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

          {!isReadOnly && tab === "list" && (
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

              <div className="flex items-center gap-1.5 overflow-x-auto">
                {["ALL", ...SO_STATUSES].map((c) => (
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
                    {c === "ALL" ? "All" : c}
                  </button>
                ))}
              </div>
            </div>

            {/* Orders Table */}
            <div className="overflow-x-auto max-h-[68vh]">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-surface-2 text-[10.5px] font-extrabold uppercase tracking-wider text-muted sticky top-0 z-10 border-b border-line shadow-2xs">
                  <tr>
                    <th className="py-2.5 px-3">SO no.</th>
                    <th className="py-2.5 px-3 min-w-[180px]">Customer</th>
                    <th className="py-2.5 px-3 min-w-[180px]">Product SKU</th>
                    <th className="py-2.5 px-3 text-right">Qty</th>
                    <th className="py-2.5 px-3 text-right font-bold text-ink">Value</th>
                    {showSp && <th className="py-2.5 px-3">Salesperson</th>}
                    <th className="py-2.5 px-3">Issued</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/60">
                  {scopedOrders.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-16 text-center text-xs text-muted">
                        No sales orders yet. Confirm a projection line and click &ldquo;+ Create SO&rdquo;.
                      </td>
                    </tr>
                  ) : (
                    scopedOrders.map((so) => {
                      const firstLine = so.lines[0];
                      const totalQty = so.lines.reduce((s, l) => s + l.qty, 0);
                      const totalVal = so.lines.reduce((s, l) => s + l.qty * l.price, 0);
                      const sp = userMap.get(so.ownerId)?.name || "—";

                      return (
                        <tr key={so.id} className="hover:bg-surface-2/70 transition-colors">
                          <td className="py-2.5 px-3 font-bold text-ink tabular-nums">{so.code}</td>
                          <td className="py-2.5 px-3 font-bold text-ink">{so.customerName}</td>
                          <td className="py-2.5 px-3 text-muted">
                            {firstLine ? firstLine.productName : "—"}
                            {so.lines.length > 1 && ` (+${so.lines.length - 1} more)`}
                          </td>
                          <td className="py-2.5 px-3 text-right tabular-nums font-semibold">{totalQty}</td>
                          <td className="py-2.5 px-3 text-right tabular-nums font-bold text-ink">
                            {inr(totalVal)}
                          </td>
                          {showSp && <td className="py-2.5 px-3 text-muted">{sp}</td>}
                          <td className="py-2.5 px-3 text-muted text-[11px] tabular-nums">
                            {fmtDT(so.createdAt)}
                          </td>
                          <td className="py-2.5 px-3">
                            <StatusBadge label={so.status} tone={soTone(so.status)} />
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
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          /* Fulfilment Report Tab */
          <div className="p-4 space-y-4">
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
                      const ackEntry = so.history?.find((h) => h.status === "Acknowledged");
                      const prepEntry = so.history?.find((h) => h.status === "Delivered from Warehouse");
                      const delvEntry = so.history?.find((h) => h.status === "Delivered to Customer");
                      const recvEntry = so.history?.find((h) => h.status === "Customer Receipt Confirmed");

                      const ackTime = ackEntry ? new Date(ackEntry.timestamp).getTime() : 0;
                      const prepTime = prepEntry ? new Date(prepEntry.timestamp).getTime() : 0;
                      const delvTime = delvEntry ? new Date(delvEntry.timestamp).getTime() : 0;
                      const recvTime = recvEntry ? new Date(recvEntry.timestamp).getTime() : 0;

                      const isDelayed =
                        so.expectedDelivery &&
                        delvTime &&
                        delvTime > new Date(so.expectedDelivery).getTime();

                      return (
                        <tr key={so.id} className="hover:bg-surface-2/60 transition-colors">
                          <td className="py-2 px-3 font-bold text-ink tabular-nums">{so.code}</td>
                          <td className="py-2 px-3 font-semibold text-ink">{so.customerName}</td>
                          <td className="py-2 px-3 text-muted text-[11px] tabular-nums">{fmtDT(so.createdAt)}</td>
                          <td className="py-2 px-3 text-muted text-[11px] tabular-nums">{fmtDT(ackEntry?.timestamp)}</td>
                          <td className="py-2 px-3 text-right tabular-nums text-muted">
                            {fmtDur(ackTime && created ? ackTime - created : null)}
                          </td>
                          <td className="py-2 px-3 text-muted text-[11px] tabular-nums">{fmtDT(prepEntry?.timestamp)}</td>
                          <td className="py-2 px-3 text-right tabular-nums text-muted">
                            {fmtDur(prepTime && ackTime ? prepTime - ackTime : null)}
                          </td>
                          <td className="py-2 px-3 text-muted text-[11px] tabular-nums">{fmtDT(delvEntry?.timestamp)}</td>
                          <td className="py-2 px-3 text-right tabular-nums text-muted">
                            {fmtDur(delvTime && prepTime ? delvTime - prepTime : null)}
                          </td>
                          <td className="py-2 px-3 text-right tabular-nums font-bold text-ink">
                            {fmtDur(delvTime && created ? delvTime - created : null)}
                          </td>
                          <td className="py-2 px-3 text-muted text-[11px] tabular-nums">{fmtDT(recvEntry?.timestamp)}</td>
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

      {/* Modals */}
      <CreateSalesOrderModal open={showCreateSo} onClose={() => setShowCreateSo(false)} />

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
