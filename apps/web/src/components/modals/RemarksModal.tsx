import { useState } from "react";
import { MessageSquare, Send, User } from "lucide-react";
import { Button, Dialog, Textarea } from "../ui";
import type { RemarkEntry } from "../../data/types";

export function RemarksModal({
  open,
  onClose,
  title,
  subtitle,
  remarks,
  onAddRemark,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  remarks: RemarkEntry[];
  onAddRemark: (text: string, userName: string) => void;
}) {
  const [text, setText] = useState("");

  const handleSend = () => {
    if (!text.trim()) return;
    onAddRemark(text.trim(), "User");
    setText("");
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-brand" />
          <span>{title}</span>
        </div>
      }
      description={subtitle || "Chronological remarks trail and discussion history"}
      maxWidth="max-w-lg"
    >
      <div className="space-y-4">
        {/* Input box */}
        <div className="rounded-xl border border-line bg-surface-2/70 p-3.5 space-y-2.5">
          <label className="text-xs font-bold text-ink uppercase tracking-wider block">
            Add New Remark / Activity Note
          </label>
          <Textarea
            rows={3}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type discussion notes, customer feedback, delivery updates or next steps…"
            className="text-xs bg-surface"
          />
          <div className="flex justify-end">
            <Button size="sm" onClick={handleSend} disabled={!text.trim()}>
              <Send className="h-3.5 w-3.5 mr-1" /> Post Remark
            </Button>
          </div>
        </div>

        {/* Remarks History */}
        <div>
          <div className="text-xs font-bold text-muted uppercase tracking-wider mb-2.5 flex items-center justify-between">
            <span>Remarks History ({remarks.length})</span>
          </div>
          {remarks && remarks.length > 0 ? (
            <div className="space-y-2.5 max-h-[260px] overflow-y-auto pr-1">
              {remarks.map((r, i) => (
                <div
                  key={r.id || i}
                  className="rounded-xl border border-line bg-surface p-3 text-xs shadow-xs space-y-1.5"
                >
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-bold text-ink flex items-center gap-1">
                      <User className="h-3 w-3 text-brand" />
                      {r.user || "Sales Rep"}
                    </span>
                    <span className="tabular-nums font-semibold text-muted">{r.date}</span>
                  </div>
                  <p className="text-ink-2 leading-relaxed text-[12.5px] font-medium">{r.text}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-line p-6 text-center text-xs text-muted font-medium bg-surface-2/40">
              No remarks recorded yet. Add the first update above.
            </div>
          )}
        </div>
      </div>
    </Dialog>
  );
}
