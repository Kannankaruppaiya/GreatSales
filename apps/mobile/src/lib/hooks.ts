import type { CursorPage } from '@greatsales/shared';
import { useCallback, useEffect, useRef, useState } from 'react';

interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

/** Run an async fetch on mount (and when `key` changes); expose reload. */
export function useAsync<T>(fn: () => Promise<T>, key = ''): AsyncState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    fnRef
      .current()
      .then((d) => {
        if (active) setData(d);
      })
      .catch((e: unknown) => {
        if (active) setError(e instanceof Error ? e.message : 'Request failed');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  return { data, loading, error, reload };
}

interface PaginatedState<T> {
  items: T[];
  loading: boolean;
  refreshing: boolean;
  loadingMore: boolean;
  error: string | null;
  hasMore: boolean;
  refresh: () => void;
  loadMore: () => void;
}

/**
 * Cursor-paginated list loader. Handles first load, pull-to-refresh, and
 * append-on-scroll, coalescing overlapping requests.
 */
export function usePaginated<T>(
  fetchPage: (cursor?: string) => Promise<CursorPage<T>>,
  key = '',
): PaginatedState<T> {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cursorRef = useRef<string | null>(null);
  const busyRef = useRef(false);
  const fetchRef = useRef(fetchPage);
  fetchRef.current = fetchPage;

  const load = useCallback(async (mode: 'initial' | 'refresh' | 'more') => {
    if (busyRef.current) return;
    if (mode === 'more' && cursorRef.current == null) return;
    busyRef.current = true;
    if (mode === 'initial') setLoading(true);
    if (mode === 'refresh') setRefreshing(true);
    if (mode === 'more') setLoadingMore(true);
    setError(null);
    try {
      const cursor = mode === 'more' ? cursorRef.current ?? undefined : undefined;
      const page = await fetchRef.current(cursor);
      cursorRef.current = page.nextCursor;
      setItems((prev) => (mode === 'more' ? [...prev, ...page.items] : page.items));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Request failed');
    } finally {
      busyRef.current = false;
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    cursorRef.current = null;
    load('initial');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const refresh = useCallback(() => {
    cursorRef.current = null;
    load('refresh');
  }, [load]);

  const loadMore = useCallback(() => load('more'), [load]);

  return {
    items,
    loading,
    refreshing,
    loadingMore,
    error,
    hasMore: cursorRef.current != null,
    refresh,
    loadMore,
  };
}
