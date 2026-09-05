/**
 * Shared QueryClient for the mobile app.
 *
 * Mobile-specific additions over web's defaults:
 * - AppState listener: pauses queries when app goes to background, refetches
 *   on foreground so data is never stale when the user returns.
 * - Conservative retry: 1 retry for network errors (mobile connectivity is
 *   less reliable; more retries would drain battery unnecessarily).
 * - staleTime: 30 s — short enough that pull-to-refresh always feels fresh,
 *   long enough to avoid redundant fetches during navigation.
 */
import { QueryClient, focusManager } from '@tanstack/react-query';
import { AppState, type AppStateStatus } from 'react-native';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,       // 30 s
      gcTime: 5 * 60_000,      // 5 min garbage-collect
      retry: 1,
      refetchOnWindowFocus: false, // handled by AppState below
    },
    mutations: {
      retry: 0,
    },
  },
});

// ---------------------------------------------------------------------------
// Refetch when app comes back to foreground (React Native equivalent of
// the browser's window focus event that web React Query uses by default).
// ---------------------------------------------------------------------------
function onAppStateChange(status: AppStateStatus) {
  if (status === 'active') {
    focusManager.setFocused(true);
  } else {
    focusManager.setFocused(false);
  }
}

AppState.addEventListener('change', onAppStateChange);
