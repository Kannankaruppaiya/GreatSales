import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../api';
import { listParams, useCursorList } from './cursorList';
import type { CustomerRow, CustomerListResponse, CustomerCreate, CustomerUpdate } from '@greatsales/shared';
import { invalidateAfter } from '../invalidate';

export type { CustomerRow, CustomerCreate, CustomerUpdate };

export interface CustomerParams {
  search?: string;
  category?: string;
}

export const customerKeys = {
  all: ['customers'] as const,
  list: (p: CustomerParams) => ['customers', 'list', p] as const,
  detail: (id: string) => ['customers', 'detail', id] as const,
};

export function useCustomers(params: CustomerParams = {}, opts: { enabled?: boolean; autoFetchAll?: boolean } = {}) {
  return useCursorList<CustomerRow>(
    '/customers',
    customerKeys.list(params),
    listParams({ ...params }),
    opts,
  );
}

/**
 * One customer, fresh from the server.
 *
 * The detail sheet used to render whichever list row happened to be in the
 * cursor pages already loaded. That row is a snapshot from whenever its page
 * was fetched, and the sheet stays open in the field for minutes — long enough
 * for the outstanding figure on screen to be wrong. Web's drawer has fetched
 * this since it shipped.
 *
 * The response shape is the same `CustomerRow`, so callers can fall back to the
 * list row while this is in flight and nothing flickers.
 */
export function useCustomer(id: string | null, opts: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: customerKeys.detail(id ?? 'none'),
    enabled: (opts.enabled ?? true) && id != null,
    queryFn: () => apiFetch<CustomerRow>(`/customers/${id}`),
  });
}

export function useCreateCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CustomerCreate) =>
      apiFetch<CustomerRow>('/customers', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => invalidateAfter(qc, 'customers'),
  });
}

export function useUpdateCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: CustomerUpdate }) =>
      apiFetch<CustomerRow>(`/customers/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
    onSuccess: () => invalidateAfter(qc, 'customers'),
  });
}

export function useDeleteCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/customers/${id}`, { method: 'DELETE' }),
    onSuccess: () => invalidateAfter(qc, 'customers'),
  });
}
