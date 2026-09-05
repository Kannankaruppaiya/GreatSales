import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import App from "@/App";
import { queryClient } from "@/lib/queryClient";
import { useAuth } from "@/store/auth";
import { usePlatformAuth } from "@/store/platformAuth";
import "./index.css";

// Restore the session from the httpOnly refresh cookie before the first paint
// decision. Nothing secret survives a reload by design, so without this every
// refresh would look like a sign-out.
void useAuth.getState().bootstrap();

// Likewise restore an owner's platform session from its own refresh cookie, so
// a reload on the management Home / switcher doesn't drop them to sign-in.
void usePlatformAuth.getState().bootstrap();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
