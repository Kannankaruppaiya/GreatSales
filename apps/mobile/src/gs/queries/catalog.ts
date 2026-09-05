import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  IndustryRow,
  MappingCreate,
  MappingRow,
  PrincipalListResponse,
  PrincipalRow,
  ProductRow,
} from '@greatsales/shared';
import { apiFetch } from '../api';
import { listParams, useCursorList } from './cursorList';

export type { PrincipalRow, ProductRow, MappingRow, MappingCreate, IndustryRow };

export const catalogKeys = {
  principals: ['principals'] as const,
  products: (p: Record<string, unknown>) => ['products', 'list', p] as const,
  mappings: (p: Record<string, unknown>) => ['mappings', 'list', p] as const,
};

/**
 * The tenant's principal brands.
 *
 * This endpoint has been wired on web since the catalog shipped. Mobile
 * hardcoded five brand names in `gs/domain.ts` instead — so the projection
 * mapping form offered Shell/Castrol/Fuchs/Gulf/Valvoline to every tenant
 * regardless of who they actually sell for, and the value it collected was a
 * display string with no id behind it.
 *
 * Reference data, so cached for an hour rather than refetched per mount.
 */
export function usePrincipals() {
  return useQuery({
    queryKey: catalogKeys.principals,
    staleTime: 60 * 60 * 1000,
    queryFn: () =>
      apiFetch<PrincipalListResponse>('/principals').then((r) => r.items),
  });
}

/**
 * The global industry catalogue.
 *
 * Mobile carried its own `INDUSTRY_TAXONOMY` in `gs/domain.ts` — the same list
 * the web app hardcoded separately — so the same catalogue existed in three
 * places and was true in at most one. `GET /industries` is the one that has
 * ids, which is what a lead actually stores.
 */
export function useIndustries() {
  return useQuery({
    queryKey: ['industries'],
    staleTime: 60 * 60 * 1000,
    queryFn: () => apiFetch<IndustryRow[]>('/industries'),
  });
}

/** Catalog products, optionally narrowed to one principal. */
export function useProducts(
  params: { search?: string; principalId?: string } = {},
  opts: { enabled?: boolean; autoFetchAll?: boolean } = {},
) {
  return useCursorList<ProductRow>(
    '/products',
    catalogKeys.products(params),
    listParams({ ...params }),
    opts,
  );
}

/** Customer × product mappings — the rows the projection worksheet is built from. */
export function useMappings(
  params: { customerId?: string; search?: string } = {},
  opts: { enabled?: boolean; autoFetchAll?: boolean } = {},
) {
  return useCursorList<MappingRow>(
    '/mappings',
    catalogKeys.mappings(params),
    listParams({ ...params }),
    opts,
  );
}

/**
 * Map a product to a customer.
 *
 * The projections screen had a complete form for this — customer picker,
 * principal pills, SKU field, price field, validation — whose submit handler
 * was `onDone()` under a comment reading "Mapping product done". Nothing was
 * ever sent. The user filled it in, watched the sheet close, and lost the lot.
 *
 * Invalidates projections as well as mappings: a new mapping is what makes a
 * new worksheet row appear, so leaving that cached shows the save doing nothing.
 */
export function useCreateMapping() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: MappingCreate) =>
      apiFetch<MappingRow>('/mappings', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['mappings'] });
      void qc.invalidateQueries({ queryKey: ['projections'] });
    },
  });
}
