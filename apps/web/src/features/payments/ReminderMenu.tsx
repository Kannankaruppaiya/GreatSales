import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Check, ChevronDown, Undo2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { shortDate } from "@/lib/format";
import {
  REMINDER_ORDINALS,
  REMINDER_STAGES,
  type PaymentRow,
  type ReminderStage,
} from "@/features/payments/types";

/**
 * The reminder chase on one invoice, as a dropdown.
 *
 * It replaced four 20px chips sitting side by side in the table. Those were
 * wrong in three ways at once. They were unlabelled, so the column read "1 2 3
 * 4" and you had to already know that green meant sent. They were independent,
 * so the third letter could be marked before the first — which is not an
 * escalation, it is a mistake, and it notified the collector either way. And a
 * click was a write with no confirmation and no way back: a mis-tap marked a
 * letter sent forever, because nothing in the UI could unmark one.
 *
 * The dropdown says the state in words, offers exactly the one letter that is
 * next, and lets the most recent one be taken back. It also has room for the
 * dates, which is what the decision actually turns on — the third letter is due
 * because the second went out three weeks ago, not because two have gone.
 */

/** Index of the last letter marked sent, or -1 when the chase has not begun. */
function lastSentIndex(p: PaymentRow): number {
  let last = -1;
  REMINDER_STAGES.forEach((st, i) => {
    if (p[st]) last = i;
  });
  return last;
}

/** Index of the first letter not yet sent, or -1 when all four have gone. */
function nextIndex(p: PaymentRow): number {
  return REMINDER_STAGES.findIndex((st) => !p[st]);
}

/** How far the chase has got, in words — the trigger's label. */
export function reminderSummary(p: PaymentRow): string {
  const last = lastSentIndex(p);
  if (last < 0) return "No reminder";
  if (REMINDER_STAGES.every((st) => p[st])) return "All 4 sent";
  return `${REMINDER_ORDINALS[last]} sent`;
}

export interface ReminderMenuProps {
  payment: PaymentRow;
  /** False for management and any read-only viewer: state shows, nothing writes. */
  canEdit: boolean;
  /** Flip one letter. The API stamps or clears its date; no date is sent. */
  onToggle: (stage: ReminderStage, next: boolean) => void;
  /** `cell` is the compact table trigger; `block` fills a panel in the modal. */
  variant?: "cell" | "block";
  disabled?: boolean;
}

export function ReminderMenu({
  payment,
  canEdit,
  onToggle,
  variant = "cell",
  disabled = false,
}: ReminderMenuProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  const last = lastSentIndex(payment);
  const next = nextIndex(payment);
  const summary = reminderSummary(payment);
  const label = payment.refNo || payment.invoiceNo || "this invoice";

  // The menu is fixed-positioned off the trigger's rect rather than absolute
  // inside the cell: the table scrolls in both directions, and an absolute menu
  // would be clipped by that overflow the moment it opened on a lower row.
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const r = triggerRef.current?.getBoundingClientRect();
      if (!r) return;
      const width = 268;
      const height = 232;
      setPos({
        top: r.bottom + height > window.innerHeight ? r.top - height - 4 : r.bottom + 4,
        left: Math.max(8, Math.min(r.left, window.innerWidth - width - 8)),
      });
    };
    place();
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Reminders for ${label} — ${summary}`}
        title={`Reminders — ${summary}`}
        className={cn(
          "inline-flex items-center gap-1 rounded-lg border font-bold transition-colors cursor-pointer disabled:opacity-50",
          variant === "cell"
            ? "px-2 py-1 text-3xs"
            : "w-full justify-between px-3 py-2 text-xs",
          last < 0
            ? "bg-surface text-muted border-line hover:border-muted"
            : "bg-brand-soft text-brand-ink border-brand/30 hover:border-brand/60",
        )}
      >
        <span className="whitespace-nowrap">{summary}</span>
        <ChevronDown className={cn("h-3 w-3 shrink-0", open && "rotate-180")} />
      </button>

      {open && pos && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            role="menu"
            aria-label="Payment reminders"
            style={{ top: pos.top, left: pos.left, width: 268 }}
            className="fixed z-50 rounded-xl border border-line bg-surface p-2 text-left shadow-xl animate-in fade-in"
          >
            <div className="px-1.5 pb-1.5 mb-1 border-b border-line">
              <div className="text-2xs font-bold text-ink truncate">{label}</div>
              <div className="text-3xs text-muted truncate">
                {payment.customerName || "Unknown party"}
              </div>
            </div>

            {REMINDER_STAGES.map((stage, i) => {
              const sent = payment[stage];
              const at = payment[`${stage}At` as const];
              // Only two rows can be acted on: the next letter to go out, and
              // the last one that went. Everything else is either history or
              // out of order, and offering it invites the mistake this menu
              // exists to prevent.
              const isNext = !sent && i === next;
              const isUndo = sent && i === last;
              const actionable = canEdit && !disabled && (isNext || isUndo);
              return (
                <button
                  key={stage}
                  type="button"
                  role="menuitem"
                  disabled={!actionable}
                  // Named explicitly: the row's own text is three nested spans,
                  // and the `title` below would otherwise become the name — so
                  // a screen reader announced the reason it is disabled where
                  // the letter's name should be.
                  aria-label={`${REMINDER_ORDINALS[i]} reminder — ${
                    sent ? (at ? `sent ${shortDate(at)}` : "sent") : "not sent"
                  }`}
                  onClick={() => {
                    onToggle(stage, !sent);
                    setOpen(false);
                  }}
                  title={
                    actionable
                      ? undefined
                      : sent
                        ? "Only the most recent reminder can be taken back."
                        : "Send the reminders in order — the earlier one first."
                  }
                  className={cn(
                    "w-full flex items-center gap-2 rounded-lg px-1.5 py-1.5 text-left text-2xs transition-colors",
                    actionable
                      ? "cursor-pointer hover:bg-surface-2"
                      : "cursor-default opacity-70",
                  )}
                >
                  <span
                    className={cn(
                      "grid h-4 w-4 shrink-0 place-items-center rounded border text-3xs font-bold",
                      sent
                        ? "bg-brand text-white border-brand"
                        : "bg-surface text-muted border-line",
                    )}
                  >
                    {sent ? <Check className="h-2.5 w-2.5" /> : i + 1}
                  </span>

                  <span className="flex-1 min-w-0">
                    <span className="block font-semibold text-ink">
                      {REMINDER_ORDINALS[i]} reminder
                    </span>
                    <span className="block text-3xs text-muted">
                      {/* A letter marked sent before this column existed has no
                          date, and inventing one would read as fact. */}
                      {sent ? (at ? `Sent ${shortDate(at)}` : "Sent") : "Not sent"}
                    </span>
                  </span>

                  {isNext && actionable && (
                    <span className="shrink-0 text-3xs font-bold uppercase tracking-wider text-brand">
                      Mark sent
                    </span>
                  )}
                  {isUndo && actionable && (
                    <Undo2 className="h-3 w-3 shrink-0 text-muted" aria-label="Undo" />
                  )}
                </button>
              );
            })}

            <div className="px-1.5 pt-1.5 mt-1 border-t border-line text-3xs text-muted">
              {!canEdit
                ? "Read-only — reminders are sent by the collections team."
                : next < 0
                  ? "All four letters have gone."
                  : `Next: ${REMINDER_ORDINALS[next]} reminder.`}
            </div>
          </div>
        </>
      )}
    </>
  );
}
