/**
 * Feature flags — which parts of the product a workspace actually gets.
 *
 * Two tables have carried this since the first migration and nothing read
 * either of them, so every tenant got every feature and `rolloutPercent` was a
 * column that described an intention.
 *
 * The resolution order is the standard one, and the schema was built for it:
 *
 *   1. a TenantFeatureFlag row for this workspace wins outright, either way;
 *   2. otherwise `enabledGlobal` turns it on for everyone;
 *   3. otherwise the tenant falls inside `rolloutPercent` or it does not,
 *      decided by a hash of the tenant id so the same workspace always lands on
 *      the same side. A random draw per request would flicker the feature on
 *      and off between page loads, which is worse than not shipping it.
 *
 * These are an OPERATOR control and the database says so: `greatsales_app` has
 * INSERT, UPDATE and DELETE revoked on both tables, and `tenant-isolation.spec`
 * asserts it. So the application READS flags and enforces them; changing one is
 * the platform's job, from the platform's own surface. That is a boundary worth
 * keeping rather than a gap to close — a workspace that can switch its own
 * flags on has not been gated, it has been asked politely.
 */

/**
 * The flags this application actually checks.
 *
 * Written down rather than read from the table, because a flag nothing reads is
 * not a feature toggle — it is a row. Code that gates on a key absent from this
 * list is a typo the type checker should catch.
 */
export const FEATURE_KEYS = ["customer-location", "bulk-import"] as const;
export type FeatureKey = (typeof FEATURE_KEYS)[number];

/** What each flag turns off, in words a workspace admin can act on. */
export const FEATURE_LABELS: Record<FeatureKey, { title: string; blurb: string }> =
  {
    "customer-location": {
      title: "Customer locations",
      blurb:
        "Let salespeople pin a customer's GPS location and share it with a driver. Off means a pin cannot be saved.",
    },
    "bulk-import": {
      title: "Bulk import",
      blurb:
        "Load customers from a spreadsheet instead of typing them in. Off means the import page is not offered.",
    },
  };

/** The resolved answer for one workspace: every key, already decided. */
export type FeatureFlagMap = Record<FeatureKey, boolean>;

/**
 * Which side of a percentage rollout a tenant falls on.
 *
 * Deterministic in the tenant id and the key together, so a workspace stays put
 * across restarts and two features at 50% do not select the same half. FNV-1a:
 * not a security hash, and it is not being used as one — it only has to spread
 * ids evenly and give the same answer on every process.
 */
export function inRollout(
  tenantId: string,
  key: string,
  percent: number,
): boolean {
  if (percent <= 0) return false;
  if (percent >= 100) return true;
  const input = `${key}:${tenantId}`;
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    // FNV prime, via shifts so this stays in 32-bit integer arithmetic.
    hash = (hash + ((hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24))) >>> 0;
  }
  return hash % 100 < percent;
}
