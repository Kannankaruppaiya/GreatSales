import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Clock, Plus, Undo2, X } from "lucide-react";
import { Button, Dialog, Input, Select, Textarea } from "@/components/ui";
import { DateTimeField } from "@/components/DateField";
import { ApiError } from "@/lib/api";
import { inr } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useAuthRole } from "@/store/auth";
import { useDeleteOrder, useUpdateOrder } from "@/features/orders/queries";
import { useProducts, flattenProducts } from "@/features/products/queries";
import { DeleteAction } from "@/components/modals/DeleteAction";
import { RemarksPanel } from "@/features/remarks/RemarksPanel";
import { AttachmentsPanel } from "@/features/attachments/AttachmentsPanel";
import {
  ORDER_STATUS_VALUES,
  ORDER_STATUS_LABELS,
  DELIVERY_MODE_LABELS,
  DELIVERY_MODE_VALUES,
  type OrderStatusValue,
  type OrderRow,
} from "@/features/orders/types";

/**
 * One sales order, as the person chasing it needs to see it.
 *
 * The modal used to open on four read-only summary cards, three of which
 * repeated fields that are editable four hundred pixels further down, and none
 * of which answered the question somebody actually opens an order to ask: is
 * this going to be late? An order promised on the 29th and still sitting at
 * "Created" a fortnight later looked exactly like one delivered yesterday —
 * a neutral "Exp: 29 Aug" and nothing else. The Fulfilment SLA report could
 * not help either: it only counts a delivery as delayed once it has ARRIVED,
 * so an order that never turns up is invisible in both places.
 *
 * So the modal now leads with the verdict, the cards carry only what nothing
 * else owns, the controls that advance an order live inside the timeline they
 * advance, and the line items are editable while the order is still a draft.
 */

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

/** A span, in the coarsest unit that still says something useful. */
function fmtGap(ms: number): string {
  const mins = Math.max(0, Math.round(ms / 60000));
  if (mins < 60) return `${mins} min`;
  const hrs = Math.round(mins / 60);
  if (hrs < 48) return `${hrs} hour${hrs === 1 ? "" : "s"}`;
  const days = Math.round(hrs / 24);
  return `${days} day${days === 1 ? "" : "s"}`;
}

/**
 * The 6 non-cancelled stages of the fulfilment lifecycle, in order — used to
 * render the progression timeline and to compute "next status" for the
 * advance button. `Cancelled` is a terminal side-branch, not part of the
 * linear progression, so it's excluded here (see ORDER_STATUS_VALUES for the
 * full raw-enum list). It mirrors ORDER_LADDER in the API's order-engine,
 * which is what actually enforces the ladder.
 */
const TIMELINE_STATUSES = ORDER_STATUS_VALUES.filter(
  (s) => s !== "Cancelled",
) as Exclude<OrderStatusValue, "Cancelled">[];

/**
 * The LAST entry for a stage, not the first.
 *
 * An order may be stepped one rung back to undo a mis-click and then advanced
 * again, which leaves two entries for the same stage. The later one is the one
 * that happened.
 */
function lastEntry(o: OrderRow, status: OrderStatusValue) {
  for (let i = o.statusHistory.length - 1; i >= 0; i--) {
    if (o.statusHistory[i].status === status) return o.statusHistory[i];
  }
  return undefined;
}

type Commitment = {
  tone: "good" | "bad" | "neutral";
  headline: string;
  detail: string;
};

/** Where this order stands against what was promised. */
function commitmentOf(o: OrderRow): Commitment {
  if (o.status === "Cancelled") {
    return {
      tone: "bad",
      headline: "Order cancelled",
      detail: o.cancelReason || "No cancellation reason was logged.",
    };
  }

  const promised = o.expectedDelivery ? new Date(o.expectedDelivery).getTime() : null;
  const delivered = lastEntry(o, "DeliveredToCustomer");

  if (promised == null) {
    return {
      tone: "neutral",
      headline: "No delivery promise recorded",
      detail:
        "Set an expected delivery below — without one the Fulfilment SLA report has nothing to judge this order against.",
    };
  }

  if (delivered) {
    const gap = new Date(delivered.at).getTime() - promised;
    return gap > 0
      ? {
          tone: "bad",
          headline: `Delivered ${fmtGap(gap)} late`,
          detail: `Promised ${fmtDT(o.expectedDelivery)}, delivered ${fmtDT(delivered.at)}.`,
        }
      : {
          tone: "good",
          headline: `Delivered ${fmtGap(-gap)} inside the promise`,
          detail: `Promised ${fmtDT(o.expectedDelivery)}, delivered ${fmtDT(delivered.at)}.`,
        };
  }

  const now = Date.now();
  const stage = ORDER_STATUS_LABELS[o.status as OrderStatusValue] ?? o.status;
  return promised < now
    ? {
        tone: "bad",
        headline: `Overdue by ${fmtGap(now - promised)}`,
        detail: `Promised ${fmtDT(o.expectedDelivery)} and still at ${stage}.`,
      }
    : {
        tone: "neutral",
        headline: `Due in ${fmtGap(promised - now)}`,
        detail: `Promised ${fmtDT(o.expectedDelivery)}, currently at ${stage}.`,
      };
}

