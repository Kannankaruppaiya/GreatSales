import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { mappingRepo } from '../repositories';
import { QUERY_KEYS, invalidateEntity } from '../lib/queryClient';
import type { Mapping } from '../domain/types';

export function useMappings(params?: { search?: string; customerId?: string; principalId?: string }) {
  return useQuery({
    queryKey: QUERY_KEYS.mappings(params),
    queryFn: () => mappingRepo.list(params),
  });
}

export function useMapping(id: string) {
  return useQuery({
    queryKey: QUERY_KEYS.mapping(id),
    queryFn: () => mappingRepo.getById(id),
    enabled: Boolean(id),
  });
}

export function useCreateMapping() {
  return useMutation({
    mutationFn: (input: Omit<Mapping, 'id' | 'createdAt' | 'updatedAt'>) =>
      mappingRepo.create(input),
    onSuccess: () => {
      invalidateEntity('mappings');
    },
  });
}

export function useUpdateMappingPrice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, customPrice }: { id: string; customPrice: number | null }) =>
      mappingRepo.updatePrice(id, customPrice),
    onSuccess: (updated) => {
      queryClient.setQueryData(QUERY_KEYS.mapping(updated.id), updated);
      invalidateEntity('mappings');
    },
  });
}

export function useDeleteMapping() {
  return useMutation({
    mutationFn: (id: string) => mappingRepo.delete(id),
    onSuccess: () => {
      invalidateEntity('mappings');
    },
  });
}
