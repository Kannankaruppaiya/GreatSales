import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { apiFetch, buildQuery } from "@/lib/api";
import type {
  MappingRow,
  MappingListResponse,
  MappingCreate,
  MappingUpdate,
} from "./types";
import { invalidateAfter } from "@/lib/invalidate";

const PAGE_SIZE = 50;

export interface MappingParams {
  search?: string;
  customerId?: string;
  productId?: string;
  ownerId?: string;
  principalId?: string;
  /** Only mappings with neither an agreed nor a catalog price behind them. */
  unpriced?: boolean;
}

export const mappingKeys = {
  list: (p: MappingParams) => ["mappings", p] as const,
};

export function mappingsQueryFn(p: MappingParams, cursor: string | undefined) {
  return apiFetch<MappingListResponse>(
    `/mappings${buildQuery({
      search: p.search,
      customerId: p.customerId,
      productId: p.productId,
      ownerId: p.ownerId,
      principalId: p.principalId,
      // Sent only when ON. The server reads the literal "true" and nothing
      // else, so an absent key and "false" mean the same thing.
      unpriced: p.unpriced ? "true" : undefined,
      cursor,
      limit: String(PAGE_SIZE),
    })}`,
  );
}

export function useMappings(
  params: MappingParams = {},
  opts: { enabled?: boolean } = {},
) {
  return useInfiniteQuery({
    queryKey: mappingKeys.list(params),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => mappingsQueryFn(params, pageParam),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled: opts.enabled ?? true,
  });
}

export function flattenMappings(data?: {
  pages: MappingListResponse[];
}): MappingRow[] {
  return data?.pages.flatMap((pg) => pg.items) ?? [];
}

/**
 * Mappings feed the projections worksheet, which in turn feeds the dashboard,
 * so a write here changes what two other pages show.
 */
export function onMappingMutationSuccess(qc: QueryClient) {
  return invalidateAfter(qc, "mappings");
}

export function useCreateMapping() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: MappingCreate) =>
      apiFetch<MappingRow>("/mappings", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => onMappingMutationSuccess(qc),
  });
}

export function useUpdateMapping() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: MappingUpdate }) =>
      apiFetch<MappingRow>(`/mappings/${id}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      }),
    onSuccess: () => onMappingMutationSuccess(qc),
  });
}

export function useDeleteMapping() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ id: string }>(`/mappings/${id}`, { method: "DELETE" }),
    onSuccess: () => onMappingMutationSuccess(qc),
  });
}
