import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { paymentRepo } from '../repositories';
import { QUERY_KEYS, invalidateEntity } from '../lib/queryClient';
import type { Payment } from '../domain/types';

export function usePayments(params?: { search?: string; status?: string; payZone?: string }) {
  return useQuery({
    queryKey: QUERY_KEYS.payments(params),
    queryFn: () => paymentRepo.list(params),
  });
}

export function usePayment(id: string) {
  return useQuery({
    queryKey: QUERY_KEYS.payment(id),
    queryFn: () => paymentRepo.getById(id),
    enabled: Boolean(id),
  });
}

export function useRecordPayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, amount, note }: { id: string; amount: number; note?: string }) =>
      paymentRepo.recordPayment(id, amount, note),
    onSuccess: (updated) => {
      queryClient.setQueryData(QUERY_KEYS.payment(updated.id), updated);
      invalidateEntity('payments');
    },
  });
}

export function useSendPaymentReminder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, stage }: { id: string; stage: 'mail1' | 'mail2' | 'mail3' | 'mail4' }) =>
      paymentRepo.sendReminder(id, stage),
    onSuccess: (updated) => {
      queryClient.setQueryData(QUERY_KEYS.payment(updated.id), updated);
      invalidateEntity('payments');
    },
  });
}

export function useAddPaymentRemark() {
  return useMutation({
    mutationFn: ({ id, note }: { id: string; note: string }) =>
      paymentRepo.addRemark(id, note),
    onSuccess: (_, { id }) => {
      invalidateEntity('payments');
    },
  });
}
