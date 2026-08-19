import { useMemo, useState } from "react";
import { MONTHS, projTone } from "../data/constants";
import { useTrackerStore } from "../store/trackerStore";
import { useUi } from "../store/ui";
import { inr } from "../lib/format";
import { cn } from "../lib/utils";
import { Button, Card } from "../components/ui";
import { StatusBadge } from "../components/StatusBadge";
import { LeadDetailModal } from "../components/modals/LeadDetailModal";
import { PaymentDetailModal } from "../components/modals/PaymentDetailModal";
import { FollowUpModal } from "../components/modals/FollowUpModal";
import { CustomerDrawer } from "../components/CustomerDrawer";
import { toast } from "../store/toastStore";
import type { Lead, Payment, Projection } from "../data/types";

function fmtDateLabel(d: string, todayStr: string): { label: string; isOver: boolean; isToday: boolean } {
  const isOver = d < todayStr;
  const isToday = d === todayStr;
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

  let label = d;
  if (isToday) label = "Today";
  else if (d === tomorrow) label = "Tomorrow";
  else {
    const dt = new Date(d + "T00:00:00");
    if (!isNaN(dt.getTime())) {
      label =
        dt.toLocaleDateString("en-IN", { weekday: "short", day: "2-digit", month: "short" }) +
        (isOver ? " (overdue)" : "");
    }
  }

  return { label, isOver, isToday };
}

