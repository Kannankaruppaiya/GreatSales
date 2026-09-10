import { useQuery } from "@tanstack/react-query";
import { apiFetch, buildQuery } from "@/lib/api";
import type { DashboardResponse } from "./types";

export const dashboardKeys = {
  overview: (from: string, to: string, ownerId?: string) =>
    ["dashboard", from, to, ownerId ?? "ALL"] as const,
};

/**
 * One request for the whole page.
 *
 * This replaces a projections query PLUS a loop that paged every lead in the
 * tenant before the KPIs could render. The window is part of the key, so
 * changing it refetches rather than recomputing stale rows.
 *
 * A resolved `from`/`to` rather than the granularity: the server does not need
 * to know which button was pressed, only which days it is summarising, and
 * sending the pair keeps one date arithmetic — `resolveRange` — instead of two
 * that could disagree about where a week starts.
 */
export function useDashboard(
  range: { from: string; to: string },
  opts: { ownerId?: string; enabled?: boolean } = {},
) {
  return useQuery({
    queryKey: dashboardKeys.overview(range.from, range.to, opts.ownerId),
    queryFn: () =>
      apiFetch<DashboardResponse>(
        `/dashboard${buildQuery({ from: range.from, to: range.to, ownerId: opts.ownerId })}`,
      ),
    enabled: opts.enabled ?? true,
  });
}
