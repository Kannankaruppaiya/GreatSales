import { useState } from "react";
import { Check } from "lucide-react";
import { Button, Dialog, Input, Select, Textarea } from "@/components/ui";
import { ApiError } from "@/lib/api";
import { useCreateFollowUp, useUpdateFollowUp } from "@/features/followups/queries";
import { ENTITY_TYPE_VALUES, type EntityTypeValue, type FollowUpRow } from "@/features/followups/types";

/**
 * Create/edit modal for the FollowUp entity resource. `entityType` is a raw
 * DB enum on the wire (packages/shared/src/enums.ts EntityTypeSchema) — the
 * `<select>` options below use ENTITY_TYPE_VALUES directly as both the
 * `value` and the display text, so there is no label→raw translation step
 * for a mismatch to hide behind (see followups/types.ts).
 *
 * Passing `followUp` puts the modal in edit mode (PATCH via
 * useUpdateFollowUp); omitting it creates a new row (POST via
 * useCreateFollowUp). `salespersonId` is intentionally not a field here —
 * the API defaults it to the caller (or forces it for sales-only roles), so
 * there is nothing useful for a picker to change for the common case.
 */
export function FollowUpModal({
  open,
  onClose,
  followUp,
}: {
  open: boolean;
  onClose: () => void;
  followUp?: FollowUpRow;
}) {
  const isEdit = !!followUp;
  const create = useCreateFollowUp();
  const update = useUpdateFollowUp();
  const mutation = isEdit ? update : create;

  const [entityType, setEntityType] = useState<EntityTypeValue>(
    followUp?.entityType ?? ENTITY_TYPE_VALUES[0],
  );
  const [entityId, setEntityId] = useState(followUp?.entityId ?? "");
  const [dueDate, setDueDate] = useState(
    followUp?.dueDate ?? new Date().toISOString().slice(0, 10),
  );
  const [title, setTitle] = useState(followUp?.title ?? "");
  const [subtitle, setSubtitle] = useState(followUp?.subtitle ?? "");
  const [amount, setAmount] = useState(followUp?.amount != null ? String(followUp.amount) : "");
  const [note, setNote] = useState(followUp?.note ?? "");
  const [done, setDone] = useState(followUp?.done ?? false);

  const canSubmit = entityId.trim().length > 0 && dueDate.length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    const shared = {
      entityType,
      entityId: entityId.trim(),
      dueDate,
      title: title.trim() || null,
      subtitle: subtitle.trim() || null,
      amount: amount.trim() ? Number(amount) : null,
      note: note.trim() || null,
    };

    try {
      if (isEdit && followUp) {
        await update.mutateAsync({ id: followUp.id, patch: { ...shared, done } });
      } else {
        await create.mutateAsync(shared);
      }
      onClose();
    } catch {
      // Surfaced inline below via mutation.error.
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={isEdit ? "Edit Follow-Up" : "Add Follow-Up"}
      description="A cross-entity follow-up task, linked to a customer / lead / order / payment / projection."
      maxWidth="max-w-lg"
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onClose} type="button">
            Cancel
          </Button>
          <Button size="sm" onClick={handleSubmit} disabled={!canSubmit || mutation.isPending}>
            <Check className="h-3.5 w-3.5 mr-1" />
            {mutation.isPending ? "Saving…" : isEdit ? "Save Follow-Up" : "Create Follow-Up"}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label
              htmlFor="fu-entity-type"
              className="text-xs font-semibold text-muted uppercase tracking-wider block mb-1.5"
            >
              Entity Type <span className="text-red">*</span>
            </label>
            <Select
              id="fu-entity-type"
              value={entityType}
              onChange={(e) => setEntityType(e.target.value as EntityTypeValue)}
            >
              {ENTITY_TYPE_VALUES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label
              htmlFor="fu-entity-id"
              className="text-xs font-semibold text-muted uppercase tracking-wider block mb-1.5"
            >
              Entity ID <span className="text-red">*</span>
            </label>
            <Input
              id="fu-entity-id"
              required
              placeholder="e.g. cust_1, lead_2…"
              value={entityId}
              onChange={(e) => setEntityId(e.target.value)}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label
              htmlFor="fu-due-date"
              className="text-xs font-semibold text-muted uppercase tracking-wider block mb-1.5"
            >
              Due Date <span className="text-red">*</span>
            </label>
            <Input
              id="fu-due-date"
              type="date"
              required
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>
          <div>
            <label
              htmlFor="fu-amount"
              className="text-xs font-semibold text-muted uppercase tracking-wider block mb-1.5"
            >
              Amount (Optional)
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted">
                ₹
              </span>
              <Input
                id="fu-amount"
                type="number"
                min={0}
                step="0.01"
                placeholder="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="pl-7"
              />
            </div>
          </div>
        </div>

        <div>
          <label
            htmlFor="fu-title"
            className="text-xs font-semibold text-muted uppercase tracking-wider block mb-1.5"
          >
            Title
          </label>
          <Input
            id="fu-title"
            placeholder="e.g. Anand Automotive Systems · CN-42 Oil"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        <div>
          <label
            htmlFor="fu-subtitle"
            className="text-xs font-semibold text-muted uppercase tracking-wider block mb-1.5"
          >
            Subtitle
          </label>
          <Input
            id="fu-subtitle"
            placeholder="e.g. Proj 10 drums @ ₹5,000"
            value={subtitle}
            onChange={(e) => setSubtitle(e.target.value)}
          />
        </div>

        <div>
          <label
            htmlFor="fu-note"
            className="text-xs font-semibold text-muted uppercase tracking-wider block mb-1.5"
          >
            Note
          </label>
          <Textarea
            id="fu-note"
            rows={3}
            placeholder="Met purchase manager, confirmed 10 drums requirement for 25th delivery…"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>

        {isEdit && (
          <label
            htmlFor="fu-done"
            className="flex items-center gap-2 text-xs font-semibold text-ink cursor-pointer select-none"
          >
            <input
              id="fu-done"
              type="checkbox"
              checked={done}
              onChange={(e) => setDone(e.target.checked)}
              className="h-4 w-4 rounded border-line accent-brand"
            />
            Mark as Done
          </label>
        )}

        {mutation.isError && (
          <p role="alert" className="text-[11.5px] font-medium text-red">
            {mutation.error instanceof ApiError ? mutation.error.message : "Failed to save follow-up."}
          </p>
        )}
      </form>
    </Dialog>
  );
}


