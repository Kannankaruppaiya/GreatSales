/**
 * react-query hooks for the projections worksheet. Read is cached by (period +
 * filters); the cell-edit mutation invalidates the list so the footer totals and
 * achievement % recompute from the server.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch, buildQuery } from "../../lib/api";
import type {
  ProjectionLine,
  ProjectionListResponse,
  ProjStatusValue,
} from "./types";

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
    onSuccess: () => qc.invalidateQueries({ queryKey: ["projections"] }),
  });
}