/**
 * An instant from the wire, as the local wall-clock string DateTimeField reads.
 *
 * `expectedDelivery` crosses as a full ISO instant, so slicing the first 16
 * characters off it would hand the control UTC — the promise a Chennai user
 * entered as 5:30 pm would reappear as 12:00 pm and be saved back as noon.
 */
function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const detailLabel = "text-2xs font-semibold text-muted uppercase tracking-wider block mb-1";
const cardLabel = "text-3xs font-bold uppercase tracking-wider text-muted";

/** One titled block, matching the shell the lead modal uses. */
function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-line bg-surface">
      <header className="flex items-center justify-between gap-2 border-b border-line bg-surface-2/60 px-3.5 py-2.5">
        <h4 className="text-2xs font-bold uppercase tracking-wider text-ink">{title}</h4>
        {action}
      </header>
      <div className="p-3.5">{children}</div>
    </section>
  );
}

/** The editable, non-status half of an order, as the form holds it. */
function detailsOf(o: OrderRow | null) {
  return {
    isUrgent: o?.isUrgent ?? false,
    deliveryMode: (o?.deliveryMode ?? "") as string,
    paymentTerms: o?.paymentTerms ?? "",
    expectedDelivery: toLocalInput(o?.expectedDelivery ?? null),
    deliveryAddress: o?.deliveryAddress ?? "",
    transporterName: o?.transporterName ?? "",
    lrNumber: o?.lrNumber ?? "",
    advanceAmount: o?.advanceAmount == null ? "" : String(o.advanceAmount),
    advanceRef: o?.advanceRef ?? "",
    deliveryInstructions: o?.deliveryInstructions ?? "",
  };
}

