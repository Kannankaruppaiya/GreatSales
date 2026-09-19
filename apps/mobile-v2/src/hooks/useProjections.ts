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

/*
 * useProjection(id) stood here. It is gone with ProjectionRepository.getById:
 * the API has no GET /projections/:id, and a ProjectionLine is not a row it
 * could simply return - the worksheet engine resolves each line's price from
 * the line, its mapping and the product catalogue. No screen in the design
 * needs one; the projections that appear do so through the dashboard's
 * topOpenProjections and the list.
 */

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
