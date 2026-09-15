import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { addDays } from "@/data/periodRange";

/**
 * The calendar every date control in the console is built from.
 *
 * Dates used to be entered as three dropdowns — day, month, year. That solved
 * the problem it was built for: `<input type="date">` renders in the BROWSER's
 * locale, so `09/08/2026` reads as two different days depending on whose
 * machine it is on, which in a product used in India on en-US browsers is a
 * correctness bug, not a polish one. Three labelled dropdowns cannot be
 * misread.
 *
 * They are also three separate decisions and up to forty options to hunt
 * through for one date, and they cannot answer the question people actually
 * have in front of a date field — "which day is next Tuesday", "is the 15th a
 * weekend". A month grid answers that by being looked at.
 *
 * So: a calendar, and the ambiguity problem solved where it actually lives —
 * in what the CLOSED field says. The trigger always reads `09 Sep 2026`, with
 * the month in words. No arrangement of digits, no locale, nothing to misread.
 *
 * Everything here works in ISO strings (`YYYY-MM-DD`) and UTC arithmetic. A
 * calendar day is not an instant, and passing it through a local-time `Date`
 * is how a picker ends up one day off for half the world.
 */

export const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
] as const;

export const MONTH_NAMES_LONG = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
] as const;

/** Monday first: this is a work calendar, and the week starts on Monday here. */
export const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"] as const;

export const pad = (n: number) => String(n).padStart(2, "0");

/** `"2026-09-08"` → a UTC midnight Date. */
export const utcDate = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

