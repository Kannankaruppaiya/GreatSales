import { useId, useState } from "react";
import { Select } from "@/components/ui";
import { cn } from "@/lib/utils";

/**
 * A date, entered as three dropdowns: day, month, year.
 *
 * This replaces `<input type="date">` everywhere in the console, for two
 * reasons.
 *
 * The one that is a correctness problem: a native date input renders in the
 * BROWSER's locale, so the same field reads `09/08/2026` to one user and
 * `08/09/2026` to another and neither can tell which half is the month. This
 * product is used in India, where dates are written day-first, on a browser
 * that is very often set to en-US, where they are not. A month named `Sep`
 * cannot be misread as a day.
 *
 * The other is that the native control looks like a different feature in every
 * browser — Chrome's spinner, Safari's wheel, Firefox's own panel — and none of
 * them match anything else on the page.
 *
 * The contract is deliberately the same as the input it replaces: `value` and
 * the string handed to `onChange` are both `YYYY-MM-DD`, or `""` for no date.
 * Nothing upstream had to learn a new shape.
 */

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
] as const;

/**
 * How many days a month has, February included.
 *
 * `new Date(Date.UTC(y, m, 0))` is day zero of the NEXT month, which is the
 * last day of this one — so leap years are the calendar's problem rather than a
 * rule written here that is wrong every hundredth year.
 */
function daysInMonth(year: number, month1to12: number): number {
  return new Date(Date.UTC(year, month1to12, 0)).getUTCDate();
}

/** One date, as far as it has been filled in. */
interface Parts {
  y: number | null;
  m: number | null;
  d: number | null;
}

/** `"2026-09-10"` → `{ y: 2026, m: 9, d: 10 }`. Anything else → all null. */
function parse(value: string): Parts {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value ?? "");
  if (!match) return { y: null, m: null, d: null };
  return { y: +match[1], m: +match[2], d: +match[3] };
}

const pad = (n: number) => String(n).padStart(2, "0");

/** The inverse of {@link parse}. A part-filled date has no value, so: `""`. */
function format({ y, m, d }: Parts): string {
  if (y == null || m == null || d == null) return "";
  return `${y}-${pad(m)}-${pad(d)}`;
}

/**
 * How far the year dropdown reaches either side of today.
 *
 * Computed from the clock on every render, never a written-down list: a
 * hardcoded range runs out, and the field it is attached to then cannot record
 * next year at all. Five each way covers an old invoice and a forward
 * commitment; a date outside it is still selectable if the record already
 * carries one, because the year it holds is always added to the options.
 */
const YEAR_SPAN = 5;

