/**
 * How an activity row is grouped, labelled and iconed.
 *
 * The Penpot board "03E.3 Activity Filters" offers five type filters. The
 * source's `kind` is a free string — "Call", "Visit", "Note", "Stage change",
 * "Quotation" from the synthetic generator, and whatever `/remarks` carries
 * from the API — so rows are bucketed by pattern rather than by an enum this
 * app does not own. An unrecognised kind lands in "Other", which is why that
 * bucket exists at all.
 *
 * "Sales Order Conversion" is on the board and is not here: an order is not a
 * remark, and the API has no endpoint that returns orders as timeline events.
 * Recorded in CHECKLIST.md under "Backend gaps" rather than faked.
 */
import { Ellipsis, FileText, Phone, Send } from "lucide-react-native";

export type ActivityGroup = "stage" | "followup" | "note" | "other";

export const ACTIVITY_GROUP_LABELS: Record<ActivityGroup, string> = {
  stage: "Stage Changes",
  followup: "Follow-ups",
  note: "Notes / Activity",
  other: "Other Events",
};

export const ACTIVITY_GROUP_ORDER: ActivityGroup[] = [
  "stage",
  "followup",
  "note",
  "other",
];

/** The short label on the timeline chips, where there is less room. */
export const ACTIVITY_CHIP_LABELS: Record<ActivityGroup, string> = {
  stage: "Stage",
  followup: "Follow-up",
  note: "Notes",
  other: "Other",
};

export function activityGroup(kind: string): ActivityGroup {
  const k = kind.toLowerCase();
  if (k.includes("stage")) return "stage";
  if (k.includes("call") || k.includes("visit") || k.includes("meeting")) return "followup";
  if (k.includes("note") || k.includes("quot") || k.includes("remark")) return "note";
  return "other";
}

export const ACTIVITY_ICONS: Record<ActivityGroup, typeof Send> = {
  stage: Send,
  followup: Phone,
  note: FileText,
  other: Ellipsis,
};

/** The date-range choices on the filter sheet, in days. `null` is All Time. */
export type ActivityRange = "all" | "7" | "30" | "90";

export const ACTIVITY_RANGE_LABELS: Record<ActivityRange, string> = {
  all: "All Time",
  "7": "Last 7 Days",
  "30": "Last 30 Days",
  "90": "Last 90 Days",
};

export function rangeCutoff(range: ActivityRange, now: Date = new Date()): string | null {
  if (range === "all") return null;
  const cutoff = new Date(now.getTime() - Number(range) * 86_400_000);
  return cutoff.toISOString();
}

/**
 * Groups rows under a date heading, newest first, the way the board does.
 * Today's heading reads "Today, 16 Sep 2026" — the date stays, because a
 * heading that says only "Today" is wrong the moment the screen is left open
 * past midnight and useless in a screenshot.
 */
export function groupByDay<T extends { at: string }>(
  rows: T[],
  now: Date = new Date(),
): { key: string; heading: string; rows: T[] }[] {
  const today = now.toDateString();
  const yesterday = new Date(now.getTime() - 86_400_000).toDateString();
  const out: { key: string; heading: string; rows: T[] }[] = [];

  for (const row of rows) {
    const date = new Date(row.at);
    const key = date.toDateString();
    const stamp = date.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
    const heading =
      key === today ? `Today, ${stamp}` : key === yesterday ? `Yesterday, ${stamp}` : stamp;

    const last = out[out.length - 1];
    if (last && last.key === key) last.rows.push(row);
    else out.push({ key, heading, rows: [row] });
  }

  return out;
}
