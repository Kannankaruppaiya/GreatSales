import { useState } from "react";
import { Receipt } from "lucide-react";
import { Button, Dialog, Input, Select } from "@/components/ui";
import { PAY_ZONES, type PayZone } from "@/data/constants";
import { inr } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useTrackerStore } from "@/store/trackerStore";
import { useAuthRole } from "@/store/auth";
import { useMockOwnerId } from "@/lib/mockOwner";
import type { Payment } from "@/data/types";

/**
 * Pre-API-wiring copy of PaymentDetailModal, kept only so PaymentsPage.mock.tsx
 * and FollowUpsPage.mock.tsx (both unrouted reference copies from before Task 6)
 * still typecheck against the mock `Payment` shape + trackerStore. The live app
 * uses features/payments/PaymentDetailModal.tsx (PaymentRow + useUpdatePayment)
 * instead. Do not wire this copy to anything new — see task-6-report.md.
 */
export function PaymentDetailModal({
  open,
  onClose,
  payment,
}: {
  open: boolean;
  onClose: () => void;
  payment: Payment | null;
}) {
  const { users, updatePaymentZone, updatePaymentField, togglePaymentMail, addPaymentRemark } =
    useTrackerStore();
  const role = useAuthRole();
  const ownerId = useMockOwnerId();
  const salespeople = users.filter((u) => u.role === "sales");

  if (!payment) return null;

  const [zone, setZone] = useState<PayZone>(payment.zone || "Green Zone");
  const [assignedOwnerId, setAssignedOwnerId] = useState(payment.ownerId);
  const [delayReason, setDelayReason] = useState(payment.delayReason || "");
  const [nextFollowUp, setNextFollowUp] = useState(payment.nextFollowUp || "");
  const [newRemark, setNewRemark] = useState("");

  const canEdit = role !== "mgmt";
  const currentUser = users.find((u) => u.id === ownerId)?.name || "User";

  const handleSave = () => {
    if (zone !== payment.zone) updatePaymentZone(payment.id, zone);
    if (assignedOwnerId !== payment.ownerId) updatePaymentField(payment.id, "ownerId", assignedOwnerId);
    if (delayReason !== payment.delayReason) updatePaymentField(payment.id, "delayReason", delayReason);
    if (nextFollowUp !== payment.nextFollowUp) updatePaymentField(payment.id, "nextFollowUp", nextFollowUp || null);
    onClose();
  };

  const handleAddRemark = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRemark.trim()) return;
    addPaymentRemark(payment.id, newRemark.trim(), currentUser);
    setNewRemark("");
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2">
          <Receipt className="h-4 w-4 text-brand" />
          <span>Invoice Details: {payment.refNo}</span>
        </div>
      }
      description={`${payment.customerName} · Pending ${inr(payment.pending)}`}
      maxWidth="max-w-lg"
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onClose} type="button">
            Cancel
          </Button>
          {canEdit && (
            <Button size="sm" onClick={handleSave}>
              Save Changes
            </Button>
          )}
        </>
      }
    >
      <div className="space-y-4 text-xs">
        {/* Invoice Key Financials */}
        <div className="grid grid-cols-3 gap-2.5">
          <div className="rounded-xl border border-line bg-surface-2 p-3 text-center">
            <div className="text-[11px] font-bold uppercase tracking-wider text-muted">Opening Amount</div>
            <div className="text-sm font-bold text-ink mt-0.5 tabular-nums">{inr(payment.amount)}</div>
          </div>
          <div className="rounded-xl border border-line bg-brand-soft p-3 text-center">
            <div className="text-[11px] font-bold uppercase tracking-wider text-brand-ink">Pending Balance</div>
            <div className="text-sm font-bold text-brand-ink mt-0.5 tabular-nums">{inr(payment.pending)}</div>
          </div>
          <div className="rounded-xl border border-line bg-surface-2 p-3 text-center">
            <div className="text-[11px] font-bold uppercase tracking-wider text-muted">Received</div>
            <div className="text-sm font-bold text-ink mt-0.5 tabular-nums">
              {payment.received ? inr(payment.received) : "₹0"}
            </div>
          </div>
        </div>

        {/* Salesperson & Risk Zone */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-muted uppercase tracking-wider block mb-1">
              Salesperson Allocation
            </label>
            {canEdit ? (
              <Select value={assignedOwnerId} onChange={(e) => setAssignedOwnerId(e.target.value)}>
                {salespeople.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            ) : (
              <div className="font-semibold text-ink p-2 rounded-lg bg-surface border border-line">
                {salespeople.find((s) => s.id === assignedOwnerId)?.name || "—"}
              </div>
            )}
          </div>
          <div>
            <label className="text-xs font-semibold text-muted uppercase tracking-wider block mb-1">
              Risk Zone Classification
            </label>
            {canEdit ? (
              <Select value={zone} onChange={(e) => setZone(e.target.value as PayZone)}>
                {PAY_ZONES.map((z) => (
                  <option key={z} value={z}>
                    {z}
                  </option>
                ))}
              </Select>
            ) : (
              <div className="font-semibold text-ink p-2 rounded-lg bg-surface border border-line">
                {zone}
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

        {/* 4 Email Reminder Chips */}
        <div className="rounded-xl border border-line bg-surface p-3 space-y-2">
          <div className="text-xs font-bold text-ink uppercase tracking-wider">
            Email Payment Reminders Sent
          </div>
          <div className="flex items-center gap-2">
            {(["mail1", "mail2", "mail3", "mail4"] as const).map((mk, mi) => (
              <button
                key={mk}
                type="button"
                disabled={!canEdit}
                onClick={() => togglePaymentMail(payment.id, mk)}
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

        {/* Remarks Log */}
        <div className="rounded-xl border border-line bg-surface p-3.5 space-y-2.5">
          <span className="text-xs font-bold text-ink uppercase tracking-wider block">
            Payment Remarks ({payment.remarks?.length || 0})
          </span>

          {canEdit && (
            <form onSubmit={handleAddRemark} className="flex gap-2">
              <Input
                placeholder="Log payment update or promise date…"
                value={newRemark}
                onChange={(e) => setNewRemark(e.target.value)}
                className="flex-1"
              />
              <Button size="sm" type="submit" disabled={!newRemark.trim()}>
                Add Note
              </Button>
            </form>
          )}

          <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
            {(payment.remarks || []).map((r, i) => (
              <div
                key={i}
                className="rounded-lg border border-line bg-surface-2/60 p-2 text-xs text-ink space-y-0.5"
              >
                <div className="flex items-center justify-between text-[10.5px] text-muted">
                  <span className="font-semibold">{r.userName || r.user || "Accountant"}</span>
                  <span>
                    {new Date(r.timestamp || r.date || Date.now()).toLocaleString("en-IN", {
                      day: "2-digit",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
                <div>{r.text}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Dialog>
  );
}
