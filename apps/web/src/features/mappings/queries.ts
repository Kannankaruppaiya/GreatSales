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

const PAGE_SIZE = 50;

export interface MappingParams {
  search?: string;
  customerId?: string;
  productId?: string;
  ownerId?: string;
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
 * Mappings feed the projections worksheet, so a write here changes what F6
 * shows. Invalidating projections too keeps the two from disagreeing until the
 * next reload.
 */
export function onMappingMutationSuccess(qc: QueryClient) {
  qc.invalidateQueries({ queryKey: ["mappings"] });
  return qc.invalidateQueries({ queryKey: ["projections"] });
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
