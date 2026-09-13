import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { customerRepo, activityRepo } from '../repositories';
import { QUERY_KEYS, invalidateEntity } from '../lib/queryClient';
import type { Customer } from '../domain/types';

export function useCustomers(params?: { search?: string; category?: string; area?: string; payZone?: string }) {
  return useQuery({
    queryKey: QUERY_KEYS.customers(params),
    queryFn: () => customerRepo.list(params),
  });
}

export function useCustomer(id: string) {
  return useQuery({
    queryKey: QUERY_KEYS.customer(id),
    queryFn: () => customerRepo.getById(id),
    enabled: !!id,
  });
}

export function useCustomerActivities(customerId: string) {
  return useQuery({
    queryKey: QUERY_KEYS.customerActivity(customerId),
    queryFn: () => activityRepo.listByCustomer(customerId),
    enabled: !!customerId,
  });
}

export function useCreateCustomerMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Omit<Customer, 'id' | 'createdAt' | 'updatedAt'>) => customerRepo.create(input),
    onSuccess: (newCust) => {
      queryClient.setQueryData(QUERY_KEYS.customer(newCust.id), newCust);
      invalidateEntity('customers');
    },
  });
}

export function useUpdateCustomerMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<Customer> }) => customerRepo.update(id, input),
    onSuccess: (updatedCust) => {
      queryClient.setQueryData(QUERY_KEYS.customer(updatedCust.id), updatedCust);
      invalidateEntity('customers');
    },
  });
}

export function useCheckDuplicateCustomers() {
  return useMutation({
    mutationFn: ({ name, phone }: { name: string; phone?: string }) =>
      customerRepo.checkDuplicates(name, phone),
  });
}

export const useCreateCustomer = useCreateCustomerMutation;
export const useUpdateCustomer = useUpdateCustomerMutation;
