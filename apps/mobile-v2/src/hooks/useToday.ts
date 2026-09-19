import { useQuery } from '@tanstack/react-query';
import { dashboardRepo } from '../repositories';
import { QUERY_KEYS } from '../lib/queryClient';
import { useCurrentUser } from './useAuthUser';
import { resolveRange } from '@greatsales/shared';
import { getTodayIso } from '../domain/calculations';

/**
 * The home screen's data: ONE request.
 *
 * This hook used to fire five - getMetrics, getOralConfirmationDeals,
 * getTopProjections, getPriorityFollowUps, getPaymentAlerts - which were five
 * reads of the same aggregate. GET /dashboard exists so that the client does
 * not do that; its controller says as much.
 *
 * The window is a granularity plus an anchor resolved on read, never a stored
 * range (AGENTS.md): a screen left open overnight then reports today as today
 * rather than yesterday.
 */
export function useToday(granularity: 'day' | 'week' | 'month' | 'year' = 'month') {
  const { data: user } = useCurrentUser();
  // A sales user is scoped to themselves by the API regardless; sending
  // ownerId keeps the query key honest about whose numbers these are.
  const ownerId = user?.role === 'sales' ? user.id : undefined;
  // The anchor is today, read at render, so the window follows the calendar.
  const { from, to } = resolveRange(granularity, getTodayIso());

  const query = useQuery({
    queryKey: QUERY_KEYS.dashboard(ownerId, from, to),
    queryFn: () => dashboardRepo.overview({ from, to, ownerId }),
  });

  return {
    overview: query.data,
    kpis: query.data?.kpis,
    oralDeals: query.data?.oralConfirmationDeals ?? [],
    topProjections: query.data?.topOpenProjections ?? [],
    followUps: query.data?.followUps ?? [],
    months: query.data?.months ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetchAll: query.refetch,
  };
}
