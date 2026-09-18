/**
 * Minimal async-state hook.
 *
 * The screens need the same four things everywhere — data, loading, error,
 * reload — and nothing more yet. A query library would add caching the app has
 * no use for while it reads from an in-memory source; this can be swapped for
 * one when the app moves onto the API and starts wanting invalidation.
 *
 * It also re-fetches whenever the screen comes back into focus. Without that, a
 * screen the user navigated away from keeps whatever it loaded when it mounted:
 * schedule a follow-up from the + launcher and Home still shows yesterday's
 * count, because Home never unmounted. Re-fetching on focus is what a query
 * library would do here, and it is the one piece of that behaviour the app
 * actually needs.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";

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
  const firstFocus = useRef(true);

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

  // Held in a ref so the focus callback below can stay identity-stable: if it
  // changed with `deps`, changing a filter would fire a second fetch on top of
  // the one the deps effect already starts.
  const latest = useRef(execute);
  useEffect(() => {
    latest.current = execute;
  }, [execute]);

  useFocusEffect(
    useCallback(() => {
      // The mount effect above already fetched, so the first focus is skipped —
      // otherwise every screen would load twice on open.
      if (firstFocus.current) {
        firstFocus.current = false;
        return;
      }
      // A refresh, not a load: the screen keeps showing what it has instead of
      // flashing skeletons over data that is probably still correct.
      void latest.current(true);
    }, []),
  );

  const reload = useCallback(() => {
    void execute(true);
  }, [execute]);

  return { data, loading, error, reload, refreshing };
}