let lineSeq = 0;
type LineRow = {
  rowId: string;
  productId: string;
  qty: number;
  price: number;
  unit: string | null;
};
const linesOf = (o: OrderRow | null): LineRow[] =>
  (o?.items ?? []).map((i) => ({
    rowId: `line_${++lineSeq}`,
    productId: i.productId,
    qty: i.qty,
    price: i.price,
    unit: i.unit,
  }));

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
  const del = useDeleteOrder();

  // The `order` prop now tracks the refetched list — OrdersPage holds the
  // selected order's ID and reads the row back out of it (lib/useSelectedRow)
  // — so this local copy is no longer what keeps the modal honest. It is kept
  // because it is FASTER: a status advance paints the new rung from the
  // mutation's own response, without waiting for the list request behind it.
  // The effect below re-syncs from the prop when that request lands, so the
  // two can never end up telling different stories. Resets on a new order.
  const [liveOrder, setLiveOrder] = useState<OrderRow | null>(order);
  const [transporterInput, setTransporterInput] = useState(order?.transporterName || "");
  const [cancelReasonInput, setCancelReasonInput] = useState("");
  const [showCancelPrompt, setShowCancelPrompt] = useState(false);
  const [details, setDetails] = useState(() => detailsOf(order));
  const [lines, setLines] = useState<LineRow[]>(() => linesOf(order));

  useEffect(() => {
    setLiveOrder(order);
    setTransporterInput(order?.transporterName || "");
    setDetails(detailsOf(order));
    setLines(linesOf(order));
    setShowCancelPrompt(false);
  }, [order?.id, order?.updatedAt]);

  const canEdit = role !== "mgmt";
  const isDraft = liveOrder?.status === "Created";
  // Only fetched when the line editor can actually be used.
  const productsQuery = useProducts({}, { enabled: open && canEdit && isDraft });
  const catalog = flattenProducts(productsQuery.data);

  if (!liveOrder) return null;

  const isCancelled = liveOrder.status === "Cancelled";
  const commitment = commitmentOf(liveOrder);

  // subtotal/taxAmount/total/lineTotal are server-computed (see
  // features/orders/types.ts) — rendered exactly as received, never recomputed.
  // `total` is the GRAND total; the GST behind it is named rather than left
  // implied, because an order with GST and one without are a fifth apart and
  // the card used to show one figure for both.
  const totalVal = liveOrder.total;
  const totalQty = liveOrder.items.reduce((s, l) => s + l.qty, 0);
  const gstNote =
    liveOrder.taxMode === "Percentage"
      ? `${inr(liveOrder.subtotal)} + ${liveOrder.taxRate ?? 0}% GST`
      : liveOrder.taxMode === "Amount"
        ? `${inr(liveOrder.subtotal)} + ${inr(liveOrder.taxAmount)} GST`
        : "No GST";

  const currentIdx = TIMELINE_STATUSES.indexOf(liveOrder.status as (typeof TIMELINE_STATUSES)[number]);
  const nextStatus: OrderStatusValue | null =
    currentIdx >= 0 && currentIdx < TIMELINE_STATUSES.length - 1
      ? TIMELINE_STATUSES[currentIdx + 1]
      : null;
  // One rung back is a correction the API allows; two is a different order.
  const prevStatus: OrderStatusValue | null =
    currentIdx > 0 ? TIMELINE_STATUSES[currentIdx - 1] : null;

  const moveTo = async (status: OrderStatusValue, extra: Record<string, unknown> = {}) => {
    try {
      const updated = await update.mutateAsync({
        id: liveOrder.id,
        patch: { status, ...extra },
      });
      setLiveOrder(updated);
      setDetails(detailsOf(updated));
      setLines(linesOf(updated));
    } catch {
      // Surfaced inline below via update.error.
    }
  };

  const handleAdvance = async () => {
    if (!nextStatus) return;
    // Transporter capture only makes sense at the "assign delivery partner"
    // step; when supplied it also becomes the status-history note so the
    // trail records who was assigned, not just that the status changed.
    const assigning = nextStatus === "DeliveryPartnerAssigned" && transporterInput.trim();
    await moveTo(
      nextStatus,
      assigning
        ? {
            transporterName: transporterInput.trim(),
            statusNote: `Transporter assigned: ${transporterInput.trim()}`,
          }
        : {},
    );
  };

  /**
   * Save the delivery and commercial half of the order.
   *
   * Every one of these fields was already accepted by OrderUpdateSchema and
   * none of them had a control anywhere in the product: an order's payment
   * terms, advance, transporter, LR number, delivery address, instructions and
   * — the one the Fulfilment SLA report is judged on — its expected delivery
   * were fixed at the moment the order was typed.
   *
   * Only what actually moved is sent, so opening and closing this panel is not
   * a write.
   */
  const handleSaveDetails = async () => {
    const patch: Record<string, unknown> = {};
    const scalar = <T,>(key: string, now: T, was: T) => {
      if (now !== was) patch[key] = now;
    };
    scalar("isUrgent", details.isUrgent, liveOrder.isUrgent);
    scalar("deliveryMode", details.deliveryMode || null, liveOrder.deliveryMode);
    scalar("paymentTerms", details.paymentTerms.trim() || null, liveOrder.paymentTerms);
    scalar("deliveryAddress", details.deliveryAddress.trim() || null, liveOrder.deliveryAddress);
    scalar("transporterName", details.transporterName.trim() || null, liveOrder.transporterName);
    scalar("lrNumber", details.lrNumber.trim() || null, liveOrder.lrNumber);
    scalar("advanceRef", details.advanceRef.trim() || null, liveOrder.advanceRef);
    scalar(
      "deliveryInstructions",
      details.deliveryInstructions.trim() || null,
      liveOrder.deliveryInstructions,
    );

    const advance = details.advanceAmount.trim() === "" ? null : Number(details.advanceAmount);
    if (advance !== null && (isNaN(advance) || advance < 0)) return;
    scalar("advanceAmount", advance, liveOrder.advanceAmount ?? null);

    // Sent as a real instant. DateTimeField reports local wall-clock time, and
    // handing that to the server bare would have it re-read in the SERVER's
    // zone — a promise five and a half hours off for every order.
    const nextExpected = details.expectedDelivery
      ? new Date(details.expectedDelivery).toISOString()
      : null;
    if (nextExpected !== (liveOrder.expectedDelivery ?? null)) {
      patch.expectedDelivery = nextExpected;
    }

    if (Object.keys(patch).length === 0) return;

    try {
      const updated = await update.mutateAsync({ id: liveOrder.id, patch });
      setLiveOrder(updated);
      setDetails(detailsOf(updated));
      setTransporterInput(updated.transporterName || "");
    } catch {
      // Surfaced inline below via update.error.
    }
  };

  const setLine = (idx: number, patch: Partial<LineRow>) =>
    setLines((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));

  const pickProduct = (idx: number, productId: string) => {
    const prod = catalog.find((p) => p.id === productId);
    setLine(idx, {
      productId,
      unit: prod?.unit ?? null,
      price: prod?.basePrice ?? lines[idx].price,
    });
  };

  /**
   * What the server will compute for these lines, under the GST treatment the
   * order ALREADY carries — the line editor does not change the tax mode, so
   * previewing a bare line sum here made every edit look like it knocked the
   * GST off the order.
   */
  const draftSubtotalPaise = lines.reduce(
    (s, r) => s + Math.round((Number(r.qty) || 0) * (Number(r.price) || 0) * 100),
    0,
  );
  const draftTaxPaise =
    liveOrder.taxMode === "Percentage"
      ? Math.round((draftSubtotalPaise * (liveOrder.taxRate ?? 0)) / 100)
      : liveOrder.taxMode === "Amount"
        ? Math.round(liveOrder.taxAmount * 100)
        : 0;
  const draftSubtotal = draftSubtotalPaise / 100;
  const draftTotal = (draftSubtotalPaise + draftTaxPaise) / 100;
  const linesChanged =
    JSON.stringify(liveOrder.items.map((i) => [i.productId, i.qty, i.price])) !==
    JSON.stringify(lines.map((r) => [r.productId, Number(r.qty) || 0, Number(r.price) || 0]));

  /**
   * Replace the order's line items.
   *
   * The API accepts this only while the order is still `Created`: once the
   * warehouse has acknowledged it the quantities are a commitment somebody is
   * acting on. Before this existed, a mistyped quantity meant deleting the
   * order and raising it again — losing its number, its trail, its remarks and
   * its attachments with it.
   */
  const handleSaveLines = async () => {
    const payload = lines
      .filter((r) => r.productId && Number(r.qty) > 0)
      .map((r) => ({
        productId: r.productId,
        qty: Number(r.qty),
        price: Number(r.price) || 0,
        unit: r.unit ?? undefined,
      }));
    if (payload.length === 0) return;
    try {
      const updated = await update.mutateAsync({
        id: liveOrder.id,
        patch: { items: payload },
      });
      setLiveOrder(updated);
      setLines(linesOf(updated));
    } catch {
      // Surfaced inline below via update.error.
    }
  };

  const handleCancel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cancelReasonInput.trim()) return;
    await moveTo("Cancelled", { cancelReason: cancelReasonInput.trim() });
    setShowCancelPrompt(false);
  };

  const CommitmentIcon =
    commitment.tone === "bad" ? AlertTriangle : commitment.tone === "good" ? CheckCircle2 : Clock;

  const errorLine = update.isError && (
    <p role="alert" className="text-2xs font-medium text-red">
      {update.error instanceof ApiError ? update.error.message : "Failed to update order."}
    </p>
  );

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`Sales Order: ${liveOrder.code}`}
      description={`${liveOrder.customerName} · ${ORDER_STATUS_LABELS[liveOrder.status as OrderStatusValue] ?? liveOrder.status} · ${inr(totalVal)}`}
      maxWidth="max-w-3xl"
      footer={
        <>
          {canEdit && (
            <DeleteAction
              label="Delete Order"
              title={`Delete ${liveOrder.code}?`}
              body="The order and its line items are removed, and it stops counting towards achievement. To keep the record for reporting, set the status to Cancelled instead."
              onDelete={() => del.mutateAsync(liveOrder.id)}
              onDeleted={onClose}
            />
          )}
          <Button variant="outline" size="sm" onClick={onClose} type="button">
            Close
          </Button>
        </>
      }
    >
      <div className="space-y-3.5 text-xs">
        {/* The verdict, first. This is the question an order is opened to ask. */}
        <div
          className={cn(
            "flex items-start gap-2.5 rounded-xl border p-3.5",
            commitment.tone === "bad" && "border-red/40 bg-red-soft",
            commitment.tone === "good" && "border-brand/30 bg-brand-soft",
            commitment.tone === "neutral" && "border-line bg-surface-2",
          )}
        >
          <CommitmentIcon
            className={cn(
              "mt-0.5 h-4 w-4 shrink-0",
              commitment.tone === "bad" && "text-red",
              commitment.tone === "good" && "text-brand",
              commitment.tone === "neutral" && "text-muted",
            )}
          />
          <div className="min-w-0">
            <div
              className={cn(
                "text-sm font-bold",
                commitment.tone === "bad" ? "text-red" : "text-ink",
              )}
            >
              {commitment.headline}
            </div>
            <p className="mt-0.5 text-2xs text-muted">{commitment.detail}</p>
          </div>
        </div>

        {/* Three cards, and none of them repeats a field the editor below owns. */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-line bg-surface-2 p-2.5">
            <div className={cardLabel}>Customer &amp; rep</div>
            <div className="mt-0.5 truncate font-bold text-ink">{liveOrder.customerName}</div>
            <div className="truncate text-2xs text-muted">By {liveOrder.salespersonName}</div>
          </div>
          <div className="rounded-xl border border-line bg-surface-2 p-2.5">
            <div className={cardLabel}>Issued</div>
            <div className="mt-0.5 font-bold text-ink tabular-nums">{fmtDT(liveOrder.date)}</div>
            <div className="truncate text-2xs text-muted">
              {liveOrder.isUrgent ? "Urgent delivery" : "Standard delivery"}
            </div>
          </div>
          <div className="rounded-xl border border-brand/40 bg-brand-soft p-2.5">
            <div className={cn(cardLabel, "text-brand-ink")}>Order value</div>
            <div className="mt-0.5 text-sm font-bold tabular-nums text-brand-ink">{inr(totalVal)}</div>
            <div className="truncate text-2xs text-brand-ink/80">{gstNote}</div>
            <div className="text-2xs text-brand-ink/80">{totalQty} units ordered</div>
          </div>
        </div>

        {/* The ladder, with the controls that move it. An action belongs beside
            the thing it acts on, not in a box of its own below. */}
        <Section title="Fulfilment Progression">
          <div className="grid grid-cols-3 gap-2 text-center sm:grid-cols-6">
            {TIMELINE_STATUSES.map((st, idx) => {
              const hist = lastEntry(liveOrder, st);
              const isCurrent = liveOrder.status === st;
              const prev = idx > 0 ? lastEntry(liveOrder, TIMELINE_STATUSES[idx - 1]) : undefined;
              const gap =
                hist && prev ? new Date(hist.at).getTime() - new Date(prev.at).getTime() : null;

              return (
                <div key={st} className="space-y-1">
                  <div
                    className={cn(
                      "h-1.5 rounded-full transition-all",
                      isCurrent
                        ? "bg-brand ring-2 ring-brand/30"
                        : hist
                          ? "bg-brand/80"
                          : "bg-surface-2",
                    )}
                  />
                  <div className="text-3xs font-bold leading-tight text-ink">
                    {idx + 1}. {ORDER_STATUS_LABELS[st]}
                  </div>
                  <div className="text-3xs leading-tight text-muted">
                    {hist ? fmtDT(hist.at) : "—"}
                  </div>
                  {/* The gap between rungs IS what the SLA report averages. */}
                  {gap != null && (
                    <div className="text-3xs font-semibold leading-tight text-muted/80">
                      +{fmtGap(gap)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {isCancelled ? (
            <p className="mt-3 border-t border-line pt-3 text-2xs text-muted">
              A cancelled order is final — it cannot be returned to the ladder. Raise a new order
              if the customer comes back.
            </p>
          ) : (
            canEdit && (
              <div className="mt-3 space-y-2.5 border-t border-line pt-3">
                {nextStatus === "DeliveryPartnerAssigned" && (
                  <div>
                    <label htmlFor="transporter-name-input" className={detailLabel}>
                      Transporter partner name
                    </label>
                    <Input
                      id="transporter-name-input"
                      className="h-8 text-xs"
                      placeholder="e.g. VRL Logistics / TCI Express"
                      value={transporterInput}
                      onChange={(e) => setTransporterInput(e.target.value)}
                    />
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {nextStatus ? (
                      <Button size="sm" onClick={handleAdvance} disabled={update.isPending}>
                        {update.isPending ? "Saving…" : `Mark as ${ORDER_STATUS_LABELS[nextStatus]}`}
                      </Button>
                    ) : (
                      <span className="text-2xs font-semibold text-muted">
                        Fulfilment complete.
                      </span>
                    )}
                    {/* One rung back, because a mis-click on "Mark as
                        Delivered" should not cost the order its trail. */}
                    {prevStatus && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={update.isPending}
                        onClick={() =>
                          moveTo(prevStatus, { statusNote: "Corrected — moved back a stage" })
                        }
                      >
                        <Undo2 className="h-3 w-3" /> Back to {ORDER_STATUS_LABELS[prevStatus]}
                      </Button>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowCancelPrompt(!showCancelPrompt)}
                    className="cursor-pointer text-2xs font-bold text-red hover:underline"
                  >
                    Cancel order
                  </button>
                </div>

                {showCancelPrompt && (
                  <form
                    onSubmit={handleCancel}
                    className="space-y-2 rounded-lg border border-red/30 bg-red-soft p-3"
                  >
                    <label htmlFor="cancel-reason-input" className={cn(detailLabel, "text-red")}>
                      Reason for cancellation *
                    </label>
                    <Input
                      id="cancel-reason-input"
                      required
                      className="h-8 text-xs"
                      placeholder="e.g. Customer cancelled due to project delay"
                      value={cancelReasonInput}
                      onChange={(e) => setCancelReasonInput(e.target.value)}
                    />
                    <div className="flex justify-end gap-2">
                      <Button
                        size="xs"
                        variant="outline"
                        type="button"
                        onClick={() => setShowCancelPrompt(false)}
                      >
                        Back
                      </Button>
                      <Button size="xs" variant="danger" type="submit" disabled={update.isPending}>
                        Confirm cancellation
                      </Button>
                    </div>
                  </form>
                )}

                {errorLine}
              </div>
            )
          )}
        </Section>

        {/* Line items — editable while the order is a draft, read-only after. */}
        <Section
          title="Ordered Products"
          action={
            canEdit && isDraft ? (
              <div className="flex items-center gap-2">
                <Button
                  size="xs"
                  variant="outline"
                  onClick={() =>
                    setLines((r) => [
                      ...r,
                      { rowId: `line_${++lineSeq}`, productId: "", qty: 1, price: 0, unit: null },
                    ])
                  }
                >
                  <Plus className="h-3 w-3" /> Add line
                </Button>
                <Button
                  size="xs"
                  variant="secondary"
                  onClick={handleSaveLines}
                  disabled={update.isPending || !linesChanged}
                >
                  {update.isPending ? "Saving…" : "Save lines"}
                </Button>
              </div>
            ) : null
          }
        >
          {canEdit && isDraft ? (
            <div className="space-y-2">
              <div className="hidden items-center gap-2 px-0.5 text-3xs font-semibold uppercase tracking-wider text-muted sm:grid sm:grid-cols-[minmax(0,1fr)_6rem_7rem_6.5rem_1.75rem]">
                <span>Product</span>
                <span>Qty</span>
                <span>Unit price</span>
                <span className="text-right">Line total</span>
                <span />
              </div>

              {lines.map((r, idx) => (
                <div
                  key={r.rowId}
                  className="grid grid-cols-2 items-center gap-2 rounded-lg border border-line bg-surface-2/40 p-2.5 sm:grid-cols-[minmax(0,1fr)_6rem_7rem_6.5rem_1.75rem] sm:rounded-none sm:border-0 sm:border-b sm:border-line/40 sm:bg-transparent sm:px-0.5 sm:py-1.5 sm:last:border-0"
                >
                  <div>
                    <span className="mb-1 block text-3xs text-muted sm:hidden">Product</span>
                    <Select
                      aria-label={`Product for line ${idx + 1}`}
                      value={r.productId}
                      onChange={(e) => pickProduct(idx, e.target.value)}
                      selectClassName="h-8 text-2xs"
                    >
                      <option value="">— Choose a product —</option>
                      {catalog.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div>
                    <span className="mb-1 block text-3xs text-muted sm:hidden">Qty</span>
                    <div className="relative">
                      <Input
                        aria-label={`Quantity for line ${idx + 1}`}
                        type="number"
                        min="0"
                        className={cn("h-8 text-2xs tabular-nums", r.unit && "pr-9")}
                        value={r.qty}
                        onChange={(e) => setLine(idx, { qty: Number(e.target.value) })}
                      />
                      {r.unit && (
                        <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-3xs font-semibold uppercase text-muted">
                          {r.unit}
                        </span>
                      )}
                    </div>
                  </div>
                  <div>
                    <span className="mb-1 block text-3xs text-muted sm:hidden">Unit price</span>
                    <div className="relative">
                      <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-2xs text-muted">
                        ₹
                      </span>
                      <Input
                        aria-label={`Price for line ${idx + 1}`}
                        type="number"
                        min="0"
                        className="h-8 pl-6 text-2xs tabular-nums"
                        value={r.price}
                        onChange={(e) => setLine(idx, { price: Number(e.target.value) })}
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-2 sm:justify-end">
                    <span className="text-3xs text-muted sm:hidden">Line total</span>
                    <span className="text-2xs font-bold tabular-nums text-ink">
                      {inr((Number(r.qty) || 0) * (Number(r.price) || 0))}
                    </span>
                  </div>
                  <div className="flex justify-end sm:justify-center">
                    <button
                      type="button"
                      aria-label={`Remove line ${idx + 1}`}
                      onClick={() => setLines((prev) => prev.filter((_, i) => i !== idx))}
                      className="grid h-6 w-6 cursor-pointer place-items-center rounded-md text-muted transition-colors hover:bg-red-soft hover:text-red"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}

              <div className="rounded-lg bg-surface-2 px-3 py-2.5 space-y-1">
                <div className="flex items-center justify-between text-2xs text-muted">
                  <span>Subtotal</span>
                  <span className="font-semibold tabular-nums text-ink">{inr(draftSubtotal)}</span>
                </div>
                <div className="flex items-center justify-between text-2xs text-muted">
                  <span>
                    {liveOrder.taxMode === "Percentage"
                      ? `GST (${liveOrder.taxRate ?? 0}%)`
                      : liveOrder.taxMode === "Amount"
                        ? "GST (entered)"
                        : "GST (none)"}
                  </span>
                  <span className="font-semibold tabular-nums text-ink">
                    {inr(draftTaxPaise / 100)}
                  </span>
                </div>
                <div className="flex items-center justify-between border-t border-line pt-1">
                  <span className="text-2xs font-bold uppercase tracking-wider text-muted">
                    {linesChanged ? "New order value (unsaved)" : "Order value"}
                  </span>
                  <span className="text-sm font-bold tabular-nums text-brand">{inr(draftTotal)}</span>
                </div>
              </div>
              <p className="text-3xs text-muted">
                The total is recomputed by the server from these lines, under this order's own GST
                treatment. Quantities lock once the order is acknowledged — the warehouse is
                acting on them by then.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-line/60">
              {liveOrder.items.map((l) => (
                <div key={l.id} className="flex items-center justify-between py-2 text-xs">
                  <div className="min-w-0">
                    <div className="truncate font-bold text-ink">{l.productName}</div>
                    <div className="text-2xs text-muted">
                      {l.qty} {l.unit || "units"} @ ₹{l.price}/{l.unit || "unit"}
                    </div>
                  </div>
                  <div className="font-bold tabular-nums text-ink">{inr(l.lineTotal)}</div>
                </div>
              ))}
              {canEdit && !isCancelled && (
                <p className="pt-2 text-3xs text-muted">
                  Locked: line items can only be changed while an order is still at Created.
                </p>
              )}
            </div>
          )}
        </Section>

        {/* Delivery & commercial details — the half of the order the API has
            always accepted on PATCH and nothing could edit. */}
        {canEdit && !isCancelled && (
          <Section
            title="Delivery & Commercial Details"
            action={
              <Button
                size="xs"
                variant="secondary"
                onClick={handleSaveDetails}
                disabled={update.isPending}
              >
                {update.isPending ? "Saving…" : "Save details"}
              </Button>
            }
          >
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <label htmlFor="so-edit-mode" className={detailLabel}>
                  Delivery mode
                </label>
                <Select
                  id="so-edit-mode"
                  value={details.deliveryMode}
                  onChange={(e) => setDetails((d) => ({ ...d, deliveryMode: e.target.value }))}
                  selectClassName="h-8 text-xs"
                >
                  <option value="">— Standard —</option>
                  {DELIVERY_MODE_VALUES.map((m) => (
                    <option key={m} value={m}>
                      {DELIVERY_MODE_LABELS[m]}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <label htmlFor="so-edit-terms" className={detailLabel}>
                  Payment terms
                </label>
                <Input
                  id="so-edit-terms"
                  className="h-8 text-xs"
                  placeholder="e.g. 30 Days Credit"
                  value={details.paymentTerms}
                  onChange={(e) => setDetails((d) => ({ ...d, paymentTerms: e.target.value }))}
                />
              </div>
              <div className="flex items-end">
                <label className="flex h-8 cursor-pointer items-center gap-1.5 text-2xs font-semibold text-muted">
                  <input
                    type="checkbox"
                    className="cursor-pointer"
                    checked={details.isUrgent}
                    onChange={(e) => setDetails((d) => ({ ...d, isUrgent: e.target.checked }))}
                  />
                  Urgent delivery
                </label>
              </div>

              <div className="sm:col-span-3">
                <label htmlFor="so-edit-expected" className={detailLabel}>
                  Expected delivery
                </label>
                <DateTimeField
                  id="so-edit-expected"
                  label="Expected delivery"
                  value={details.expectedDelivery}
                  onChange={(v) => setDetails((d) => ({ ...d, expectedDelivery: v }))}
                />
                <p className="mt-1 text-3xs text-muted">
                  What the banner above and the Fulfilment SLA report judge this delivery against.
                </p>
              </div>

              <div className="sm:col-span-2">
                <label htmlFor="so-edit-transporter" className={detailLabel}>
                  Transporter
                </label>
                <Input
                  id="so-edit-transporter"
                  className="h-8 text-xs"
                  placeholder="e.g. VRL Logistics"
                  value={details.transporterName}
                  onChange={(e) => setDetails((d) => ({ ...d, transporterName: e.target.value }))}
                />
              </div>
              <div>
                <label htmlFor="so-edit-lr" className={detailLabel}>
                  LR number
                </label>
                <Input
                  id="so-edit-lr"
                  className="h-8 text-xs"
                  value={details.lrNumber}
                  onChange={(e) => setDetails((d) => ({ ...d, lrNumber: e.target.value }))}
                />
              </div>

              <div className="sm:col-span-3">
                <label htmlFor="so-edit-address" className={detailLabel}>
                  Delivery address
                </label>
                <Input
                  id="so-edit-address"
                  className="h-8 text-xs"
                  value={details.deliveryAddress}
                  onChange={(e) => setDetails((d) => ({ ...d, deliveryAddress: e.target.value }))}
                />
              </div>

              <div>
                <label htmlFor="so-edit-advance" className={detailLabel}>
                  Advance received (₹)
                </label>
                <Input
                  id="so-edit-advance"
                  type="number"
                  min="0"
                  className="h-8 text-xs tabular-nums"
                  value={details.advanceAmount}
                  onChange={(e) => setDetails((d) => ({ ...d, advanceAmount: e.target.value }))}
                />
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="so-edit-advance-ref" className={detailLabel}>
                  Advance reference
                </label>
                <Input
                  id="so-edit-advance-ref"
                  className="h-8 text-xs"
                  placeholder="UTR / cheque no."
                  value={details.advanceRef}
                  onChange={(e) => setDetails((d) => ({ ...d, advanceRef: e.target.value }))}
                />
              </div>

              <div className="sm:col-span-3">
                <label htmlFor="so-edit-instructions" className={detailLabel}>
                  Delivery instructions
                </label>
                <Textarea
                  id="so-edit-instructions"
                  rows={2}
                  className="text-xs"
                  placeholder="Gate pass, unloading window, site contact…"
                  value={details.deliveryInstructions}
                  onChange={(e) =>
                    setDetails((d) => ({ ...d, deliveryInstructions: e.target.value }))
                  }
                />
              </div>
            </div>

            {/* Repeated from the timeline card, which is hidden once an order
                is cancelled or complete — this panel stays usable. */}
            {errorLine}
          </Section>
        )}

        <AttachmentsPanel
          entityType="Order"
          entityId={liveOrder.id}
          enabled={open}
          canWrite={canEdit}
        />

        <RemarksPanel
          entityType="Order"
          entityId={liveOrder.id}
          enabled={open}
          canWrite={canEdit}
        />
      </div>
    </Dialog>
  );
}
