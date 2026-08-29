/**
 * react-query hook for the global industry catalogue (GET /industries).
 *
 * Industry is shared reference data, not a tenant-owned entity — one small,
 * rarely-changing list every industry picker reads. Before this endpoint the
 * pickers scraped their options out of already-loaded customer/lead rows, which
 * is why the dashboard quick-add-lead modal came up empty once that page stopped
 * loading leads (checklists/03-API.md C.3.12). Callers pass `enabled` so the
 * fetch only fires when a picker is actually on screen.
 */
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

/** Mirrors the `@greatsales/shared` IndustryOption contract (local copy). */
export interface IndustryOption {
  id: string;
  name: string;
  subIndustries: string[];
}

export const industryKeys = {
  all: ["industries"] as const,
};

export function useIndustries(opts: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: industryKeys.all,
    queryFn: () => apiFetch<IndustryOption[]>("/industries"),
    // Global reference data: safe to cache hard across a session so reopening a
    // modal is instant and does not re-hit the endpoint.
    staleTime: 5 * 60_000,
    enabled: opts.enabled ?? true,
  });
}
