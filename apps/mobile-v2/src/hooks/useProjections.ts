import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { projectionRepo } from '../repositories';
import { QUERY_KEYS, invalidateEntity } from '../lib/queryClient';
import type { ProjStatusValue } from '../domain/types';

export function useProjections(params?: { search?: string; status?: string; principalId?: string }) {
  return useQuery({
    queryKey: QUERY_KEYS.projections(params),
    queryFn: () => projectionRepo.list(params),
  });
}

export function useProjection(id: string) {
  return useQuery({
    queryKey: QUERY_KEYS.projection(id),
    queryFn: () => projectionRepo.getById(id),
    enabled: Boolean(id),
  });
}

export function useUpdateProjectionStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, status, note }: { id: string; status: ProjStatusValue; note?: string }) =>
      projectionRepo.updateStatus(id, status, note),
    onSuccess: (updated) => {
      queryClient.setQueryData(QUERY_KEYS.projection(updated.id), updated);
      invalidateEntity('projections');
    },
  });
}
