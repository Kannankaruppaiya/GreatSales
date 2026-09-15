import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import {
  CalendarPager,
  CalendarPopover,
  DayCells,
  MONTH_NAMES,
  MonthCells,
  YEAR_BLOCK,
  YearCells,
  pad,
  startOfMonth,
  utcDate,
} from "@/components/Calendar";
import { Button } from "@/components/ui";
import { cn } from "@/lib/utils";
import {
  GRANULARITIES,
  GRANULARITY_LABELS,
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
 *
 * The grids themselves come from `Calendar.tsx`, which is also what the date
 * fields open. There were two hand-rolled month grids in this app and they had
 * already drifted apart in cell height and weekday casing.
 */
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
  const triggerRef = useRef<HTMLDivElement>(null);

  const range = useMemo(
    () => resolveRange(granularity, anchor),
    [granularity, anchor],
  );
  const today = todayIso();

  // Re-open on the selected window rather than wherever it was last left.
  useEffect(() => {
    if (open) setViewing(anchor);
  }, [open, anchor]);

  const pick = (nextAnchor: string, nextGranularity = granularity) => {
    onChange(nextGranularity, nextAnchor);
    setOpen(false);
  };

  const viewYear = utcDate(viewing).getUTCFullYear();
  const viewMonth = utcDate(viewing).getUTCMonth();
  const anchorYear = utcDate(anchor).getUTCFullYear();
  const anchorMonth = utcDate(anchor).getUTCMonth();
  const inRange = (day: string) => day >= range.from && day <= range.to;

  return (
    <div className={cn("relative", className)}>
      <div ref={triggerRef} className="flex items-center gap-0.5">
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

      <CalendarPopover
        open={open}
        onClose={() => setOpen(false)}
        anchorRef={triggerRef}
        label="Choose a reporting window"
        width={304}
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
          <YearBlock selected={anchorYear} onPick={(y) => pick(`${y}-01-01`)} />
        ) : granularity === "month" ? (
          <>
            <CalendarPager
              label={String(viewYear)}
              prevLabel="Previous year"
              nextLabel="Next year"
              onStep={(d) => setViewing(startOfMonth(viewYear + d, 0))}
            />
            <MonthCells
              year={viewYear}
              isSelected={(m) => anchorYear === viewYear && m === anchorMonth}
              onPick={(m) => pick(`${viewYear}-${pad(m + 1)}-01`)}
            />
          </>
        ) : (
          <>
            <CalendarPager
              label={`${MONTH_NAMES[viewMonth]} ${viewYear}`}
              prevLabel="Previous month"
              nextLabel="Next month"
              onStep={(d) => setViewing(startOfMonth(viewYear, viewMonth + d))}
            />
            <DayCells
              viewing={viewing}
              todayIso={today}
              // The whole week highlights on a week window, so what a click is
              // about to select is visible before it is clicked.
              isSelected={inRange}
              onPick={(day) => pick(day)}
            />
            <p className="mt-2 text-3xs text-muted">
              {granularity === "week"
                ? "Picks the Monday-to-Sunday week that day falls in."
                : "Picks that single day."}
            </p>
          </>
        )}

        <div className="mt-3 flex items-center justify-between border-t border-line pt-2.5">
          <span className="text-3xs text-muted">
            {range.from === range.to ? range.from : `${range.from} → ${range.to}`}
          </span>
          {/* Today, in whatever length is selected — "this week" and "this
              month" are one click from anywhere you have wandered to. */}
          <Button type="button" variant="outline" size="sm" onClick={() => pick(today)}>
            Today
          </Button>
        </div>
      </CalendarPopover>
    </div>
  );
}

/**
 * Years around the selected one.
 *
 * Its own block start, computed from the selection rather than a written-down
 * list: a fixed range runs out, and this control would then be unable to reach
 * the year it is sitting in.
 */
function YearBlock({
  selected,
  onPick,
}: {
  selected: number;
  onPick: (year: number) => void;
}) {
  const [first, setFirst] = useState(selected - Math.floor(YEAR_BLOCK / 2));

  return (
    <>
      <CalendarPager
        label={`${first} – ${first + YEAR_BLOCK - 1}`}
        prevLabel="Previous years"
        nextLabel="Next years"
        onStep={(d) => setFirst((f) => f + d * YEAR_BLOCK)}
      />
      <YearCells
        firstYear={first}
        isSelected={(y) => y === selected}
        onPick={onPick}
      />
    </>
  );
}
