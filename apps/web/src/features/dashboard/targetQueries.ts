import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { SalesTargetRow, TargetUpsert } from "@/features/dashboard/types";
import { apiFetch, buildQuery } from "@/lib/api";
import { invalidateAfter } from "@/lib/invalidate";

/**
 * Monthly sales targets.
 *
 * These invalidate the dashboard as well as themselves: the dashboard's
 * `kpis.target` and every `bySalesperson[].target` are computed from these
 * rows, so setting a target and leaving the summary showing the old figure
 * would be the page disagreeing with the dialog that just changed it.
 */
export const targetKeys = {
  all: ["targets"] as const,
  list: (period: string) => ["targets", period] as const,
};

export function useTargets(period: string, enabled = true) {
  return useQuery({
    queryKey: targetKeys.list(period),
    enabled,
    queryFn: () =>
      apiFetch<SalesTargetRow[]>(`/targets${buildQuery({ period })}`),
  });
}

function useInvalidateTargets() {
  const qc = useQueryClient();
  return () => invalidateAfter(qc, "targets");
}

export function useSetTarget() {
  const invalidate = useInvalidateTargets();
  return useMutation({
    mutationFn: (body: TargetUpsert) =>
      apiFetch<SalesTargetRow>("/targets", {
        method: "PUT",
        body: JSON.stringify(body),
      }),
    onSuccess: invalidate,
  });
}

export function useClearTarget() {
  const invalidate = useInvalidateTargets();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<void>(`/targets/${id}`, { method: "DELETE" }),
    onSuccess: invalidate,
  });
}
