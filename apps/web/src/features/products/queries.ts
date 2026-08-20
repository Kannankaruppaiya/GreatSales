/**
 * react-query hooks for the products (catalog) page. List is cursor-paginated
 * via useInfiniteQuery; create/update/delete mutations all invalidate the
 * `products` query family so every open list/filter combination refetches.
 */
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { apiFetch, buildQuery } from "@/lib/api";
import type {
  ProductRow,
  ProductListResponse,
  ProductCreate,
  ProductUpdate,
} from "./types";

const PAGE_SIZE = 50;

export interface ProductParams {
  search?: string;
  principalId?: string;
}

export const productKeys = {
  list: (p: ProductParams) => ["products", p] as const,
};

export function productsQueryFn(p: ProductParams, cursor: string | undefined) {
  return apiFetch<ProductListResponse>(
    `/products${buildQuery({
      search: p.search,
      principalId: p.principalId,
      cursor,
      limit: String(PAGE_SIZE),
    })}`,
  );
}

export function useProducts(params: ProductParams = {}, opts: { enabled?: boolean } = {}) {
  return useInfiniteQuery({
    queryKey: productKeys.list(params),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => productsQueryFn(params, pageParam),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled: opts.enabled ?? true,
  });
}

export function flattenProducts(data?: { pages: ProductListResponse[] }): ProductRow[] {
  return data?.pages.flatMap((pg) => pg.items) ?? [];
}

export function onProductMutationSuccess(qc: QueryClient) {
  return qc.invalidateQueries({ queryKey: ["products"] });
}

export function useCreateProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: ProductCreate) =>
      apiFetch<ProductRow>("/products", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => onProductMutationSuccess(qc),
  });
}

export function useUpdateProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: ProductUpdate }) =>
      apiFetch<ProductRow>(`/products/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
    onSuccess: () => onProductMutationSuccess(qc),
  });
}

export function useDeleteProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/products/${id}`, { method: "DELETE" }),
    onSuccess: () => onProductMutationSuccess(qc),
  });
}
