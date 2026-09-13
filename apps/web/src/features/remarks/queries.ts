/**
 * react-query hooks for entity remarks (the activity-note timeline).
 *
 * Keyed by (entityType, entityId) so two open drawers do not share a cache
 * entry. A post goes through `invalidateAfter` rather than invalidating just
 * that timeline: the projections worksheet prints the remark count on every
 * line, so a note is stale data on a page the note was not posted from.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch, buildQuery } from "@/lib/api";
import { invalidateAfter } from "@/lib/invalidate";
import type {
  RemarkCreate,
  RemarkEntityType,
  RemarkListResponse,
  RemarkRow,
} from "@/features/remarks/types";

export type RemarkTarget = {
  entityType: RemarkEntityType;
  entityId: string;
};

const remarkKey = (t: RemarkTarget) =>
  ["remarks", t.entityType, t.entityId] as const;

/**
 * One entity's notes, newest first.
 *
 * `enabled` is driven by the caller because every consumer is a modal or a
 * drawer: fetching a timeline for a record nobody has opened would be one
 * request per row of the list behind it.
 */
export function useRemarks(
  target: RemarkTarget | null,
  opts: { enabled?: boolean } = {},
) {
  return useQuery({
    queryKey: target ? remarkKey(target) : (["remarks", "none"] as const),
    enabled: (opts.enabled ?? true) && !!target,
    queryFn: () =>
      apiFetch<RemarkListResponse>(
        `/remarks${buildQuery({
          entityType: target!.entityType,
          entityId: target!.entityId,
          limit: "50",
        })}`,
      ),
  });
}

export function useCreateRemark() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: RemarkCreate) =>
      apiFetch<RemarkRow>("/remarks", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    // Through the graph, not a hand-rolled call: the remark count is printed
    // on the projections worksheet, so a note makes more than its own thread
    // stale. See STALE_AFTER.remarks.
    onSuccess: () => invalidateAfter(qc, "remarks"),
  });
}
