/**
 * Minimal async-state hook.
 *
 * The screens need the same four things everywhere — data, loading, error,
 * reload — and nothing more yet. A query library would add caching the app has
 * no use for while it reads from an in-memory source; this can be swapped for
 * one when the app moves onto the API and starts wanting invalidation.
 */
import { useCallback, useEffect, useRef, useState } from "react";

export interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  reload: () => void;
  /** True while a reload runs over data that is already on screen. */
  refreshing: boolean;
}

export function useAsync<T>(
  run: () => Promise<T>,
  deps: readonly unknown[] = [],
): AsyncState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Guards against a slow first request resolving after a fast second one and
  // overwriting the newer result.
  const generation = useRef(0);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const execute = useCallback(
    async (isRefresh: boolean) => {
      const ticket = ++generation.current;
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);

      try {
        const result = await run();
        if (!mounted.current || ticket !== generation.current) return;
        setData(result);
      } catch (caught) {
        if (!mounted.current || ticket !== generation.current) return;
        setError(caught instanceof Error ? caught : new Error(String(caught)));
      } finally {
        if (mounted.current && ticket === generation.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    // `run` is rebuilt on every render by design; the caller's deps decide when
    // to re-fetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    deps,
  );

  useEffect(() => {
    void execute(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  const reload = useCallback(() => {
    void execute(true);
  }, [execute]);

  return { data, loading, error, reload, refreshing };
}
