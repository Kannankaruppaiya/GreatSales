/**
 * React Query hooks for the Leads (New Sales Pipeline) screen.
 * Salesperson-scoped — the JWT on every request limits results to their own leads.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../api';
import { listParams, useCursorList } from './cursorList';
import type { LeadRow, LeadListResponse, LeadCreate, LeadUpdate } from '@greatsales/shared';
import { invalidateAfter } from '../invalidate';

export type { LeadRow, LeadCreate, LeadUpdate };

export interface LeadParams {
  search?: string;
  stage?: string;
  tier?: string;
}

export const leadKeys = {
  all: ['leads'] as const,
  list: (p: LeadParams) => ['leads', 'list', p] as const,
};

export function useLeads(params: LeadParams = {}, opts: { enabled?: boolean; autoFetchAll?: boolean } = {}) {
  return useCursorList<LeadRow>(
    '/leads',
    leadKeys.list(params),
    listParams({ ...params }),
    opts,
  );
}

export function useCreateLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: LeadCreate) =>
      apiFetch<LeadRow>('/leads', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => invalidateAfter(qc, 'leads'),
  });
}

export function useUpdateLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: LeadUpdate }) =>
      apiFetch<LeadRow>(`/leads/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
    onSuccess: () => invalidateAfter(qc, 'leads'),
  });
}

export function useDeleteLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/leads/${id}`, { method: 'DELETE' }),
    onSuccess: () => invalidateAfter(qc, 'leads'),
  });
}
