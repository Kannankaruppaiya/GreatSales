import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../api';
import { listParams, useCursorList } from './cursorList';
import type { CustomerRow, CustomerListResponse, CustomerCreate, CustomerUpdate } from '@greatsales/shared';

export type { CustomerRow, CustomerCreate, CustomerUpdate };

export interface CustomerParams {
  search?: string;
  category?: string;
}

export const customerKeys = {
  all: ['customers'] as const,
  list: (p: CustomerParams) => ['customers', 'list', p] as const,
};

export function useCustomers(params: CustomerParams = {}, opts: { enabled?: boolean; autoFetchAll?: boolean } = {}) {
  return useCursorList<CustomerRow>(
    '/customers',
    customerKeys.list(params),
    listParams({ ...params }),
    opts,
  );
}

export function useCreateCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CustomerCreate) =>
      apiFetch<CustomerRow>('/customers', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: customerKeys.all }),
  });
}

export function useUpdateCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: CustomerUpdate }) =>
      apiFetch<CustomerRow>(`/customers/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: customerKeys.all }),
  });
}

export function useDeleteCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/customers/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: customerKeys.all }),
  });
}
