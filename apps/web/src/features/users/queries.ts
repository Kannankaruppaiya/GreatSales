/**
 * react-query hooks for user, role, and team administration.
 *
 * CROSS-INVALIDATION is the part worth reading. These three resources are not
 * independent: changing a user's role moves a role's `userCount`, deleting a
 * team detaches its members, and moving someone between teams changes two
 * counts at once. Every mutation therefore invalidates each family it can
 * affect — without that, the three tabs would quietly disagree with each other
 * and with the database.
 */
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { apiFetch, buildQuery } from "@/lib/api";
import type {
  PermissionGroup,
  RoleCreate,
  RoleRow,
  RoleUpdate,
  SortDirection,
  TeamCreate,
  TeamRow,
  TeamUpdate,
  UserCreate,
  UserListResponse,
  UserRow,
  UserSortField,
  UserStatusFilter,
  UserUpdate,
} from "./types";

const PAGE_SIZE = 25;

export interface UserParams {
  search?: string;
  roleId?: string;
  teamId?: string;
  status?: UserStatusFilter;
  sort?: UserSortField;
  dir?: SortDirection;
  includeDeleted?: boolean;
}

export const userKeys = {
  all: ["users"] as const,
  list: (p: UserParams) => ["users", p] as const,
};
export const roleKeys = {
  all: ["roles"] as const,
  list: () => ["roles"] as const,
  permissions: () => ["permissions"] as const,
};
export const teamKeys = {
  all: ["teams"] as const,
  list: () => ["teams"] as const,
  members: (id: string) => ["teams", id, "members"] as const,
};

/**
 * Invalidate every family a user, role, or team change can affect.
 *
 * Deliberately broad. A narrower invalidation would be faster and wrong: a
 * role change alters that role's userCount, a team change alters a user's team
 * name, and getting it wrong shows the operator stale numbers immediately
 * after they changed them — the moment they are most likely to be looking.
 */
export function invalidateAdminFamilies(qc: QueryClient): Promise<void> {
  return Promise.all([
    qc.invalidateQueries({ queryKey: userKeys.all }),
    qc.invalidateQueries({ queryKey: roleKeys.all }),
    qc.invalidateQueries({ queryKey: teamKeys.all }),
  ]).then(() => undefined);
}

/* ── Users ──────────────────────────────────────────────────────────────── */

export function usersQueryFn(p: UserParams, cursor: string | undefined) {
  return apiFetch<UserListResponse>(
    `/users${buildQuery({
      search: p.search,
      roleId: p.roleId,
      teamId: p.teamId,
      status: p.status,
      sort: p.sort,
      dir: p.dir,
      // Sent as the STRING the server's enum expects. The server rejects any
      // other spelling rather than coercing it, which is why `?active=false`
      // silently returning ACTIVE users cannot happen again.
      includeDeleted: p.includeDeleted ? "true" : "false",
      cursor,
      limit: String(PAGE_SIZE),
    })}`,
  );
}

export function useUsers(
  params: UserParams = {},
  opts: { enabled?: boolean } = {},
) {
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

/**
 * The SERVER's count of matching users.
 *
 * Not `flattenUsers(data).length` — that counts only the pages loaded so far,
 * so any visible total would under-report the moment the list paginated.
 */
export function userTotal(data?: { pages: UserListResponse[] }): number {
  return data?.pages[0]?.total ?? 0;
}

export function useCreateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: UserCreate) =>
      apiFetch<UserRow>("/users", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => invalidateAdminFamilies(qc),
  });
}

export function useUpdateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: UserUpdate }) =>
      apiFetch<UserRow>(`/users/${id}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      }),
    onSuccess: () => invalidateAdminFamilies(qc),
  });
}

export function useDeleteUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<void>(`/users/${id}`, { method: "DELETE" }),
    onSuccess: () => invalidateAdminFamilies(qc),
  });
}

export function useRestoreUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<UserRow>(`/users/${id}/restore`, { method: "POST" }),
    onSuccess: () => invalidateAdminFamilies(qc),
  });
}

export function useResetPassword() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, password }: { id: string; password: string }) =>
      apiFetch<{ mustChangePassword: true }>(`/users/${id}/reset-password`, {
        method: "POST",
        body: JSON.stringify({ password }),
      }),
    onSuccess: () => invalidateAdminFamilies(qc),
  });
}

/* ── Roles ──────────────────────────────────────────────────────────────── */

export function useRoles(opts: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: roleKeys.list(),
    queryFn: () => apiFetch<RoleRow[]>("/roles"),
    enabled: opts.enabled ?? true,
  });
}

/**
 * The permission catalogue. Static and tenant-agnostic — permissions are a
 * property of the software — so it is cached for the session rather than
 * refetched every time the matrix renders.
 */
export function usePermissionCatalog(opts: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: roleKeys.permissions(),
    queryFn: () => apiFetch<PermissionGroup[]>("/permissions"),
    staleTime: Infinity,
    enabled: opts.enabled ?? true,
  });
}

export function useCreateRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: RoleCreate) =>
      apiFetch<RoleRow>("/roles", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => invalidateAdminFamilies(qc),
  });
}

export function useUpdateRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: RoleUpdate }) =>
      apiFetch<RoleRow>(`/roles/${id}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      }),
    onSuccess: () => invalidateAdminFamilies(qc),
  });
}

export function useDeleteRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<void>(`/roles/${id}`, { method: "DELETE" }),
    onSuccess: () => invalidateAdminFamilies(qc),
  });
}

/* ── Teams ──────────────────────────────────────────────────────────────── */

export function useTeams(opts: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: teamKeys.list(),
    queryFn: () => apiFetch<TeamRow[]>("/teams"),
    enabled: opts.enabled ?? true,
  });
}

export function useTeamMembers(teamId: string | null) {
  return useQuery({
    queryKey: teamKeys.members(teamId ?? ""),
    queryFn: () => apiFetch<UserRow[]>(`/teams/${teamId}/members`),
    enabled: !!teamId,
  });
}

export function useCreateTeam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: TeamCreate) =>
      apiFetch<TeamRow>("/teams", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => invalidateAdminFamilies(qc),
  });
}

export function useUpdateTeam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: TeamUpdate }) =>
      apiFetch<TeamRow>(`/teams/${id}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      }),
    onSuccess: () => invalidateAdminFamilies(qc),
  });
}

export function useDeleteTeam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<void>(`/teams/${id}`, { method: "DELETE" }),
    onSuccess: () => invalidateAdminFamilies(qc),
  });
}

export function useAddTeamMembers() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ teamId, userIds }: { teamId: string; userIds: string[] }) =>
      apiFetch<{ added: number }>(`/teams/${teamId}/members`, {
        method: "POST",
        body: JSON.stringify({ userIds }),
      }),
    onSuccess: () => invalidateAdminFamilies(qc),
  });
}

export function useRemoveTeamMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ teamId, userId }: { teamId: string; userId: string }) =>
      apiFetch<void>(`/teams/${teamId}/members/${userId}`, {
        method: "DELETE",
      }),
    onSuccess: () => invalidateAdminFamilies(qc),
  });
}
