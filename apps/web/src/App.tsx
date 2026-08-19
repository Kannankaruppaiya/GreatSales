import { lazy, Suspense } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useUi } from "./store/ui";
import { Layout } from "./components/layout";
import { Skeleton } from "./components/ui";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { RoleGuard } from "./components/RoleGuard";
import { RequireOwner } from "./components/RequireOwner";
import { ManagementProvider } from "./components/ManagementProvider";

const LoginPage = lazy(() => import("./pages/LoginPage"));
const DashboardPage = lazy(() => import("./pages/DashboardPage"));
const ProjectionsPage = lazy(() => import("./pages/ProjectionsPage"));
const LeadsPage = lazy(() => import("./pages/LeadsPage"));
const OrdersPage = lazy(() => import("./pages/OrdersPage"));
const PaymentsPage = lazy(() => import("./pages/PaymentsPage"));
const FollowUpsPage = lazy(() => import("./pages/FollowUpsPage"));
const CustomersPage = lazy(() => import("./pages/CustomersPage"));
const ProductsPage = lazy(() => import("./pages/ProductsPage"));
const UsersPage = lazy(() => import("./pages/UsersPage"));
const DataPage = lazy(() => import("./pages/DataPage"));
const ManagementHomePage = lazy(() => import("./pages/ManagementHomePage"));
const NotFoundPage = lazy(() => import("./pages/NotFoundPage"));

function PageLoadingSkeleton() {
  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      <div className="flex items-center justify-between pb-2">
        <Skeleton className="h-8 w-48 rounded-lg" />
        <Skeleton className="h-8 w-32 rounded-lg" />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-24 rounded-xl" />
      </div>
      <Skeleton className="h-96 rounded-xl w-full" />
    </div>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const authed = useUi((s) => s.authed);
  const location = useLocation();

  if (!authed) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}

function PublicAuthRoute() {
  const authed = useUi((s) => s.authed);
  const location = useLocation();
  const from = (location.state as { from?: { pathname?: string } })?.from?.pathname || "/";

  if (authed) {
    return <Navigate to={from} replace />;
  }

  return (
    <Suspense fallback={<div className="min-h-screen grid place-items-center"><Skeleton className="h-96 w-80 rounded-2xl" /></div>}>
      <LoginPage />
    </Suspense>
  );
}

/** Sends the authenticated user to the right entry point:
 *  owner → the management home; a single-management admin → their dashboard. */
function RootRedirect() {
  const isOwner = useUi((s) => s.isOwner);
  const activeManagementId = useUi((s) => s.activeManagementId);
  if (isOwner) return <Navigate to="/managements" replace />;
  return <Navigate to={activeManagementId ? `/managements/${activeManagementId}/dashboard` : "/login"} replace />;
}

function AppLayout() {
  const location = useLocation();

  return (
    <Layout>
      <div key={location.pathname}>
        <Suspense fallback={<PageLoadingSkeleton />}>
          <Routes>
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="projections" element={<ProjectionsPage />} />
            <Route path="leads" element={<LeadsPage />} />
            <Route path="orders" element={<OrdersPage />} />
            <Route path="payments" element={<PaymentsPage />} />
            <Route path="followups" element={<FollowUpsPage />} />
            <Route path="customers" element={<CustomersPage />} />
            <Route path="products" element={<ProductsPage />} />
            <Route
              path="users"
              element={
                <RoleGuard allowedRoles={["admin"]}>
                  <UsersPage />
                </RoleGuard>
              }
            />
            <Route
              path="data"
              element={
                <RoleGuard allowedRoles={["admin"]}>
                  <DataPage />
                </RoleGuard>
              }
            />
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Suspense>
      </div>
    </Layout>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <Routes>
        <Route path="/login" element={<PublicAuthRoute />} />
        <Route
          path="/managements"
          element={
            <ProtectedRoute>
              <RequireOwner>
                <Suspense fallback={<PageLoadingSkeleton />}>
                  <ManagementHomePage />
                </Suspense>
              </RequireOwner>
            </ProtectedRoute>
          }
        />
        <Route
          path="/managements/:managementId/*"
          element={
            <ProtectedRoute>
              <ManagementProvider>
                <AppLayout />
              </ManagementProvider>
            </ProtectedRoute>
          }
        />
        <Route path="/" element={<ProtectedRoute><RootRedirect /></ProtectedRoute>} />
        <Route path="*" element={<ProtectedRoute><RootRedirect /></ProtectedRoute>} />
      </Routes>
    </ErrorBoundary>
  );
}
