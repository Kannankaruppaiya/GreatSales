import { useMemo, useState } from "react";
import {
  Boxes,
  Building2,
  CalendarClock,
  MessageCircle,
  Phone,
  Plus,
  Receipt,
  ShoppingCart,
  X,
} from "lucide-react";
import { useTrackerStore } from "@/store/trackerStore";
import { inr } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui";
import { TierBadge } from "@/components/StatusBadge";
import { AddMappingModal } from "@/components/modals/AddMappingModal";
import { CreateSalesOrderModal } from "@/components/modals/CreateSalesOrderModal";
import { FollowUpModal } from "@/components/modals/FollowUpModal";
import type { Projection } from "@/data/types";

export function CustomerDrawer({
  customerId,
  onClose,
}: {
  customerId: string | null;
  onClose: () => void;
}) {
  const {
    customers,
    products,
    projections,
    orders,
    payments,
    users,
    addProjectionRemark,
    setProjectionFollowUp,
  } = useTrackerStore();

  const [activeTab, setActiveTab] = useState<"projections" | "orders" | "payments">("projections");
  const [showAddMapping, setShowAddMapping] = useState(false);
  const [createSoProj, setCreateSoProj] = useState<Projection | null>(null);
  const [selectedFuProj, setSelectedFuProj] = useState<Projection | null>(null);

  const customer = useMemo(() => customers.find((c) => c.id === customerId), [customers, customerId]);
  const userMap = useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);
  const prodMap = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  // Customer projections
  const custProjections = useMemo(() => {
    if (!customerId) return [];
    return projections.filter((p) => p.customerId === customerId);
  }, [projections, customerId]);

  // Customer orders
  const custOrders = useMemo(() => {
    if (!customerId) return [];
    return orders.filter((o) => o.customerId === customerId);
  }, [orders, customerId]);

  // Customer payments
  const custPayments = useMemo(() => {
    if (!customerId || !customer) return [];
    return payments.filter(
      (p) =>
        p.customerId === customerId ||
        p.customerName.toLowerCase() === customer.name.toLowerCase()
    );
  }, [payments, customerId, customer]);

  if (!customer) return null;

  const totalCommitted = custProjections.reduce((s, p) => s + (p.projectedQty || 0) * (p.price || 0), 0);
  const totalAchieved = custProjections.reduce((s, p) => s + (p.achievedQty || 0) * (p.price || 0), 0);
  const totalPendingBalance = custPayments.reduce((s, p) => s + (p.pending || 0), 0);
  const assignedRep = userMap.get(customer.ownerId)?.name || "Sales Rep";

  const phoneClean = (customer.whatsapp || customer.phone || "").replace(/[^0-9]/g, "");

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-slate-950/40 backdrop-blur-xs transition-opacity animate-in fade-in"
        onClick={onClose}
      />

      {/* Drawer Panel */}
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-xl bg-surface border-l border-line shadow-2xl flex flex-col animate-in slide-in-from-right duration-250">
        {/* Drawer Header */}
        <div className="p-4 border-b border-line bg-surface-2/40 flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-soft border border-brand/30 text-brand font-bold shadow-xs">
              <Building2 className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-bold text-base text-ink truncate">{customer.name}</h3>
                <TierBadge tier={customer.tier || "Silver"} />
              </div>
              <div className="text-xs text-muted mt-0.5 flex items-center gap-2 flex-wrap">
                <span>Contact: <b className="text-ink">{customer.contactName || "Direct"}</b></span>
                <span>·</span>
                <span>Assigned: <b className="text-brand font-semibold">{assignedRep}</b></span>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="grid h-7 w-7 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-ink cursor-pointer transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Contact & Action Quick Bar */}
        <div className="px-4 py-2.5 bg-surface border-b border-line/60 flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-3 text-xs">
            {customer.phone && (
              <a
                href={`tel:${customer.phone}`}
                className="inline-flex items-center gap-1 text-muted hover:text-brand font-medium transition-colors"
              >
                <Phone className="h-3 w-3" /> {customer.phone}
              </a>
            )}
            {phoneClean && (
              <a
                href={`https://wa.me/${phoneClean.startsWith("91") ? phoneClean : "91" + phoneClean}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-emerald-600 hover:text-emerald-700 font-semibold transition-colors"
              >
                <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
              </a>
            )}
          </div>

          <div className="text-xs text-muted">
            Terms: <span className="font-semibold text-ink">{customer.paymentTerms || "30 Days Credit"}</span>
          </div>
        </div>

        {/* Financial KPI Summary */}
        <div className="grid grid-cols-3 gap-2 p-4 bg-surface-2/30 border-b border-line">
          <div className="rounded-xl border border-line bg-surface p-2.5 text-center shadow-2xs">
            <div className="text-[10px] font-bold uppercase tracking-wider text-muted">Committed (Aug)</div>
            <div className="text-sm font-bold text-ink mt-0.5 tabular-nums">{inr(totalCommitted)}</div>
          </div>
          <div className="rounded-xl border border-brand/30 bg-brand-soft p-2.5 text-center shadow-2xs">
            <div className="text-[10px] font-bold uppercase tracking-wider text-brand-ink">Achieved</div>
            <div className="text-sm font-bold text-brand-ink mt-0.5 tabular-nums">{inr(totalAchieved)}</div>
          </div>
          <div className={cn("rounded-xl border p-2.5 text-center shadow-2xs", totalPendingBalance > 0 ? "border-red/40 bg-red-soft" : "border-line bg-surface")}>
            <div className={cn("text-[10px] font-bold uppercase tracking-wider", totalPendingBalance > 0 ? "text-red" : "text-muted")}>
              Pending Balance
            </div>
            <div className={cn("text-sm font-bold mt-0.5 tabular-nums", totalPendingBalance > 0 ? "text-red" : "text-ink")}>
              {inr(totalPendingBalance)}
            </div>
          </div>
        </div>

        {/* Tab Selector */}
        <div className="px-4 border-b border-line bg-surface flex items-center gap-2">
          <button
            onClick={() => setActiveTab("projections")}
            className={cn(
              "py-2.5 px-3 text-xs font-bold border-b-2 transition-all cursor-pointer inline-flex items-center gap-1.5",
              activeTab === "projections"
                ? "border-brand text-brand"
                : "border-transparent text-muted hover:text-ink"
            )}
          >
            <Boxes className="h-3.5 w-3.5" />
            <span>Mapped SKUs ({custProjections.length})</span>
          </button>
          <button
            onClick={() => setActiveTab("orders")}
            className={cn(
              "py-2.5 px-3 text-xs font-bold border-b-2 transition-all cursor-pointer inline-flex items-center gap-1.5",
              activeTab === "orders"
                ? "border-brand text-brand"
                : "border-transparent text-muted hover:text-ink"
            )}
          >
            <ShoppingCart className="h-3.5 w-3.5" />
            <span>Sales Orders ({custOrders.length})</span>
          </button>
          <button
            onClick={() => setActiveTab("payments")}
            className={cn(
              "py-2.5 px-3 text-xs font-bold border-b-2 transition-all cursor-pointer inline-flex items-center gap-1.5",
              activeTab === "payments"
                ? "border-brand text-brand"
                : "border-transparent text-muted hover:text-ink"
            )}
          >
            <Receipt className="h-3.5 w-3.5" />
            <span>Invoices ({custPayments.length})</span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {activeTab === "projections" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-ink uppercase tracking-wider">
                  Recurring Projections & Mappings
                </span>
                <Button size="xs" variant="secondary" onClick={() => setShowAddMapping(true)}>
                  <Plus className="h-3 w-3 mr-1" /> Map New SKU
                </Button>
              </div>

              {custProjections.length === 0 ? (
                <div className="py-12 text-center text-xs text-muted border border-dashed border-line rounded-xl">
                  No products currently mapped for this customer.
                </div>
              ) : (
                <div className="space-y-2">
                  {custProjections.map((p) => {
                    const prod = prodMap.get(p.productId);
                    const pv = (p.projectedQty || 0) * (p.price || 0);
                    const av = (p.achievedQty || 0) * (p.price || 0);

                    return (
                      <div
                        key={p.id}
                        className="rounded-xl border border-line bg-surface p-3 space-y-2 shadow-2xs hover:border-brand transition-colors"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="font-bold text-xs text-ink">{prod?.name}</div>
                            <div className="text-[11px] text-muted">{prod?.principalName} · Rate: ₹{p.price}</div>
                          </div>
                          <span className="rounded bg-surface-2 border border-line px-2 py-0.5 text-[10.5px] font-bold text-ink">
                            {p.status || "Projection Created"}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-line/40">
                          <div>
                            <span className="text-muted text-[11px]">Projected:</span>{" "}
                            <b className="tabular-nums text-ink">{p.projectedQty} units ({inr(pv)})</b>
                          </div>
                          <div className="text-right">
                            <span className="text-muted text-[11px]">Achieved:</span>{" "}
                            <b className="tabular-nums text-brand">{p.achievedQty} units ({inr(av)})</b>
                          </div>
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-1 border-t border-line/40">
                          <button
                            type="button"
                            onClick={() => setSelectedFuProj(p)}
                            className="text-xs font-semibold text-muted hover:text-brand inline-flex items-center gap-1 cursor-pointer"
                          >
                            <CalendarClock className="h-3 w-3" /> Log follow-up
                          </button>
                          {(p.status === "Confirmed" || p.status === "Partially Confirmed") && (
                            <>
                              <span className="text-muted">·</span>
                              <button
                                type="button"
                                onClick={() => setCreateSoProj(p)}
                                className="text-xs font-bold text-brand hover:underline inline-flex items-center gap-1 cursor-pointer"
                              >
                                <Plus className="h-3 w-3" /> Create SO
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {activeTab === "orders" && (
            <div className="space-y-3">
              <div className="text-xs font-bold text-ink uppercase tracking-wider">
                Sales Orders History
              </div>

              {custOrders.length === 0 ? (
                <div className="py-12 text-center text-xs text-muted border border-dashed border-line rounded-xl">
                  No sales orders recorded yet.
                </div>
              ) : (
                <div className="space-y-2">
                  {custOrders.map((o) => {
                    const totalOVal = o.lines.reduce((s, l) => s + l.qty * l.price, 0);
                    return (
                      <div
                        key={o.id}
                        className="rounded-xl border border-line bg-surface p-3 space-y-1.5 shadow-2xs"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-xs text-ink">{o.code}</span>
                          <span className="rounded bg-brand-soft text-brand-ink px-2 py-0.5 text-[10.5px] font-bold">
                            {o.status}
                          </span>
                        </div>
                        <div className="text-xs text-muted">
                          {o.lines.map((l) => `${l.productName} (${l.qty})`).join(", ")}
                        </div>
                        <div className="flex items-center justify-between text-xs font-bold pt-1 border-t border-line/40">
                          <span className="text-muted">Total Order Value:</span>
                          <span className="text-ink tabular-nums">{inr(totalOVal)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {activeTab === "payments" && (
            <div className="space-y-3">
              <div className="text-xs font-bold text-ink uppercase tracking-wider">
                Outstanding & Settled Invoices
              </div>

              {custPayments.length === 0 ? (
                <div className="py-12 text-center text-xs text-muted border border-dashed border-line rounded-xl">
                  No outstanding payment records found.
                </div>
              ) : (
                <div className="space-y-2">
                  {custPayments.map((pmt) => (
                    <div
                      key={pmt.id}
                      className="rounded-xl border border-line bg-surface p-3 space-y-1.5 shadow-2xs"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-ink">{pmt.refNo}</span>
                        <span className="rounded bg-surface-2 border border-line px-2 py-0.5 text-[10px] font-bold text-ink">
                          {pmt.zone || "Green Zone"}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="text-muted text-[11px]">Invoice Date:</span>{" "}
                          <span className="text-ink tabular-nums">{pmt.invoiceDate}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-muted text-[11px]">Pending:</span>{" "}
                          <b className="text-red tabular-nums">{inr(pmt.pending)}</b>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Modals triggered from drawer */}
      {showAddMapping && (
        <AddMappingModal
          open={showAddMapping}
          onClose={() => setShowAddMapping(false)}
          initialCustomerId={customer.id}
        />
      )}

      {selectedFuProj && (
        <FollowUpModal
          open={!!selectedFuProj}
          onClose={() => setSelectedFuProj(null)}
          title={`${customer.name} · ${prodMap.get(selectedFuProj.productId)?.name}`}
          subtitle={`${prodMap.get(selectedFuProj.productId)?.principalName} · Proj ${selectedFuProj.projectedQty || 0} units @ ₹${selectedFuProj.price || 0} = ${inr((selectedFuProj.projectedQty || 0) * (selectedFuProj.price || 0))}`}
          currentDate={selectedFuProj.nextFollowUp}
          currentProb={selectedFuProj.probability}
          currentStatus={selectedFuProj.status}
          remarks={selectedFuProj.remarks || []}
          onSave={(nextDate, note, prob, nextStatus) => {
            if (note) {
              addProjectionRemark(selectedFuProj.id, note, users.find((u) => u.id === customer.ownerId)?.name || "Sales Rep");
            }
            setProjectionFollowUp(selectedFuProj.id, nextDate, undefined, prob, nextStatus);
          }}
        />
      )}

      {createSoProj && (
        <CreateSalesOrderModal
          open={!!createSoProj}
          onClose={() => setCreateSoProj(null)}
          initialCustomerId={createSoProj.customerId}
          initialProductId={createSoProj.productId}
          initialQty={createSoProj.achievedQty || createSoProj.projectedQty || 10}
          initialPrice={createSoProj.price}
          fromProjectionId={createSoProj.id}
        />
      )}
    </>
  );
}
