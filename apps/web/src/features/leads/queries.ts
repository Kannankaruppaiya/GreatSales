/**
 * react-query hooks for the leads (new-sales pipeline) page. List is
 * cursor-paginated via useInfiniteQuery; create/update/delete mutations all
 * invalidate the `leads` query family so every open list/filter combination
 * (including the Kanban board) refetches.
 */
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { apiFetch, buildQuery } from "@/lib/api";
import type {
  LeadRow,
  LeadListResponse,
  LeadCreate,
  LeadUpdate,
} from "./types";
import { invalidateAfter } from "@/lib/invalidate";

const PAGE_SIZE = 50;

export interface LeadParams {
  /** Leads carrying at least one line item for this principal. */
  principalId?: string;
  search?: string;
  stage?: string;
  tier?: string;
  ownerId?: string;
}

export const leadKeys = {
  list: (p: LeadParams) => ["leads", p] as const,
};

export function leadsQueryFn(p: LeadParams, cursor: string | undefined) {
  return apiFetch<LeadListResponse>(
    `/leads${buildQuery({
      search: p.search,
      stage: p.stage,
      tier: p.tier,
      ownerId: p.ownerId,
      principalId: p.principalId,
      cursor,
      limit: String(PAGE_SIZE),
    })}`,
  );
}

export function useLeads(params: LeadParams = {}, opts: { enabled?: boolean } = {}) {
  return useInfiniteQuery({
    queryKey: leadKeys.list(params),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => leadsQueryFn(params, pageParam),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled: opts.enabled ?? true,
  });
}

export function flattenLeads(data?: { pages: LeadListResponse[] }): LeadRow[] {
  return data?.pages.flatMap((pg) => pg.items) ?? [];
}

/**
 * The dashboard's committed new-sales value, its oral-confirmation list and
 * its stage breakdown are all computed from leads, so a stage moved here moves
 * numbers on a page this one does not own.
 */
export function onLeadMutationSuccess(qc: QueryClient) {
  return invalidateAfter(qc, "leads");
}

export function useCreateLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: LeadCreate) =>
      apiFetch<LeadRow>("/leads", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => onLeadMutationSuccess(qc),
  });
}

export function useUpdateLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: LeadUpdate }) =>
      apiFetch<LeadRow>(`/leads/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
    onSuccess: () => onLeadMutationSuccess(qc),
  });
}

export function useDeleteLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/leads/${id}`, { method: "DELETE" }),
    onSuccess: () => onLeadMutationSuccess(qc),
  });
}
