import { describe, expect, it } from "vitest";
import {
  addMonths,
  currentPeriod,
  groupByYear,
  monthOptions,
  monthsBetween,
  periodLabel,
  periodRange,
} from "@/data/months";

/**
 * These assertions are all about TIME PASSING, because that is the failure the
 * hardcoded MONTHS list had and the reason it went unnoticed: it worked
 * perfectly on the day it was written and would have silently expired in April
 * 2027, leaving every selector in the app opening on a month in the past.
 *
 * So every case here fixes "now" to a date rather than trusting the clock, and
 * several deliberately sit years away from when this was written.
 */
describe("periods", () => {
  it("reads the current month from the clock, not a list", () => {
    expect(currentPeriod(new Date("2026-09-05T10:00:00Z"))).toBe("2026-09");
    expect(currentPeriod(new Date("2031-01-15T12:00:00Z"))).toBe("2031-01");
    // Local, not UTC: a viewer's "this month" is their own calendar's. Built
    // from local parts so the assertion holds in any timezone CI runs in.
    const localNewYear = new Date(2032, 0, 1, 0, 30);
    expect(currentPeriod(localNewYear)).toBe("2032-01");
  });

  it("labels any period, including ones no list would contain", () => {
    expect(periodLabel("2026-09")).toBe("Sep 2026");
    // The exact case the old lookup returned raw: outside the Apr26–Mar27 window.
    expect(periodLabel("2035-04")).toBe("Apr 2035");
    // Malformed input reads as itself rather than throwing inside a header.
    expect(periodLabel("nonsense")).toBe("nonsense");
  });

  it("rolls over years in both directions", () => {
    expect(addMonths("2026-12", 1)).toBe("2027-01");
    expect(addMonths("2026-01", -1)).toBe("2025-12");
    expect(addMonths("2026-09", 24)).toBe("2028-09");
    expect(addMonths("2026-09", -24)).toBe("2024-09");
    expect(monthsBetween("2025-12", "2026-03")).toBe(3);
    expect(monthsBetween("2026-03", "2025-12")).toBe(-3);
  });

  it("offers the current month and a forward window", () => {
    const now = new Date("2026-09-05T00:00:00Z");
    const opts = monthOptions("2026-04-01T00:00:00.000Z", now);
    expect(opts).toContain("2026-09"); // current
    expect(opts).toContain("2026-12"); // +3, the commitment horizon
    expect(opts).not.toContain("2027-01"); // and no further
    expect(opts[0]).toBe("2026-04"); // back to the workspace's first month
  });

  it("still works ten years on — the case the old list could not survive", () => {
    const now = new Date("2036-07-15T00:00:00Z");
    const opts = monthOptions("2026-04-01T00:00:00.000Z", now);
    expect(opts).toContain("2036-07"); // the real current month
    expect(opts).toContain("2027-01"); // and history is reachable
    expect(opts.length).toBeGreaterThan(100);
    // Capped, so a decade of options is long but never unbounded.
    expect(opts.length).toBeLessThanOrEqual(15 * 12 + 1);
  });

  it("caps the span by dropping the OLDEST months, never the newest", () => {
    const range = periodRange("1990-01", "2036-07");
    expect(range[range.length - 1]).toBe("2036-07");
    expect(range.length).toBe(15 * 12 + 1);
    expect(range[0]).toBe("2021-07");
  });

  it("falls back to a two-year window when the workspace date is unusable", () => {
    const now = new Date("2026-09-05T00:00:00Z");
    for (const bad of [undefined, "", "not-a-date", "2026-13-01"]) {
      const opts = monthOptions(bad, now);
      expect(opts).toContain("2026-09");
      expect(opts[0]).toBe("2024-09");
    }
  });

  it("never returns an empty list for a workspace created in the future", () => {
    const now = new Date("2026-09-05T00:00:00Z");
    const opts = monthOptions("2030-01-01T00:00:00.000Z", now);
    expect(opts).toContain("2026-09");
    expect(opts.length).toBeGreaterThan(0);
  });

  it("groups newest first so a long list stays navigable", () => {
    const groups = groupByYear(["2025-11", "2026-01", "2026-02"]);
    expect(groups.map((g) => g.year)).toEqual([2026, 2025]);
    expect(groups[0].periods).toEqual(["2026-02", "2026-01"]);
  });
});
