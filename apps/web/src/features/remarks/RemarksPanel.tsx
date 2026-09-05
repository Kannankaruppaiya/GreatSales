import { useState } from "react";
import { Send, User } from "lucide-react";
import { Button, Textarea } from "@/components/ui";
import { ApiError } from "@/lib/api";
import { useCreateRemark, useRemarks } from "@/features/remarks/queries";
import type { RemarkEntityType } from "@/features/remarks/types";

/**
 * One record's activity-note timeline, as a block a detail modal can embed.
 *
 * A PANEL rather than a modal: notes are read while looking at the record, and
 * the previous `RemarksModal` — a dialog opened from a dialog — was never
 * mounted by anything at all. It also took `remarks` and `onAddRemark` as
 * props, so every would-be caller had to own the storage; there was none, so
 * there were no callers. This owns its own query and mutation, and the only
 * thing a caller passes is which record it is looking at.
 *
 * `enabled` exists so a modal can hold the panel in its tree without fetching
 * until it is actually open.
 */
export function RemarksPanel({
  entityType,
  entityId,
  enabled = true,
  canWrite = true,
}: {
  entityType: RemarkEntityType;
  entityId: string;
  enabled?: boolean;
  canWrite?: boolean;
}) {
  const target = { entityType, entityId };
  const q = useRemarks(target, { enabled });
  const create = useCreateRemark();
  const [text, setText] = useState("");
  const [error, setError] = useState("");

  const remarks = q.data?.items ?? [];

  const handleSend = async () => {
    const body = text.trim();
    if (!body) return;
    setError("");
    try {
      await create.mutateAsync({ ...target, text: body });
      // Cleared only after the server accepted it, so a failed post does not
      // silently eat what the user typed.
      setText("");
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Could not post the remark.",
      );
    }
  };

  return (
    <div className="space-y-3">
      {canWrite && (
        <div className="rounded-xl border border-line bg-surface-2/70 p-3 space-y-2">
          <label
            className="text-[11px] font-bold text-ink uppercase tracking-wider block"
            htmlFor={`remark-${entityType}-${entityId}`}
          >
            Add remark / activity note
          </label>
          <Textarea
            id={`remark-${entityType}-${entityId}`}
            rows={2}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Discussion notes, customer feedback, delivery updates, next steps…"
            className="text-xs bg-surface"
          />
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] text-red font-medium">{error}</span>
            <Button
              size="sm"
              type="button"
              onClick={() => void handleSend()}
              disabled={!text.trim() || create.isPending}
            >
              <Send className="h-3.5 w-3.5 mr-1" />
              {create.isPending ? "Posting…" : "Post Remark"}
            </Button>
          </div>
        </div>
      )}

      <div>
        <div className="text-[11px] font-bold text-muted uppercase tracking-wider mb-2">
          Remarks history ({q.data?.total ?? 0})
        </div>

        {q.isLoading ? (
          <div className="rounded-xl border border-dashed border-line p-5 text-center text-xs text-muted font-medium">
            Loading notes…
          </div>
        ) : remarks.length > 0 ? (
          <div className="space-y-2 max-h-[240px] overflow-y-auto pr-1">
            {remarks.map((r) => (
              <div
                key={r.id}
                className="rounded-xl border border-line bg-surface p-2.5 text-xs shadow-xs space-y-1"
              >
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-bold text-ink flex items-center gap-1">
                    <User className="h-3 w-3 text-brand" />
                    {r.userName || "System"}
                  </span>
                  <span className="tabular-nums font-semibold text-muted">
                    {r.at.slice(0, 10)}
                  </span>
                </div>
                <p className="text-ink-2 leading-relaxed text-[12.5px] font-medium">
                  {r.text}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-line p-5 text-center text-xs text-muted font-medium bg-surface-2/40">
            No remarks yet.
          </div>
        )}
      </div>
    </div>
  );
}
