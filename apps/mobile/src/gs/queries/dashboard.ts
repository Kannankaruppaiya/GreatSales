/**
 * React Query hook for the mobile dashboard aggregate.
 *
 * This used to call `/dashboard?year=…&month=…` against a hand-written response
 * shape that the API has never returned. Every request came back 400 and every
 * tile silently rendered ₹0 — the screen looked like an empty tenant rather
 * than a broken call. The endpoint takes a `YYYY-MM` period and answers with
 * `DashboardResponse`, so both now come from @greatsales/shared: if the
 * contract moves, this fails to compile instead of failing at runtime.
 *
 * The endpoint takes a DATE RANGE now, because the web console offers a day, a
 * week, a month and a year. This app still thinks in months — its screens have
 * no window picker — so it resolves its month to that month's range with the
 * shared `resolveRange`, which is the same function the console uses. One date
 * arithmetic, so the two clients cannot disagree about where a month ends.
 */
import { useQuery } from '@tanstack/react-query';
import { resolveRange, type DashboardResponse } from '@greatsales/shared';
import { apiFetch } from '../api';

export type { DashboardResponse };

export const dashboardKeys = {
  all: ['dashboard'] as const,
  period: (period: string) => ['dashboard', period] as const,
};

export function useDashboard(period: string) {
  return useQuery({
    queryKey: dashboardKeys.period(period),
    queryFn: () => {
      const { from, to } = resolveRange('month', `${period}-01`);
      return apiFetch<DashboardResponse>(
        `/dashboard?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
      );
    },
    staleTime: 60_000, // dashboard can be slightly stale — 1 min
  });
}
