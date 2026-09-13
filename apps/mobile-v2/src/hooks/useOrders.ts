import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { orderRepo } from '../repositories';
import { QUERY_KEYS, invalidateEntity } from '../lib/queryClient';
import type { SalesOrder, OrderStatusValue } from '../domain/types';

export function useOrders(params?: { search?: string; status?: string }) {
  return useQuery({
    queryKey: QUERY_KEYS.orders(params),
    queryFn: () => orderRepo.list(params),
  });
}

export function useOrder(id: string) {
  return useQuery({
    queryKey: QUERY_KEYS.order(id),
    queryFn: () => orderRepo.getById(id),
    enabled: Boolean(id),
  });
}

export function useCreateOrder() {
  return useMutation({
    mutationFn: (input: Omit<SalesOrder, 'id' | 'code' | 'createdAt' | 'updatedAt' | 'statusHistory'>) =>
      orderRepo.create(input),
    onSuccess: () => {
      invalidateEntity('orders');
    },
  });
}

export function useAdvanceOrderStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, nextStatus, note }: { id: string; nextStatus: OrderStatusValue; note?: string }) =>
      orderRepo.advanceStatus(id, nextStatus, note),
    onSuccess: (updated) => {
      queryClient.setQueryData(QUERY_KEYS.order(updated.id), updated);
      invalidateEntity('orders');
    },
  });
}

export function useCancelOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      orderRepo.cancelOrder(id, reason),
    onSuccess: (updated) => {
      queryClient.setQueryData(QUERY_KEYS.order(updated.id), updated);
      invalidateEntity('orders');
    },
  });
}
