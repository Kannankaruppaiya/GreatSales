import type { QueryClient } from "@tanstack/react-query";

/**
 * What a write makes stale, in one place.
 *
 * Every mutation in both clients used to invalidate its OWN query family and
 * nothing else, which is correct only while no other screen shows the same
 * facts — and almost every screen here does. The dashboard is composed from
 * four services (apps/api/src/dashboard/dashboard.service.ts calls
 * `projections.forPeriods`, `leads.allInScope`, `targets.totalFor` and
 * `followUps.outstanding`), a mapping row carries the product's catalog price,
 * and a customer's name is copied onto mappings, projections, orders and
 * payments. So logging a follow-up from the dashboard wrote the row, refetched
 * a projections list nobody was looking at, and left the tile that prompted the
 * edit showing the old figure until the operator pressed F5.
 *
 * The map below is the dependency graph between a WRITE and the cached READS
 * that carry its data. It is deliberately generous: react-query's
 * `invalidateQueries` only refetches queries that are currently mounted and
 * marks the rest stale, so naming a family that is not on screen costs one
 * cache flag, while omitting one that is costs the user their trust in the
 * number in front of them.
 *
 * Each entry lists its own root first, so a call site reads as a single
 * statement of what just changed rather than a list of housekeeping.
 *
 * Mirrors `@greatsales/shared/query-deps`; kept as a local copy so the Vite
 * build does not need to consume the CJS `shared` dist, the same way every
 * wire type under `features/` is. Both clients cache the same
 * responses under the same query-key roots, so the graph has to be one
 * graph — `tests/lib/invalidate.test.ts` fails if this copy drifts from it.
 */
export type WriteTarget =
  | "customers"
  | "leads"
  | "orders"
  | "payments"
  | "projections"
  | "mappings"
  | "products"
  | "principals"
  | "followups"
  | "remarks"
  | "targets"
  | "periodLocks"
  | "people"
  | "imports";

export const STALE_AFTER: Record<WriteTarget, readonly string[]> = {
  /** Name, tier and owner are copied onto every row that trades with them. */
  customers: [
    "customers",
    "mappings",
    "projections",
    "orders",
    "payments",
    "dashboard",
  ],
  /** The dashboard's committed new-sales value and its oral-confirmation list. */
  leads: ["leads", "dashboard"],
  orders: ["orders"],
  payments: ["payments"],
  /** Feeds the KPI row, the top-open list and the achievement percentages. */
  projections: ["projections", "dashboard"],
  /** A mapping IS the price a projection line resolves through. */
  mappings: ["mappings", "projections", "dashboard"],
  /** `basePrice` is a mapping's catalog column and a projection's fallback price. */
  products: ["products", "principals", "mappings", "projections", "orders"],
  principals: ["principals", "products", "mappings", "projections"],
  /** The dashboard carries the outstanding-follow-ups count and its list. */
  followups: ["followups", "dashboard", "projections"],
  /**
   * A note logged against a record.
   *
   * Its own thread, and the projections worksheet — which prints the remark
   * COUNT as a badge on each line's Remarks button, so a note posted from that
   * button used to leave the badge it came from reading one fewer than the
   * thread behind it.
   */
  remarks: ["remarks", "projections"],
  targets: ["targets", "dashboard"],
  /** Locking a month changes what the worksheet will accept. */
  periodLocks: ["period-locks", "projections", "dashboard"],
  /**
   * Users, roles and teams. Broad on purpose: a role change moves a role's
   * `userCount`, and a rename changes the `salespersonName` printed on six
   * other resources.
   */
  people: [
    "users",
    "roles",
    "teams",
    "customers",
    "leads",
    "orders",
    "payments",
    "projections",
    "mappings",
    "followups",
    "dashboard",
  ],
  /** The import history itself; the caller names the entity it imported too. */
  imports: ["imports"],
};


/**
 * Refetch everything that a write to `targets` can have changed.
 *
 * Returns a promise so a mutation's `onSuccess` can return it and react-query
 * keeps `isPending` true until the screen actually holds the new data — a
 * button that stops saying "Saving…" before the list behind it has caught up
 * is the same bug in a smaller window.
 */
export function invalidateAfter(
  qc: QueryClient,
  ...targets: readonly WriteTarget[]
): Promise<void> {
  const roots = new Set<string>();
  for (const t of targets) for (const key of STALE_AFTER[t]) roots.add(key);
  return Promise.all(
    [...roots].map((key) => qc.invalidateQueries({ queryKey: [key] })),
  ).then(() => undefined);
}
