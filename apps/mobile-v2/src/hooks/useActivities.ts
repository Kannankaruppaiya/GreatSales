import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { activityRepo } from '../repositories';
import { QUERY_KEYS } from '../lib/queryClient';
import type { EntityTypeValue } from '../domain/types';

/** Remarks logged against one record. The API calls these remarks. */
export function useEntityActivity(entityType: EntityTypeValue, entityId: string) {
  return useQuery({
    queryKey: QUERY_KEYS.activities(entityType, entityId),
    queryFn: () => activityRepo.listByEntity(entityType, entityId),
    enabled: Boolean(entityType && entityId),
  });
}

/** A customer's remarks are entity remarks; there is no separate endpoint. */
export function useCustomerActivity(customerId: string) {
  return useEntityActivity('Customer', customerId);
}

export function useLogActivity() {
  const queryClient = useQueryClient();

  return useMutation({
    // RemarkRow's field is `text`, not `note`, and it has no customerId - the
    // record it hangs off is (entityType, entityId).
    mutationFn: (input: { entityType: EntityTypeValue; entityId: string; text: string }) =>
      activityRepo.log(input),
    onSuccess: (row) => {
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.activities(row.entityType, row.entityId),
      });
    },
  });
}
