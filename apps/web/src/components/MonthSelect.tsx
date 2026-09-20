import { useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarActions,
  CalendarPager,
  CalendarPopover,
  CalendarTrigger,
  MonthCells,
  YEAR_BLOCK,
  YearCells,
} from "@/components/Calendar";
import { useManagements } from "@/features/management/queries";
import {
  currentPeriod,
  monthOptions,
  parsePeriod,
  periodLabel,
} from "@/data/months";

/**
 * The month picker, used by every surface that has one.
 *
 * There were four of these, each mapping over the same hardcoded twelve-month
 * array, so a fix to the range had to be made in four places and the Data page
 * had already drifted — it defaulted to the FIRST entry of that list rather
 * than to the current month, which is why it opened on April 2026 in September.
 *
 * It was a `<select>` of every month the workspace has, grouped by year. On a
 * tenant with real history that is a scrolling list of a hundred and twenty
 * options to find "March, two years ago" in. A grid of twelve months under a
 * year you page through is the same information laid out the way a year
 * actually is, and it is the same calendar the date fields and the dashboard's
 * reporting window use.
 *
 * The range still comes from the workspace's own history (already fetched by
 * the layout, so no extra request) through three months ahead. Months outside
 * it are drawn but not selectable, which says "there is nothing there" — a
 * list said it by simply not containing them, which is indistinguishable from
 * a bug. `value` is always selectable even when it falls outside that range: a
 * link to an old period, or a lock on a month before the workspace existed,
 * must not show a selector displaying some other month than the page beneath
 * it.
 */
export function MonthSelect({
  id,
  value,
  onChange,
  ariaLabel = "Reporting month",
  className,
}: {
  /** Goes on the trigger, so a page's own `<label htmlFor>` still lands. */
  id?: string;
  value: string;
  onChange: (period: string) => void;
  ariaLabel?: string;
  className?: string;
}) {
  const { data: managements } = useManagements();
  const workspace = managements?.[0];
  // The earliest period that HAS data, not the tenant row's creation date — a
  // workspace created today can be imported with years of history behind it,
  // and a selector floored at createdAt would hide exactly that history.
  // Falls back to createdAt when the tenant has no worksheet rows at all.
  const floor = workspace?.firstPeriod ?? workspace?.createdAt;

  const [open, setOpen] = useState(false);
  const [zoom, setZoom] = useState<"month" | "year">("month");
  const triggerRef = useRef<HTMLButtonElement>(null);

  const bounds = useMemo(() => {
    const options = monthOptions(floor);
    return { min: options[0], max: options[options.length - 1] };
  }, [floor]);

  const selectedYear = useMemo(() => {
    try {
      return parsePeriod(value).year;
    } catch {
      return new Date().getFullYear();
    }
  }, [value]);

  // What the calendar is SHOWING, which is not what is selected: paging to last
  // year to look at it must not move the page under it until something is
  // clicked.
  const [viewYear, setViewYear] = useState(selectedYear);
  const [yearBlockStart, setYearBlockStart] = useState(
    () => selectedYear - Math.floor(YEAR_BLOCK / 2),
  );

  // Re-open on the selected month rather than wherever it was last left.
  useEffect(() => {
    if (!open) return;
    setViewYear(selectedYear);
    setZoom("month");
  }, [open, selectedYear]);

  const close = () => {
    setOpen(false);
    triggerRef.current?.focus();
  };

  const pick = (period: string) => {
    onChange(period);
    close();
  };

  const periodOf = (year: number, month0: number) =>
    `${year}-${String(month0 + 1).padStart(2, "0")}`;

  // Outside the workspace's window and not the month already selected — there
  // is no data there and nothing to show.
  const outOfRange = (period: string) =>
    period !== value && (period < bounds.min || period > bounds.max);

  const minYear = Number(bounds.min.slice(0, 4));
  const maxYear = Number(bounds.max.slice(0, 4));

  return (
    <div className={className}>
      <CalendarTrigger
        id={id}
        buttonRef={triggerRef}
        open={open}
        onToggle={() => setOpen((v) => !v)}
        text={periodLabel(value)}
        placeholder="Select month"
        ariaLabel={ariaLabel}
      />
      <CalendarPopover
        open={open}
        onClose={close}
        anchorRef={triggerRef}
        label={`Choose ${ariaLabel.toLowerCase()}`}
        width={256}
      >
        {zoom === "year" ? (
          <>
            <CalendarPager
              label={`${yearBlockStart} – ${yearBlockStart + YEAR_BLOCK - 1}`}
              prevLabel="Previous years"
              nextLabel="Next years"
              onStep={(d) => setYearBlockStart((y) => y + d * YEAR_BLOCK)}
            />
            <YearCells
              firstYear={yearBlockStart}
              isSelected={(y) => y === selectedYear}
              isDisabled={(y) => (y < minYear || y > maxYear) && y !== selectedYear}
              onPick={(y) => {
                setViewYear(y);
                setZoom("month");
              }}
            />
          </>
        ) : (
          <>
            <CalendarPager
              label={String(viewYear)}
              prevLabel="Previous year"
              nextLabel="Next year"
              zoomOutLabel={`${viewYear} — choose a year`}
              onStep={(d) => setViewYear((y) => y + d)}
              onZoomOut={() => {
                setYearBlockStart(viewYear - Math.floor(YEAR_BLOCK / 2));
                setZoom("year");
              }}
            />
            <MonthCells
              year={viewYear}
              isSelected={(m) => periodOf(viewYear, m) === value}
              isDisabled={(m) => outOfRange(periodOf(viewYear, m))}
              onPick={(m) => pick(periodOf(viewYear, m))}
            />
          </>
        )}
        <CalendarActions
          onToday={() => pick(currentPeriod())}
          todayLabel="This month"
        />
      </CalendarPopover>
    </div>
  );
}
