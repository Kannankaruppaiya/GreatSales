import { useRef, useState } from "react";
import { Select } from "@/components/ui";
import {
  CalendarActions,
  CalendarDayView,
  CalendarPopover,
  CalendarTrigger,
  dateLabel,
  isIsoDate,
  pad,
  today,
} from "@/components/Calendar";
import { cn } from "@/lib/utils";

/**
 * A date, picked from a calendar.
 *
 * This replaces `<input type="date">` everywhere in the console, and before
 * that replaced the three dropdowns — day, month, year — that themselves
 * replaced it.
 *
 * The reason the native input had to go has not changed: it renders in the
 * BROWSER's locale, so the same field reads `09/08/2026` to one user and
 * `08/09/2026` to another and neither can tell which half is the month. This
 * product is used in India, where dates are written day-first, on a browser
 * that is very often set to en-US, where they are not. And the native control
 * looks like a different feature in every browser — Chrome's spinner, Safari's
 * wheel, Firefox's own panel — none of them matching anything else on the page.
 *
 * The dropdowns fixed the ambiguity and cost something for it: three decisions
 * and up to forty options for one date, and no way to see that the 15th is a
 * Saturday. A calendar is one decision and answers that by being looked at.
 *
 * The ambiguity guarantee survives because it moved to the CLOSED field, which
 * always reads `09 Sep 2026` — month in words, nothing to misread.
 *
 * The contract is deliberately unchanged, again: `value` and the string handed
 * to `onChange` are both `YYYY-MM-DD`, or `""` for no date. Nothing upstream
 * had to learn a new shape either time.
 */
export function DateField({
  id,
  label,
  value,
  onChange,
  disabled,
  required,
  className,
  placeholder = "Select date",
}: {
  /** Goes on the trigger, so an existing `<label htmlFor>` still lands. */
  id?: string;
  /**
   * What this date is, for assistive tech — "Due date", "Invoice date". The
   * trigger announces as "Due date: 09 Sep 2026", which on a form with two
   * dates is the difference between usable and not.
   */
  label: string;
  /** `YYYY-MM-DD`, or `""` for no date. */
  value: string;
  /** Called with `YYYY-MM-DD`, or `""` when the date is cleared. */
  onChange: (value: string) => void;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const close = () => {
    setOpen(false);
    // Back to the field, not to the top of the document — the panel that had
    // focus is about to stop existing.
    triggerRef.current?.focus();
  };

  const commit = (next: string) => {
    onChange(next);
    close();
  };

  return (
    <div className={cn("w-full", className)}>
      <CalendarTrigger
        id={id}
        buttonRef={triggerRef}
        open={open}
        onToggle={() => setOpen((v) => !v)}
        text={dateLabel(value)}
        placeholder={placeholder}
        ariaLabel={label}
        disabled={disabled}
        required={required}
      />
      <CalendarPopover
        open={open}
        onClose={close}
        anchorRef={triggerRef}
        label={`Choose ${label.toLowerCase()}`}
      >
        <CalendarDayView
          selected={isIsoDate(value) ? value : ""}
          onPick={commit}
          footer={
            <CalendarActions
              // Clearing was free with the dropdowns — you picked the blank
              // option. A calendar has no blank cell, so an optional date needs
              // somewhere to say "no date" or it can never be un-set again.
              onClear={value && !required ? () => commit("") : undefined}
              onToday={() => commit(today())}
            />
          }
        />
      </CalendarPopover>
    </div>
  );
}

/**
 * A date AND a time: a calendar, plus a half-hour time list.
 *
 * `<input type="datetime-local">` carries every problem the date input does and
 * adds its own: a 12-hour browser shows AM/PM and a 24-hour one does not, so
 * "delivery by 07:30" is genuinely ambiguous between two users looking at the
 * same order.
 *
 * The time stays a fixed half-hour list rather than a calendar or free entry,
 * because this field records a delivery commitment. Nobody promises 14:07, and
 * the half hours are two clicks instead of four keystrokes.
 *
 * Contract, again, matches the input it replaces: `YYYY-MM-DDTHH:mm`, or `""`.
 */
const TIME_SLOTS = Array.from({ length: 48 }, (_, i) => {
  const h = Math.floor(i / 2);
  const m = i % 2 ? "30" : "00";
  return `${pad(h)}:${m}`;
});

/** `"07:30"` → `"7:30 AM"`. Written out so neither clock convention can be read wrong. */
function timeLabel(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const suffix = h < 12 ? "AM" : "PM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${pad(m)} ${suffix}`;
}

export function DateTimeField({
  id,
  label,
  value,
  onChange,
  disabled,
  required,
  className,
}: {
  id?: string;
  label: string;
  /** `YYYY-MM-DDTHH:mm`, or `""`. */
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  required?: boolean;
  className?: string;
}) {
  /**
   * The two halves, held here rather than derived from `value`.
   *
   * A date with no time is not a moment, so `value` is `""` until both are
   * set — and reading the halves back OUT of `value` therefore made the field
   * impossible to fill: choosing the date emitted `""` because there was no
   * time yet, which erased the date, so choosing the time then had no date to
   * pair with. Each half kept clearing the other.
   */
  const [datePart, setDatePart] = useState(() => (value ?? "").split("T")[0] ?? "");
  const [timePart, setTimePart] = useState(() => (value ?? "").split("T")[1] ?? "");

  // Re-sync only on a change from outside — compared against this component's
  // own idea of the value, never against `""`, which is what it reports
  // whenever it is mid-edit.
  const [seenValue, setSeenValue] = useState(value);
  const combined = datePart && timePart ? `${datePart}T${timePart}` : "";
  if (value !== seenValue) {
    setSeenValue(value);
    if (value !== combined) {
      setDatePart((value ?? "").split("T")[0] ?? "");
      setTimePart((value ?? "").split("T")[1] ?? "");
    }
  }

  const emit = (nextDate: string, nextTime: string) => {
    const next = nextDate && nextTime ? `${nextDate}T${nextTime}` : "";
    setSeenValue(next);
    onChange(next);
  };

  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      <DateField
        id={id}
        label={label}
        value={datePart}
        disabled={disabled}
        required={required}
        onChange={(next) => {
          setDatePart(next);
          emit(next, timePart);
        }}
        className="min-w-[10rem] flex-1"
      />
      <Select
        aria-label={`${label} — time`}
        className="w-[6.5rem] shrink-0"
        selectClassName="pl-2.5 pr-7"
        disabled={disabled}
        required={required}
        value={timePart}
        onChange={(e) => {
          setTimePart(e.target.value);
          emit(datePart, e.target.value);
        }}
      >
        <option value="">Time</option>
        {TIME_SLOTS.map((slot) => (
          <option key={slot} value={slot}>
            {timeLabel(slot)}
          </option>
        ))}
      </Select>
    </div>
  );
}
