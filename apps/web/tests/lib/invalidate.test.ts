import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it, expect, vi } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import {
  invalidateAfter,
  STALE_AFTER,
  type WriteTarget,
} from "../../src/lib/invalidate";

/** The declared entries of a `STALE_AFTER` literal, read straight off a file. */
function parseMap(source: string): Record<string, string[]> {
  const body = source.slice(source.indexOf("STALE_AFTER"));
  const out: Record<string, string[]> = {};
  for (const [, key, list] of body.matchAll(/^ {2}(\w+): \[([^\]]*)\],$/gm)) {
    out[key] = [...list.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
  }
  return out;
}

const rootsOf = (spy: { mock: { calls: unknown[][] } }) =>
  spy.mock.calls.map((c) => (c[0] as { queryKey: string[] }).queryKey[0]).sort();

describe("invalidateAfter", () => {
  it("refetches the family that was written, and every family that copies it", async () => {
    const qc = new QueryClient();
    const spy = vi.spyOn(qc, "invalidateQueries");
    await invalidateAfter(qc, "followups");
    // The bug this exists for: a follow-up logged from a dashboard tile used
    // to refresh the follow-ups page and leave the tile showing the old count.
    // `projections` joined the list when the worksheet started printing a
    // follow-up count on every line — same failure, a different badge. `leads`
    // joined it when completing a mirrored task started clearing the record's
    // own `nextFollowUp` column.
    expect(rootsOf(spy)).toEqual([
      "dashboard",
      "followups",
      "leads",
      "projections",
    ]);
  });

  it("asks for each root once when two writes overlap", async () => {
    const qc = new QueryClient();
    const spy = vi.spyOn(qc, "invalidateQueries");
    await invalidateAfter(qc, "projections", "mappings");
    expect(rootsOf(spy)).toEqual([
      "dashboard",
      "followups",
      "mappings",
      "projections",
    ]);
  });

  it("names its own family first, so a call site reads as one statement", () => {
    for (const [target, roots] of Object.entries(STALE_AFTER)) {
      expect(roots.length).toBeGreaterThan(0);
      if (target === "periodLocks") expect(roots[0]).toBe("period-locks");
      else if (target === "people") expect(roots[0]).toBe("users");
      else expect(roots[0]).toBe(target);
    }
  });

  /**
   * The dashboard response is assembled from four services — see
   * apps/api/src/dashboard/dashboard.service.ts, which calls
   * `projections.forPeriods`, `leads.allInScope`, `targets.totalFor` and
   * `followUps.outstanding`. Anything that feeds one of those feeds the
   * dashboard, and this is the assertion that says so out loud.
   */
  it("refreshes the dashboard after every write it is computed from", () => {
    const feeds: WriteTarget[] = [
      "projections",
      "leads",
      "targets",
      "followups",
      "mappings",
      "customers",
      "periodLocks",
      "people",
    ];
    for (const t of feeds) expect(STALE_AFTER[t]).toContain("dashboard");
  });

  /**
   * `Projection.nextFollowUp` and `Lead.nextFollowUp` are mirrored into
   * `FollowUp` rows by the API, so a write to either record can change what
   * the Follow-ups page lists. Logging a follow-up on the worksheet and
   * finding that page unchanged is the bug this line prevents coming back.
   */
  it("refreshes the follow-ups list after a projection or lead write", () => {
    expect(STALE_AFTER.projections).toContain("followups");
    expect(STALE_AFTER.leads).toContain("followups");
  });

  it("does not refetch unrelated families", () => {
    // Orders and payments appear nowhere in the dashboard payload, so an
    // order saved on the dashboard must not cost the page a second request.
    expect(STALE_AFTER.orders).not.toContain("dashboard");
    expect(STALE_AFTER.payments).toEqual(["payments"]);
  });

  /**
   * An order raised from a projection writes `Projection.salesOrderId` in the
   * same transaction, and `ProjectionLine` carries that id and the order's
   * status. Invalidating only "orders" left the worksheet's sales-order column
   * showing a line as unconverted with its order already raised behind it.
   */
  it("refreshes the projections worksheet after an order write", () => {
    expect(STALE_AFTER.orders).toContain("projections");
  });

  /**
   * Web mirrors @greatsales/shared rather than importing it (the Vite build
   * does not consume the CJS dist, like every wire type under features/).
   * A mirror that
   * nobody checks is a mirror that drifts, and a dependency graph that differs
   * between the console and the phone is the original bug wearing a hat.
   */
  it("matches the copy the mobile client reads", () => {
    // vitest runs with apps/web as the cwd (see vite.config.ts).
    const read = (p: string) => readFileSync(resolve(process.cwd(), p), "utf8");
    const mine = parseMap(read("src/lib/invalidate.ts"));
    const theirs = parseMap(read("../../packages/shared/src/query-deps.ts"));
    expect(Object.keys(mine).length).toBeGreaterThan(0);
    expect(mine).toEqual(theirs);
  });
});