/**
 * react-query hooks for the follow-ups page. List is cursor-paginated via
 * useInfiniteQuery; create/update/delete mutations all invalidate the
 * `followups` query family so every open list/filter combination refetches.
 *
 * NOTE: the FollowUp table has NO soft-delete column — `useDeleteFollowUp`
 * issues a hard `DELETE /followups/:id` that permanently removes the row.
 */
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { apiFetch, buildQuery } from "@/lib/api";
import type {
  FollowUpRow,
  FollowUpListResponse,
  FollowUpCreate,
  FollowUpUpdate,
  EntityTypeValue,
} from "./types";

const PAGE_SIZE = 50;

export interface FollowUpParams {
  search?: string;
  entityType?: EntityTypeValue;
  done?: boolean;
  ownerId?: string;
}

export const followUpKeys = {
  list: (p: FollowUpParams) => ["followups", p] as const,
};

export function followUpsQueryFn(p: FollowUpParams, cursor: string | undefined) {
  return apiFetch<FollowUpListResponse>(
    `/followups${buildQuery({
      search: p.search,
      entityType: p.entityType,
      // `done` is a boolean filter but buildQuery only accepts strings —
      // stringify it here so `done: false` still reaches the URL instead of
      // silently vanishing (buildQuery only drops undefined/"" values, but a
      // raw `false` would fail the `Record<string, string>` param type).
      done: p.done === undefined ? undefined : String(p.done),
      ownerId: p.ownerId,
      cursor,
      limit: String(PAGE_SIZE),
    })}`,
  );
}

export function useFollowUps(
  params: FollowUpParams = {},
  opts: { enabled?: boolean } = {},
) {
  return useInfiniteQuery({
    queryKey: followUpKeys.list(params),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => followUpsQueryFn(params, pageParam),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled: opts.enabled ?? true,
  });
}

export function flattenFollowUps(data?: { pages: FollowUpListResponse[] }): FollowUpRow[] {
  return data?.pages.flatMap((pg) => pg.items) ?? [];
}

export function onFollowUpMutationSuccess(qc: QueryClient) {
  return qc.invalidateQueries({ queryKey: ["followups"] });
}

export function useCreateFollowUp() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: FollowUpCreate) =>
      apiFetch<FollowUpRow>("/followups", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => onFollowUpMutationSuccess(qc),
  });
}

export function useUpdateFollowUp() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: FollowUpUpdate }) =>
      apiFetch<FollowUpRow>(`/followups/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
    onSuccess: () => onFollowUpMutationSuccess(qc),
  });
}

/** Hard delete — the FollowUp table has no soft-delete column. */
export function useDeleteFollowUp() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/followups/${id}`, { method: "DELETE" }),
    onSuccess: () => onFollowUpMutationSuccess(qc),
  });
}
