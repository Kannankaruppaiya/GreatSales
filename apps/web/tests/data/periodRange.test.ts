import { describe, it, expect } from "vitest";
import {
  monthsInRange,
  resolveRange,
  shiftRange,
  todayIso,
} from "@/data/periodRange";

/**
 * Reporting windows.
 *
 * This module is a MIRROR of `@greatsales/shared/period-range` — the Vite build
 * cannot consume the CJS shared dist, so the console carries its own copy, the
 * same arrangement `months.ts` uses. Two copies of date arithmetic is the
 * dangerous kind of duplication, so this pins the behaviour on this side and
 * `dashboard.service.spec` pins it on the other: both would have to be wrong in
 * the same way for them to drift apart unnoticed.
 *
 * The week is the part most likely to be got wrong, and the part where being
 * wrong is invisible — a report that opens on Sunday looks fine and splits
 * every working week in half.
 */
describe("resolveRange", () => {
  it("makes a day a window of one", () => {
    const r = resolveRange("day", "2026-09-10");
    expect(r).toMatchObject({ from: "2026-09-10", to: "2026-09-10" });
    expect(r.label).toBe("10 Sep 2026");
    expect(r.months).toEqual(["2026-09"]);
  });

  it("runs a week Monday to Sunday", () => {
    // 2026-09-10 is a Thursday.
    const r = resolveRange("week", "2026-09-10");
    expect(r.from).toBe("2026-09-07"); // Monday
    expect(r.to).toBe("2026-09-13"); // Sunday
    expect(r.label).toBe("7–13 Sep 2026");
  });

  it("keeps a Sunday in the week it ends, not the one it would start", () => {
    // The off-by-one that a Sunday-first calculation makes, and the reason the
    // Monday offset is written as `(day + 6) % 7` rather than as `day`.
    const sunday = resolveRange("week", "2026-09-13");
    expect(sunday.from).toBe("2026-09-07");
    expect(sunday.to).toBe("2026-09-13");

    const monday = resolveRange("week", "2026-09-14");
    expect(monday.from).toBe("2026-09-14");
  });

  it("spans two months and two years when a week does", () => {
    const across = resolveRange("week", "2026-12-31"); // Thursday
    expect(across.from).toBe("2026-12-28");
    expect(across.to).toBe("2027-01-03");
    expect(across.months).toEqual(["2026-12", "2027-01"]);
    expect(across.label).toBe("28 Dec 2026 – 3 Jan 2027");
  });

  it("ends a month on its real last day, February included", () => {
    expect(resolveRange("month", "2026-09-10").to).toBe("2026-09-30");
    expect(resolveRange("month", "2026-02-05").to).toBe("2026-02-28");
    // Leap years are the calendar's problem, not a rule written in the source.
    expect(resolveRange("month", "2024-02-05").to).toBe("2024-02-29");
  });

  it("covers a whole year, and names its twelve months", () => {
    const r = resolveRange("year", "2026-09-10");
    expect(r).toMatchObject({ from: "2026-01-01", to: "2026-12-31" });
    expect(r.label).toBe("2026");
    expect(r.months).toHaveLength(12);
    expect(r.months[0]).toBe("2026-01");
    expect(r.months[11]).toBe("2026-12");
  });

  it("answers the same window whichever day inside it is the anchor", () => {
    // The anchor is "a day in the window", not "the start of it" — which is
    // what lets the calendar hand back whatever cell was clicked.
    const first = resolveRange("month", "2026-09-01");
    const last = resolveRange("month", "2026-09-30");
    expect(first).toEqual(last);
  });
});

describe("shiftRange", () => {
  it("steps by one of whatever is selected", () => {
    expect(shiftRange("day", "2026-09-10", 1)).toBe("2026-09-11");
    expect(shiftRange("week", "2026-09-10", -1)).toBe("2026-09-03");
    expect(resolveRange("month", shiftRange("month", "2026-09-10", 1)).label).toBe(
      "Oct 2026",
    );
    expect(resolveRange("year", shiftRange("year", "2026-09-10", -1)).label).toBe(
      "2025",
    );
  });

  it("does not skip a month when stepping back from a long one", () => {
    // The 31st minus one month is not a date. Left to Date, it rolls forward
    // into the month AFTER the one that was asked for — so stepping back from
    // 31 October lands in October again, and the button does nothing.
    const back = shiftRange("month", "2026-10-31", -1);
    expect(resolveRange("month", back).label).toBe("Sep 2026");

    const forward = shiftRange("month", "2026-01-31", 1);
    expect(resolveRange("month", forward).label).toBe("Feb 2026");
  });
});

describe("monthsInRange", () => {
  it("lists every month a range touches, inclusive", () => {
    expect(monthsInRange("2026-09-10", "2026-09-10")).toEqual(["2026-09"]);
    expect(monthsInRange("2026-11-20", "2027-02-03")).toEqual([
      "2026-11",
      "2026-12",
      "2027-01",
      "2027-02",
    ]);
  });
});

describe("todayIso", () => {
  it("reads the viewer's own calendar day", () => {
    // Local, not UTC, and deliberately: "today" is a thing a person means
    // about their own day, and a UTC reading is yesterday for half the world
    // for part of every day.
    const d = new Date(2026, 8, 10, 23, 30);
    expect(todayIso(d)).toBe("2026-09-10");
  });
});
