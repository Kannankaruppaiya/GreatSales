/**
 * Reporting windows — day, week, month, year.
 *
 * Mirrors `@greatsales/shared/period-range`; kept as a local copy so the Vite
 * build does not need to consume the CJS `shared` dist — the arrangement every
 * feature here uses, and the same one `months.ts` uses for periods. The zod
 * schemas are left out: the API validates the wire, this only computes.
 *
 * The API is the source of truth: keep in sync with
 * packages/shared/src/period-range.ts. `tests/data/periodRange.test.ts` pins
 * this side, the dashboard spec pins the other, and both would have to be wrong
 * in the same way for the two to drift apart unnoticed.
 */

/**
 * A reporting window: today, this week, this month, this year — or any past one.
 *
 * The console had a single month dropdown, and it was doing less than it looked
 * like. The recurring half of the dashboard is genuinely per-month, so that
 * part moved; the new-sales half was not filtered by date AT ALL, so the same
 * ₹50.5L of pipeline appeared under every month in the list. A picker whose
 * choice changes nothing teaches people not to trust the page.
 *
 * So a window is now a GRANULARITY plus an ANCHOR — one date inside it — and
 * everything on the page is scoped to the range that pair resolves to. The pair
 * is the state, not the range: "this week" stays this week when the anchor is
 * today, and a resolved `from`/`to` would silently become last week's dates
 * overnight in a tab left open.
 *
 * All dates here are `YYYY-MM-DD` and all arithmetic is UTC. These are calendar
 * days, not instants — "September" is a page of a report, and it must not shift
 * because the reader is in a different timezone from the writer.
 */

export const GRANULARITIES = ["day", "week", "month", "year"] as const;
export type Granularity = (typeof GRANULARITIES)[number];

export interface PeriodRange {
  granularity: Granularity;
  /** Inclusive, `YYYY-MM-DD`. */
  from: string;
  /** Inclusive, `YYYY-MM-DD`. */
  to: string;
  /**
   * Every `YYYY-MM` the range touches, in order.
   *
   * The monthly tables — `Projection`, `SalesTarget`, `PeriodLock` — are keyed
   * by period, not by date. A commitment IS a month; there is no such thing as
   * a Tuesday's worth of it. So a day or a week resolves to the ONE month that
   * contains it and the recurring figures are that month's, labelled as that
   * month. Slicing a monthly commitment into daily portions would be inventing
   * numbers, which is worse than showing a wider one honestly.
   */
  months: string[];
  /** "10 Sep 2026", "7–13 Sep 2026", "Sep 2026", "2026". */
  label: string;
}

/** `(2026, 9)` → `"2026-09"`. Mirrors `toPeriod` in @greatsales/shared. */
const toPeriod = (year: number, month1to12: number) =>
  `${year}-${String(month1to12).padStart(2, "0")}`;

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
] as const;

const pad = (n: number) => String(n).padStart(2, "0");
const iso = (d: Date) =>
  `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
const utc = (value: string) => new Date(`${value}T00:00:00.000Z`);

/** Today in the VIEWER's calendar — "today" is a thing about their own day. */
export function todayIso(now: Date = new Date()): string {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function addDays(date: string, delta: number): string {
  const d = utc(date);
  d.setUTCDate(d.getUTCDate() + delta);
  return iso(d);
}

/**
 * Every `YYYY-MM` from `from` to `to`, inclusive.
 *
 * Exported because the API is handed a range, not a granularity: the server
 * never learns which button was pressed, so it works out the months it has to
 * read the monthly tables for from the dates alone — with this function, so
 * client and server cannot disagree about which months a window covers.
 */
export function monthsInRange(from: string, to: string): string[] {
  const out: string[] = [];
  const end = utc(to);
  const cursor = utc(from);
  cursor.setUTCDate(1);
  while (cursor <= end) {
    out.push(toPeriod(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1));
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return out;
}

function dayLabel(date: string): string {
  const d = utc(date);
  return `${d.getUTCDate()} ${MONTH_NAMES[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/**
 * The window a granularity and an anchor describe.
 *
 * The week runs MONDAY to Sunday. That is the business week wherever this
 * product is sold, and a report that opens on Sunday and closes on Saturday
 * splits every working week in half — the one thing a weekly view must not do.
 */
export function resolveRange(
  granularity: Granularity,
  anchor: string,
): PeriodRange {
  const a = utc(anchor);
  let from: string;
  let to: string;
  let label: string;

  switch (granularity) {
    case "day": {
      from = to = anchor;
      label = dayLabel(anchor);
      break;
    }
    case "week": {
      // getUTCDay(): 0 = Sunday. Monday-first means Sunday is 6 days IN, not 0.
      const offset = (a.getUTCDay() + 6) % 7;
      from = addDays(anchor, -offset);
      to = addDays(from, 6);
      const start = utc(from);
      const end = utc(to);
      label =
        start.getUTCMonth() === end.getUTCMonth()
          ? `${start.getUTCDate()}–${end.getUTCDate()} ${MONTH_NAMES[start.getUTCMonth()]} ${start.getUTCFullYear()}`
          : `${dayLabel(from)} – ${dayLabel(to)}`;
      break;
    }
    case "month": {
      const y = a.getUTCFullYear();
      const m = a.getUTCMonth();
      from = iso(new Date(Date.UTC(y, m, 1)));
      // Day zero of the next month is the last day of this one, so February and
      // leap years are the calendar's problem rather than a rule written here.
      to = iso(new Date(Date.UTC(y, m + 1, 0)));
      label = `${MONTH_NAMES[m]} ${y}`;
      break;
    }
    case "year": {
      const y = a.getUTCFullYear();
      from = `${y}-01-01`;
      to = `${y}-12-31`;
      label = String(y);
      break;
    }
  }

  return {
    granularity,
    from,
    to,
    months: monthsInRange(from, to),
    label,
  };
}

/** Step a window forward or back by one of itself. */
export function shiftRange(
  granularity: Granularity,
  anchor: string,
  delta: number,
): string {
  const a = utc(anchor);
  switch (granularity) {
    case "day":
      return addDays(anchor, delta);
    case "week":
      return addDays(anchor, delta * 7);
    case "month": {
      // Anchor the 1st before stepping: the 31st minus one month is not a date,
      // and Date rolls it into the month after the one that was asked for.
      const d = new Date(Date.UTC(a.getUTCFullYear(), a.getUTCMonth() + delta, 1));
      return iso(d);
    }
    case "year":
      return iso(new Date(Date.UTC(a.getUTCFullYear() + delta, a.getUTCMonth(), 1)));
  }
}

/** Human words for the granularity, for a tab or a caption. */
export const GRANULARITY_LABELS: Record<Granularity, string> = {
  day: "Day",
  week: "Week",
  month: "Month",
  year: "Year",
};
