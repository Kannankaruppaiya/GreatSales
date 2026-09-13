import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../api';
import { listParams, useCursorList } from './cursorList';
import type { PaymentRow, PaymentListResponse, PaymentCreate, PaymentUpdate } from '@greatsales/shared';
import { invalidateAfter } from '../invalidate';

export type { PaymentRow, PaymentCreate, PaymentUpdate };

export interface PaymentParams {
  search?: string;
  status?: string;
  customerId?: string;
}

export const paymentKeys = {
  all: ['payments'] as const,
  list: (p: PaymentParams) => ['payments', 'list', p] as const,
};

export function usePayments(params: PaymentParams = {}, opts: { enabled?: boolean; autoFetchAll?: boolean } = {}) {
  return useCursorList<PaymentRow>(
    '/payments',
    paymentKeys.list(params),
    listParams({ ...params }),
    opts,
  );
}

export function useCreatePayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: PaymentCreate) =>
      apiFetch<PaymentRow>('/payments', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => invalidateAfter(qc, 'payments'),
  });
}

export function useUpdatePayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: PaymentUpdate }) =>
      apiFetch<PaymentRow>(`/payments/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      }),
    onSuccess: () => invalidateAfter(qc, 'payments'),
  });
}

export function useDeletePayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/payments/${id}`, { method: 'DELETE' }),
    onSuccess: () => invalidateAfter(qc, 'payments'),
  });
}
