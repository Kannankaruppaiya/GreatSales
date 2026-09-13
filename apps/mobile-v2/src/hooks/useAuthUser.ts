import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { authRepo } from '../repositories';
import { QUERY_KEYS, invalidateEntity } from '../lib/queryClient';
import type { User } from '../domain/types';

export function useCurrentUser() {
  return useQuery({
    queryKey: QUERY_KEYS.currentUser,
    queryFn: () => authRepo.getCurrentUser(),
  });
}

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) =>
      authRepo.login(email, password),
    onSuccess: (data) => {
      queryClient.setQueryData(QUERY_KEYS.currentUser, data.user);
      invalidateEntity('dashboard');
    },
  });
}

export const useLoginMutation = useLogin;

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => authRepo.logout(),
    onSuccess: () => {
      queryClient.setQueryData(QUERY_KEYS.currentUser, null);
      queryClient.clear();
    },
  });
}

export function useChangePassword() {
  return useMutation({
    mutationFn: ({ oldPw, newPw }: { oldPw: string; newPw: string }) =>
      authRepo.changePassword(oldPw, newPw),
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { name?: string; phone?: string }) => authRepo.updateProfile(input),
    onSuccess: (updatedUser) => {
      queryClient.setQueryData(QUERY_KEYS.currentUser, updatedUser);
      invalidateEntity('profile');
    },
  });
}

export const useUpdateProfileMutation = useUpdateProfile;

export function useUpdateAvatar() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (uri: string) => authRepo.updateAvatar(uri),
    onSuccess: (newUrl) => {
      queryClient.setQueryData(QUERY_KEYS.currentUser, (old: User | null | undefined) => {
        if (!old) return old;
        return { ...old, avatarUrl: newUrl };
      });
      invalidateEntity('profile');
    },
  });
}

export const useUpdateAvatarMutation = useUpdateAvatar;

export function useRemoveAvatar() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => authRepo.removeAvatar(),
    onSuccess: () => {
      queryClient.setQueryData(QUERY_KEYS.currentUser, (old: User | null | undefined) => {
        if (!old) return old;
        return { ...old, avatarUrl: null };
      });
      invalidateEntity('profile');
    },
  });
}

export const useRemoveAvatarMutation = useRemoveAvatar;
