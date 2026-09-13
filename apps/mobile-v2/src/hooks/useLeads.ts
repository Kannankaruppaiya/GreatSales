import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { leadRepo } from '../repositories';
import { QUERY_KEYS, invalidateEntity } from '../lib/queryClient';
import type { Lead, DealStageValue } from '../domain/types';

export function useLeads(params?: { search?: string; stage?: string; salespersonId?: string }) {
  return useQuery({
    queryKey: QUERY_KEYS.leads(params),
    queryFn: () => leadRepo.list(params),
  });
}

export function useLead(id: string) {
  return useQuery({
    queryKey: QUERY_KEYS.lead(id),
    queryFn: () => leadRepo.getById(id),
    enabled: !!id,
  });
}

export function useCreateLeadMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Omit<Lead, 'id' | 'createdAt' | 'updatedAt' | 'stageUpdatedAt'>) =>
      leadRepo.create(input),
    onSuccess: (newLead) => {
      queryClient.setQueryData(QUERY_KEYS.lead(newLead.id), newLead);
      invalidateEntity('leads');
    },
  });
}

export function useChangeLeadStageMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, stage, note }: { id: string; stage: DealStageValue; note?: string }) =>
      leadRepo.changeStage(id, stage, note),
    onSuccess: (updated) => {
      queryClient.setQueryData(QUERY_KEYS.lead(updated.id), updated);
      invalidateEntity('leads');
    },
  });
}

export function useAddLeadRemarkMutation() {
  return useMutation({
    mutationFn: ({ id, note }: { id: string; note: string }) => leadRepo.addRemark(id, note),
    onSuccess: () => {
      invalidateEntity('leads');
    },
  });
}

export const useChangeLeadStage = useChangeLeadStageMutation;
export const useCreateLead = useCreateLeadMutation;
export const useAddLeadRemark = useAddLeadRemarkMutation;
