import { useEffect } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import type { CursorPage } from '@greatsales/shared';
import { apiFetch, buildQuery } from '../api';

/** Rows per request. The API caps `limit` at 100. */
export const PAGE_SIZE = 50;

/**
 * A cursor-paginated list, flattened for a screen to render.
 *
 * Every mobile list used to be `useQuery` with a hardcoded `limit: 100` that
 * threw `nextCursor` away — the string "cursor" did not appear anywhere in this
 * app. With 417 customers the app showed 100 and stopped, silently, with no
 * "load more" and nothing to say the rest existed. Search made it worse: no
 * screen sent `search` to the API either, so the box filtered those 100 rows in
 * JS and a customer on page 3 could not be found at all.
 *
 * So: params go to the SERVER, and pages are followed. `items` is every page
 * fetched so far and `total` is what the server says exists, which is what lets
 * a footer say "50 of 417" instead of implying 50 is all there is.
 */
export function useCursorList<TRow>(
  resource: string,
  key: readonly unknown[],
  params: Record<string, string | number | boolean | undefined>,
  opts: { enabled?: boolean; autoFetchAll?: boolean } = {},
) {
  const q = useInfiniteQuery({
    queryKey: key,
    enabled: opts.enabled ?? true,
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      apiFetch<CursorPage<TRow>>(
        `${resource}${buildQuery({ ...params, cursor: pageParam, limit: PAGE_SIZE })}`,
      ),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });

  /**
   * Some screens cannot render a partial answer: a kanban board with three of
   * five columns filled, or a receivables total that is only the first page,
   * is worse than a slow one. Those pass `autoFetchAll` and get every page —
   * the same trade-off the web console makes on its kanban and report tabs.
   *
   * The server-side filters above are what keep this bounded: it walks the
   * FILTERED set, not the whole table.
   */
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = q;
  useEffect(() => {
    if (opts.autoFetchAll && hasNextPage && !isFetchingNextPage) {
      void fetchNextPage();
    }
  }, [opts.autoFetchAll, hasNextPage, isFetchingNextPage, fetchNextPage]);

  return {
    ...q,
    /** Every row fetched so far, in page order. */
    items: q.data?.pages.flatMap((p) => p.items) ?? [],
    /** What the server says matches the filter, not what is on screen. */
    total: q.data?.pages[0]?.total ?? 0,
    /** True until every page of an `autoFetchAll` list has arrived. */
    isLoadingAll: q.isLoading || (!!opts.autoFetchAll && q.hasNextPage === true),
  };
}

/**
 * Drop `undefined` and the "ALL" sentinel the filter chips use, so neither
 * reaches the query string as a literal.
 */
export function listParams(
  raw: Record<string, string | number | boolean | undefined>,
): Record<string, string | number | boolean | undefined> {
  const out: Record<string, string | number | boolean | undefined> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (v === undefined || v === '' || v === 'ALL') continue;
    out[k] = v;
  }
  return out;
}
