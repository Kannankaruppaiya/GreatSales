import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { followUpRepo } from '../repositories';
import { QUERY_KEYS, invalidateEntity } from '../lib/queryClient';
import type { FollowUp } from '../domain/types';

export function useFollowUps(params?: {
  filter?: 'all' | 'overdue' | 'today' | 'upcoming' | 'completed';
  entityType?: string;
}) {
  return useQuery({
    queryKey: QUERY_KEYS.followups(params),
    queryFn: () => followUpRepo.list(params),
  });
}

export function useFollowUp(id: string) {
  return useQuery({
    queryKey: QUERY_KEYS.followup(id),
    queryFn: () => followUpRepo.getById(id),
    enabled: Boolean(id),
  });
}

export function useCreateFollowUp() {
  return useMutation({
    mutationFn: (input: Omit<FollowUp, 'id' | 'createdAt' | 'updatedAt'>) =>
      followUpRepo.create(input),
    onSuccess: () => {
      invalidateEntity('followups');
    },
  });
}

export function useCompleteFollowUp() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, outcomeNote }: { id: string; outcomeNote?: string }) =>
      followUpRepo.complete(id, outcomeNote),
    onSuccess: (updated) => {
      queryClient.setQueryData(QUERY_KEYS.followup(updated.id), updated);
      invalidateEntity('followups');
    },
  });
}

export function useSnoozeFollowUp() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, days }: { id: string; days: number }) =>
      followUpRepo.snooze(id, days),
    onSuccess: (updated) => {
      queryClient.setQueryData(QUERY_KEYS.followup(updated.id), updated);
      invalidateEntity('followups');
    },
  });
}
