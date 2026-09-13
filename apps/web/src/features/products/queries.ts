import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { apiFetch, buildQuery } from "@/lib/api";
import type {
  ProductRow,
  ProductListResponse,
  ProductCreate,
  ProductUpdate,
  PrincipalRow,
  PrincipalListResponse,
  PrincipalCreate,
  PrincipalUpdate,
} from "./types";
import { invalidateAfter } from "@/lib/invalidate";

const PAGE_SIZE = 50;

export interface ProductParams {
  division?: string;
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
      division: p.division,
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

/**
 * `basePrice` is a mapping's Catalog column and the price a projection line
 * falls back to, so editing a product silently changes both.
 */
export function onProductMutationSuccess(qc: QueryClient) {
  return invalidateAfter(qc, "products");
}

export function useCreateProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: ProductCreate) =>
      apiFetch<ProductRow>("/products", { method: "POST", body: JSON.stringify(body) }),
    // `products` already carries `principals` (a principal row counts its
    // products), so one call covers both.
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
    // `products` already carries `principals` (a principal row counts its
    // products), so one call covers both.
    onSuccess: () => onProductMutationSuccess(qc),
  });
}

// =============================================================================
// Principals Hooks
// =============================================================================

export const principalKeys = {
  all: ["principals"] as const,
};

export function usePrincipals(opts: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: principalKeys.all,
    queryFn: () => apiFetch<PrincipalListResponse>("/principals"),
    enabled: opts.enabled ?? true,
  });
}

export function useCreatePrincipal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: PrincipalCreate) =>
      apiFetch<PrincipalRow>("/principals", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => {
      invalidateAfter(qc, "principals");
    },
  });
}

export function useUpdatePrincipal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: PrincipalUpdate }) =>
      apiFetch<PrincipalRow>(`/principals/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
    onSuccess: () => {
      invalidateAfter(qc, "principals");
    },
  });
}

export function useDeletePrincipal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/principals/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      invalidateAfter(qc, "principals");
    },
  });
}


