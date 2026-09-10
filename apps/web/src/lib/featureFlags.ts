import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

/**
 * Which features this workspace has.
 *
 * PRESENTATION ONLY, exactly like the permission helpers in `store/auth`. The
 * API enforces every one of these on the write itself — `CustomersService`
 * refuses a GPS pin from a workspace with `customer-location` off, whether or
 * not this hook ever ran. Hiding the field is so the user is not offered a
 * control that would 403; it is not the gate.
 *
 * Mirrors `FEATURE_KEYS` in packages/shared/src/feature-flag.ts.
 */
export type FeatureKey = "customer-location" | "bulk-import";
export type FeatureFlagMap = Record<FeatureKey, boolean>;

export const featureFlagKeys = {
  all: ["feature-flags"] as const,
};

export function useFeatureFlags() {
  return useQuery({
    queryKey: featureFlagKeys.all,
    queryFn: () => apiFetch<FeatureFlagMap>("/feature-flags"),
    // Flags change when an operator changes them, which is rare and never
    // because of anything this tab did. Five minutes keeps the request off
    // every navigation without the UI going stale for a working day.
    staleTime: 5 * 60_000,
  });
}

/**
 * True when the workspace has `key`.
 *
 * FALSE while the answer is still loading, on purpose. The alternative —
 * assuming a feature is on until told otherwise — flashes a control the user
 * may not have and then removes it, and for a gated write that flash is an
 * invitation to a 403.
 */
export function useFeature(key: FeatureKey): boolean {
  const { data } = useFeatureFlags();
  return data?.[key] ?? false;
}
