import { useMemo, useState } from "react";
import {
  Building2,
  Plus,
  ShoppingCart,
  TrendingUp,
} from "lucide-react";
import { MONTHS, projTone } from "../data/constants";
import { useTrackerStore } from "../store/trackerStore";
import { useUi } from "../store/ui";
import { inr, lakhs } from "../lib/format";
import { cn } from "../lib/utils";
import { Button, Card } from "../components/ui";
import { StatusBadge } from "../components/StatusBadge";
import { CompareLegend, GroupedBars } from "../components/charts";
import { LeadDetailModal } from "../components/modals/LeadDetailModal";
import { FollowUpModal } from "../components/modals/FollowUpModal";
import { CustomerDrawer } from "../components/CustomerDrawer";
import { AddLeadModal } from "../components/modals/AddLeadModal";
import { AddCustomerModal } from "../components/modals/AddCustomerModal";
import { CreateSalesOrderModal } from "../components/modals/CreateSalesOrderModal";
import { toast } from "../store/toastStore";
import type { Lead, Projection } from "../data/types";

export default function DashboardPage() {
  const { role, month, principalId, ownerFilter, ownerId } = useUi();
  const { customers, products, principals, projections, leads, users, addProjectionRemark, setProjectionFollowUp } =
    useTrackerStore();

  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [selectedFuProj, setSelectedFuProj] = useState<Projection | null>(null);
  const [selectedDrawerCustId, setSelectedDrawerCustId] = useState<string | null>(null);

  // Quick action modal states
  const [showAddLead, setShowAddLead] = useState(false);
  const [showAddCustomer, setShowAddCustomer] = useState(false);
  const [showCreateOrder, setShowCreateOrder] = useState(false);

  const monthLabel = MONTHS.find((m) => m.value === month)?.label ?? month;
  const isSalesRole = role === "sales";
  const todayStr = new Date().toISOString().slice(0, 10);

  const userMap = useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);
  const custMap = useMemo(() => new Map(customers.map((c) => [c.id, c])), [customers]);
  const prodMap = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  // Scoped projections
  const scopedProjections = useMemo(() => {
    return projections.filter((p) => {
      if (p.month !== month) return false;
      if (role === "sales" && p.ownerId !== ownerId) return false;
      if (ownerFilter !== "ALL" && p.ownerId !== ownerFilter) return false;
      if (principalId !== "ALL") {
        const prod = prodMap.get(p.productId);
        if (!prod || prod.principalId !== principalId) return false;
      }
      return true;
    });
  }, [projections, month, role, ownerId, ownerFilter, principalId, prodMap]);

  // Scoped leads
  const scopedLeads = useMemo(() => {
    return leads.filter((l) => {
      if (role === "sales" && l.ownerId !== ownerId) return false;
      if (ownerFilter !== "ALL" && l.ownerId !== ownerFilter) return false;
      if (principalId !== "ALL") {
        const hasPrincipal = (l.products || []).some((p) => p.principalId === principalId);
        if (!hasPrincipal) return false;
      }
      return true;
    });
  }, [leads, role, ownerId, ownerFilter, principalId]);

  // KPI Calculations
  const recurringCommitted = scopedProjections.reduce((s, p) => s + (p.projectedQty || 0) * (p.price || 0), 0);
  const recurringAchieved = scopedProjections.reduce((s, p) => s + (p.achievedQty || 0) * (p.price || 0), 0);
  const recPct = recurringCommitted > 0 ? (recurringAchieved / recurringCommitted) * 100 : null;

  const newSalesCommitted = scopedLeads
    .filter((l) => !["Closed Lost", "No Requirement or Cold"].includes(l.stage))
    .reduce((s, l) => s + (l.products || []).reduce((ps, p) => ps + (p.value || 0), 0), 0);
  const newSalesAchieved = scopedLeads
    .filter((l) => l.stage === "Closed Won")
    .reduce((s, l) => s + (l.products || []).reduce((ps, p) => ps + (p.value || 0), 0), 0);

  const totalCommitted = recurringCommitted + newSalesCommitted;
  const totalAchieved = recurringAchieved + newSalesAchieved;
  const totalPct = totalCommitted > 0 ? (totalAchieved / totalCommitted) * 100 : null;

  let fuDue = 0;
  let fuOverdue = 0;
  scopedProjections.forEach((p) => {
    if (!["Confirmed", "Completed", "Lost", "Cancelled"].includes(p.status) && p.nextFollowUp) {
      if (p.nextFollowUp < todayStr) fuOverdue++;
      else if (p.nextFollowUp === todayStr) fuDue++;
    }
  });
  scopedLeads.forEach((l) => {
    if (!["Closed Won", "Closed Lost", "No Requirement or Cold"].includes(l.stage) && l.nextFollowUp) {
      if (l.nextFollowUp < todayStr) fuOverdue++;
      else if (l.nextFollowUp === todayStr) fuDue++;
    }
  });

  // Salesperson Bar Chart Data
  const salespeople = users.filter((u) => u.role === "sales");
  const spChartItems = useMemo(() => {
    return salespeople.map((sp) => {
      const spProjs = projections.filter(
        (p) =>
          p.month === month &&
          p.ownerId === sp.id &&
          (principalId === "ALL" || prodMap.get(p.productId)?.principalId === principalId)
      );
      const spLeads = leads.filter(
        (l) =>
          l.ownerId === sp.id &&
          (principalId === "ALL" || (l.products || []).some((pr) => pr.principalId === principalId))
      );

      const cVal =
        spProjs.reduce((s, p) => s + (p.projectedQty || 0) * (p.price || 0), 0) +
        spLeads
          .filter((l) => !["Closed Lost", "No Requirement or Cold"].includes(l.stage))
          .reduce((s, l) => s + (l.products || []).reduce((ps, p) => ps + p.value, 0), 0);

      const aVal =
        spProjs.reduce((s, p) => s + (p.achievedQty || 0) * (p.price || 0), 0) +
        spLeads
          .filter((l) => l.stage === "Closed Won")
          .reduce((s, l) => s + (l.products || []).reduce((ps, p) => ps + p.value, 0), 0);

      return {
        label: sp.name,
        committed: cVal,
        achieved: aVal,
      };
    });
  }, [salespeople, projections, leads, month, principalId, prodMap]);

  // Oral Confirmation Deals
  const oralDeals = useMemo(() => {
    return scopedLeads.filter((l) => l.stage === "Negotiation / Oral Confirmation");
  }, [scopedLeads]);

  // Top Open Projections (for sales view)
  const topOpenProjections = useMemo(() => {
    return scopedProjections
      .filter((p) => p.projectedQty > 0 && !["Confirmed", "Completed", "Lost", "Cancelled"].includes(p.status))
      .sort((a, b) => (b.projectedQty * b.price) - (a.projectedQty * a.price))
      .slice(0, 10);
  }, [scopedProjections]);

  // Principal performance bars (Admin / Mgmt view)
  const principalStats = useMemo(() => {
    const map: Record<string, { name: string; committed: number; achieved: number }> = {};
    principals.forEach((pr) => (map[pr.id] = { name: pr.name, committed: 0, achieved: 0 }));

    scopedProjections.forEach((p) => {
      const prod = prodMap.get(p.productId);
      if (prod && map[prod.principalId]) {
        map[prod.principalId].committed += (p.projectedQty || 0) * (p.price || 0);
        map[prod.principalId].achieved += (p.achievedQty || 0) * (p.price || 0);
      }
    });

    return Object.values(map)
      .filter((pr) => pr.committed > 0 || pr.achieved > 0)
      .sort((a, b) => b.committed - a.committed);
  }, [principals, scopedProjections, prodMap]);

  // Customer category mix (Admin / Mgmt view)
  const categoryStats = useMemo(() => {
    const tiers = ["Platinum", "Gold", "Silver", "Brass"];
    const map: Record<string, { committed: number; achieved: number; count: number }> = {};
    tiers.forEach((t) => (map[t] = { committed: 0, achieved: 0, count: 0 }));

    scopedProjections.forEach((p) => {
      const c = custMap.get(p.customerId);
      const t = c?.tier || "Silver";
      if (map[t]) {
        map[t].committed += (p.projectedQty || 0) * (p.price || 0);
        map[t].achieved += (p.achievedQty || 0) * (p.price || 0);
      }
    });

    return tiers.map((t) => ({ tier: t, ...map[t] }));
  }, [scopedProjections, custMap]);

  return (
    <div className="space-y-5">
      {/* Enterprise Executive Banner with Quick Actions */}
      <div className="rounded-2xl border border-line bg-gradient-to-r from-surface via-surface to-brand-soft/30 p-5 shadow-xs flex items-center justify-between gap-4 flex-wrap">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="grid h-6 w-6 place-items-center rounded-lg bg-brand text-white shadow-2xs">
              <TrendingUp className="h-3.5 w-3.5" />
            </span>
            <span className="text-xs font-extrabold uppercase tracking-wider text-brand-ink">
              Commercial Sales Pulse · {monthLabel}
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-ink tracking-tight font-sans">
            Revenue Performance & Pipeline Tracker
          </h1>
          <p className="text-xs text-muted">
            Track commitments, actual realizations, hot deals, and overdue credit collections in real time.
          </p>
        </div>

        {role !== "mgmt" && (
          <div className="flex items-center gap-2 flex-wrap">
            <Button size="sm" onClick={() => setShowAddLead(true)}>
              <Plus className="h-3.5 w-3.5 mr-1" /> New Sales Lead
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setShowAddCustomer(true)}>
              <Building2 className="h-3.5 w-3.5 mr-1" /> Add Customer
            </Button>
            <Button size="sm" variant="outline" onClick={() => setShowCreateOrder(true)}>
              <ShoppingCart className="h-3.5 w-3.5 mr-1" /> Create Order
            </Button>
          </div>
        )}
      </div>

      {/* 6 Top KPI Cards with Visual Depth */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <div className="rounded-xl border border-line bg-surface p-3.5 shadow-xs hover:border-muted transition-colors">
          <div className="text-[10.5px] font-bold uppercase tracking-wider text-muted">Recurring committed</div>
          <div className="text-xl font-black text-ink mt-1 tabular-nums">{lakhs(recurringCommitted)}</div>
          <div className="text-xs text-muted mt-0.5">Achieved: {lakhs(recurringAchieved)}</div>
        </div>

        <div className="rounded-xl border border-brand/40 bg-brand-soft/70 p-3.5 shadow-xs">
          <div className="text-[10.5px] font-bold uppercase tracking-wider text-brand-ink">Recurring achieved</div>
          <div className="text-xl font-black text-brand-ink mt-1 tabular-nums">{lakhs(recurringAchieved)}</div>
          <div className="text-xs text-brand-ink/80 mt-0.5 font-semibold">
            {recPct != null ? `${recPct.toFixed(1)}% achieved` : "—"}
          </div>
        </div>

        <div className="rounded-xl border border-line bg-surface p-3.5 shadow-xs hover:border-muted transition-colors">
          <div className="text-[10.5px] font-bold uppercase tracking-wider text-muted">New sales committed</div>
          <div className="text-xl font-black text-ink mt-1 tabular-nums">{lakhs(newSalesCommitted)}</div>
          <div className="text-xs text-muted mt-0.5">Won: {lakhs(newSalesAchieved)}</div>
        </div>

        <div className="rounded-xl border border-line bg-surface p-3.5 shadow-xs hover:border-muted transition-colors">
          <div className="text-[10.5px] font-bold uppercase tracking-wider text-muted">Total committed</div>
          <div className="text-xl font-black text-ink mt-1 tabular-nums">{lakhs(totalCommitted)}</div>
          <div className="text-xs text-muted mt-0.5">Recurring + New sales</div>
        </div>

        <div className="rounded-xl border border-brand/40 bg-brand-soft/70 p-3.5 shadow-xs">
          <div className="text-[10.5px] font-bold uppercase tracking-wider text-brand-ink">Total achieved</div>
          <div className="text-xl font-black text-brand-ink mt-1 tabular-nums">{lakhs(totalAchieved)}</div>
          <div className="text-xs text-brand-ink/80 mt-0.5 font-semibold">
            {totalPct != null ? `${totalPct.toFixed(1)}% target` : "—"}
          </div>
        </div>

        <div className={cn("rounded-xl border p-3.5 shadow-xs transition-colors", fuOverdue > 0 ? "border-red/40 bg-red-soft/70" : "border-line bg-surface")}>
          <div className={cn("text-[10.5px] font-bold uppercase tracking-wider", fuOverdue > 0 ? "text-red" : "text-muted")}>
            Follow-ups due
          </div>
          <div className={cn("text-xl font-black mt-1 tabular-nums", fuOverdue > 0 ? "text-red" : "text-ink")}>
            {fuDue + fuOverdue}
          </div>
          <div className={cn("text-xs mt-0.5 font-semibold", fuOverdue > 0 ? "text-red" : "text-muted")}>
            {fuOverdue > 0 ? `${fuOverdue} overdue` : "All up to date"}
          </div>
        </div>
      </div>

      {isSalesRole ? (
        /* Sales Role Dashboard Views */
        <div className="space-y-5">
          {/* 1. Deals at Oral Confirmation */}
          <Card className="p-0 overflow-hidden shadow-xs border-line">
            <div className="p-3.5 border-b border-line flex items-center justify-between bg-surface-2/40">
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-ink">My deals at Oral Confirmation</span>
                <span className="rounded bg-brand-soft border border-brand/20 px-2 py-0.5 text-[10.5px] font-bold text-brand-ink">
                  High Probability
                </span>
              </div>
              <span className="text-xs text-muted font-medium">{oralDeals.length} deals</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-surface-2 text-[11px] font-bold uppercase tracking-wider text-muted border-b border-line">
                  <tr>
                    <th className="py-2.5 px-3">Customer</th>
                    <th className="py-2.5 px-3">Contact</th>
                    <th className="py-2.5 px-3">Mobile</th>
                    <th className="py-2.5 px-3 text-right">Value</th>
                    <th className="py-2.5 px-3">Next follow-up</th>
                    <th className="py-2.5 px-3">Expected closure</th>
                    <th className="py-2.5 px-3 text-center"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/60">
                  {oralDeals.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-xs text-muted">
                        No deals currently at Oral Confirmation stage.
                      </td>
                    </tr>
                  ) : (
                    oralDeals.map((l) => (
                      <tr key={l.id} className="hover:bg-surface-2/60 transition-colors">
                        <td className="py-2.5 px-3">
                          <button
                            type="button"
                            onClick={() => setSelectedLead(l)}
                            className="font-bold text-ink hover:text-brand hover:underline cursor-pointer text-left"
                          >
                            {l.name}
                          </button>
                        </td>
                        <td className="py-2.5 px-3 text-muted">{l.contactName || "—"}</td>
                        <td className="py-2.5 px-3 text-muted tabular-nums">{l.phone || "—"}</td>
                        <td className="py-2.5 px-3 text-right tabular-nums font-bold text-brand">
                          {inr((l.products || []).reduce((s, p) => s + (p.value || 0), 0))}
                        </td>
                        <td className="py-2.5 px-3 tabular-nums text-muted">{l.nextFollowUp || "—"}</td>
                        <td className="py-2.5 px-3 tabular-nums text-muted">{l.expClose || "—"}</td>
                        <td className="py-2.5 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => setSelectedLead(l)}
                            className="rounded-lg border border-line bg-surface px-2.5 py-1 text-xs font-bold text-ink hover:border-brand hover:text-brand cursor-pointer shadow-2xs transition-colors"
                          >
                            Open Deal
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          {/* 2. Top open projections */}
          <Card className="p-0 overflow-hidden shadow-xs border-line">
            <div className="p-3.5 border-b border-line flex items-center justify-between bg-surface-2/40">
              <div className="font-bold text-sm text-ink">Top open projections this month</div>
              <span className="text-xs text-muted font-medium">{topOpenProjections.length} lines</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-surface-2 text-[11px] font-bold uppercase tracking-wider text-muted border-b border-line">
                  <tr>
                    <th className="py-2.5 px-3">Customer</th>
                    <th className="py-2.5 px-3">Principal</th>
                    <th className="py-2.5 px-3">Sub product</th>
                    <th className="py-2.5 px-3 text-right">Proj value</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Next follow-up</th>
                    <th className="py-2.5 px-3 text-center"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/60">
                  {topOpenProjections.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-xs text-muted">
                        No open projections for this month.
                      </td>
                    </tr>
                  ) : (
                    topOpenProjections.map((p) => {
                      const c = custMap.get(p.customerId);
                      const pr = prodMap.get(p.productId);
                      return (
                        <tr key={p.id} className="hover:bg-surface-2/60 transition-colors">
                          <td className="py-2.5 px-3">
                            <button
                              type="button"
                              onClick={() => setSelectedDrawerCustId(p.customerId)}
                              className="font-bold text-ink hover:text-brand hover:underline cursor-pointer text-left"
                            >
                              {c?.name}
                            </button>
                          </td>
                          <td className="py-2.5 px-3 text-muted">{pr?.principalName}</td>
                          <td className="py-2.5 px-3 font-semibold text-ink">{pr?.name}</td>
                          <td className="py-2.5 px-3 text-right tabular-nums font-bold text-ink">
                            {inr((p.projectedQty || 0) * (p.price || 0))}
                          </td>
                          <td className="py-2.5 px-3">
                            <StatusBadge label={p.status || "—"} tone={projTone(p.status)} />
                          </td>
                          <td className="py-2.5 px-3 tabular-nums text-muted">{p.nextFollowUp || "—"}</td>
                          <td className="py-2.5 px-3 text-center">
                            <button
                              type="button"
                              onClick={() => setSelectedFuProj(p)}
                              className="rounded-lg border border-line bg-surface px-2.5 py-1 text-xs font-bold text-ink hover:border-brand hover:text-brand cursor-pointer shadow-2xs transition-colors"
                            >
                              Log Follow-Up
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      ) : (
        /* Admin & Management Dashboard Views */
        <div className="space-y-5">
          {/* 1. Committed vs achieved by salesperson chart */}
          <Card className="p-4 shadow-xs border-line">
            <div className="flex items-center justify-between mb-3">
              <div className="font-bold text-sm text-ink">
                Committed vs achieved by salesperson — {monthLabel}
              </div>
              <CompareLegend />
            </div>
            <div className="pt-2">
              <GroupedBars data={spChartItems} />
            </div>
          </Card>

          {/* 2. Deals at Oral Confirmation */}
          <Card className="p-0 overflow-hidden shadow-xs border-line">
            <div className="p-3.5 border-b border-line flex items-center justify-between bg-surface-2/40">
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-ink">Deals at Oral Confirmation stage</span>
                <span className="rounded bg-brand-soft border border-brand/20 px-2 py-0.5 text-[10.5px] font-bold text-brand-ink">
                  High Probability
                </span>
              </div>
              <span className="text-xs text-muted font-medium">{oralDeals.length} deals</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-surface-2 text-[11px] font-bold uppercase tracking-wider text-muted border-b border-line">
                  <tr>
                    <th className="py-2.5 px-3">Customer</th>
                    <th className="py-2.5 px-3">Salesperson</th>
                    <th className="py-2.5 px-3 text-right">Value</th>
                    <th className="py-2.5 px-3">Expected closure</th>
                    <th className="py-2.5 px-3 text-center"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/60">
                  {oralDeals.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-xs text-muted">
                        No deals currently at Oral Confirmation stage.
                      </td>
                    </tr>
                  ) : (
                    oralDeals.map((l) => {
                      const sp = userMap.get(l.ownerId)?.name || "—";
                      return (
                        <tr key={l.id} className="hover:bg-surface-2/60 transition-colors">
                          <td className="py-2.5 px-3">
                            <button
                              type="button"
                              onClick={() => setSelectedLead(l)}
                              className="font-bold text-ink hover:text-brand hover:underline cursor-pointer text-left"
                            >
                              {l.name}
                            </button>
                          </td>
                          <td className="py-2.5 px-3 text-muted">{sp}</td>
                          <td className="py-2.5 px-3 text-right tabular-nums font-bold text-brand">
                            {inr((l.products || []).reduce((s, p) => s + (p.value || 0), 0))}
                          </td>
                          <td className="py-2.5 px-3 tabular-nums text-muted">{l.expClose || "—"}</td>
                          <td className="py-2.5 px-3 text-center">
                            <button
                              type="button"
                              onClick={() => setSelectedLead(l)}
                              className="rounded-lg border border-line bg-surface px-2.5 py-1 text-xs font-bold text-ink hover:border-brand hover:text-brand cursor-pointer shadow-2xs transition-colors"
                            >
                              Open Deal
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          {/* 3. Principal Performance & Category Mix */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Principal Performance */}
            <Card className="p-4 shadow-xs border-line">
              <div className="font-bold text-sm text-ink mb-3">Principal performance this month</div>
              <div className="space-y-3">
                {principalStats.slice(0, 6).map((pr) => {
                  const achPct = pr.committed > 0 ? (pr.achieved / pr.committed) * 100 : 0;
                  return (
                    <div key={pr.name} className="space-y-1">
                      <div className="flex items-center justify-between text-xs font-bold">
                        <span className="text-ink">{pr.name}</span>
                        <span className="text-muted tabular-nums">
                          {inr(pr.achieved)} / {inr(pr.committed)} ({achPct.toFixed(0)}%)
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-surface-2 overflow-hidden">
                        <div
                          className="h-full bg-brand rounded-full transition-all"
                          style={{ width: `${Math.min(100, achPct)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>

            {/* Customer Category Mix */}
            <Card className="p-4 shadow-xs border-line">
              <div className="font-bold text-sm text-ink mb-3">Customer category mix</div>
              <div className="space-y-3">
                {categoryStats.map((c) => {
                  const achPct = c.committed > 0 ? (c.achieved / c.committed) * 100 : 0;
                  return (
                    <div key={c.tier} className="space-y-1">
                      <div className="flex items-center justify-between text-xs font-bold">
                        <span className="text-ink">{c.tier} Customers</span>
                        <span className="text-muted tabular-nums">
                          {inr(c.achieved)} / {inr(c.committed)} ({achPct.toFixed(0)}%)
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-surface-2 overflow-hidden">
                        <div
                          className="h-full bg-brand rounded-full transition-all"
                          style={{ width: `${Math.min(100, achPct)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* Modals & Drawers */}
      {selectedLead && (
        <LeadDetailModal
          open={!!selectedLead}
          onClose={() => setSelectedLead(null)}
          lead={selectedLead}
        />
      )}

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
            toast.success("Follow-up updated successfully");
          }}
        />
      )}

      <CustomerDrawer
        customerId={selectedDrawerCustId}
        onClose={() => setSelectedDrawerCustId(null)}
      />

      <AddLeadModal open={showAddLead} onClose={() => setShowAddLead(false)} />
      <AddCustomerModal open={showAddCustomer} onClose={() => setShowAddCustomer(false)} />
      <CreateSalesOrderModal open={showCreateOrder} onClose={() => setShowCreateOrder(false)} />
    </div>
  );
}
