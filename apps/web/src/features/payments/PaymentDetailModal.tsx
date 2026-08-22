import { useState } from "react";
import { Receipt } from "lucide-react";
import { Button, Dialog, Input, Select } from "@/components/ui";
import { ApiError } from "@/lib/api";
import { inr } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useAuthRole } from "@/store/auth";
import { useUpdatePayment } from "@/features/payments/queries";
import {
  PAY_ZONE_VALUES,
  PAY_ZONE_LABELS,
  PAYMENT_STATUS_LABELS,
  type PayZoneValue,
  type PaymentRow,
  type PaymentUpdate,
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

  if (!payment) return null;

  // Kept in lockstep with PaymentsPage's canEdit gate — see the comment
  // there. Payments writes require `payment.write`, which `sales` does not
  // hold, so (unlike sibling detail modals) this is NOT `role !== "mgmt"`.
  const canEdit = role === "admin" || role === "super_admin";
  const statusLabel = PAYMENT_STATUS_LABELS[payment.status as keyof typeof PAYMENT_STATUS_LABELS] ?? payment.status;

  const [payZone, setPayZone] = useState<PayZoneValue>(
    (payment.payZone as PayZoneValue) || "GreenZone",
  );
  const [salespersonId, setSalespersonId] = useState(payment.salespersonId || "");
  const [delayReason, setDelayReason] = useState(payment.delayReason || "");
  const [nextFollowUp, setNextFollowUp] = useState(payment.nextFollowUp || "");

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

  const toggleMail = (mk: "mail1" | "mail2" | "mail3" | "mail4") => {
    update.mutate({ id: payment.id, patch: { [mk]: !payment[mk] } });
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2">
          <Receipt className="h-4 w-4 text-brand" />
          <span>Invoice Details: {payment.refNo || "—"}</span>
        </div>
      }
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
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-muted uppercase tracking-wider block mb-1">
              Salesperson Allocation
            </label>
            {canEdit ? (
              <Select value={salespersonId} onChange={(e) => setSalespersonId(e.target.value)}>
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
            <label className="text-xs font-semibold text-muted uppercase tracking-wider block mb-1">
              Risk Zone Classification
            </label>
            {canEdit ? (
              <Select value={payZone} onChange={(e) => setPayZone(e.target.value as PayZoneValue)}>
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
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-muted uppercase tracking-wider block mb-1">
              Delay Reason / Note
            </label>
            <Input
              disabled={!canEdit}
              placeholder="e.g. MSME payment terms / pending certification"
              value={delayReason}
              onChange={(e) => setDelayReason(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted uppercase tracking-wider block mb-1">
              Next Follow-Up Date
            </label>
            <Input
              disabled={!canEdit}
              type="date"
              value={nextFollowUp}
              onChange={(e) => setNextFollowUp(e.target.value)}
            />
          </div>
        </div>

        {/* 4 Email Reminder Chips — each toggle PATCHes immediately */}
        <div className="rounded-xl border border-line bg-surface p-3 space-y-2">
          <div className="text-xs font-bold text-ink uppercase tracking-wider">
            Email Payment Reminders Sent
          </div>
          <div className="flex items-center gap-2">
            {(["mail1", "mail2", "mail3", "mail4"] as const).map((mk, mi) => (
              <button
                key={mk}
                type="button"
                disabled={!canEdit || update.isPending}
                onClick={() => toggleMail(mk)}
                className={cn(
                  "flex-1 py-1.5 rounded-lg border text-xs font-bold transition-all cursor-pointer",
                  payment[mk]
                    ? "bg-brand text-white border-brand shadow-2xs"
                    : "bg-surface-2 text-muted border-line hover:border-muted"
                )}
              >
                Reminder {mi + 1}
              </button>
            ))}
          </div>
        </div>

        {/* Follow-up log — read-only here (nested on the payment row; the
            FollowUps API is the write path, out of scope for this task). */}
        <div className="rounded-xl border border-line bg-surface p-3.5 space-y-2.5">
          <span className="text-xs font-bold text-ink uppercase tracking-wider block">
            Follow-up Log ({payment.followups.length})
          </span>

          <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
            {payment.followups.length === 0 ? (
              <p className="text-[11px] text-muted">No follow-ups logged yet.</p>
            ) : (
              payment.followups.map((f) => (
                <div
                  key={f.id}
                  className="rounded-lg border border-line bg-surface-2/60 p-2 text-xs text-ink space-y-0.5"
                >
                  <div className="flex items-center justify-between text-[10.5px] text-muted">
                    <span className="font-semibold">{f.date}</span>
                    {f.nextFollowupDate && <span>Next: {f.nextFollowupDate}</span>}
                  </div>
                  <div>{f.note}</div>
                </div>
              ))
            )}
          </div>
        </div>

        {update.isError && (
          <p className="text-[11.5px] font-medium text-red">
            {update.error instanceof ApiError ? update.error.message : "Failed to save changes."}
          </p>
        )}
      </div>
    </Dialog>
  );
}
