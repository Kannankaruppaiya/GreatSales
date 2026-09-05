/**
 * React Query hooks for the mobile dashboard.
 * Fetches the same aggregate endpoint the web dashboard uses.
 */
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../api';

// Mirror of apps/web/src/features/dashboard/types.ts
export interface DashboardData {
  recurringCommitted: number;
  recurringAchieved: number;
  newCommitted: number;
  newAchieved: number;
  totalCommitted: number;
  totalAchieved: number;
  achievementPct: number | null;
  weightedPipeline: number;
  totalPendingPayments: number;
  overdueFollowUpsCount: number;
  dueTodayFollowUpsCount: number;
  oralConfirmationCount: number;
}

export const dashboardKeys = {
  all: ['dashboard'] as const,
  period: (year: number, month: number) => ['dashboard', year, month] as const,
};

export function useDashboard(year: number, month: number) {
  return useQuery({
    queryKey: dashboardKeys.period(year, month),
    queryFn: () =>
      apiFetch<DashboardData>(`/dashboard?year=${year}&month=${month}`),
    staleTime: 60_000, // dashboard can be slightly stale — 1 min
  });
}
