import { useQuery } from "@tanstack/react-query";
import { apiFetch, buildQuery } from "@/lib/api";
import type { DashboardResponse } from "./types";

export const dashboardKeys = {
  overview: (period: string, ownerId?: string) =>
    ["dashboard", period, ownerId ?? "ALL"] as const,
};

/**
 * One request for the whole page.
 *
 * This replaces a projections query PLUS a loop that paged every lead in the
 * tenant before the KPIs could render. The period is part of the key, so
 * switching month refetches rather than recomputing stale rows.
 */
export function useDashboard(
  period: string,
  opts: { ownerId?: string; enabled?: boolean } = {},
) {
  return useQuery({
    queryKey: dashboardKeys.overview(period, opts.ownerId),
    queryFn: () =>
      apiFetch<DashboardResponse>(
        `/dashboard${buildQuery({ period, ownerId: opts.ownerId })}`,
      ),
    enabled: opts.enabled ?? true,
  });
}
