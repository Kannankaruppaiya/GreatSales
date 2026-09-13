import { useEffect, useState } from "react";
import { Button, Dialog, Input, Select } from "@/components/ui";
import { DateField } from "@/components/DateField";
import { ApiError } from "@/lib/api";
import { inr } from "@/lib/format";
import { useAuthRole } from "@/store/auth";
import { useUpdatePayment } from "@/features/payments/queries";
import { RemarksPanel } from "@/features/remarks/RemarksPanel";
import { AttachmentsPanel } from "@/features/attachments/AttachmentsPanel";
import { ReminderMenu } from "@/features/payments/ReminderMenu";
import { FollowUpModal } from "@/features/followups/FollowUpModal";
import {
  useFollowUps,
  useUpdateFollowUp,
  flattenFollowUps,
} from "@/features/followups/queries";
import { shortDate } from "@/lib/format";
import {
  PAY_ZONE_VALUES,
  PAY_ZONE_LABELS,
  PAYMENT_STATUS_LABELS,
  type PayZoneValue,
  type PaymentRow,
  type PaymentUpdate,
  type ReminderStage,
} from "@/features/payments/types";
import type { PaymentFkOption } from "@/features/payments/AddPaymentModal";

export function PaymentDetailModal({
  open,
  onClose,
  payment,
  salespeople = [],
}: {
  open: boolean;
  onClose: () => void;
  payment: PaymentRow | null;
  salespeople?: PaymentFkOption[];
}) {
  const update = useUpdatePayment();
  const role = useAuthRole();

  // Kept in lockstep with PaymentsPage's canEdit gate — see the comment
  // there. Payments writes require `payment.write`, which `sales` does not
  // hold, so (unlike sibling detail modals) this is NOT `role !== "mgmt"`.
  const canEdit = role === "admin" || role === "super_admin";

  const [payZone, setPayZone] = useState<PayZoneValue>(
    (payment?.payZone as PayZoneValue) || "GreenZone",
  );
  const [salespersonId, setSalespersonId] = useState(payment?.salespersonId || "");
  const [delayReason, setDelayReason] = useState(payment?.delayReason || "");
  const [nextFollowUp, setNextFollowUp] = useState(payment?.nextFollowUp || "");

  // All hooks above must run on every render regardless of `payment`, so
  // this component never returns early before them (Rules of Hooks). The
  // caller currently remounts via `key={payment.id}` when switching between
  // invoices, but this effect keeps local state in sync even if that ever
  // changes — reopening the same instance for a different payment (or a
  // fresh fetch of the same one) must not keep the previous invoice's
  // edited-but-unsaved values on screen.
  useEffect(() => {
    if (!payment) return;
    setPayZone((payment.payZone as PayZoneValue) || "GreenZone");
    setSalespersonId(payment.salespersonId || "");
    setDelayReason(payment.delayReason || "");
    setNextFollowUp(payment.nextFollowUp || "");
  }, [payment]);

  // The real follow-ups for this invoice — the same rows the Follow-ups page
  // lists and the dashboard tile counts.
  const fuQuery = useFollowUps({ entityType: "Payment" }, { enabled: !!payment && open });
  const markDone = useUpdateFollowUp();
  const [showAddFollowUp, setShowAddFollowUp] = useState(false);

  if (!payment) return null;

  const statusLabel = PAYMENT_STATUS_LABELS[payment.status as keyof typeof PAYMENT_STATUS_LABELS] ?? payment.status;

  const invoiceFollowUps = flattenFollowUps(fuQuery.data).filter(
    (f) => f.entityId === payment.id,
  );

  const handleSave = async () => {
    const patch: Partial<PaymentUpdate> = {};
    if (payZone !== payment.payZone) patch.payZone = payZone;
    if (salespersonId !== (payment.salespersonId || "")) patch.salespersonId = salespersonId || null;
    if (delayReason !== (payment.delayReason || "")) patch.delayReason = delayReason || null;
    if (nextFollowUp !== (payment.nextFollowUp || "")) patch.nextFollowUp = nextFollowUp || null;

    if (Object.keys(patch).length === 0) {
      onClose();
      return;
    }

    try {
      await update.mutateAsync({ id: payment.id, patch });
      onClose();
    } catch {
      // Surfaced inline below via update.error.
    }
  };

  const setReminder = (stage: ReminderStage, next: boolean) => {
    update.mutate({ id: payment.id, patch: { [stage]: next } });
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`Invoice Details: ${payment.refNo || "—"}`}
      description={`${payment.customerName || "Customer"} · Pending ${inr(payment.pending)} · ${statusLabel}`}
      maxWidth="max-w-lg"
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onClose} type="button">
            Cancel
          </Button>
          {canEdit && (
            <Button size="sm" onClick={handleSave} disabled={update.isPending}>
              {update.isPending ? "Saving…" : "Save Changes"}
            </Button>
          )}
        </>
      }
    >
      <div className="space-y-4 text-xs">
        {/* Invoice Key Financials — amount/received/pending/status/agingDays
            are all server-computed or server-supplied and rendered here
            exactly as received; nothing on this screen recomputes them. */}
        <div className="grid grid-cols-3 gap-2.5">
          <div className="rounded-xl border border-line bg-surface-2 p-3 text-center">
            <div className="text-[11px] font-bold uppercase tracking-wider text-muted">Invoice Amount</div>
            <div className="text-sm font-bold text-ink mt-0.5 tabular-nums">{inr(payment.amount)}</div>
          </div>
          <div className="rounded-xl border border-line bg-brand-soft p-3 text-center">
            <div className="text-[11px] font-bold uppercase tracking-wider text-brand-ink">Pending Balance</div>
            <div className="text-sm font-bold text-brand-ink mt-0.5 tabular-nums">{inr(payment.pending)}</div>
          </div>
          <div className="rounded-xl border border-line bg-surface-2 p-3 text-center">
            <div className="text-[11px] font-bold uppercase tracking-wider text-muted">Received</div>
            <div className="text-sm font-bold text-ink mt-0.5 tabular-nums">{inr(payment.received)}</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2.5 text-[11px] text-muted">
          <div>
            Status:{" "}
            <span className="font-bold text-ink">{statusLabel}</span>
          </div>
          <div>
            Aging:{" "}
            <span className="font-bold text-ink tabular-nums">
              {payment.agingDays != null ? `${payment.agingDays}d` : "—"}
            </span>
          </div>
        </div>

        {/* Salesperson & Risk Zone */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label
              htmlFor="pd-salesperson"
              className="text-xs font-semibold text-muted uppercase tracking-wider block mb-1.5"
            >
              Salesperson Allocation
            </label>
            {canEdit ? (
              <Select
                id="pd-salesperson"
                value={salespersonId}
                onChange={(e) => setSalespersonId(e.target.value)}
              >
                <option value="">— Unassigned —</option>
                {salespeople.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            ) : (
              <div className="font-semibold text-ink p-2 rounded-lg bg-surface border border-line">
                {payment.salespersonName || "—"}
              </div>
            )}
          </div>
          <div>
            <label
              htmlFor="pd-payzone"
              className="text-xs font-semibold text-muted uppercase tracking-wider block mb-1.5"
            >
              Risk Zone Classification
            </label>
            {canEdit ? (
              <Select
                id="pd-payzone"
                value={payZone}
                onChange={(e) => setPayZone(e.target.value as PayZoneValue)}
              >
                {PAY_ZONE_VALUES.map((z) => (
                  <option key={z} value={z}>
                    {PAY_ZONE_LABELS[z]}
                  </option>
                ))}
              </Select>
            ) : (
              <div className="font-semibold text-ink p-2 rounded-lg bg-surface border border-line">
                {PAY_ZONE_LABELS[(payment.payZone as PayZoneValue) || "GreenZone"]}
              </div>
            )}
          </div>
        </div>

        {/* Delay Reason & Next Follow-Up */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label
              htmlFor="pd-reason"
              className="text-xs font-semibold text-muted uppercase tracking-wider block mb-1.5"
            >
              Delay Reason / Note
            </label>
            <Input
              id="pd-reason"
              disabled={!canEdit}
              placeholder="e.g. MSME payment terms / pending certification"
              value={delayReason}
              onChange={(e) => setDelayReason(e.target.value)}
            />
          </div>
          <div className="sm:col-span-2">
            <label
              htmlFor="pd-next-followup"
              className="text-xs font-semibold text-muted uppercase tracking-wider block mb-1.5"
            >
              Next Follow-Up Date
            </label>
            <DateField
              id="pd-next-followup"
              label="Next follow-up"
              disabled={!canEdit}
              value={nextFollowUp}
              onChange={setNextFollowUp}
            />
          </div>
        </div>

        {/* The reminder chase. Same control as the table's Reminders column,
            so the two surfaces cannot disagree about what is next. */}
        <div className="rounded-xl border border-line bg-surface p-3 space-y-2">
          <div className="text-xs font-bold text-ink uppercase tracking-wider">
            Email Payment Reminders Sent
          </div>
          <ReminderMenu
            payment={payment}
            canEdit={canEdit}
            disabled={update.isPending}
            variant="block"
            onToggle={setReminder}
          />
        </div>

        {/* The follow-ups on this invoice.
            
            This panel used to read `payment.followups` — the nested
            `PaymentFollowup` rows — and offer no way to add one. Nothing in the
            product writes that table: not the app, not the seed, not the
            import. So the panel said "No follow-ups logged yet." to every user
            of every workspace, for ever, while the Follow-ups feature held the
            real rows a few clicks away. It reads and writes those now. */}
        <div className="rounded-xl border border-line bg-surface p-3.5 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold text-ink uppercase tracking-wider">
              Follow-ups ({invoiceFollowUps.length})
            </span>
            {canEdit && (
              <Button size="sm" variant="secondary" onClick={() => setShowAddFollowUp(true)}>
                Add follow-up
              </Button>
            )}
          </div>

          <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
            {invoiceFollowUps.length === 0 ? (
              <p className="text-2xs text-muted">No follow-ups on this invoice yet.</p>
            ) : (
              invoiceFollowUps.map((f) => (
                <div
                  key={f.id}
                  className="rounded-lg border border-line bg-surface-2/60 p-2 text-xs text-ink space-y-0.5"
                >
                  <div className="flex items-center justify-between gap-2 text-3xs text-muted">
                    <span className="font-semibold">Due {shortDate(f.dueDate)}</span>
                    {canEdit && !f.done && (
                      <button
                        type="button"
                        onClick={() => markDone.mutate({ id: f.id, patch: { done: true } })}
                        disabled={markDone.isPending}
                        className="font-bold uppercase tracking-wider text-brand hover:underline cursor-pointer disabled:opacity-50"
                      >
                        Mark done
                      </button>
                    )}
                    {f.done && <span className="font-bold uppercase tracking-wider">Done</span>}
                  </div>
                  <div className="font-semibold">{f.title || "Follow-up"}</div>
                  {f.note && <div className="text-2xs text-muted">{f.note}</div>}
                </div>
              ))
            )}
          </div>
        </div>

        {update.isError && (
          <p role="alert" className="text-[11.5px] font-medium text-red">
            {update.error instanceof ApiError ? update.error.message : "Failed to save changes."}
          </p>
        )}

        <AttachmentsPanel
          entityType="Payment"
          entityId={payment.id}
          enabled={open}
          canWrite={canEdit}
        />

        <RemarksPanel
          entityType="Payment"
          entityId={payment.id}
          enabled={open}
          canWrite={canEdit}
        />
      </div>

      {/* Opened from the invoice, so the entity it is about is already known —
          the person never has to find and paste a payment id. */}
      {showAddFollowUp && (
        <FollowUpModal
          open={showAddFollowUp}
          onClose={() => setShowAddFollowUp(false)}
          defaults={{
            entityType: "Payment",
            entityId: payment.id,
            title: `Collect on ${payment.refNo || payment.invoiceNo || "this invoice"}`,
            subtitle: payment.customerName ?? undefined,
          }}
        />
      )}
    </Dialog>
  );
}


