import { useState } from "react";
import { Package } from "lucide-react";
import { Button, Dialog, Input } from "../ui";
import { SO_STATUSES, type SoStatus } from "../../data/constants";
import { inr } from "../../lib/format";
import { cn } from "../../lib/utils";
import { useTrackerStore } from "../../store/trackerStore";
import { useUi } from "../../store/ui";
import type { SalesOrder } from "../../data/types";

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

export function SalesOrderDetailModal({
  open,
  onClose,
  order,
}: {
  open: boolean;
  onClose: () => void;
  order: SalesOrder | null;
}) {
  const { users, advanceSalesOrder, cancelSalesOrder } = useTrackerStore();
  const { role, ownerId } = useUi();

  if (!order) return null;

  const [transporterInput, setTransporterInput] = useState(order.transporterName || "");
  const [cancelReasonInput, setCancelReasonInput] = useState("");
  const [showCancelPrompt, setShowCancelPrompt] = useState(false);

  const canEdit = role !== "mgmt";
  const isCancelled = order.status === "Cancelled";
  const isDelivered = order.status === "Customer Receipt Confirmed";

  const totalVal = order.lines.reduce((s, l) => s + l.qty * l.price, 0);
  const totalQty = order.lines.reduce((s, l) => s + l.qty, 0);
  const salesperson = users.find((u) => u.id === order.ownerId)?.name || "Sales Rep";
  const currentUser = users.find((u) => u.id === ownerId)?.name || "User";

  const handleAdvance = (nextStatus: SoStatus) => {
    advanceSalesOrder(order.id, nextStatus, undefined, currentUser, {
      partner: transporterInput || undefined,
    });
  };

  const handleCancel = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cancelReasonInput.trim()) return;
    cancelSalesOrder(order.id, cancelReasonInput.trim(), currentUser);
    setShowCancelPrompt(false);
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2">
          <Package className="h-4 w-4 text-brand" />
          <span>Sales Order: {order.code}</span>
        </div>
      }
      description={`${order.customerName} · Total ${inr(totalVal)} · Status: ${order.status}`}
      maxWidth="max-w-2xl"
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onClose} type="button">
            Close
          </Button>
        </>
      }
    >
      <div className="space-y-4 text-xs">
        {/* 4-Box Summary Grid */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-line bg-surface-2 p-2.5">
            <div className="text-[10px] font-bold uppercase tracking-wider text-muted">Customer & Rep</div>
            <div className="font-bold text-ink truncate mt-0.5">{order.customerName}</div>
            <div className="text-[11px] text-muted truncate">By {salesperson}</div>
          </div>
          <div className="rounded-xl border border-line bg-surface-2 p-2.5">
            <div className="text-[10px] font-bold uppercase tracking-wider text-muted">Delivery Mode</div>
            <div className="font-bold text-ink mt-0.5">{order.deliveryMode || "Standard"}</div>
            <div className="text-[11px] text-brand font-semibold">{order.paymentTerm || order.paymentTerms || "30 Days Credit"}</div>
          </div>
          <div className="rounded-xl border border-line bg-surface-2 p-2.5">
            <div className="text-[10px] font-bold uppercase tracking-wider text-muted">Priority & Date</div>
            <div className="font-bold text-ink mt-0.5">
              {order.isUrgent ? <span className="text-red font-bold">Urgent Delivery</span> : "Normal Delivery"}
            </div>
            <div className="text-[11px] text-muted">Exp: {fmtDT(order.expectedDelivery)}</div>
          </div>
          <div className="rounded-xl border border-brand/40 bg-brand-soft p-2.5">
            <div className="text-[10px] font-bold uppercase tracking-wider text-brand-ink">Order Value</div>
            <div className="text-sm font-bold text-brand-ink mt-0.5 tabular-nums">{inr(totalVal)}</div>
            <div className="text-[11px] text-brand-ink/80">{totalQty} units ordered</div>
          </div>
        </div>

        {/* 6-Stage Timeline */}
        <div className="rounded-xl border border-line bg-surface p-3.5 space-y-3">
          <div className="text-xs font-bold text-ink uppercase tracking-wider">
            Fulfilment Progression Timeline
          </div>

          <div className="grid grid-cols-6 gap-1 text-center">
            {SO_STATUSES.map((st, idx) => {
              const hist = order.history?.find((h) => h.status === st);
              const isPast = !!hist;
              const isCurrent = order.status === st;

              return (
                <div key={st} className="space-y-1">
                  <div
                    className={cn(
                      "h-1.5 rounded-full transition-all",
                      isCurrent
                        ? "bg-brand ring-2 ring-brand/30"
                        : isPast
                        ? "bg-brand/80"
                        : "bg-surface-2"
                    )}
                  />
                  <div className="text-[10px] font-bold text-ink leading-tight">
                    {idx + 1}. {st}
                  </div>
                  <div className="text-[9.5px] text-muted leading-tight">
                    {hist ? fmtDT(hist.timestamp) : "—"}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Action Controls to Advance Order */}
        {canEdit && !isCancelled && !isDelivered && (
          <div className="rounded-xl border border-line bg-surface-2 p-3.5 space-y-3">
            <div className="font-bold text-xs text-ink uppercase tracking-wider">
              Advance Order Fulfilment State
            </div>

            {order.status === "Created" && (
              <div className="flex items-center justify-between">
                <span className="text-muted">Acknowledge sales order and queue for warehouse picking:</span>
                <Button size="sm" onClick={() => handleAdvance("Acknowledged")}>
                  Acknowledge Order
                </Button>
              </div>
            )}

            {order.status === "Acknowledged" && (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    placeholder="Transporter Name (e.g. VRL Logistics)"
                    value={transporterInput}
                    onChange={(e) => setTransporterInput(e.target.value)}
                  />
                </div>
                <div className="flex justify-end">
                  <Button size="sm" onClick={() => handleAdvance("Delivered from Warehouse")}>
                    Confirm Left Warehouse
                  </Button>
                </div>
              </div>
            )}

            {order.status === "Delivered from Warehouse" && (
              <div className="flex items-center justify-between">
                <span className="text-muted">Mark as delivered to customer doorstep:</span>
                <Button size="sm" onClick={() => handleAdvance("Delivered to Customer")}>
                  Confirm Delivered to Customer
                </Button>
              </div>
            )}

            {order.status === "Delivered to Customer" && (
              <div className="flex items-center justify-between">
                <span className="text-muted">Confirm customer physical goods receipt & sign-off:</span>
                <Button size="sm" onClick={() => handleAdvance("Customer Receipt Confirmed")}>
                  Confirm Customer Receipt
                </Button>
              </div>
            )}

            <div className="pt-2 border-t border-line flex items-center justify-between">
              <span className="text-muted">Need to cancel order due to stock out or client change?</span>
              <button
                type="button"
                onClick={() => setShowCancelPrompt(!showCancelPrompt)}
                className="text-red font-bold hover:underline cursor-pointer"
              >
                Cancel Order
              </button>
            </div>

            {showCancelPrompt && (
              <form onSubmit={handleCancel} className="p-3 bg-red-soft rounded-lg border border-red/30 space-y-2">
                <label className="text-[11px] font-bold text-red uppercase tracking-wider block">
                  Reason for Order Cancellation *
                </label>
                <Input
                  required
                  placeholder="e.g. Customer cancelled due to project delay"
                  value={cancelReasonInput}
                  onChange={(e) => setCancelReasonInput(e.target.value)}
                />
                <div className="flex justify-end gap-2">
                  <Button size="xs" variant="outline" type="button" onClick={() => setShowCancelPrompt(false)}>
                    Back
                  </Button>
                  <Button size="xs" variant="danger" type="submit">
                    Confirm Cancellation
                  </Button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* Cancellation Banner */}
        {isCancelled && (
          <div className="rounded-xl border border-red/40 bg-red-soft p-3 text-red">
            <div className="font-bold text-xs">Order Cancelled</div>
            <div className="text-xs mt-0.5">{order.cancelReason || "No cancellation reason logged."}</div>
          </div>
        )}

        {/* Order Product Lines */}
        <div className="rounded-xl border border-line bg-surface p-3.5 space-y-2">
          <div className="text-xs font-bold text-ink uppercase tracking-wider">Ordered Products</div>
          <div className="divide-y divide-line/60">
            {order.lines.map((l, i) => (
              <div key={i} className="py-2 flex items-center justify-between text-xs">
                <div>
                  <div className="font-bold text-ink">{l.productName}</div>
                  <div className="text-muted text-[11px]">
                    {l.qty} {l.unit || "units"} @ ₹{l.price}/{l.unit || "unit"}
                  </div>
                </div>
                <div className="font-bold text-ink tabular-nums">{inr(l.qty * l.price)}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Dialog>
  );
}
