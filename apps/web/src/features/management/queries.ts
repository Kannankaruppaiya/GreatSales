/**
 * react-query hooks for managements (workspaces).
 *
 * Read only, and that mirrors the API: the runtime database role has no write
 * grant on `Tenant`, because a tenant-scoped connection able to edit the
 * tenancy registry is a cross-tenant escalation path. Creating a workspace is
 * an operator action on the platform layer, not something the console does.
 */
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

/**
 * Mirrors the `@greatsales/shared` ManagementRow contract; kept local so the
 * Vite build does not consume the CJS `shared` dist, same as every other
 * feature's types. Source of truth: packages/shared/src/management.ts.
 */
export interface ManagementRow {
  id: string;
  name: string;
  plan: string;
  status: string;
  industry: string | null;
  region: string | null;
  createdAt: string;
  userCount: number;
  customerCount: number;
  productCount: number;
}

/**
 * Every workspace the signed-in user can reach.
 *
 * That is exactly one today — a `User` row carries one `tenantId` — so callers
 * should treat "the list" as "the current workspace, in a shape that will not
 * change when platform auth lands".
 */
export function useManagements() {
  return useQuery({
    queryKey: ["managements"],
    staleTime: 5 * 60 * 1000,
    queryFn: () => apiFetch<ManagementRow[]>("/managements"),
  });
}
