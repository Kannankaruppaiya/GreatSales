import { useEffect, useState } from "react";
import { Target } from "lucide-react";
import { Button, Dialog, Input, Select } from "@/components/ui";
import { ApiError } from "@/lib/api";
import { inr } from "@/lib/format";
import { useAuthRole } from "@/store/auth";
import { useDeleteLead, useUpdateLead } from "@/features/leads/queries";
import { DeleteAction } from "@/components/modals/DeleteAction";
import { RemarksPanel } from "@/features/remarks/RemarksPanel";
import {
  DEAL_STAGE_VALUES,
  DEAL_STAGE_LABELS,
  type DealStageValue,
  type LeadRow,
} from "@/features/leads/types";

export function LeadDetailModal({
  open,
  onClose,
  lead,
}: {
  open: boolean;
  onClose: () => void;
  lead: LeadRow | null;
}) {
  const role = useAuthRole();
  const canEdit = role !== "mgmt";
  const update = useUpdateLead();
  const del = useDeleteLead();

  const [stage, setStage] = useState<DealStageValue>((lead?.stage as DealStageValue) || "NewEnquiries");
  const [nextFollowUp, setNextFollowUp] = useState(lead?.nextFollowUp || "");
  const [expClose, setExpClose] = useState(lead?.expClose || "");

  // Reset local edit state whenever a different lead is opened.
  useEffect(() => {
    setStage((lead?.stage as DealStageValue) || "NewEnquiries");
    setNextFollowUp(lead?.nextFollowUp || "");
    setExpClose(lead?.expClose || "");
  }, [lead]);

  if (!lead) return null;

  const handleSaveAll = async () => {
    // Product line items cannot be edited here — LeadUpdate omits `products`
    // entirely this cycle (see features/leads/types.ts); only scalar fields
    // are PATCH-able. `stage` is sent as its raw DealStageValue, never the
    // display label (see DEAL_STAGE_LABELS doc comment).
    const patch: Record<string, unknown> = {};
    if (stage !== lead.stage) patch.stage = stage;
    if (nextFollowUp !== (lead.nextFollowUp || "")) patch.nextFollowUp = nextFollowUp || null;
    if (expClose !== (lead.expClose || "")) patch.expClose = expClose || null;

    if (Object.keys(patch).length === 0) {
      onClose();
      return;
    }

    try {
      await update.mutateAsync({ id: lead.id, patch });
      onClose();
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
          <Target className="h-4 w-4 text-brand" />
          <span>New Sales Lead: {lead.customerName}</span>
        </div>
      }
      description={`${lead.contactName || "Direct Contact"} · ${lead.area || "Territory"} · Total ${inr(lead.totalValue)}`}
      maxWidth="max-w-2xl"
      footer={
        <>
          {canEdit && (
            <DeleteAction
              label="Delete Lead"
              title={`Delete ${lead.customerName}?`}
              body="The deal, its line items and its activity history are removed. Won deals are usually better left in place for reporting — cancel the lead instead."
              onDelete={() => del.mutateAsync(lead.id)}
              onDeleted={onClose}
            />
          )}
          <Button variant="outline" size="sm" onClick={onClose} type="button">
            Cancel
          </Button>
          {canEdit && (
            <Button size="sm" onClick={handleSaveAll} disabled={update.isPending}>
              {update.isPending ? "Saving…" : "Save Changes"}
            </Button>
          )}
        </>
      }
    >
      <div className="space-y-4 text-xs">
        {/* Deal Stage Selector */}
        <div className="rounded-xl border border-line bg-surface-2 p-3 flex items-center justify-between gap-3">
          <span className="font-bold text-xs text-ink uppercase tracking-wider">
            Deal Pipeline Stage:
          </span>
          {/* `<option value>` is the raw DealStageValue — DEAL_STAGE_LABELS
              supplies only the visible text (see features/leads/types.ts). */}
          <Select
            value={stage}
            onChange={(e) => setStage(e.target.value as DealStageValue)}
            disabled={!canEdit}
            className="font-bold text-brand max-w-[260px]"
          >
            {DEAL_STAGE_VALUES.map((s) => (
              <option key={s} value={s}>
                {DEAL_STAGE_LABELS[s]}
              </option>
            ))}
          </Select>
        </div>

        {/* Lead Metadata Grid */}
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="text-xs font-semibold text-muted uppercase tracking-wider block mb-1">
              Salesperson
            </label>
            <div className="font-semibold text-ink p-2 rounded-lg bg-surface border border-line">
              {lead.salespersonName || "—"}
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-muted uppercase tracking-wider block mb-1">
              Next Follow-Up
            </label>
            <Input
              type="date"
              disabled={!canEdit}
              value={nextFollowUp}
              onChange={(e) => setNextFollowUp(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted uppercase tracking-wider block mb-1">
              Expected Closure
            </label>
            <Input
              type="date"
              disabled={!canEdit}
              value={expClose}
              onChange={(e) => setExpClose(e.target.value)}
            />
          </div>
        </div>

        {/* Contact & Location */}
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="text-xs font-semibold text-muted uppercase tracking-wider block mb-1">
              Contact
            </label>
            <div className="font-semibold text-ink p-2 rounded-lg bg-surface border border-line">
              {lead.contactName || "—"}
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-muted uppercase tracking-wider block mb-1">
              Mobile / WhatsApp
            </label>
            <div className="font-semibold text-ink p-2 rounded-lg bg-surface border border-line">
              {lead.phone || lead.whatsapp || "—"}
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-muted uppercase tracking-wider block mb-1">
              Industry
            </label>
            <div className="font-semibold text-ink p-2 rounded-lg bg-surface border border-line">
              {lead.industryName || "—"}
              {lead.subIndustry ? ` · ${lead.subIndustry}` : ""}
            </div>
          </div>
        </div>

        {/* Product Requirements Table — read-only this cycle: LeadUpdate
            omits `products`, so line items can only be set at create time
            (see features/leads/types.ts doc comment). */}
        <div className="rounded-xl border border-line bg-surface p-3.5 space-y-2.5">
          <span className="text-xs font-bold text-ink uppercase tracking-wider block">
            Enquiry Products & Estimated Values
          </span>

          {lead.products.length === 0 ? (
            <p className="text-[11px] text-muted">No product lines recorded on this lead.</p>
          ) : (
            <div className="space-y-1.5">
              {lead.products.map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-2 text-xs border-b border-line/40 pb-1.5 last:border-0 last:pb-0">
                  <div>
                    <div className="font-semibold text-ink">{p.productName}</div>
                    <div className="text-[11px] text-muted">
                      {p.qty ?? "—"} {p.unit || ""} @ ₹{p.price ?? "—"}/{p.unit || "unit"}
                    </div>
                  </div>
                  <div className="font-bold text-ink tabular-nums">{inr(p.value || 0)}</div>
                </div>
              ))}
            </div>
          )}

          <div className="pt-2 border-t border-line flex items-center justify-between text-xs font-bold">
            <span className="text-muted uppercase tracking-wider">Total Deal Value</span>
            <span className="text-brand tabular-nums text-sm">{inr(lead.totalValue)}</span>
          </div>
        </div>

        {update.isError && (
          <p className="text-[11.5px] font-medium text-red">
            {update.error instanceof ApiError ? update.error.message : "Failed to save change."}
          </p>
        )}

        <RemarksPanel
          entityType="Lead"
          entityId={lead.id}
          enabled={open}
          canWrite={canEdit}
        />
      </div>
    </Dialog>
  );
}
