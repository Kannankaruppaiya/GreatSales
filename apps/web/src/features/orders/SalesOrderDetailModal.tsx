import { useEffect, useState } from "react";
import { Package } from "lucide-react";
import { Button, Dialog, Input } from "@/components/ui";
import { ApiError } from "@/lib/api";
import { inr } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useAuthRole } from "@/store/auth";
import { useUpdateOrder } from "@/features/orders/queries";
import {
  ORDER_STATUS_VALUES,
  ORDER_STATUS_LABELS,
  DELIVERY_MODE_LABELS,
  type OrderStatusValue,
  type OrderRow,
  type DeliveryModeValue,
} from "@/features/orders/types";

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

/**
 * The 6 non-cancelled stages of the fulfilment lifecycle, in order — used to
 * render the progression timeline and to compute "next status" for the
 * advance button. `Cancelled` is a terminal side-branch, not part of the
 * linear progression, so it's excluded here (see ORDER_STATUS_VALUES for the
 * full raw-enum list).
 */
const TIMELINE_STATUSES = ORDER_STATUS_VALUES.filter(
  (s) => s !== "Cancelled",
) as Exclude<OrderStatusValue, "Cancelled">[];

export function SalesOrderDetailModal({
  open,
  onClose,
  order,
}: {
  open: boolean;
  onClose: () => void;
  order: OrderRow | null;
}) {
  const role = useAuthRole();
  const update = useUpdateOrder();

  // The `order` prop is a snapshot the parent captured on row-click — it
  // does not re-render after a mutation invalidates the orders list (the
  // parent's `selectedOrder` state isn't wired back up to the refetched
  // rows). So a successful status advance/cancel updates this local copy
  // directly from the mutation's response instead, which keeps the timeline
  // and status badge live across a multi-step advance without needing the
  // modal to close and reopen. Resets whenever a different order is opened.
  const [liveOrder, setLiveOrder] = useState<OrderRow | null>(order);
  const [transporterInput, setTransporterInput] = useState(order?.transporterName || "");
  const [cancelReasonInput, setCancelReasonInput] = useState("");
  const [showCancelPrompt, setShowCancelPrompt] = useState(false);

  useEffect(() => {
    setLiveOrder(order);
    setTransporterInput(order?.transporterName || "");
  }, [order]);

  if (!liveOrder) return null;

  const canEdit = role !== "mgmt";
  const isCancelled = liveOrder.status === "Cancelled";
  const isDelivered = liveOrder.status === "CustomerReceiptConfirmed";

  // total/lineTotal are server-computed (see features/orders/types.ts) —
  // rendered exactly as received, never recomputed.
  const totalVal = liveOrder.total;
  const totalQty = liveOrder.items.reduce((s, l) => s + l.qty, 0);

  const currentIdx = TIMELINE_STATUSES.indexOf(liveOrder.status as (typeof TIMELINE_STATUSES)[number]);
  const nextStatus: OrderStatusValue | null =
    currentIdx >= 0 && currentIdx < TIMELINE_STATUSES.length - 1
      ? TIMELINE_STATUSES[currentIdx + 1]
      : null;

  const handleAdvance = async () => {
    if (!nextStatus) return;
    // Transporter capture only makes sense at the "assign delivery partner"
    // step; when supplied it also becomes the status-history note so the
    // trail records who was assigned, not just that the status changed.
    const isAssigningTransporter = nextStatus === "DeliveryPartnerAssigned" && transporterInput.trim();
    try {
      const updated = await update.mutateAsync({
        id: liveOrder.id,
        patch: {
          status: nextStatus,
          ...(isAssigningTransporter
            ? {
                transporterName: transporterInput.trim(),
                statusNote: `Transporter assigned: ${transporterInput.trim()}`,
              }
            : {}),
        },
      });
      setLiveOrder(updated);
    } catch {
      // Surfaced inline below via update.error.
    }
  };

  const handleCancel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cancelReasonInput.trim()) return;
    try {
      const updated = await update.mutateAsync({
        id: liveOrder.id,
        patch: { status: "Cancelled", cancelReason: cancelReasonInput.trim() },
      });
      setLiveOrder(updated);
      setShowCancelPrompt(false);
    } catch {
      // Surfaced inline below via update.error.
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2">
          <Package className="h-4 w-4 text-brand" />
          <span>Sales Order: {liveOrder.code}</span>
        </div>
      }
      description={`${liveOrder.customerName} · Total ${inr(totalVal)} · Status: ${ORDER_STATUS_LABELS[liveOrder.status as OrderStatusValue] ?? liveOrder.status}`}
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
            <div className="font-bold text-ink truncate mt-0.5">{liveOrder.customerName}</div>
            <div className="text-[11px] text-muted truncate">By {liveOrder.salespersonName}</div>
          </div>
          <div className="rounded-xl border border-line bg-surface-2 p-2.5">
            <div className="text-[10px] font-bold uppercase tracking-wider text-muted">Delivery Mode</div>
            <div className="font-bold text-ink mt-0.5">
              {liveOrder.deliveryMode
                ? (DELIVERY_MODE_LABELS[liveOrder.deliveryMode as DeliveryModeValue] ?? liveOrder.deliveryMode)
                : "Standard"}
            </div>
            <div className="text-[11px] text-brand font-semibold">{liveOrder.paymentTerms || "—"}</div>
          </div>
          <div className="rounded-xl border border-line bg-surface-2 p-2.5">
            <div className="text-[10px] font-bold uppercase tracking-wider text-muted">Priority & Date</div>
            <div className="font-bold text-ink mt-0.5">
              {liveOrder.isUrgent ? <span className="text-red font-bold">Urgent Delivery</span> : "Normal Delivery"}
            </div>
            <div className="text-[11px] text-muted">Exp: {fmtDT(liveOrder.expectedDelivery)}</div>
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
            {TIMELINE_STATUSES.map((st, idx) => {
              const hist = liveOrder.statusHistory.find((h) => h.status === st);
              const isPast = !!hist;
              const isCurrent = liveOrder.status === st;

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
                    {idx + 1}. {ORDER_STATUS_LABELS[st]}
                  </div>
                  <div className="text-[9.5px] text-muted leading-tight">
                    {hist ? fmtDT(hist.at) : "—"}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Action Controls to Advance Order */}
        {canEdit && !isCancelled && !isDelivered && nextStatus && (
          <div className="rounded-xl border border-line bg-surface-2 p-3.5 space-y-3">
            <div className="font-bold text-xs text-ink uppercase tracking-wider">
              Advance Order Fulfilment State
            </div>

            {nextStatus === "DeliveryPartnerAssigned" && (
              <div className="grid grid-cols-2 gap-2 mb-2">
                <Input
                  placeholder="Transporter Name (e.g. VRL Logistics)"
                  value={transporterInput}
                  onChange={(e) => setTransporterInput(e.target.value)}
                />
              </div>
            )}

            <div className="flex items-center justify-between">
              <span className="text-muted">
                Advance to <strong className="text-ink">{ORDER_STATUS_LABELS[nextStatus]}</strong>:
              </span>
              <Button size="sm" onClick={handleAdvance} disabled={update.isPending}>
                {update.isPending ? "Saving…" : `Mark as ${ORDER_STATUS_LABELS[nextStatus]}`}
              </Button>
            </div>

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
                  <Button size="xs" variant="danger" type="submit" disabled={update.isPending}>
                    Confirm Cancellation
                  </Button>
                </div>
              </form>
            )}

            {update.isError && (
              <p className="text-[11.5px] font-medium text-red">
                {update.error instanceof ApiError ? update.error.message : "Failed to update order."}
              </p>
            )}
          </div>
        )}

        {/* Cancellation Banner */}
        {isCancelled && (
          <div className="rounded-xl border border-red/40 bg-red-soft p-3 text-red">
            <div className="font-bold text-xs">Order Cancelled</div>
            <div className="text-xs mt-0.5">{liveOrder.cancelReason || "No cancellation reason logged."}</div>
          </div>
        )}

        {/* Order Product Lines — qty/price/lineTotal rendered exactly as
            the API returned them (lineTotal is server-computed). */}
        <div className="rounded-xl border border-line bg-surface p-3.5 space-y-2">
          <div className="text-xs font-bold text-ink uppercase tracking-wider">Ordered Products</div>
          <div className="divide-y divide-line/60">
            {liveOrder.items.map((l) => (
              <div key={l.id} className="py-2 flex items-center justify-between text-xs">
                <div>
                  <div className="font-bold text-ink">{l.productName}</div>
                  <div className="text-muted text-[11px]">
                    {l.qty} {l.unit || "units"} @ ₹{l.price}/{l.unit || "unit"}
                  </div>
                </div>
                <div className="font-bold text-ink tabular-nums">{inr(l.lineTotal)}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Dialog>
  );
}