/** The inverse of {@link utcDate}. */
export const isoOf = (d: Date) =>
  `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;

export const isIsoDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value ?? "");

/** `"2026-09"` — a reporting period, the shape MonthSelect speaks. */
export const isPeriodString = (value: string) => /^\d{4}-(0[1-9]|1[0-2])$/.test(value ?? "");

/**
 * How many days a month has, February included.
 *
 * `Date.UTC(y, m, 0)` is day zero of the NEXT month, which is the last day of
 * this one — so leap years stay the calendar's problem rather than a rule
 * written here that is wrong every hundredth year.
 */
export function daysInMonth(year: number, month1to12: number): number {
  return new Date(Date.UTC(year, month1to12, 0)).getUTCDate();
}

export const startOfMonth = (year: number, month0: number) =>
  isoOf(new Date(Date.UTC(year, month0, 1)));

/** Today, in the VIEWER's timezone — "today" is a thing about their calendar. */
export function today(now: Date = new Date()): string {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/**
 * `"2026-09-08"` → `"08 Sep 2026"`.
 *
 * The month in words is the whole point: this string is what a closed date
 * field shows, and it is the reason dropping the three dropdowns does not drop
 * the ambiguity guarantee they existed for.
 */
export function dateLabel(iso: string): string {
  if (!isIsoDate(iso)) return "";
  const d = utcDate(iso);
  return `${pad(d.getUTCDate())} ${MONTH_NAMES[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** The same date spelled out, for screen readers: `"8 September 2026"`. */
export function dateLabelLong(iso: string): string {
  if (!isIsoDate(iso)) return "";
  const d = utcDate(iso);
  return `${d.getUTCDate()} ${MONTH_NAMES_LONG[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/**
 * The 42 cells of a month grid, Monday-first, including the neighbouring days
 * that fill the first and last rows.
 *
 * Six rows always, never five: a grid that changes height as you page through
 * months makes the panel jump under the cursor, and the day you were about to
 * click moves out from under it.
 */
export function monthGridDays(anchor: string): string[] {
  const a = utcDate(anchor);
  const first = new Date(Date.UTC(a.getUTCFullYear(), a.getUTCMonth(), 1));
  const lead = (first.getUTCDay() + 6) % 7; // Monday = 0
  const start = isoOf(new Date(first.getTime() - lead * 86_400_000));
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}

/* ------------------------------------------------------------------ *
 * Popover
 * ------------------------------------------------------------------ */

/**
 * The floating panel, rendered into `document.body` rather than next to its
 * trigger.
 *
 * Portalled because most of these fields sit inside a Modal, whose body is
 * `overflow-y-auto` inside an `overflow-hidden` dialog. An absolutely
 * positioned panel there is CLIPPED — the bottom two rows of the calendar
 * simply do not exist — and no amount of z-index fixes it, because the problem
 * is the scroll container, not the stacking order.
 *
 * Position is therefore computed from the trigger's viewport rect and applied
 * as `fixed`, re-measured on scroll and resize. It flips above the trigger when
 * there is no room below, which is what a date field near the bottom of a
 * dialog needs.
 */
export function CalendarPopover({
  open,
  onClose,
  anchorRef,
  label,
  width = 288,
  children,
}: {
  open: boolean;
  onClose: () => void;
  anchorRef: RefObject<HTMLElement | null>;
  /** Names the dialog for assistive tech — "Choose a due date". */
  label: string;
  width?: number;
  children: ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    if (!open) {
      setPos(null);
      return;
    }
    const place = () => {
      const anchor = anchorRef.current;
      const panel = panelRef.current;
      if (!anchor || !panel) return;
      const a = anchor.getBoundingClientRect();
      const w = panel.offsetWidth || width;
      const h = panel.offsetHeight || 320;
      const gap = 6;
      const edge = 8;

      // Left-aligned with the field, pulled back to its right edge and then to
      // the viewport when the panel is wider than the room that is left.
      let left = a.left;
      if (left + w > window.innerWidth - edge) left = a.right - w;
      left = Math.max(edge, Math.min(left, window.innerWidth - w - edge));

      let top = a.bottom + gap;
      if (top + h > window.innerHeight - edge) {
        const above = a.top - h - gap;
        top = above >= edge ? above : Math.max(edge, window.innerHeight - h - edge);
      }
      setPos({ top, left });
    };

    place();
    window.addEventListener("resize", place);
    // Capture, so a scroll inside the modal body counts and not only the page.
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, anchorRef, width]);

  useEffect(() => {
    if (!open) return;
    /**
     * Escape, caught on the way DOWN from `document`.
     *
     * A React handler on the panel is not enough: the trigger that opened this
     * is OUTSIDE the portal, so an Escape pressed before focus has moved into
     * the grid never reaches the panel at all. It bubbles straight to the
     * document-level handler the enclosing Dialog installed — and the whole
     * modal closes because somebody dismissed a calendar.
     *
     * A capture listener on `document` runs before that bubble-phase one
     * whatever had focus, and stopping the event there is what keeps Escape
     * meaning "close the calendar".
     */
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      onClose();
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (panelRef.current?.contains(target)) return;
      // The trigger toggles itself; closing here too would reopen on the
      // click that was meant to close.
      if (anchorRef.current?.contains(target)) return;
      onClose();
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open, onClose, anchorRef]);

  if (!open) return null;

  return createPortal(
    <div
      ref={panelRef}
      role="dialog"
      aria-label={label}
      style={{
        position: "fixed",
        top: pos?.top ?? 0,
        left: pos?.left ?? 0,
        width,
        // Invisible for the one frame between mounting and being measured, so
        // it is never seen in the top-left corner on its way to the field.
        // Transparent rather than `visibility: hidden`, because a hidden
        // element cannot take focus — and the calendar focuses the selected
        // day as it opens, which silently did nothing while that was the rule.
        opacity: pos ? 1 : 0,
      }}
      className="z-[60] rounded-xl border border-line bg-surface p-3 shadow-xl"
    >
      {children}
    </div>,
    document.body,
  );
}

/* ------------------------------------------------------------------ *
 * Shared chrome
 * ------------------------------------------------------------------ */

/**
 * The header of every grid: back, a label, forward.
 *
 * The label is a BUTTON when `onZoomOut` is given — clicking "Sep 2026" steps
 * up to the twelve months of 2026, and clicking "2026" from there steps up to a
 * block of years. That is what replaces the year dropdown: reaching 1999 is
 * two clicks, not two hundred presses of a chevron.
 */
export function CalendarPager({
  label,
  onStep,
  onZoomOut,
  zoomOutLabel,
  prevLabel = "Previous",
  nextLabel = "Next",
}: {
  label: string;
  onStep: (delta: number) => void;
  onZoomOut?: () => void;
  zoomOutLabel?: string;
  prevLabel?: string;
  nextLabel?: string;
}) {
  return (
    <div className="mb-2 flex items-center justify-between gap-1">
      <button
        type="button"
        aria-label={prevLabel}
        onClick={() => onStep(-1)}
        className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-muted hover:bg-surface-2 hover:text-ink cursor-pointer"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      {onZoomOut ? (
        <button
          type="button"
          onClick={onZoomOut}
          aria-label={zoomOutLabel}
          className="flex-1 rounded-md px-2 py-1 text-xs font-bold text-ink hover:bg-surface-2 cursor-pointer"
        >
          {label}
        </button>
      ) : (
        <span className="flex-1 text-center text-xs font-bold text-ink">{label}</span>
      )}
      <button
        type="button"
        aria-label={nextLabel}
        onClick={() => onStep(1)}
        className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-muted hover:bg-surface-2 hover:text-ink cursor-pointer"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}

const cellBase =
  "rounded-md text-2xs font-semibold transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-transparent";

/**
 * A month of day cells.
 *
 * `isSelected` is a predicate rather than a value because the same grid draws a
 * single chosen day and a whole highlighted week or month — see PeriodPicker,
 * where what a click MEANS changes but the grid does not.
 */
export function DayCells({
  viewing,
  isSelected,
  isDisabled,
  onPick,
  todayIso: todayDate,
  focusedDay,
  onFocusedDayChange,
  gridRef,
}: {
  /** Any day in the month being shown. */
  viewing: string;
  isSelected: (day: string) => boolean;
  isDisabled?: (day: string) => boolean;
  onPick: (day: string) => void;
  todayIso: string;
  /** The one cell in the tab order, for arrow-key navigation. */
  focusedDay?: string;
  onFocusedDayChange?: (day: string) => void;
  gridRef?: RefObject<HTMLDivElement | null>;
}) {
  const days = useMemo(() => monthGridDays(viewing), [viewing]);
  const viewMonth = utcDate(viewing).getUTCMonth();

  /**
   * Arrow keys walk the calendar the way it looks: left and right by a day, up
   * and down by a WEEK, because that is what is directly above a cell. Page
   * steps a month, Home and End the week. Without this the only way through a
   * grid of 42 buttons is 42 presses of Tab.
   */
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!focusedDay || !onFocusedDayChange) return;
    const moves: Record<string, number> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -7,
      ArrowDown: 7,
      PageUp: -28,
      PageDown: 28,
    };
    let next: string | null = null;
    if (e.key in moves) next = addDays(focusedDay, moves[e.key]);
    else if (e.key === "Home") next = addDays(focusedDay, -((utcDate(focusedDay).getUTCDay() + 6) % 7));
    else if (e.key === "End") next = addDays(focusedDay, 6 - ((utcDate(focusedDay).getUTCDay() + 6) % 7));
    if (!next) return;
    e.preventDefault();
    onFocusedDayChange(next);
  };

  return (
    <div
      ref={gridRef}
      role="grid"
      onKeyDown={onKeyDown}
      className="grid grid-cols-7 gap-0.5"
    >
      {WEEKDAYS.map((d) => (
        <div
          key={d}
          role="columnheader"
          className="pb-1 text-center text-3xs font-bold uppercase text-muted"
        >
          {d}
        </div>
      ))}
      {days.map((day) => {
        const d = utcDate(day);
        const outside = d.getUTCMonth() !== viewMonth;
        const selected = isSelected(day);
        const disabled = isDisabled?.(day) ?? false;
        return (
          <button
            key={day}
            type="button"
            data-day={day}
            disabled={disabled}
            // The date spelled out, so a screen reader says "8 September 2026"
            // rather than a bare "8".
            aria-label={dateLabelLong(day)}
            aria-pressed={selected}
            aria-current={day === todayDate ? "date" : undefined}
            tabIndex={focusedDay ? (day === focusedDay ? 0 : -1) : 0}
            onFocus={() => {
              if (day !== focusedDay) onFocusedDayChange?.(day);
            }}
            onClick={() => onPick(day)}
            className={cn(
              cellBase,
              "h-8",
              selected
                ? "bg-brand text-white hover:bg-brand-hover"
                : outside
                  ? "text-muted/40 hover:bg-surface-2"
                  : "text-ink hover:bg-surface-2",
              day === todayDate && !selected && "ring-1 ring-brand/60",
            )}
          >
            {d.getUTCDate()}
          </button>
        );
      })}
    </div>
  );
}

/** The twelve months of one year. */
export function MonthCells({
  year,
  isSelected,
  isDisabled,
  onPick,
}: {
  year: number;
  isSelected: (month0: number) => boolean;
  isDisabled?: (month0: number) => boolean;
  onPick: (month0: number) => void;
}) {
  return (
    <div role="grid" className="grid grid-cols-3 gap-1">
      {MONTH_NAMES.map((m, i) => {
        const selected = isSelected(i);
        return (
          <button
            key={m}
            type="button"
            disabled={isDisabled?.(i) ?? false}
            aria-label={`${MONTH_NAMES_LONG[i]} ${year}`}
            aria-pressed={selected}
            onClick={() => onPick(i)}
            className={cn(
              cellBase,
              "h-9",
              selected ? "bg-brand text-white hover:bg-brand-hover" : "text-ink hover:bg-surface-2",
            )}
          >
            {m}
          </button>
        );
      })}
    </div>
  );
}

/** Nine years — three rows, which fits without scrolling. */
export const YEAR_BLOCK = 9;

export function YearCells({
  firstYear,
  isSelected,
  isDisabled,
  onPick,
}: {
  firstYear: number;
  isSelected: (year: number) => boolean;
  isDisabled?: (year: number) => boolean;
  onPick: (year: number) => void;
}) {
  return (
    <div role="grid" className="grid grid-cols-3 gap-1">
      {Array.from({ length: YEAR_BLOCK }, (_, i) => firstYear + i).map((y) => {
        const selected = isSelected(y);
        return (
          <button
            key={y}
            type="button"
            disabled={isDisabled?.(y) ?? false}
            aria-label={String(y)}
            aria-pressed={selected}
            onClick={() => onPick(y)}
            className={cn(
              cellBase,
              "h-9",
              selected ? "bg-brand text-white hover:bg-brand-hover" : "text-ink hover:bg-surface-2",
            )}
          >
            {y}
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * The day calendar
 * ------------------------------------------------------------------ */

type Zoom = "day" | "month" | "year";

/**
 * Pick one date.
 *
 * Three zoom levels behind one grid — days, the twelve months of a year, a
 * block of nine years — reached by clicking the header. This is what carries
 * the reach the year dropdown had: an invoice from 1999 and a commitment in
 * 2031 are both a handful of clicks away, and neither needs a list that had to
 * guess how far either way anyone would ever go.
 */
export function CalendarDayView({
  selected,
  onPick,
  todayIso: todayDate = today(),
  autoFocus = true,
  footer,
}: {
  /** `YYYY-MM-DD`, or `""` for no date. */
  selected: string;
  onPick: (iso: string) => void;
  todayIso?: string;
  autoFocus?: boolean;
  footer?: ReactNode;
}) {
  const start = isIsoDate(selected) ? selected : todayDate;
  const [viewing, setViewing] = useState(start);
  const [focused, setFocused] = useState(start);
  const [zoom, setZoom] = useState<Zoom>("day");
  const gridRef = useRef<HTMLDivElement>(null);
  const movedByKey = useRef(false);
  const mounted = useRef(false);

  // Re-open on the selected date rather than wherever it was last left.
  useEffect(() => {
    setViewing(start);
    setFocused(start);
    // Only when the date handed in changes, not on every render of a parent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  // Follow the roving focus with real DOM focus, but only when a KEY moved it.
  // Doing it on every change would steal focus back from anything else in the
  // panel the moment the mouse hovered a cell.
  useEffect(() => {
    if (!movedByKey.current) return;
    movedByKey.current = false;
    gridRef.current
      ?.querySelector<HTMLButtonElement>(`[data-day="${focused}"]`)
      ?.focus();
  }, [focused, viewing]);

  // Land on the selected day when the panel opens, so a keyboard user is
  // inside the grid rather than at the top of the document.
  useEffect(() => {
    if (!autoFocus || mounted.current) return;
    mounted.current = true;
    gridRef.current
      ?.querySelector<HTMLButtonElement>(`[data-day="${focused}"]`)
      ?.focus();
  }, [autoFocus, focused]);

  const viewYear = utcDate(viewing).getUTCFullYear();
  const viewMonth = utcDate(viewing).getUTCMonth();
  const [yearBlockStart, setYearBlockStart] = useState(
    () => viewYear - Math.floor(YEAR_BLOCK / 2),
  );

  const moveFocus = (day: string) => {
    movedByKey.current = true;
    setFocused(day);
    // Walking off the edge of the month pages the grid, which is the only way
    // arrow keys can reach the 1st of next month.
    if (day.slice(0, 7) !== viewing.slice(0, 7)) setViewing(day);
  };

  if (zoom === "year") {
    return (
      <>
        <CalendarPager
          label={`${yearBlockStart} – ${yearBlockStart + YEAR_BLOCK - 1}`}
          prevLabel="Previous years"
          nextLabel="Next years"
          onStep={(d) => setYearBlockStart((y) => y + d * YEAR_BLOCK)}
        />
        <YearCells
          firstYear={yearBlockStart}
          isSelected={(y) => y === viewYear}
          onPick={(y) => {
            setViewing(startOfMonth(y, viewMonth));
            setZoom("month");
          }}
        />
        {footer}
      </>
    );
  }

  if (zoom === "month") {
    return (
      <>
        <CalendarPager
          label={String(viewYear)}
          prevLabel="Previous year"
          nextLabel="Next year"
          zoomOutLabel={`${viewYear} — choose a year`}
          onStep={(d) => setViewing(startOfMonth(viewYear + d, viewMonth))}
          onZoomOut={() => {
            setYearBlockStart(viewYear - Math.floor(YEAR_BLOCK / 2));
            setZoom("year");
          }}
        />
        <MonthCells
          year={viewYear}
          isSelected={(m) => m === viewMonth}
          onPick={(m) => {
            setViewing(startOfMonth(viewYear, m));
            setZoom("day");
          }}
        />
        {footer}
      </>
    );
  }

  return (
    <>
      <CalendarPager
        label={`${MONTH_NAMES[viewMonth]} ${viewYear}`}
        prevLabel="Previous month"
        nextLabel="Next month"
        zoomOutLabel={`${MONTH_NAMES_LONG[viewMonth]} ${viewYear} — choose a month`}
        onStep={(d) => setViewing(startOfMonth(viewYear, viewMonth + d))}
        onZoomOut={() => setZoom("month")}
      />
      <DayCells
        viewing={viewing}
        gridRef={gridRef}
        todayIso={todayDate}
        focusedDay={focused}
        onFocusedDayChange={moveFocus}
        isSelected={(day) => day === selected}
        onPick={onPick}
      />
      {footer}
    </>
  );
}

/* ------------------------------------------------------------------ *
 * The trigger
 * ------------------------------------------------------------------ */

/**
 * The closed field: a button that reads the date in words and opens a
 * calendar.
 *
 * A button rather than a text input, because a half-typed date is a state this
 * control does not have — the value is always a real day or nothing at all.
 */
export function CalendarTrigger({
  id,
  open,
  onToggle,
  text,
  placeholder,
  ariaLabel,
  disabled,
  required,
  className,
  buttonRef,
}: {
  id?: string;
  open: boolean;
  onToggle: () => void;
  /** The chosen value in words, or `""` to show the placeholder. */
  text: string;
  placeholder: string;
  ariaLabel: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  buttonRef: RefObject<HTMLButtonElement | null>;
}) {
  return (
    <button
      id={id}
      ref={buttonRef}
      type="button"
      disabled={disabled}
      onClick={onToggle}
      aria-haspopup="dialog"
      aria-expanded={open}
      aria-required={required || undefined}
      aria-label={text ? `${ariaLabel}: ${text}` : ariaLabel}
      className={cn(
        "flex h-9 w-full items-center gap-2 rounded-lg border border-line bg-surface px-3 text-sm font-medium text-ink shadow-2xs transition-all hover:border-muted/30 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-muted cursor-pointer",
        open && "border-brand ring-2 ring-brand/20",
        className,
      )}
    >
      <CalendarDays className="h-4 w-4 shrink-0 text-muted" />
      <span className={cn("truncate", !text && "text-muted/70 font-normal")}>
        {text || placeholder}
      </span>
    </button>
  );
}

/** The row under a calendar: clear on the left, today on the right. */
export function CalendarActions({
  onClear,
  onToday,
  todayLabel = "Today",
}: {
  onClear?: () => void;
  onToday?: () => void;
  todayLabel?: string;
}) {
  if (!onClear && !onToday) return null;
  return (
    <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-line pt-2.5">
      {onClear ? (
        <button
          type="button"
          onClick={onClear}
          className="rounded-md px-2 py-1 text-2xs font-semibold text-muted hover:bg-surface-2 hover:text-ink cursor-pointer"
        >
          Clear
        </button>
      ) : (
        <span />
      )}
      {onToday && (
        <button
          type="button"
          onClick={onToday}
          className="rounded-md border border-line px-2.5 py-1 text-2xs font-semibold text-ink hover:bg-surface-2 cursor-pointer"
        >
          {todayLabel}
        </button>
      )}
    </div>
  );
}
