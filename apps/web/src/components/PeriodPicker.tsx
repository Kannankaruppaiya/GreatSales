import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui";
import { cn } from "@/lib/utils";
import {
  GRANULARITIES,
  GRANULARITY_LABELS,
  addDays,
  resolveRange,
  shiftRange,
  todayIso,
  type Granularity,
} from "@/data/periodRange";

/**
 * The reporting window picker: today, this week, this month, this year.
 *
 * It replaces a month dropdown that could only ever say "a month", and — worse
 * — was doing almost nothing when it did. The recurring half of the dashboard
 * moved with it; the new-sales half ignored the period entirely, so the same
 * pipeline total appeared under every month in the list. The window is real
 * now, which is why this control is worth building.
 *
 * A calendar rather than a list, because "the week of the 8th" and "last
 * Tuesday" are things people find by looking at a month, not by reading
 * options. The same grid serves all four granularities: what changes is what a
 * click MEANS and what is drawn as selected — a day, its Monday-to-Sunday week,
 * its whole month, or its whole year.
 */

const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"] as const;
const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
] as const;

const utc = (d: string) => new Date(`${d}T00:00:00.000Z`);
const pad = (n: number) => String(n).padStart(2, "0");
const isoOf = (d: Date) =>
  `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;

/**
 * The 42 cells of a month grid, Monday-first, including the neighbouring days
 * that fill the first and last rows.
 *
 * Six rows always, never five: a grid that changes height as you page through
 * months makes the control jump under the cursor, and the button you were
 * about to click moves.
 */
function monthGrid(anchor: string): string[] {
  const a = utc(anchor);
  const first = new Date(Date.UTC(a.getUTCFullYear(), a.getUTCMonth(), 1));
  const lead = (first.getUTCDay() + 6) % 7; // Monday = 0
  const start = isoOf(new Date(first.getTime() - lead * 86_400_000));
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}

export function PeriodPicker({
  granularity,
  anchor,
  onChange,
  className,
}: {
  granularity: Granularity;
  /** `YYYY-MM-DD` — any day inside the window. */
  anchor: string;
  onChange: (granularity: Granularity, anchor: string) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  // What the calendar is SHOWING, which is not what is selected: paging to
  // December to look at it must not move the window until something is clicked.
  const [viewing, setViewing] = useState(anchor);
  const wrap = useRef<HTMLDivElement>(null);

  const range = useMemo(
    () => resolveRange(granularity, anchor),
    [granularity, anchor],
  );
  const today = todayIso();

  // Re-open on the selected window rather than wherever it was last left.
  useEffect(() => {
    if (open) setViewing(anchor);
  }, [open, anchor]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const pick = (nextAnchor: string, nextGranularity = granularity) => {
    onChange(nextGranularity, nextAnchor);
    setOpen(false);
  };

  const viewYear = utc(viewing).getUTCFullYear();
  const viewMonth = utc(viewing).getUTCMonth();
  const inRange = (day: string) => day >= range.from && day <= range.to;

  return (
    <div ref={wrap} className={cn("relative", className)}>
      <div className="flex items-center gap-0.5">
        {/* Stepping is one window at a time, in the unit that is selected —
            the arrows mean "previous week" on a week and "previous year" on a
            year, which is what makes them worth having next to the label. */}
        <button
          type="button"
          aria-label={`Previous ${GRANULARITY_LABELS[granularity].toLowerCase()}`}
          onClick={() => onChange(granularity, shiftRange(granularity, anchor, -1))}
          className="grid h-8 w-6 place-items-center rounded-l-lg border border-r-0 border-line bg-surface text-muted hover:bg-surface-2 hover:text-ink cursor-pointer"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </button>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-label={`Reporting window: ${range.label}`}
          className="flex h-8 min-w-[9.5rem] items-center justify-center gap-1.5 border-y border-line bg-surface px-2 text-xs font-bold text-ink hover:bg-surface-2 cursor-pointer"
        >
          <CalendarDays className="h-3.5 w-3.5 text-muted" />
          {range.label}
        </button>

        <button
          type="button"
          aria-label={`Next ${GRANULARITY_LABELS[granularity].toLowerCase()}`}
          onClick={() => onChange(granularity, shiftRange(granularity, anchor, 1))}
          className="grid h-8 w-6 place-items-center rounded-r-lg border border-l-0 border-line bg-surface text-muted hover:bg-surface-2 hover:text-ink cursor-pointer"
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>

      {open && (
        <div
          role="dialog"
          aria-label="Choose a reporting window"
          className="absolute right-0 z-40 mt-1 w-[19rem] rounded-xl border border-line bg-surface p-3 shadow-xl"
        >
          {/* Granularity. Four separate views of the same data, which is the
              whole point: a day, a week, a month and a year are different
              questions and this is where you pick which one is being asked. */}
          <div
            role="tablist"
            aria-label="Window length"
            className="mb-3 flex rounded-lg border border-line p-0.5"
          >
            {GRANULARITIES.map((g) => (
              <button
                key={g}
                role="tab"
                aria-selected={g === granularity}
                type="button"
                onClick={() => onChange(g, anchor)}
                className={cn(
                  "flex-1 rounded-md px-2 py-1 text-2xs font-bold uppercase tracking-wider transition-colors cursor-pointer",
                  g === granularity
                    ? "bg-brand text-white"
                    : "text-muted hover:bg-surface-2 hover:text-ink",
                )}
              >
                {GRANULARITY_LABELS[g]}
              </button>
            ))}
          </div>

          {granularity === "year" ? (
            <YearGrid
              selected={utc(anchor).getUTCFullYear()}
              onPick={(y) => pick(`${y}-01-01`)}
            />
          ) : granularity === "month" ? (
            <MonthGrid
              year={viewYear}
              selectedMonth={
                utc(anchor).getUTCFullYear() === viewYear
                  ? utc(anchor).getUTCMonth()
                  : null
              }
              onYear={(delta) => setViewing(`${viewYear + delta}-01-01`)}
              onPick={(m) => pick(`${viewYear}-${pad(m + 1)}-01`)}
            />
          ) : (
            <DayGrid
              viewing={viewing}
              viewYear={viewYear}
              viewMonth={viewMonth}
              today={today}
              inRange={inRange}
              granularity={granularity}
              onMonth={(delta) =>
                setViewing(isoOf(new Date(Date.UTC(viewYear, viewMonth + delta, 1))))
              }
              onPick={(day) => pick(day)}
            />
          )}

          <div className="mt-3 flex items-center justify-between border-t border-line pt-2.5">
            <span className="text-3xs text-muted">
              {range.from === range.to ? range.from : `${range.from} → ${range.to}`}
            </span>
            {/* Today, in whatever length is selected — "this week" and "this
                month" are one click from anywhere you have wandered to. */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => pick(today)}
            >
              Today
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function Pager({
  label,
  onStep,
}: {
  label: string;
  onStep: (delta: number) => void;
}) {
  return (
    <div className="mb-2 flex items-center justify-between">
      <button
        type="button"
        aria-label="Previous"
        onClick={() => onStep(-1)}
        className="grid h-6 w-6 place-items-center rounded-md text-muted hover:bg-surface-2 hover:text-ink cursor-pointer"
      >
        <ChevronLeft className="h-3.5 w-3.5" />
      </button>
      <span className="text-xs font-bold text-ink">{label}</span>
      <button
        type="button"
        aria-label="Next"
        onClick={() => onStep(1)}
        className="grid h-6 w-6 place-items-center rounded-md text-muted hover:bg-surface-2 hover:text-ink cursor-pointer"
      >
        <ChevronRight className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function DayGrid({
  viewing,
  viewYear,
  viewMonth,
  today,
  inRange,
  granularity,
  onMonth,
  onPick,
}: {
  viewing: string;
  viewYear: number;
  viewMonth: number;
  today: string;
  inRange: (day: string) => boolean;
  granularity: Granularity;
  onMonth: (delta: number) => void;
  onPick: (day: string) => void;
}) {
  const days = useMemo(() => monthGrid(viewing), [viewing]);

  return (
    <>
      <Pager
        label={`${MONTHS[viewMonth]} ${viewYear}`}
        onStep={onMonth}
      />
      <div className="grid grid-cols-7 gap-0.5">
        {WEEKDAYS.map((d) => (
          <div
            key={d}
            className="pb-1 text-center text-3xs font-bold uppercase text-muted"
          >
            {d}
          </div>
        ))}
        {days.map((day) => {
          const d = utc(day);
          const outside = d.getUTCMonth() !== viewMonth;
          const selected = inRange(day);
          return (
            <button
              key={day}
              type="button"
              // The whole week highlights on a week window, so what a click is
              // about to select is visible before it is clicked.
              aria-label={day}
              aria-current={day === today ? "date" : undefined}
              onClick={() => onPick(day)}
              className={cn(
                "h-7 rounded-md text-2xs font-semibold transition-colors cursor-pointer",
                selected
                  ? "bg-brand text-white"
                  : outside
                    ? "text-muted/40 hover:bg-surface-2"
                    : "text-ink hover:bg-surface-2",
                day === today && !selected && "ring-1 ring-brand/60",
              )}
            >
              {d.getUTCDate()}
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-3xs text-muted">
        {granularity === "week"
          ? "Picks the Monday-to-Sunday week that day falls in."
          : "Picks that single day."}
      </p>
    </>
  );
}

function MonthGrid({
  year,
  selectedMonth,
  onYear,
  onPick,
}: {
  year: number;
  selectedMonth: number | null;
  onYear: (delta: number) => void;
  onPick: (month: number) => void;
}) {
  return (
    <>
      <Pager label={String(year)} onStep={onYear} />
      <div className="grid grid-cols-3 gap-1">
        {MONTHS.map((m, i) => (
          <button
            key={m}
            type="button"
            onClick={() => onPick(i)}
            className={cn(
              "h-8 rounded-md text-2xs font-semibold transition-colors cursor-pointer",
              i === selectedMonth
                ? "bg-brand text-white"
                : "text-ink hover:bg-surface-2",
            )}
          >
            {m}
          </button>
        ))}
      </div>
    </>
  );
}

/**
 * Years around the selected one.
 *
 * Computed from the selection, not from a written-down list: a fixed range runs
 * out, and this control would then be unable to reach the year it is sitting
 * in. Nine is three rows, which fits without scrolling.
 */
function YearGrid({
  selected,
  onPick,
}: {
  selected: number;
  onPick: (year: number) => void;
}) {
  const [centre, setCentre] = useState(selected);
  const years = Array.from({ length: 9 }, (_, i) => centre - 4 + i);

  return (
    <>
      <Pager
        label={`${years[0]} – ${years[years.length - 1]}`}
        onStep={(d) => setCentre((c) => c + d * 9)}
      />
      <div className="grid grid-cols-3 gap-1">
        {years.map((y) => (
          <button
            key={y}
            type="button"
            onClick={() => onPick(y)}
            className={cn(
              "h-8 rounded-md text-2xs font-semibold transition-colors cursor-pointer",
              y === selected
                ? "bg-brand text-white"
                : "text-ink hover:bg-surface-2",
            )}
          >
            {y}
          </button>
        ))}
      </div>
    </>
  );
}
