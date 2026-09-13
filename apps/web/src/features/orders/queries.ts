/**
 * react-query hooks for the orders (sales order) page. List is
 * cursor-paginated via useInfiniteQuery; create/update/delete mutations all
 * invalidate the `orders` query family so every open list/filter combination
 * refetches. `total`/`items[].lineTotal` on the returned OrderRow are
 * server-computed — see features/orders/types.ts.
 */
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { apiFetch, buildQuery } from "@/lib/api";
import type {
  OrderRow,
  OrderListResponse,
  OrderCreate,
  OrderUpdate,
} from "./types";
import { invalidateAfter } from "@/lib/invalidate";

const PAGE_SIZE = 50;

export interface OrderParams {
  /** Orders with at least one item whose product belongs to this principal. */
  principalId?: string;
  search?: string;
  status?: string;
  customerId?: string;
  ownerId?: string;
}

export const orderKeys = {
  list: (p: OrderParams) => ["orders", p] as const,
};

export function ordersQueryFn(p: OrderParams, cursor: string | undefined) {
  return apiFetch<OrderListResponse>(
    `/orders${buildQuery({
      search: p.search,
      status: p.status,
      customerId: p.customerId,
      ownerId: p.ownerId,
      principalId: p.principalId,
      cursor,
      limit: String(PAGE_SIZE),
    })}`,
  );
}

export function useOrders(params: OrderParams = {}, opts: { enabled?: boolean } = {}) {
  return useInfiniteQuery({
    queryKey: orderKeys.list(params),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => ordersQueryFn(params, pageParam),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled: opts.enabled ?? true,
  });
}

export function flattenOrders(data?: { pages: OrderListResponse[] }): OrderRow[] {
  return data?.pages.flatMap((pg) => pg.items) ?? [];
}

export function onOrderMutationSuccess(qc: QueryClient) {
  return invalidateAfter(qc, "orders");
}

export function useCreateOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: OrderCreate) =>
      apiFetch<OrderRow>("/orders", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => onOrderMutationSuccess(qc),
  });
}

export function useUpdateOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: OrderUpdate }) =>
      apiFetch<OrderRow>(`/orders/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
    onSuccess: () => onOrderMutationSuccess(qc),
  });
}

export function useDeleteOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/orders/${id}`, { method: "DELETE" }),
    onSuccess: () => onOrderMutationSuccess(qc),
  });
}
