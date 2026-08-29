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
  CustomerContactRow,
  CustomerContactListResponse,
  CustomerContactCreate,
  CustomerContactUpdate,
} from "./types";

const PAGE_SIZE = 50;

export interface CustomerParams {
  search?: string;
  category?: string;
  ownerId?: string;
}

export const customerKeys = {
  list: (p: CustomerParams) => ["customers", p] as const,
};

export function customersQueryFn(p: CustomerParams, cursor: string | undefined) {
  return apiFetch<CustomerListResponse>(
    `/customers${buildQuery({
      search: p.search,
      category: p.category,
      ownerId: p.ownerId,
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

// --- Contacts sub-resource ------------------------------------------------

export const contactKeys = {
  list: (customerId: string) => ["customers", customerId, "contacts"] as const,
};

/** Fetch a customer's contacts. Disabled (no request) until a customer is set. */
export function useCustomerContacts(customerId: string | null) {
  return useQuery({
    queryKey: customerId
      ? contactKeys.list(customerId)
      : (["customers", "__none__", "contacts"] as const),
    queryFn: () =>
      apiFetch<CustomerContactListResponse>(`/customers/${customerId}/contacts`),
    enabled: !!customerId,
  });
}

/**
 * A contact change can move the customer's primary, which the customer list row
 * displays — so invalidate both the contacts list and the whole `customers`
 * family.
 */
function onContactMutationSuccess(qc: QueryClient, customerId: string) {
  qc.invalidateQueries({ queryKey: contactKeys.list(customerId) });
  qc.invalidateQueries({ queryKey: ["customers"] });
}

export function useCreateContact(customerId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CustomerContactCreate) =>
      apiFetch<CustomerContactRow>(`/customers/${customerId}/contacts`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => onContactMutationSuccess(qc, customerId),
  });
}

export function useUpdateContact(customerId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: CustomerContactUpdate }) =>
      apiFetch<CustomerContactRow>(`/customers/${customerId}/contacts/${id}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      }),
    onSuccess: () => onContactMutationSuccess(qc, customerId),
  });
}

export function useDeleteContact(customerId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<void>(`/customers/${customerId}/contacts/${id}`, { method: "DELETE" }),
    onSuccess: () => onContactMutationSuccess(qc, customerId),
  });
}