export default function FollowUpsPage() {
  const { role, month, ownerFilter, ownerId, principalId } = useUi();
  const {
    projections,
    leads,
    payments,
    customers,
    products,
    users,
    addProjectionRemark,
    setProjectionFollowUp,
  } = useTrackerStore();

  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [selectedFuProj, setSelectedFuProj] = useState<Projection | null>(null);
  const [selectedDrawerCustId, setSelectedDrawerCustId] = useState<string | null>(null);

  const todayStr = new Date().toISOString().slice(0, 10);
  const monthLabel = MONTHS.find((m) => m.value === month)?.label ?? month;
  const userMap = useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);
  const custMap = useMemo(() => new Map(customers.map((c) => [c.id, c])), [customers]);
  const prodMap = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  // Combined follow-up items by date
  const combinedFollowUps = useMemo(() => {
    const items: {
      date: string;
      type: "Recurring" | "New Sales" | "Payment";
      name: string;
      sub: string;
      sp: string;
      onClick: () => void;
    }[] = [];

    // 1. Projections
    projections.forEach((p) => {
      if (p.month !== month || !p.nextFollowUp) return;
      if (["Confirmed", "Completed", "Lost", "Cancelled"].includes(p.status)) return;
      if (role === "sales" && p.ownerId !== ownerId) return;
      if (ownerFilter !== "ALL" && p.ownerId !== ownerFilter) return;

      const c = custMap.get(p.customerId);
      const pr = prodMap.get(p.productId);
      const sp = userMap.get(p.ownerId)?.name || "Sales Rep";

      items.push({
        date: p.nextFollowUp,
        type: "Recurring",
        name: c?.name || "Customer",
        sub: pr?.name || "Product",
        sp,
        onClick: () => setSelectedFuProj(p),
      });
    });

    // 2. Leads
    leads.forEach((l) => {
      if (!l.nextFollowUp) return;
      if (["Closed Won", "Closed Lost", "No Requirement or Cold"].includes(l.stage)) return;
      if (role === "sales" && l.ownerId !== ownerId) return;
      if (ownerFilter !== "ALL" && l.ownerId !== ownerFilter) return;

      const sp = userMap.get(l.ownerId)?.name || "Sales Rep";
      items.push({
        date: l.nextFollowUp,
        type: "New Sales",
        name: l.name,
        sub: l.stage,
        sp,
        onClick: () => setSelectedLead(l),
      });
    });

    // 3. Payments
    payments.forEach((p) => {
      if (!p.nextFollowUp) return;
      if (role === "sales" && p.ownerId !== ownerId) return;
      if (ownerFilter !== "ALL" && p.ownerId !== ownerFilter) return;

      const sp = userMap.get(p.ownerId)?.name || "Unassigned";
      items.push({
        date: p.nextFollowUp,
        type: "Payment",
        name: p.customerName || "Customer",
        sub: p.refNo || "Invoice",
        sp,
        onClick: () => setSelectedPayment(p),
      });
    });

    // Group by date
    const groups: Record<string, typeof items> = {};
    items.forEach((it) => {
      if (!groups[it.date]) groups[it.date] = [];
      groups[it.date].push(it);
    });

    return Object.entries(groups).sort((a, b) => (a[0] < b[0] ? -1 : 1));
  }, [projections, leads, payments, month, role, ownerId, ownerFilter, custMap, prodMap, userMap]);

  // Recurring follow-up queue for current month
  const recurringQueue = useMemo(() => {
    return projections
      .filter((p) => {
        if (p.month !== month) return false;
        if (role === "sales" && p.ownerId !== ownerId) return false;
        if (ownerFilter !== "ALL" && p.ownerId !== ownerFilter) return false;
        if (principalId !== "ALL") {
          const prod = prodMap.get(p.productId);
          if (prod?.principalId !== principalId) return false;
        }

        const openLine = p.projectedQty > 0 && !["Confirmed", "Completed", "Lost", "Cancelled"].includes(p.status);
        if (p.nextFollowUp) return true;
        if (openLine && (!p.remarks || p.remarks.length === 0)) return true;
        return false;
      })
      .map((p) => {
        const nx = p.nextFollowUp;
        let kind = 3; // uncontacted
        if (nx) {
          if (nx < todayStr) kind = 0; // overdue
          else if (nx === todayStr) kind = 1; // due today
          else kind = 2; // upcoming
        }
        return { p, kind, nx };
      })
      .sort((a, b) => a.kind - b.kind || ((a.nx || "9") < (b.nx || "9") ? -1 : 1));
  }, [projections, month, role, ownerId, ownerFilter, principalId, prodMap, todayStr]);

  const KCOL = ["bg-red", "bg-amber", "bg-blue", "bg-slate-400"];

  return (
    <div className="space-y-4">
      {/* Top Section: All Follow-ups by Date */}
      <Card className="p-0 overflow-hidden shadow-xs border-line">
        <div className="p-3.5 border-b border-line flex items-center justify-between bg-surface-2/40">
          <div className="font-bold text-sm text-ink">All Follow-Ups Agenda by Date</div>
          <span className="text-xs text-muted font-medium">Recurring + New Sales + Payments</span>
        </div>

        <div className="p-4 max-h-[44vh] overflow-y-auto space-y-4">
          {combinedFollowUps.length === 0 ? (
            <div className="text-center py-12 text-xs text-muted">
              No follow-ups scheduled. Set next follow-up dates from Projections, Leads, or Payments.
            </div>
          ) : (
            combinedFollowUps.map(([dateStr, items]) => {
              const { label, isOver, isToday } = fmtDateLabel(dateStr, todayStr);
              return (
                <div key={dateStr} className="space-y-2">
                  <div
                    className={cn(
                      "text-[10.5px] font-black uppercase tracking-wider pb-1 border-b border-line",
                      isOver ? "text-red" : isToday ? "text-brand font-black" : "text-muted"
                    )}
                  >
                    {label} ({items.length})
                  </div>

                  <div className="space-y-1.5">
                    {items.map((it, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-surface hover:bg-surface-2/80 border border-line/70 shadow-2xs transition-colors"
                      >
                        <span
                          className={cn(
                            "w-2.5 h-2.5 rounded-full shrink-0",
                            isOver ? "bg-red" : isToday ? "bg-amber" : "bg-blue"
                          )}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-xs text-ink truncate">{it.name}</div>
                          <div className="text-[11px] text-muted truncate">
                            <span className="font-semibold text-brand-ink">{it.type}</span> · {it.sub}
                            {role !== "sales" && ` · ${it.sp}`}
                          </div>
                        </div>
                        <Button variant="outline" size="sm" onClick={it.onClick} className="text-xs py-1 h-7">
                          Open Details
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </Card>

      {/* Bottom Section: Recurring sales follow-up queue */}
      <Card className="p-0 overflow-hidden shadow-xs border-line">
        <div className="p-3.5 border-b border-line flex items-center justify-between bg-surface-2/40">
          <div className="font-bold text-sm text-ink">
            Recurring sales follow-up queue — {monthLabel}
          </div>
          <span className="text-xs text-muted font-medium">{recurringQueue.length} items</span>
        </div>

        <div className="overflow-x-auto max-h-[50vh]">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-surface-2 text-[10.5px] font-extrabold uppercase tracking-wider text-muted sticky top-0 z-10 border-b border-line shadow-2xs">
              <tr>
                <th className="py-2.5 px-3 w-8"></th>
                <th className="py-2.5 px-3 min-w-[200px]">Customer</th>
                <th className="py-2.5 px-3">Principal</th>
                <th className="py-2.5 px-3 min-w-[160px]">Sub product</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3 text-right">Win Prob</th>
                <th className="py-2.5 px-3">Next date</th>
                <th className="py-2.5 px-3 min-w-[200px]">Last note</th>
                <th className="py-2.5 px-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line/60">
              {recurringQueue.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-16 text-center text-xs text-muted">
                    Nothing in the queue for this period.
                  </td>
                </tr>
              ) : (
                recurringQueue.map(({ p, kind, nx }) => {
                  const cust = custMap.get(p.customerId);
                  const prod = prodMap.get(p.productId);
                  const sp = userMap.get(p.ownerId)?.name || "—";
                  const lastRmk = p.remarks?.[0]?.text;

                  return (
                    <tr key={p.id} className="hover:bg-surface-2/70 transition-colors">
                      <td className="py-2 px-3">
                        <span className={cn("w-2.5 h-2.5 rounded-full block shadow-2xs", KCOL[kind])} />
                      </td>
                      <td className="py-2 px-3">
                        <button
                          type="button"
                          onClick={() => setSelectedDrawerCustId(p.customerId)}
                          className="font-bold text-ink hover:text-brand hover:underline cursor-pointer text-left block"
                        >
                          {cust?.name}
                        </button>
                        {role !== "sales" && <span className="text-[10.5px] text-muted block">{sp}</span>}
                      </td>
                      <td className="py-2 px-3 text-muted text-[11px] font-semibold">{prod?.principalName}</td>
                      <td className="py-2 px-3 font-semibold text-ink">{prod?.name}</td>
                      <td className="py-2 px-3">
                        <StatusBadge label={p.status || "—"} tone={projTone(p.status)} />
                      </td>
                      <td className="py-2 px-3 text-right tabular-nums text-muted font-bold">
                        {p.probability != null ? `${p.probability}%` : "—"}
                      </td>
                      <td className="py-2 px-3 tabular-nums text-muted font-semibold">{nx || "No follow-up yet"}</td>
                      <td className="py-2 px-3 text-muted text-xs truncate max-w-[260px]">
                        {lastRmk || "—"}
                      </td>
                      <td className="py-2 px-3 text-center">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedFuProj(p)}
                          className="text-xs py-1 h-7 font-bold shadow-2xs"
                        >
                          Log Note
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Customer 360 Drawer */}
      <CustomerDrawer
        customerId={selectedDrawerCustId}
        onClose={() => setSelectedDrawerCustId(null)}
      />

      {/* Modals */}
      {selectedFuProj && (
        <FollowUpModal
          open={!!selectedFuProj}
          onClose={() => setSelectedFuProj(null)}
          title={`${custMap.get(selectedFuProj.customerId)?.name} · ${prodMap.get(selectedFuProj.productId)?.name}`}
          subtitle={`${prodMap.get(selectedFuProj.productId)?.principalName} · Proj ${selectedFuProj.projectedQty || 0} units @ ₹${selectedFuProj.price || 0} = ${inr((selectedFuProj.projectedQty || 0) * (selectedFuProj.price || 0))} · Achieved ${selectedFuProj.achievedQty || 0} · Status: ${selectedFuProj.status || "—"}`}
          currentDate={selectedFuProj.nextFollowUp}
          currentProb={selectedFuProj.probability}
          currentStatus={selectedFuProj.status}
          remarks={selectedFuProj.remarks || []}
          onSave={(nextDate, note, prob, nextStatus) => {
            if (note) {
              addProjectionRemark(selectedFuProj.id, note, users.find((u) => u.id === ownerId)?.name || "Sales Rep");
            }
            setProjectionFollowUp(selectedFuProj.id, nextDate, undefined, prob, nextStatus);
            toast.success("Follow-up updated");
          }}
        />
      )}

      {selectedLead && (
        <LeadDetailModal
          open={!!selectedLead}
          onClose={() => setSelectedLead(null)}
          lead={selectedLead}
        />
      )}

      {selectedPayment && (
        <PaymentDetailModal
          open={!!selectedPayment}
          onClose={() => setSelectedPayment(null)}
          payment={selectedPayment}
        />
      )}
    </div>
  );
}
