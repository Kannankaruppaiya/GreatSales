import { useState } from "react";
import { CalendarClock, Check } from "lucide-react";
import { Button, Dialog, Input, Select, Textarea } from "@/components/ui";
import { PROJ_STATUSES } from "@/data/constants";
import type { RemarkEntry } from "@/data/types";

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
  remarks = [],
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  currentDate?: string | null;
  currentProb?: number;
  currentStatus?: string;
  remarks?: RemarkEntry[];
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

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(date || null, note.trim(), prob, status);
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2">
          <CalendarClock className="h-4 w-4 text-brand" />
          <span>Follow-Up & Status Log</span>
        </div>
      }
      description={title}
      maxWidth="max-w-lg"
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onClose} type="button">
            Cancel
          </Button>
          <Button size="sm" onClick={handleSave}>
            <Check className="h-3.5 w-3.5 mr-1" /> Save Follow-Up
          </Button>
        </>
      }
    >
      <form onSubmit={handleSave} className="space-y-4 text-xs">
        {subtitle && (
          <div className="p-2.5 rounded-lg bg-surface-2 border border-line text-xs text-muted leading-relaxed">
            {subtitle}
          </div>
        )}

        {/* Status after follow-up */}
        <div>
          <label className="text-xs font-semibold text-muted uppercase tracking-wider block mb-1">
            Status after this follow-up
          </label>
          <Select value={status || ""} onChange={(e) => setStatus(e.target.value)}>
            <option value="">(keep current status)</option>
            {PROJ_STATUSES.map((st) => (
              <option key={st} value={st}>
                {st}
              </option>
            ))}
          </Select>
        </div>

        {/* Date & Win Probability */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-muted uppercase tracking-wider block mb-1">
              Next Follow-Up Date
            </label>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted uppercase tracking-wider block mb-1">
              Win Probability % (0–100)
            </label>
            <Input
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
          <label className="text-xs font-semibold text-muted uppercase tracking-wider block mb-1">
            Interaction Note / Conversation Details
          </label>
          <Textarea
            rows={3}
            placeholder="Met purchase manager, confirmed 10 drums requirement for 25th delivery…"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>

        {/* Existing History */}
        {remarks.length > 0 && (
          <div>
            <label className="text-xs font-semibold text-muted uppercase tracking-wider block mb-1.5">
              Previous Interaction History ({remarks.length})
            </label>
            <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
              {remarks.map((r, i) => (
                <div
                  key={i}
                  className="rounded-lg border border-line bg-surface-2/60 p-2 text-xs text-ink space-y-0.5"
                >
                  <div className="flex items-center justify-between text-[10.5px] text-muted">
                    <span className="font-semibold">{r.userName || r.user || "Sales Rep"}</span>
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
        )}
      </form>
    </Dialog>
  );
}
