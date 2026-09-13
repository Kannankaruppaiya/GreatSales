/**
 * react-query hooks for the projections worksheet. Read is cached by (period +
 * filters); the cell-edit mutation invalidates the list so the footer totals and
 * achievement % recompute from the server.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch, buildQuery } from "@/lib/api";
import type {
  ProjectionLine,
  ProjectionListResponse,
  ProjStatusValue,
} from "@/features/projections/types";
import { invalidateAfter } from "@/lib/invalidate";

export interface ProjectionParams {
  period: string;
  principalId?: string;
  ownerId?: string;
  search?: string;
  lineFilter?: "all" | "projected" | "blank" | "due";
}

export interface ProjectionPatch {
  price?: number | null;
  committedQty?: number;
  achievedQty?: number;
  status?: ProjStatusValue;
  probability?: number | null;
  nextFollowUp?: string | null;
  targetDate?: string | null;
}

export interface RollForwardResult {
  from: string;
  to: string;
  created: number;
  skipped: number;
}

/**
 * Open a month by carrying the previous month's commitments into it.
 *
 * Invalidates the whole `projections` family rather than one key: the month
 * just filled is usually the one on screen, and the footer totals are the
 * server's, so re-reading is the only way they can be right.
 */
/**
 * Drop a line from a month — the counterpart to rolling one in.
 *
 * A roll carries every commitment the previous month held, and some are for
 * customers who have since stopped buying; without this the only way to take
 * one out of the total is to commit zero and pretend.
 */
export function useDeleteProjection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<void>(`/projections/${id}`, { method: "DELETE" }),
    onSuccess: () => invalidateAfter(qc, "projections"),
  });
}

export function useRollForward() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { to: string; from?: string; ownerId?: string }) =>
      apiFetch<RollForwardResult>("/projections/roll-forward", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => invalidateAfter(qc, "projections"),
  });
}

export function useProjections(params: ProjectionParams, enabled: boolean) {
  return useQuery({
    queryKey: ["projections", params],
    enabled,
    queryFn: () =>
      apiFetch<ProjectionListResponse>(
        `/projections${buildQuery({
          period: params.period,
          principalId: params.principalId,
          ownerId: params.ownerId,
          search: params.search,
          lineFilter: params.lineFilter,
        })}`,
      ),
  });
}

export function useUpdateProjection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: ProjectionPatch }) =>
      apiFetch<ProjectionLine>(`/projections/${id}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      }),
    onSuccess: () => invalidateAfter(qc, "projections"),
  });
}
