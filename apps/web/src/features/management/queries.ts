/**
 * Data layer for the platform (owner) management surface — Home grid, switcher,
 * create wizard. All requests go through {@link platformFetch} (the platform
 * token), never the tenant `apiFetch`.
 */
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { platformFetch } from "@/lib/platformApi";
import { useAuth } from "@/store/auth";
import { useUi } from "@/store/ui";
import { useIsPlatformAuthed } from "@/store/platformAuth";
import type { LoginResponse } from "@/features/projections/types";

/** Mirrors the `@greatsales/shared` ManagementSummary contract (local copy). */
export interface ManagementSummary {
  id: string;
  name: string;
  status: string;
  region: string | null;
  industry: string | null;
  currency: string | null;
  userCount: number;
  salesThisMonth: number;
  createdAt: string;
}

export interface CreateManagementInput {
  name: string;
  industry?: string | null;
  region?: string | null;
  currency?: string | null;
  timezone?: string | null;
  adminName: string;
  adminEmail: string;
}

export interface CreateManagementResponse {
  management: ManagementSummary;
  adminEmail: string;
  tempPassword: string;
}

export const managementKeys = {
  list: ["managements"] as const,
};

/** The owner's managements. Only fires while a platform session exists. */
export function useManagements() {
  const enabled = useIsPlatformAuthed();
  return useQuery({
    queryKey: managementKeys.list,
    queryFn: () => platformFetch<ManagementSummary[]>("/platform/managements"),
    enabled,
  });
}

export function useCreateManagement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateManagementInput) =>
      platformFetch<CreateManagementResponse>("/platform/managements", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: managementKeys.list }),
  });
}

/**
 * Open (or switch into) a management — the token-exchange. Calls the audited
 * assume endpoint, then installs the returned tenant session into `useAuth`
 * exactly as a tenant login would, so every existing tenant page and its
 * refresh-cookie flow work unchanged. Navigation is the caller's job, after
 * this resolves, so the workspace route always sees a matching session.
 */
export async function openManagement(managementId: string): Promise<void> {
  const res = await platformFetch<LoginResponse>(
    `/platform/managements/${managementId}/assume`,
    { method: "POST" },
  );
  useAuth.setState({
    accessToken: res.accessToken,
    user: res.user,
    lastTenantId: res.user.tenantId,
    status: "ready",
  });
  useUi.getState().setActiveManagement(managementId);
}
