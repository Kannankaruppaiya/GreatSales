/**
 * React Query hook for the mobile dashboard aggregate.
 *
 * This used to call `/dashboard?year=…&month=…` against a hand-written response
 * shape that the API has never returned. Every request came back 400 and every
 * tile silently rendered ₹0 — the screen looked like an empty tenant rather
 * than a broken call. The endpoint takes a `YYYY-MM` period and answers with
 * `DashboardResponse`, so both now come from @greatsales/shared: if the
 * contract moves, this fails to compile instead of failing at runtime.
 */
import { useQuery } from '@tanstack/react-query';
import type { DashboardResponse } from '@greatsales/shared';
import { apiFetch } from '../api';

export type { DashboardResponse };

export const dashboardKeys = {
  all: ['dashboard'] as const,
  period: (period: string) => ['dashboard', period] as const,
};

export function useDashboard(period: string) {
  return useQuery({
    queryKey: dashboardKeys.period(period),
    queryFn: () =>
      apiFetch<DashboardResponse>(`/dashboard?period=${encodeURIComponent(period)}`),
    staleTime: 60_000, // dashboard can be slightly stale — 1 min
  });
}
