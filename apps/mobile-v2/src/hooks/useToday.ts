import { useQuery } from '@tanstack/react-query';
import { dashboardRepo } from '../repositories';
import { QUERY_KEYS } from '../lib/queryClient';
import { useCurrentUser } from './useAuthUser';

export function useToday() {
  const { data: user } = useCurrentUser();
  const ownerId = user?.role === 'sales' ? user.id : undefined;

  const metricsQuery = useQuery({
    queryKey: QUERY_KEYS.dashboard(ownerId),
    queryFn: () => dashboardRepo.getMetrics(ownerId),
  });

  const oralDealsQuery = useQuery({
    queryKey: QUERY_KEYS.oralDeals(ownerId),
    queryFn: () => dashboardRepo.getOralConfirmationDeals(ownerId),
  });

  const topProjectionsQuery = useQuery({
    queryKey: QUERY_KEYS.topProjections(ownerId),
    queryFn: () => dashboardRepo.getTopProjections(ownerId),
  });

  const priorityFollowUpsQuery = useQuery({
    queryKey: QUERY_KEYS.priorityFollowUps(ownerId),
    queryFn: () => dashboardRepo.getPriorityFollowUps(ownerId),
  });

  const paymentAlertsQuery = useQuery({
    queryKey: QUERY_KEYS.paymentAlerts(ownerId),
    queryFn: () => dashboardRepo.getPaymentAlerts(ownerId),
  });

  const isLoading =
    metricsQuery.isLoading ||
    oralDealsQuery.isLoading ||
    topProjectionsQuery.isLoading ||
    priorityFollowUpsQuery.isLoading ||
    paymentAlertsQuery.isLoading;

  const isError =
    metricsQuery.isError ||
    oralDealsQuery.isError ||
    topProjectionsQuery.isError ||
    priorityFollowUpsQuery.isError ||
    paymentAlertsQuery.isError;

  const refetchAll = () => {
    metricsQuery.refetch();
    oralDealsQuery.refetch();
    topProjectionsQuery.refetch();
    priorityFollowUpsQuery.refetch();
    paymentAlertsQuery.refetch();
  };

  return {
    metrics: metricsQuery.data,
    oralDeals: oralDealsQuery.data || [],
    topProjections: topProjectionsQuery.data || [],
    priorityFollowUps: priorityFollowUpsQuery.data || [],
    paymentAlerts: paymentAlertsQuery.data || [],
    isLoading,
    isError,
    refetchAll,
  };
}
