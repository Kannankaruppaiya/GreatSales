import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../api';
import { listParams, useCursorList } from './cursorList';
import type { FollowUpRow, FollowUpListResponse, FollowUpCreate, FollowUpUpdate } from '@greatsales/shared';

export type { FollowUpRow, FollowUpCreate, FollowUpUpdate };

export interface FollowUpParams {
  search?: string;
  done?: boolean;
}

export const followUpKeys = {
  all: ['followups'] as const,
  list: (p: FollowUpParams) => ['followups', 'list', p] as const,
};

export function useFollowUps(params: FollowUpParams = {}, opts: { enabled?: boolean; autoFetchAll?: boolean } = {}) {
  return useCursorList<FollowUpRow>(
    '/followups',
    followUpKeys.list(params),
    // `done` is sent as the literal "true"/"false" the API's QueryBool parses;
    // listParams would otherwise treat `false` as a value to keep, which it is.
    listParams({
      ...params,
      done: params.done !== undefined ? String(params.done) : undefined,
    }),
    opts,
  );
}

export function useCreateFollowUp() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: FollowUpCreate) =>
      apiFetch<FollowUpRow>('/followups', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: followUpKeys.all }),
  });
}

export function useUpdateFollowUp() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: FollowUpUpdate }) =>
      apiFetch<FollowUpRow>(`/followups/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: followUpKeys.all }),
  });
}

export function useDeleteFollowUp() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/followups/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: followUpKeys.all }),
  });
}

/** Convenience: mark a follow-up done without closing it. */
export function useMarkFollowUpDone() {
  const update = useUpdateFollowUp();
  return {
    ...update,
    mutate: (id: string) => update.mutate({ id, patch: { done: true } }),
    mutateAsync: (id: string) => update.mutateAsync({ id, patch: { done: true } }),
  };
}
