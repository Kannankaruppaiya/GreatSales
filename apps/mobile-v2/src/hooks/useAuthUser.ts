import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { authRepo } from '../repositories';
import { QUERY_KEYS, invalidateEntity } from '../lib/queryClient';

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

/*
 * useUpdateProfile, useUpdateAvatar and useRemoveAvatar used to live here.
 *
 * They are gone because the API has none of it. UserRow carries no avatar
 * field and no phone; AuthUser carries neither either; there is no
 * self-service profile endpoint, only PATCH /users/:id, which is user
 * administration and is not granted to a sales role - the only role that may
 * sign in from mobile at all (AGENTS.md, CLIENT_ROLE_ALLOWLIST).
 *
 * The mutations wrote `avatarUrl` into the cached user on success, so the
 * picture appeared to change and survived until the next fetch. That is the
 * shape of every bug in this app before the fixtures came out.
 *
 * Adding any of it starts on the API.
 */
