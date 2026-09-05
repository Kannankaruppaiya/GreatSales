/**
 * react-query hooks for the payments page. List is cursor-paginated via
 * useInfiniteQuery; create/update/delete mutations all invalidate the
 * `payments` query family so every open list/filter combination refetches.
 *
 * `pending`/`status`/`agingDays` come back on every PaymentRow already
 * computed by the server — nothing here (or in any payments consumer)
 * recomputes them.
 */
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { apiFetch, buildQuery } from "@/lib/api";
import type {
  PaymentRow,
  PaymentListResponse,
  PaymentCreate,
  PaymentUpdate,
  PaymentImport,
  PaymentImportResult,
} from "./types";

const PAGE_SIZE = 50;

export interface PaymentParams {
  search?: string;
  status?: string;
  customerId?: string;
  ownerId?: string;
}

export const paymentKeys = {
  list: (p: PaymentParams) => ["payments", p] as const,
};

export function paymentsQueryFn(p: PaymentParams, cursor: string | undefined) {
  return apiFetch<PaymentListResponse>(
    `/payments${buildQuery({
      search: p.search,
      status: p.status,
      customerId: p.customerId,
      ownerId: p.ownerId,
      cursor,
      limit: String(PAGE_SIZE),
    })}`,
  );
}

export function usePayments(
  params: PaymentParams = {},
  opts: { enabled?: boolean } = {},
) {
  return useInfiniteQuery({
    queryKey: paymentKeys.list(params),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => paymentsQueryFn(params, pageParam),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled: opts.enabled ?? true,
  });
}

export function flattenPayments(data?: { pages: PaymentListResponse[] }): PaymentRow[] {
  return data?.pages.flatMap((pg) => pg.items) ?? [];
}

export function onPaymentMutationSuccess(qc: QueryClient) {
  return qc.invalidateQueries({ queryKey: ["payments"] });
}

export function useCreatePayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: PaymentCreate) =>
      apiFetch<PaymentRow>("/payments", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => onPaymentMutationSuccess(qc),
  });
}

export function useUpdatePayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: PaymentUpdate }) =>
      apiFetch<PaymentRow>(`/payments/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
    onSuccess: () => onPaymentMutationSuccess(qc),
  });
}

/**
 * Bulk-import parsed rows through the one server endpoint. The server dedupes
 * against the whole table and commits in a single transaction, returning a
 * per-row report — this replaces the old per-row POST loop, which had no
 * transaction and deduped only against the loaded page. Invalidates the list so
 * every open filter refetches the newly imported invoices.
 */
export function useImportPayments() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: PaymentImport) =>
      apiFetch<PaymentImportResult>("/payments/import", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => onPaymentMutationSuccess(qc),
  });
}

export function useDeletePayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/payments/${id}`, { method: "DELETE" }),
    onSuccess: () => onPaymentMutationSuccess(qc),
  });
}
