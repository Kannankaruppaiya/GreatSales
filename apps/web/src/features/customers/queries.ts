/**
 * react-query hooks for the customers page. List is cursor-paginated via
 * useInfiniteQuery; create/update/delete mutations all invalidate the
 * `customers` query family so every open list/filter combination refetches.
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
  CustomerRow,
  CustomerListResponse,
  CustomerCreate,
  CustomerUpdate,
  IndustryRow,
} from "./types";

const PAGE_SIZE = 50;

export interface CustomerParams {
  search?: string;
  category?: string;
  ownerId?: string;
  area?: string;
  industryId?: string;
  /** Accounts mapped to at least one product of this principal. */
  principalId?: string;
}

export const customerKeys = {
  list: (p: CustomerParams) => ["customers", p] as const,
  detail: (id: string) => ["customers", "detail", id] as const,
};

export function useCustomer(id: string | null, opts: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: id ? customerKeys.detail(id) : ["customers", "detail", "null"],
    queryFn: () => apiFetch<CustomerRow>(`/customers/${id}`),
    enabled: !!id && (opts.enabled ?? true),
  });
}

export function customersQueryFn(p: CustomerParams, cursor: string | undefined) {
  return apiFetch<CustomerListResponse>(
    `/customers${buildQuery({
      search: p.search,
      category: p.category,
      ownerId: p.ownerId,
      area: p.area,
      industryId: p.industryId,
      principalId: p.principalId,
      cursor,
      limit: String(PAGE_SIZE),
    })}`,
  );
}

export function useCustomers(
  params: CustomerParams = {},
  opts: { enabled?: boolean } = {},
) {
  return useInfiniteQuery({
    queryKey: customerKeys.list(params),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => customersQueryFn(params, pageParam),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled: opts.enabled ?? true,
  });
}

export function flattenCustomers(data?: { pages: CustomerListResponse[] }): CustomerRow[] {
  return data?.pages.flatMap((pg) => pg.items) ?? [];
}

export function onCustomerMutationSuccess(qc: QueryClient) {
  return qc.invalidateQueries({ queryKey: ["customers"] });
}

/**
 * The global industry catalogue.
 *
 * Cached with a long staleTime because it is reference data that changes about
 * never, and it is fetched by both the customers filter bar and the customer
 * form — one request per session rather than one per mount.
 */
export function useIndustries() {
  return useQuery({
    queryKey: ["industries"],
    staleTime: 60 * 60 * 1000,
    queryFn: () => apiFetch<IndustryRow[]>("/industries"),
  });
}

export function useCreateCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CustomerCreate) =>
      apiFetch<CustomerRow>("/customers", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => onCustomerMutationSuccess(qc),
  });
}

export function useUpdateCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: CustomerUpdate }) =>
      apiFetch<CustomerRow>(`/customers/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
    onSuccess: () => onCustomerMutationSuccess(qc),
  });
}

export function useDeleteCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/customers/${id}`, { method: "DELETE" }),
    onSuccess: () => onCustomerMutationSuccess(qc),
  });
}
