import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider, createBrowserRouter } from "react-router-dom";

import { AppShell } from "@/components/app-shell";
import { AuthProvider } from "@/lib/auth/auth-context";
import { AccountPage } from "@/pages/account";
import { CustomerDetailPage } from "@/pages/customers/customer-detail";
import { CustomersListPage } from "@/pages/customers/customers-list";
import { DashboardPage } from "@/pages/dashboard";
import { LoginPage } from "@/pages/login";
import { NotFoundPage } from "@/pages/not-found";
import { ThemeProvider } from "@/theme/theme-provider";

import "./index.css";

const router = createBrowserRouter([
  { path: "/login", element: <LoginPage /> },
  {
    path: "/",
    element: <AppShell />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: "customers", element: <CustomersListPage /> },
      { path: "customers/:id", element: <CustomerDetailPage /> },
      { path: "account", element: <AccountPage /> },
    ],
  },
  { path: "*", element: <NotFoundPage /> },
]);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </ThemeProvider>
  </StrictMode>,
);
