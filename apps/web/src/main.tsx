import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import {
  MutationCache,
  QueryCache,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import App from "@/App";
import { ApiError } from "@/lib/api";
import { useAuth } from "@/store/auth";
import "./index.css";

// An expired/invalid access token surfaces as ApiError(401). Phase 0 has no silent
// refresh: clear the session so ProtectedRoute bounces the user to /login.
function onApiError(err: unknown) {
  if (err instanceof ApiError && err.status === 401) {
    useAuth.getState().logout();
  }
}

const queryClient = new QueryClient({
  queryCache: new QueryCache({ onError: onApiError }),
  mutationCache: new MutationCache({ onError: onApiError }),
  defaultOptions: { queries: { staleTime: 30_000, refetchOnWindowFocus: false } },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
