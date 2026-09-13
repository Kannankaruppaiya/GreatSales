import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { activityRepo } from '../repositories';
import { QUERY_KEYS } from '../lib/queryClient';
import type { Activity } from '../domain/types';

export function useCustomerActivity(customerId: string) {
  return useQuery({
    queryKey: QUERY_KEYS.customerActivity(customerId),
    queryFn: () => activityRepo.listByCustomer(customerId),
    enabled: Boolean(customerId),
  });
}

export function useEntityActivity(entityType: string, entityId: string) {
  return useQuery({
    queryKey: QUERY_KEYS.activities(entityType, entityId),
    queryFn: () => activityRepo.listByEntity(entityType, entityId),
    enabled: Boolean(entityType && entityId),
  });
}

export function useLogActivity() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: Omit<Activity, 'id' | 'timestamp'>) => activityRepo.log(input),
    onSuccess: (data) => {
      if (data.customerId) {
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.customerActivity(data.customerId) });
      }
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.activities(data.entityType, data.entityId) });
    },
  });
}
