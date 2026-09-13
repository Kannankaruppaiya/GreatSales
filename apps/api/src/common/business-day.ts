/**
 * What day it is where the business is.
 *
 * Every "is this overdue" question in this API is decided by comparing a
 * `YYYY-MM-DD` against today, and today used to be `new Date().toISOString()`
 * sliced — which is the day in UTC, not the day on the wall. This workspace
 * runs on IST, so for the five and a half hours after midnight the API reported
 * yesterday's date: a follow-up dated the 10th read as "due today" on the 11th,
 * the dashboard tile said "all up to date" over a day-late row, an invoice aged
 * one day short, and a projection's "Needs follow-up" filter left out the line
 * it was opened to find. Everything agreed with everything else, and all of it
 * was a day behind.
 *
 * The zone is configuration rather than a constant, because a tenant in another
 * country closes its books on its own clock. It is one setting for the process
 * today; the per-tenant column is the eventual answer, and when it arrives this
 * is the one function that has to learn about it.
 */

/** IANA zone the business day is resolved in. */
const BUSINESS_TIMEZONE = process.env.BUSINESS_TIMEZONE || 'Asia/Kolkata';

/**
 * `en-CA` formats as `YYYY-MM-DD`, which is the shape every date in this API is
 * stored and compared as. Built once: constructing a formatter per request is
 * measurably slower than the comparison it serves.
 */
const dayFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: BUSINESS_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** Today, as `YYYY-MM-DD`, in the business's own timezone. */
export function businessToday(now: Date = new Date()): string {
  return dayFormatter.format(now);
}

/** Check whether a given YYYY-MM-DD date string is strictly before today in the business timezone. */
export function isOverdueBusinessDay(
  dateString: string,
  now: Date = new Date(),
): boolean {
  if (!dateString) return false;
  return dateString < businessToday(now);
}
