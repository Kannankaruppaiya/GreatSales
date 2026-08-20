import { useMemo, useState } from "react";
import {
  FileSpreadsheet,
  LayoutList,
  MessageCircle,
  MessageSquare,
  Plus,
  Upload,
  X,
} from "lucide-react";
import { PAY_ZONES, type PayZone } from "@/data/constants";
import { useTrackerStore } from "@/store/trackerStore";
import { useUi } from "@/store/ui";
import { useAuthRole } from "@/store/auth";
import { useMockOwnerId } from "@/lib/mockOwner";
import { inr, lakhs } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button, Card } from "@/components/ui";
import { AddPaymentModal } from "@/components/modals/AddPaymentModal";
import { ImportPaymentsModal } from "@/components/modals/ImportPaymentsModal";
import { PaymentDetailModal } from "@/components/modals/PaymentDetailModal";
import { RemarksModal } from "@/components/modals/RemarksModal";
import { CustomerDrawer } from "@/components/CustomerDrawer";
import { toast } from "@/store/toastStore";
import type { Payment } from "@/data/types";

function agingDays(dateStr?: string | null): number | null {
  if (!dateStr) return null;
  const d = new Date(dateStr + "T00:00:00");
  const t = new Date();
  t.setHours(0, 0, 0, 0);
  if (isNaN(d.getTime())) return null;
  return Math.floor((t.getTime() - d.getTime()) / 86400000);
}

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
  "Red Zone": "bg-red-soft text-red border-red/30",
  "Yellow Zone": "bg-amber-soft text-amber border-amber/30",
  "Green Zone": "bg-brand-soft text-brand-ink border-brand/30",
  Blacklist: "bg-violet-soft text-violet border-violet/30",
  Unassigned: "bg-surface-2 text-muted border-line",
};

