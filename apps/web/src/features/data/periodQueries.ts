/**
 * react-query hooks for reporting-period locks.
 *
 * Locking invalidates the projections cache as well as the lock list, because
 * the worksheet renders its cells read-only from this answer — leaving it stale
 * would show editable inputs on a month the server has already frozen.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch, buildQuery } from "@/lib/api";
/**
 * Mirrors the `@greatsales/shared` period-lock contracts; kept local so the
 * Vite build does not consume the CJS `shared` dist, same as every other
 * feature's types.ts. Source of truth: packages/shared/src/period-lock.ts.
 */
export interface PeriodLockRow {
  period: string;
  reason: string | null;
  lockedById: string;
  lockedByName: string;
  lockedAt: string;
}

export interface PeriodLockCreate {
  period: string;
  reason?: string;
}

export function usePeriodLocks(opts: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: ["period-locks"],
    enabled: opts.enabled ?? true,
    queryFn: () => apiFetch<PeriodLockRow[]>(`/period-locks${buildQuery({})}`),
  });
}

/**
 * The lock covering `period`, or null. Undefined while the list is loading.
 *
 * Defensive about the response shape because the projections worksheet calls
 * this during its own render: a non-array here throws inside that render and
 * blanks the entire page, so a hiccup on a secondary query would take out the
 * worksheet it is only annotating. An unreadable answer means "not known to be
 * locked" — the server still refuses the write either way, so the worst case is
 * an editable-looking cell rather than a lost edit.
 */
export function usePeriodLock(
  period: string,
  opts: { enabled?: boolean } = {},
): PeriodLockRow | null | undefined {
  const q = usePeriodLocks(opts);
  if (!q.data) return undefined;
  if (!Array.isArray(q.data)) return null;
  return q.data.find((l) => l.period === period) ?? null;
}

function invalidate(qc: ReturnType<typeof useQueryClient>) {
  void qc.invalidateQueries({ queryKey: ["period-locks"] });
  void qc.invalidateQueries({ queryKey: ["projections"] });
}

export function useLockPeriod() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: PeriodLockCreate) =>
      apiFetch<PeriodLockRow>("/period-locks", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => invalidate(qc),
  });
}

export function useUnlockPeriod() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (period: string) =>
      apiFetch<void>(`/period-locks/${period}`, { method: "DELETE" }),
    onSuccess: () => invalidate(qc),
  });
}
