/**
 * Customers list — search + filters + cursor pagination, with real loading /
 * empty / error states, and create-via-modal. What a user sees is scoped by the
 * API (own vs. tenant-wide); this page just renders what it's allowed.
 */
import { Plus, Search, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { Text } from "@/components/ui/text";
import { ApiError } from "@/lib/api/errors";
import {
  createCustomer,
  listCustomers,
  listIndustries,
  type CursorPage,
} from "@/lib/api/customers-api";
import {
  CUSTOMER_CATEGORIES,
  PAY_ZONES,
  PAY_ZONE_LABEL,
  PAY_ZONE_TONE,
  type CustomerCategory,
  type CustomerFormValues,
  type CustomerListItem,
  type IndustryDto,
  type PayZone,
} from "@/lib/api/customer-types";
import { CUSTOMER_FORM_ID, CustomerForm } from "@/pages/customers/customer-form";

const PAGE_SIZE = 20;

type ListState = {
  status: "loading" | "ready" | "error";
  items: CustomerListItem[];
  nextCursor: string | null;
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function CustomerRow({ c, onOpen }: { c: CustomerListItem; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-surface-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-inset"
    >
      <div className="min-w-0 flex-1">
        <Text variant="bodyLg" className="block truncate font-semibold">
          {c.name}
        </Text>
        <Text variant="bodySm" color="secondary" className="block truncate">
          {c.salespersonName ?? "Unassigned"}
          {c.area ? ` · ${c.area}` : ""}
        </Text>
      </div>
      <div className="hidden shrink-0 items-center gap-2 sm:flex">
        {c.category ? <Badge label={c.category} tone="neutral" /> : null}
        {c.payZone ? <Badge label={PAY_ZONE_LABEL[c.payZone]} tone={PAY_ZONE_TONE[c.payZone]} /> : null}
      </div>
      <Text variant="bodySm" color="muted" className="hidden w-24 shrink-0 text-right md:block">
        {formatDate(c.createdAt)}
      </Text>
    </button>
  );
}

export function CustomersListPage() {
  const navigate = useNavigate();

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<"" | CustomerCategory>("");
  const [payZone, setPayZone] = useState<"" | PayZone>("");

  const [state, setState] = useState<ListState>({ status: "loading", items: [], nextCursor: null });
  const [loadingMore, setLoadingMore] = useState(false);

  const [industries, setIndustries] = useState<IndustryDto[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const filtersActive = Boolean(search || category || payZone);
  // Guards against out-of-order responses when filters change quickly.
  const reqId = useRef(0);

  const load = useCallback(async () => {
    const id = ++reqId.current;
    setState((s) => ({ ...s, status: "loading" }));
    try {
      const page = await listCustomers({
        search: search || undefined,
        category: category || undefined,
        payZone: payZone || undefined,
        limit: PAGE_SIZE,
      });
      if (id !== reqId.current) return;
      setState({ status: "ready", items: page.items, nextCursor: page.nextCursor });
    } catch {
      if (id !== reqId.current) return;
      setState({ status: "error", items: [], nextCursor: null });
    }
  }, [search, category, payZone]);

  // Debounce the search box.
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    void load();
  }, [load]);

  // Industries for the create form (best-effort; form still works without).
  useEffect(() => {
    listIndustries()
      .then(setIndustries)
      .catch(() => setIndustries([]));
  }, []);

  async function loadMore() {
    if (!state.nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const page: CursorPage<CustomerListItem> = await listCustomers({
        search: search || undefined,
        category: category || undefined,
        payZone: payZone || undefined,
        cursor: state.nextCursor,
        limit: PAGE_SIZE,
      });
      setState((s) => ({ status: "ready", items: [...s.items, ...page.items], nextCursor: page.nextCursor }));
    } catch {
      /* keep what we have; the load-more button stays available to retry */
    } finally {
      setLoadingMore(false);
    }
  }

  function clearFilters() {
    setSearchInput("");
    setSearch("");
    setCategory("");
    setPayZone("");
  }

  async function onCreate(values: CustomerFormValues) {
    setCreating(true);
    setCreateError(null);
    try {
      const created = await createCustomer(values);
      setCreateOpen(false);
      navigate(`/customers/${created.id}`);
    } catch (err) {
      setCreateError(err instanceof ApiError ? err.userMessage : "Couldn’t create the customer.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Text as="h1" variant="h1">
          Customers
        </Text>
        <Button leadingIcon={Plus} onClick={() => { setCreateError(null); setCreateOpen(true); }}>
          New customer
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-fg-muted" aria-hidden />
          <input
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search customers"
            aria-label="Search customers"
            className="h-11 w-full rounded-field border border-border bg-input-bg pl-9 pr-3 text-[15px] text-fg outline-none placeholder:text-fg-muted focus-visible:border-focus focus-visible:ring-2 focus-visible:ring-focus"
          />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:w-auto sm:grid-cols-none sm:grid-flow-col">
          <Select
            label="Category"
            placeholder="All categories"
            options={CUSTOMER_CATEGORIES.map((v) => ({ value: v, label: v }))}
            value={category}
            onChange={(e) => setCategory(e.target.value as CustomerCategory | "")}
          />
          <Select
            label="Pay zone"
            placeholder="All zones"
            options={PAY_ZONES.map((v) => ({ value: v, label: PAY_ZONE_LABEL[v] }))}
            value={payZone}
            onChange={(e) => setPayZone(e.target.value as PayZone | "")}
          />
        </div>
      </div>
      {filtersActive ? (
        <button
          type="button"
          onClick={clearFilters}
          className="inline-flex items-center gap-1 self-start text-[13px] font-semibold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus rounded"
        >
          <X className="size-3.5" aria-hidden />
          Clear filters
        </button>
      ) : null}

      {/* Results */}
      <Card padded={false} className="overflow-hidden">
        {state.status === "loading" ? (
          <div className="divide-y divide-divider">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-4">
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-3 w-32" />
                </div>
                <Skeleton className="h-5 w-16" />
              </div>
            ))}
          </div>
        ) : state.status === "error" ? (
          <ErrorState
            title="Couldn’t load customers"
            description="Check your connection and try again."
            onRetry={() => void load()}
          />
        ) : state.items.length === 0 ? (
          filtersActive ? (
            <EmptyState
              icon={Search}
              title="No matches"
              description="No customers match your search and filters."
              actionLabel="Clear filters"
              onAction={clearFilters}
            />
          ) : (
            <EmptyState
              icon={Plus}
              title="No customers yet"
              description="Add your first customer to get started."
              actionLabel="New customer"
              onAction={() => setCreateOpen(true)}
            />
          )
        ) : (
          <div className="divide-y divide-divider">
            {state.items.map((c) => (
              <CustomerRow key={c.id} c={c} onOpen={() => navigate(`/customers/${c.id}`)} />
            ))}
          </div>
        )}
      </Card>

      {state.status === "ready" && state.nextCursor ? (
        <div className="flex justify-center">
          <Button variant="secondary" onClick={loadMore} loading={loadingMore}>
            Load more
          </Button>
        </div>
      ) : null}

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="New customer"
        description="Create a customer record."
        busy={creating}
        footer={
          <>
            <Button variant="secondary" onClick={() => setCreateOpen(false)} disabled={creating}>
              Cancel
            </Button>
            <Button type="submit" form={CUSTOMER_FORM_ID} loading={creating}>
              Create customer
            </Button>
          </>
        }
      >
        <CustomerForm industries={industries} submitting={creating} formError={createError} onSubmit={onCreate} />
      </Modal>
    </div>
  );
}
