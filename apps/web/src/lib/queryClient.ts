/**
 * The app's single QueryClient, in its own module so non-component code — the
 * auth store's logout, the management switcher — can reach it to clear the
 * cache. Every tenant query key is tenant-free (e.g. ["customers", params]), so
 * a session swap that left the cache intact could render the PREVIOUS tenant's
 * rows within the 30s stale window before any refetch. Clearing the cache on
 * every session boundary (logout, management switch) is what closes that
 * cross-tenant leak — see apps/web/AGENTS.md ("Logout must clear the whole
 * query cache").
 */
import {
  MutationCache,
  QueryCache,
  QueryClient,
} from "@tanstack/react-query";
import { ApiError } from "@/lib/api";
import { useAuth } from "@/store/auth";

// A 401 that surfaces here means refresh already failed (api.ts self-heals
// otherwise). Clear any residual session so ProtectedRoute bounces to /login.
// `useAuth` is dereferenced only inside this handler (never at module load), so
// the auth ⇄ queryClient import cycle resolves cleanly.
function onApiError(err: unknown) {
  if (err instanceof ApiError && err.status === 401) {
    void useAuth.getState().logout();
  }
}

export const queryClient = new QueryClient({
  queryCache: new QueryCache({ onError: onApiError }),
  mutationCache: new MutationCache({ onError: onApiError }),
  defaultOptions: { queries: { staleTime: 30_000, refetchOnWindowFocus: false } },
});
