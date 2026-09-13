import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch, buildQuery } from '../api';
import type { ProjectionLine, ProjectionListResponse, ProjectionUpdate } from '@greatsales/shared';
import { invalidateAfter } from '../invalidate';

export type { ProjectionLine, ProjectionUpdate };

export interface ProjectionParams {
  period: string; // YYYY-MM
  search?: string;
  principalId?: string;
  lineFilter?: 'all' | 'projected' | 'blank' | 'due';
}

export const projectionKeys = {
  all: ['projections'] as const,
  list: (p: ProjectionParams) => ['projections', 'list', p] as const,
};

export function useProjections(params: ProjectionParams, enabled = true) {
  return useQuery({
    queryKey: projectionKeys.list(params),
    queryFn: () =>
      apiFetch<ProjectionListResponse>(
        `/projections${buildQuery(params as unknown as Record<string, unknown>)}`,
      ),
    enabled: enabled && !!params.period,
  });
}

export function useUpdateProjection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: ProjectionUpdate }) =>
      apiFetch<ProjectionLine>(`/projections/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      }),
    onSuccess: () => invalidateAfter(qc, 'projections'),
  });
}