export function DateField({
  id,
  label,
  value,
  onChange,
  disabled,
  required,
  className,
}: {
  /** Goes on the DAY select, so an existing `<label htmlFor>` still lands. */
  id?: string;
  /**
   * What this date is, for assistive tech — "Due date", "Invoice date". The
   * three selects announce as "Due date, Month" rather than a bare "Month",
   * which on a form with two dates is the difference between usable and not.
   */
  label: string;
  /** `YYYY-MM-DD`, or `""` for no date. */
  value: string;
  /** Called with `YYYY-MM-DD`, or `""` while the date is incomplete. */
  onChange: (value: string) => void;
  disabled?: boolean;
  required?: boolean;
  className?: string;
}) {
  const fallbackId = useId();
  const dayId = id ?? `${fallbackId}-day`;

  /**
   * The three selections, held HERE rather than derived from `value`.
   *
   * A partly-filled date has no `YYYY-MM-DD` to be, so `value` is `""` until
   * all three are chosen. Deriving the selects from it therefore emptied the
   * whole control the moment any one of them was cleared: clear the day to
   * change it and the month and year you had already picked vanished with it.
   */
  const [draft, setDraft] = useState<Parts>(() => parse(value));

  /**
   * Re-sync when `value` changes from OUTSIDE — a form reset, or a different
   * record loaded into the same modal.
   *
   * The comparison is against the draft's own idea of the date, not against
   * `""`. `value` goes empty every time this control is mid-edit, and treating
   * that as an external change would wipe the draft on the first keystroke —
   * the bug this state exists to fix, reintroduced through the back door.
   */
  const [seenValue, setSeenValue] = useState(value);
  if (value !== seenValue) {
    setSeenValue(value);
    if (value !== format(draft)) setDraft(parse(value));
  }

  const { y, m, d } = draft;
  const thisYear = new Date().getFullYear();

  const years: number[] = [];
  for (let i = thisYear + YEAR_SPAN; i >= thisYear - YEAR_SPAN; i--) years.push(i);
  // A record from outside the window keeps its own year rather than silently
  // reading as blank and being saved back as something else.
  if (y != null && !years.includes(y)) {
    years.push(y);
    years.sort((a, b) => b - a);
  }

  // Until the month is known, offer 31 — otherwise picking the day first would
  // be impossible for the 29th, 30th and 31st, and people fill these left to
  // right.
  const dayCount = y != null && m != null ? daysInMonth(y, m) : 31;

  /**
   * Record one selection, and report the date if it is now complete.
   *
   * `""` while incomplete is exactly what the input this replaced reported, so
   * a form that treats empty as "not set" keeps working without knowing
   * anything changed.
   *
   * The day is clamped rather than cleared when a shorter month is chosen: 31
   * January then February means the end of February, which is what the person
   * meant, and clearing it would quietly discard a choice they had made.
   */
  const update = (next: Partial<Parts>) => {
    const merged: Parts = { ...draft, ...next };
    if (merged.y != null && merged.m != null && merged.d != null) {
      merged.d = Math.min(merged.d, daysInMonth(merged.y, merged.m));
    }
    setDraft(merged);
    const formatted = format(merged);
    setSeenValue(formatted);
    onChange(formatted);
  };

  const asNumber = (raw: string) => (raw === "" ? null : Number(raw));

  return (
    <div
      role="group"
      aria-label={label}
      /**
       * Wraps rather than crushes.
       *
       * Several of these sit in a two-column grid inside a modal, which leaves
       * about 195px — less than three selects need. Without `flex-wrap` the
       * month, as the only flexible one, collapsed to its chevron and the field
       * read "24 | ‹› | 2026": the one part a date is genuinely ambiguous
       * without was the part that disappeared. Each select carries a min-width
       * so a tight column pushes the year onto a second line instead.
       */
      className={cn("flex flex-wrap items-center gap-1.5", className)}
    >
      <Select
        id={dayId}
        aria-label={`${label} — day`}
        className="w-[4.25rem] shrink-0"
        selectClassName="pl-2.5 pr-7"
        disabled={disabled}
        required={required}
        value={d ?? ""}
        onChange={(e) => update({ d: asNumber(e.target.value) })}
      >
        <option value="">Day</option>
        {Array.from({ length: dayCount }, (_, i) => i + 1).map((n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
      </Select>

      <Select
        aria-label={`${label} — month`}
        // Grows to fill a narrow column and stops there. Left to `flex-1` on a
        // full-width row it stretched to 290px around the word "Sep", which
        // reads as a layout accident rather than a field.
        className="min-w-[4.75rem] max-w-[8rem] flex-1"
        selectClassName="pl-2.5 pr-7"
        disabled={disabled}
        required={required}
        value={m ?? ""}
        onChange={(e) => update({ m: asNumber(e.target.value) })}
      >
        <option value="">Month</option>
        {MONTHS.map((name, i) => (
          <option key={name} value={i + 1}>
            {name}
          </option>
        ))}
      </Select>

      <Select
        aria-label={`${label} — year`}
        className="w-[5rem] shrink-0"
        selectClassName="pl-2.5 pr-7"
        disabled={disabled}
        required={required}
        value={y ?? ""}
        onChange={(e) => update({ y: asNumber(e.target.value) })}
      >
        <option value="">Year</option>
        {years.map((year) => (
          <option key={year} value={year}>
            {year}
          </option>
        ))}
      </Select>
    </div>
  );
}

/**
 * A date AND a time, as four dropdowns.
 *
 * `<input type="datetime-local">` carries every problem the date input does and
 * adds its own: a 12-hour browser shows AM/PM and a 24-hour one does not, so
 * "delivery by 07:30" is genuinely ambiguous between two users looking at the
 * same order.
 *
 * The time is a fixed half-hour list rather than free entry, because this field
 * records a delivery commitment. Nobody promises 14:07, and the half hours are
 * two clicks instead of four keystrokes.
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
   * The two halves, held here for the same reason DateField holds its three.
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
        className="flex-1 min-w-[15rem]"
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
