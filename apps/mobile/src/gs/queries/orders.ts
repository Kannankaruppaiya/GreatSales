import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../api';
import { listParams, useCursorList } from './cursorList';
import type { OrderRow, OrderListResponse, OrderCreate, OrderUpdate } from '@greatsales/shared';
import { invalidateAfter } from '../invalidate';

export type { OrderRow, OrderCreate, OrderUpdate };

export interface OrderParams {
  search?: string;
  status?: string;
  customerId?: string;
}

export const orderKeys = {
  all: ['orders'] as const,
  list: (p: OrderParams) => ['orders', 'list', p] as const,
};

export function useOrders(params: OrderParams = {}, opts: { enabled?: boolean; autoFetchAll?: boolean } = {}) {
  return useCursorList<OrderRow>(
    '/orders',
    orderKeys.list(params),
    listParams({ ...params }),
    opts,
  );
}

export function useCreateOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: OrderCreate) =>
      apiFetch<OrderRow>('/orders', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => invalidateAfter(qc, 'orders'),
  });
}

export function useUpdateOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: OrderUpdate }) =>
      apiFetch<OrderRow>(`/orders/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
    onSuccess: () => invalidateAfter(qc, 'orders'),
  });
}

export function useDeleteOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/orders/${id}`, { method: 'DELETE' }),
    onSuccess: () => invalidateAfter(qc, 'orders'),
  });
}
