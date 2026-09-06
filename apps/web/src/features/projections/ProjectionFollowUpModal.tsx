import { useState } from "react";
import { Check } from "lucide-react";
import { Button, Dialog, Input, Select, Textarea } from "@/components/ui";
import { PROJ_STATUSES } from "@/data/constants";
import { ApiError } from "@/lib/api";
import { useCreateRemark } from "@/features/remarks/queries";
import { RemarksPanel } from "@/features/remarks/RemarksPanel";

/**
 * Quick follow-up/status/probability log editor for a single Projection row
 * (edits the projection's embedded nextFollowUp/probability/status fields via
 * trackerStore — unrelated to the FollowUp entity table). Kept distinct from
 * `features/followups/FollowUpModal.tsx`, which creates/edits rows in the
 * real cross-entity FollowUp API resource. Both used to share the
 * `FollowUpModal` name/file before the followups feature was wired to the
 * API; this one moved here so DashboardPage.tsx / ProjectionsPage.mock.tsx
 * keep working unchanged.
 */
export function ProjectionFollowUpModal({
  open,
  onClose,
  title,
  subtitle,
  currentDate,
  currentProb,
  currentStatus,
  projectionId,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  currentDate?: string | null;
  currentProb?: number;
  currentStatus?: string;
  /** The projection this log belongs to. Notes are posted against it. */
  projectionId: string;
  onSave: (
    nextDate: string | null,
    note: string,
    prob?: number,
    nextStatus?: string
  ) => void;
}) {
  const [date, setDate] = useState(currentDate || "");
  const [prob, setProb] = useState<number | undefined>(currentProb);
  const [status, setStatus] = useState<string | undefined>(currentStatus);
  const [note, setNote] = useState("");

  const createRemark = useCreateRemark();
  const [error, setError] = useState("");

  /**
   * The note used to be handed to a caller that dropped it — DashboardPage's
   * handler named the parameter `_note`. It is now posted to /remarks against
   * this projection, BEFORE the fields are saved: if the note fails, the modal
   * stays open with the text still in it rather than closing on a half-done
   * save the user believes worked.
   */
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const body = note.trim();
    if (body) {
      try {
        await createRemark.mutateAsync({
          entityType: "Projection",
          entityId: projectionId,
          text: body,
        });
      } catch (err) {
        setError(
          err instanceof ApiError ? err.message : "Could not save the note.",
        );
        return;
      }
    }
    onSave(date || null, body, prob, status);
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Follow-Up & Status Log"
      description={title}
      maxWidth="max-w-lg"
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onClose} type="button">
            Cancel
          </Button>
          <Button size="sm" onClick={handleSave} disabled={createRemark.isPending}>
            <Check className="h-3.5 w-3.5 mr-1" />
            {createRemark.isPending ? "Saving…" : "Save Follow-Up"}
          </Button>
        </>
      }
    >
      <form onSubmit={(e) => void handleSave(e)} className="space-y-4 text-xs">
        {subtitle && (
          <div className="p-2.5 rounded-lg bg-surface-2 border border-line text-xs text-muted leading-relaxed">
            {subtitle}
          </div>
        )}

        {/* Status after follow-up */}
        <div>
          <label
            htmlFor="pf-status"
            className="text-xs font-semibold text-muted uppercase tracking-wider block mb-1.5"
          >
            Status after this follow-up
          </label>
          <Select
            id="pf-status"
            value={status || ""}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">(keep current status)</option>
            {PROJ_STATUSES.map((st) => (
              <option key={st} value={st}>
                {st}
              </option>
            ))}
          </Select>
        </div>

        {/* Date & Win Probability */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label
              htmlFor="pf-date"
              className="text-xs font-semibold text-muted uppercase tracking-wider block mb-1.5"
            >
              Next Follow-Up Date
            </label>
            <Input
              id="pf-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div>
            <label
              htmlFor="pf-prob"
              className="text-xs font-semibold text-muted uppercase tracking-wider block mb-1.5"
            >
              Win Probability % (0–100)
            </label>
            <Input
              id="pf-prob"
              type="number"
              min={0}
              max={100}
              placeholder="e.g. 80"
              value={prob ?? ""}
              onChange={(e) => {
                const val = e.target.value;
                setProb(val === "" ? undefined : Math.min(100, Math.max(0, Number(val))));
              }}
            />
          </div>
        </div>

        {/* Interaction Notes */}
        <div>
          <label
            htmlFor="pf-note"
            className="text-xs font-semibold text-muted uppercase tracking-wider block mb-1.5"
          >
            Interaction Note / Conversation Details
          </label>
          <Textarea
            id="pf-note"
            rows={3}
            placeholder="Met purchase manager, confirmed 10 drums requirement for 25th delivery…"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>

        {error && (
          <p role="alert" className="text-[11.5px] font-medium text-red">{error}</p>
        )}

        {/* Interaction history, from /remarks rather than a prop nobody filled. */}
        <RemarksPanel
          entityType="Projection"
          entityId={projectionId}
          enabled={open}
          canWrite={false}
        />
      </form>
    </Dialog>
  );
}



