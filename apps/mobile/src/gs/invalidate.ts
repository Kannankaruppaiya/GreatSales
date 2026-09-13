import type { QueryClient } from '@tanstack/react-query';
import { STALE_AFTER, type WriteTarget } from '@greatsales/shared';

export { STALE_AFTER, type WriteTarget };

/**
 * Refetch everything that a write to `targets` can have changed.
 *
 * The graph itself lives in @greatsales/shared/query-deps, because this app
 * and the web console cache the same responses under the same query-key roots
 * — the dashboard is assembled from projections, leads, targets and follow-ups
 * on the server, so a follow-up saved on a phone has to move the phone's tiles
 * too, not just the follow-ups list.
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
