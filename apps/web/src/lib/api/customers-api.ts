/** Customer + industries endpoints (authenticated). */
import { apiFetch } from "./client";
import type {
  CustomerCategory,
  CustomerDetail,
  CustomerFormValues,
  CustomerListItem,
  IndustryDto,
  PayZone,
} from "./customer-types";

export interface CursorPage<T> {
  items: T[];
  nextCursor: string | null;
}

export interface CustomerListParams {
  search?: string;
  category?: CustomerCategory;
  payZone?: PayZone;
  cursor?: string;
  limit?: number;
}

export function listCustomers(params: CustomerListParams): Promise<CursorPage<CustomerListItem>> {
  const q = new URLSearchParams();
  if (params.search) q.set("search", params.search);
  if (params.category) q.set("category", params.category);
  if (params.payZone) q.set("payZone", params.payZone);
  if (params.cursor) q.set("cursor", params.cursor);
  if (params.limit) q.set("limit", String(params.limit));
  const qs = q.toString();
  return apiFetch<CursorPage<CustomerListItem>>(`/customers${qs ? `?${qs}` : ""}`, { auth: true });
}

export function getCustomer(id: string): Promise<CustomerDetail> {
  return apiFetch<CustomerDetail>(`/customers/${id}`, { auth: true });
}

export function createCustomer(input: CustomerFormValues): Promise<CustomerDetail> {
  return apiFetch<CustomerDetail>("/customers", { method: "POST", auth: true, body: input });
}

export function updateCustomer(id: string, input: CustomerFormValues): Promise<CustomerDetail> {
  return apiFetch<CustomerDetail>(`/customers/${id}`, { method: "PATCH", auth: true, body: input });
}

export function deleteCustomer(id: string): Promise<{ id: string }> {
  return apiFetch<{ id: string }>(`/customers/${id}`, { method: "DELETE", auth: true });
}

export function listIndustries(): Promise<IndustryDto[]> {
  return apiFetch<IndustryDto[]>("/industries", { auth: true });
}
