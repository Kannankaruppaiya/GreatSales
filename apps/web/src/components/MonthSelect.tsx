import { useMemo } from "react";
import { Select } from "@/components/ui";
import { useManagements } from "@/features/management/queries";
import {
  groupByYear,
  monthOptions,
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
 * The range comes from the workspace's creation date (already fetched by the
 * layout, so no extra request) through three months ahead, grouped by year.
 * `value` is always rendered even if it falls outside that range — a link to an
 * old period, or a lock on a month before the workspace existed, must not show
 * a selector displaying some other month than the page beneath it.
 */
export function MonthSelect({
  value,
  onChange,
  ariaLabel = "Reporting month",
  className,
}: {
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

  const groups = useMemo(() => {
    const options = monthOptions(floor);
    // Keep the selected period selectable even when it is outside the window.
    return groupByYear(
      options.includes(value) ? options : [...options, value].sort(),
    );
  }, [floor, value]);

  return (
    <Select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label={ariaLabel}
      className={className}
    >
      {groups.map((g) => (
        <optgroup key={g.year} label={String(g.year)}>
          {g.periods.map((p) => (
            <option key={p} value={p}>
              {periodLabel(p)}
            </option>
          ))}
        </optgroup>
      ))}
    </Select>
  );
}
