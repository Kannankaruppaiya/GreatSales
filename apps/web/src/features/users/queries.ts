/**
 * react-query hooks for the users (team) page. List is cursor-paginated via
 * useInfiniteQuery; create/update/delete mutations all invalidate the
 * `users` query family so every open list/filter combination refetches.
 */
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { apiFetch, buildQuery } from "@/lib/api";
import type {
  UserRow,
  UserListResponse,
  UserCreate,
  UserUpdate,
} from "./types";

const PAGE_SIZE = 50;

export interface UserParams {
  search?: string;
  roleId?: string;
}

export const userKeys = {
  list: (p: UserParams) => ["users", p] as const,
};

export function usersQueryFn(p: UserParams, cursor: string | undefined) {
  return apiFetch<UserListResponse>(
    `/users${buildQuery({
      search: p.search,
      roleId: p.roleId,
      cursor,
      limit: String(PAGE_SIZE),
    })}`,
  );
}

export function useUsers(params: UserParams = {}, opts: { enabled?: boolean } = {}) {
  return useInfiniteQuery({
    queryKey: userKeys.list(params),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => usersQueryFn(params, pageParam),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled: opts.enabled ?? true,
  });
}

export function flattenUsers(data?: { pages: UserListResponse[] }): UserRow[] {
  return data?.pages.flatMap((pg) => pg.items) ?? [];
}

export function onUserMutationSuccess(qc: QueryClient) {
  return qc.invalidateQueries({ queryKey: ["users"] });
}

export function useCreateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: UserCreate) =>
      apiFetch<UserRow>("/users", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => onUserMutationSuccess(qc),
  });
}

export function useUpdateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: UserUpdate }) =>
      apiFetch<UserRow>(`/users/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
    onSuccess: () => onUserMutationSuccess(qc),
  });
}

export function useDeleteUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/users/${id}`, { method: "DELETE" }),
    onSuccess: () => onUserMutationSuccess(qc),
  });
}