export default function PaymentsPage() {
  const { ownerFilter } = useUi();
  const role = useAuthRole();
  const ownerId = useMockOwnerId();
  const {
    payments,
    customers,
    users,
    updatePaymentField,
    updatePaymentZone,
    togglePaymentMail,
    addPaymentRemark,
    deletePayment,
  } = useTrackerStore();

  const [search, setSearch] = useState("");
  const [zoneChip, setZoneChip] = useState("ALL");
  const [tab, setTab] = useState<"list" | "report">("list");
  const [showAddPayment, setShowAddPayment] = useState(false);
  const [showImportExcel, setShowImportExcel] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [selectedRemarksPayment, setSelectedRemarksPayment] = useState<Payment | null>(null);
  const [selectedDrawerCustId, setSelectedDrawerCustId] = useState<string | null>(null);

  const canEdit = role !== "mgmt";
  const todayStr = new Date().toISOString().slice(0, 10);
  const salespeople = users.filter((u) => u.role === "sales");
  const userMap = useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);
  const custMap = useMemo(() => new Map(customers.map((c) => [c.name.toLowerCase(), c])), [customers]);

  // Filter scoped payments
  const scopedPayments = useMemo(() => {
    const q = search.trim().toLowerCase();
    return payments.filter((p) => {
      if (role === "sales" && p.ownerId !== ownerId) return false;
      if (ownerFilter !== "ALL" && p.ownerId !== ownerFilter) return false;

      if (zoneChip !== "ALL") {
        if (zoneChip === "Unassigned") {
          if (p.zone) return false;
        } else if (p.zone !== zoneChip) {
          return false;
        }
      }

      if (q) {
        const partyMatch = (p.customerName || "").toLowerCase().includes(q);
        const refMatch = (p.refNo || "").toLowerCase().includes(q);
        if (!partyMatch && !refMatch) return false;
      }
      return true;
    }).sort((a, b) => (agingDays(b.invoiceDate) || 0) - (agingDays(a.invoiceDate) || 0));
  }, [payments, role, ownerId, ownerFilter, zoneChip, search]);

  // KPI calculations
  const allScoped = useMemo(() => {
    return payments.filter((p) => {
      if (role === "sales" && p.ownerId !== ownerId) return false;
      if (ownerFilter !== "ALL" && p.ownerId !== ownerFilter) return false;
      return true;
    });
  }, [payments, role, ownerId, ownerFilter]);

  const totalPending = allScoped.reduce((s, p) => s + (p.pending || 0), 0);
  const redTotal = allScoped.filter((p) => p.zone === "Red Zone").reduce((s, p) => s + (p.pending || 0), 0);
  const over90Total = allScoped
    .filter((p) => {
      const d = agingDays(p.invoiceDate);
      return d != null && d > 90;
    })
    .reduce((s, p) => s + (p.pending || 0), 0);

  const fuTodayCount = allScoped.filter((p) => p.nextFollowUp && p.nextFollowUp <= todayStr).length;

  // Aging Reports Aggregation
  const buckets = ["0-30", "31-60", "61-90", "91-120", "121-150", "150+"];

  // 1. Zone-wise pending
  const zoneList = ["Red Zone", "Yellow Zone", "Green Zone", "Blacklist", "Unassigned"];
  const byZone: Record<string, { count: number; pending: number }> = {};
  zoneList.forEach((z) => (byZone[z] = { count: 0, pending: 0 }));
  allScoped.forEach((p) => {
    const z = p.zone || "Unassigned";
    if (!byZone[z]) byZone[z] = { count: 0, pending: 0 };
    byZone[z].count++;
    byZone[z].pending += p.pending || 0;
  });

  // 2. Salesperson-wise aging matrix
  const bySp: Record<string, Record<string, number> & { total: number }> = {};
  allScoped.forEach((p) => {
    const spName = userMap.get(p.ownerId)?.name || "Unassigned";
    if (!bySp[spName]) {
      bySp[spName] = { total: 0 };
      buckets.forEach((b) => (bySp[spName][b] = 0));
    }
    const b = agingBucket(agingDays(p.invoiceDate));
    bySp[spName][b] = (bySp[spName][b] || 0) + (p.pending || 0);
    bySp[spName].total += p.pending || 0;
  });
  const spRows = Object.entries(bySp).sort((a, b) => b[1].total - a[1].total);

  // 3. Organization-wise pending
  const byOrg: Record<string, { pending: number; count: number; oldest: number; zones: Set<string> }> = {};
  allScoped.forEach((p) => {
    const party = p.customerName || "Customer";
    if (!byOrg[party]) byOrg[party] = { pending: 0, count: 0, oldest: 0, zones: new Set() };
    byOrg[party].pending += p.pending || 0;
    byOrg[party].count++;
    const d = agingDays(p.invoiceDate) || 0;
    if (d > byOrg[party].oldest) byOrg[party].oldest = d;
    if (p.zone) byOrg[party].zones.add(p.zone);
  });
  const orgRows = Object.entries(byOrg).sort((a, b) => b[1].pending - a[1].pending);

  const handleSendWa = (p: Payment) => {
    const cust = custMap.get(p.customerName.toLowerCase());
    const phone = cust?.whatsapp || cust?.phone || "";
    const cleanPhone = phone.replace(/[^0-9]/g, "");
    const msg = encodeURIComponent(
      `Dear ${p.customerName},\n\nThis is a friendly reminder regarding pending invoice ${p.refNo} dated ${p.invoiceDate} for ₹${p.pending.toLocaleString("en-IN")}.\n\nPlease arrange for the clearance at your earliest convenience.\n\nThank you,\nGreatSales Accounts Team`
    );
    const url = cleanPhone
      ? `https://wa.me/${cleanPhone.startsWith("91") ? cleanPhone : "91" + cleanPhone}?text=${msg}`
      : `https://wa.me/?text=${msg}`;
    window.open(url, "_blank");
    toast.success("WhatsApp reminder dispatched");
  };

  return (
    <div className="space-y-4">
      {/* Top 4 KPI Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-line bg-surface p-3.5 shadow-xs">
          <div className="text-[10.5px] font-bold uppercase tracking-wider text-muted">Total pending</div>
          <div className="text-xl font-black text-ink mt-1 tabular-nums">{lakhs(totalPending)}</div>
          <div className="text-xs text-muted mt-0.5">{allScoped.length} invoices</div>
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
              <LayoutList className="h-3 w-3" /> Invoices ({scopedPayments.length})
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

          {role === "admin" && (
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

              <div className="flex items-center gap-1.5 overflow-x-auto">
                {["ALL", ...PAY_ZONES, "Unassigned"].map((z) => (
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
                    {z === "ALL" ? "All zones" : z}
                  </button>
                ))}
              </div>
            </div>

            {/* Invoices Table */}
            <div className="overflow-x-auto max-h-[68vh]">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-surface-2 text-[10.5px] font-extrabold uppercase tracking-wider text-muted sticky top-0 z-10 border-b border-line shadow-2xs">
                  <tr>
                    <th className="py-2.5 px-3">Ref no.</th>
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3 min-w-[210px]">Party</th>
                    <th className="py-2.5 px-3 text-right">Aging</th>
                    <th className="py-2.5 px-3 text-right">Opening</th>
                    <th className="py-2.5 px-3 text-right font-bold text-ink">Pending</th>
                    <th className="py-2.5 px-3 text-right">Received</th>
                    <th className="py-2.5 px-3">Salesperson</th>
                    <th className="py-2.5 px-3">Zone</th>
                    <th className="py-2.5 px-3 min-w-[140px]">Reason</th>
                    <th className="py-2.5 px-3 min-w-[120px]">Next follow-up</th>
                    <th className="py-2.5 px-3 text-center">Reminders</th>
                    <th className="py-2.5 px-3 text-center">Remarks</th>
                    <th className="py-2.5 px-3 text-center">WhatsApp</th>
                    {role === "admin" && <th className="py-2.5 px-2 w-8"></th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/60">
                  {scopedPayments.length === 0 ? (
                    <tr>
                      <td colSpan={15} className="py-16 text-center text-xs text-muted">
                        No invoices match this filter.
                      </td>
                    </tr>
                  ) : (
                    scopedPayments.map((p) => {
                      const days = agingDays(p.invoiceDate);
                      const bucket = agingBucket(days);
                      const toneCls = agingTone(days);
                      const cust = custMap.get(p.customerName.toLowerCase());

                      return (
                        <tr key={p.id} className="hover:bg-surface-2/70 transition-colors">
                          <td className="py-2.5 px-3 font-bold text-ink tabular-nums">{p.refNo}</td>
                          <td className="py-2.5 px-3 text-muted tabular-nums">{p.invoiceDate}</td>
                          <td className="py-2.5 px-3">
                            <button
                              type="button"
                              onClick={() => {
                                if (cust?.id || p.customerId) {
                                  setSelectedDrawerCustId(cust?.id || p.customerId || null);
                                }
                              }}
                              className="font-bold text-ink hover:text-brand hover:underline cursor-pointer text-left block"
                            >
                              {p.customerName}
                            </button>
                          </td>

                          {/* Aging badge */}
                          <td className="py-2.5 px-3 text-right">
                            <span className={cn("rounded-lg px-2 py-0.5 text-[11px] font-bold tabular-nums", toneCls)}>
                              {days != null ? `${days}d · ${bucket}` : "—"}
                            </span>
                          </td>

                          {/* Opening */}
                          <td className="py-2.5 px-3 text-right tabular-nums text-muted">{inr(p.amount)}</td>

                          {/* Pending */}
                          <td className="py-2.5 px-3 text-right tabular-nums font-bold text-ink">{inr(p.pending)}</td>

                          {/* Received */}
                          <td className="py-2.5 px-3 text-right tabular-nums text-muted">
                            {p.received ? inr(p.received) : "—"}
                          </td>

                          {/* Salesperson selector */}
                          <td className="py-2.5 px-3">
                            {canEdit ? (
                              <select
                                value={p.ownerId || ""}
                                onChange={(e) => {
                                  updatePaymentField(p.id, "ownerId", e.target.value);
                                  toast.info("Salesperson assigned");
                                }}
                                className="rounded-lg border border-line bg-surface px-2 py-1 text-xs text-ink max-w-[130px]"
                              >
                                <option value="">—</option>
                                {salespeople.map((s) => (
                                  <option key={s.id} value={s.id}>
                                    {s.name}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <span className="text-muted">{userMap.get(p.ownerId)?.name || "—"}</span>
                            )}
                          </td>

                          {/* Zone selector */}
                          <td className="py-2.5 px-3">
                            {canEdit ? (
                              <select
                                value={p.zone || ""}
                                onChange={(e) => {
                                  updatePaymentZone(p.id, e.target.value as PayZone);
                                  toast.info("Risk zone updated");
                                }}
                                className={cn(
                                  "rounded-lg border px-2 py-1 text-xs font-bold",
                                  ZONE_CLASSES[p.zone || "Unassigned"]
                                )}
                              >
                                <option value="">—</option>
                                {PAY_ZONES.map((z) => (
                                  <option key={z} value={z}>
                                    {z}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <span
                                className={cn(
                                  "rounded px-2 py-0.5 text-[11px] font-bold",
                                  ZONE_CLASSES[p.zone || "Unassigned"]
                                )}
                              >
                                {p.zone || "—"}
                              </span>
                            )}
                          </td>

                          {/* Reason input */}
                          <td className="py-2.5 px-3">
                            {canEdit ? (
                              <input
                                type="text"
                                value={p.delayReason || ""}
                                onChange={(e) => updatePaymentField(p.id, "delayReason", e.target.value)}
                                placeholder="e.g. MSME, pending signoff…"
                                className="w-full rounded-md border border-line bg-surface px-1.5 py-1 text-xs text-ink focus:outline-brand focus:border-brand"
                              />
                            ) : (
                              <span className="text-muted text-xs">{p.delayReason || "—"}</span>
                            )}
                          </td>

                          {/* Next follow-up */}
                          <td className="py-2.5 px-3">
                            {canEdit ? (
                              <input
                                type="date"
                                value={p.nextFollowUp || ""}
                                onChange={(e) => updatePaymentField(p.id, "nextFollowUp", e.target.value || null)}
                                className="rounded-md border border-line bg-surface px-1.5 py-1 text-xs text-ink tabular-nums w-32"
                              />
                            ) : (
                              <span className="text-muted tabular-nums">{p.nextFollowUp || "—"}</span>
                            )}
                          </td>

                          {/* 4 Mail Reminder chips */}
                          <td className="py-2.5 px-3 text-center">
                            <div className="flex items-center justify-center gap-1">
                              {(["mail1", "mail2", "mail3", "mail4"] as const).map((mk, mi) => (
                                <button
                                  key={mk}
                                  type="button"
                                  disabled={!canEdit}
                                  onClick={() => togglePaymentMail(p.id, mk)}
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

                          {/* Remarks button */}
                          <td className="py-2.5 px-3 text-center">
                            <button
                              type="button"
                              onClick={() => setSelectedRemarksPayment(p)}
                              className="rounded-lg border border-line bg-surface px-2.5 py-1 text-xs text-muted hover:border-brand hover:text-brand transition-all cursor-pointer inline-flex items-center gap-1 font-medium shadow-2xs"
                            >
                              <MessageSquare className="h-3 w-3" />
                              <span>Remarks</span>
                              {p.remarks && p.remarks.length > 0 && (
                                <span className="rounded-full bg-brand text-white px-1.5 py-0.2 text-[10px] font-bold">
                                  {p.remarks.length}
                                </span>
                              )}
                            </button>
                          </td>

                          {/* WhatsApp Reminder Direct Action */}
                          <td className="py-2.5 px-3 text-center">
                            <button
                              type="button"
                              onClick={() => handleSendWa(p)}
                              className="rounded-lg border border-emerald-600/30 bg-emerald-50 text-emerald-700 hover:bg-emerald-600 hover:text-white px-2 py-1 text-xs font-bold transition-colors cursor-pointer shadow-2xs inline-flex items-center gap-1"
                              title="Send WhatsApp payment reminder"
                            >
                              <MessageCircle className="h-3 w-3" /> Remind
                            </button>
                          </td>

                          {/* Delete action */}
                          {role === "admin" && (
                            <td className="py-2.5 px-2 text-center">
                              <button
                                type="button"
                                onClick={() => {
                                  if (confirm(`Delete invoice ${p.refNo}?`)) {
                                    deletePayment(p.id);
                                    toast.info("Invoice removed");
                                  }
                                }}
                                className="text-red/60 hover:text-red p-1 cursor-pointer"
                                title="Delete invoice"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </td>
                          )}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          /* Aging Reports View */
          <div className="p-4 space-y-6">
            {/* 1. Zone-wise pending */}
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-muted mb-2">Zone-wise pending</div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                {zoneList.map((z) => (
                  <div key={z} className={cn("rounded-xl border p-3 shadow-xs", ZONE_CLASSES[z])}>
                    <div className="text-[10.5px] font-bold uppercase tracking-wider">{z}</div>
                    <div className="text-lg font-black mt-1 tabular-nums">{lakhs(byZone[z]?.pending || 0)}</div>
                    <div className="text-xs opacity-80 mt-0.5">{byZone[z]?.count || 0} invoices</div>
                  </div>
                ))}
              </div>
            </div>

            {/* 2. Salesperson-wise aging matrix table */}
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

            {/* 3. Organization-wise pending */}
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
                                  {z}
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
      <CustomerDrawer
        customerId={selectedDrawerCustId}
        onClose={() => setSelectedDrawerCustId(null)}
      />

      {/* Modals */}
      <AddPaymentModal open={showAddPayment} onClose={() => setShowAddPayment(false)} />
      <ImportPaymentsModal open={showImportExcel} onClose={() => setShowImportExcel(false)} />

      {selectedPayment && (
        <PaymentDetailModal
          open={!!selectedPayment}
          onClose={() => setSelectedPayment(null)}
          payment={selectedPayment}
        />
      )}

      {selectedRemarksPayment && (
        <RemarksModal
          open={!!selectedRemarksPayment}
          onClose={() => setSelectedRemarksPayment(null)}
          title={`Remarks — ${selectedRemarksPayment.customerName} · ${selectedRemarksPayment.refNo}`}
          remarks={selectedRemarksPayment.remarks || []}
          onAddRemark={(text, user) => {
            addPaymentRemark(selectedRemarksPayment.id, text, user);
            toast.success("Remark added");
          }}
        />
      )}
    </div>
  );
}
