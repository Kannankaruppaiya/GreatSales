import { lazy, Suspense } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useUi, DEFAULT_MANAGEMENT_ID } from "@/store/ui";
import { useIsAuthed, useAuthRole, useIsOwner } from "@/store/auth";
import { Layout } from "@/components/layout";
import { Skeleton } from "@/components/ui";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { RoleGuard } from "@/components/RoleGuard";
import { RequireOwner } from "@/components/RequireOwner";
import { ManagementProvider } from "@/components/ManagementProvider";
import type { LoginRole } from "@/pages/LoginPage";

const LoginPage = lazy(() => import("@/pages/LoginPage"));
const DashboardPage = lazy(() => import("@/pages/DashboardPage"));
const ProjectionsPage = lazy(() => import("@/pages/ProjectionsPage"));
const LeadsPage = lazy(() => import("@/pages/LeadsPage"));
const OrdersPage = lazy(() => import("@/pages/OrdersPage"));
const PaymentsPage = lazy(() => import("@/pages/PaymentsPage"));
const FollowUpsPage = lazy(() => import("@/pages/FollowUpsPage"));
const CustomersPage = lazy(() => import("@/pages/CustomersPage"));
const ProductsPage = lazy(() => import("@/pages/ProductsPage"));
const UsersPage = lazy(() => import("@/pages/UsersPage"));
const DataPage = lazy(() => import("@/pages/DataPage"));
const ManagementHomePage = lazy(() => import("@/pages/ManagementHomePage"));
const NotFoundPage = lazy(() => import("@/pages/NotFoundPage"));

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
  const authed = useIsAuthed();
  const location = useLocation();

  if (!authed) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}

function PublicAuthRoute({ initialRole }: { initialRole?: LoginRole }) {
  const authed = useIsAuthed();
  const isOwner = useIsOwner();
  const role = useAuthRole();
  const activeManagementId = useUi((s) => s.activeManagementId);
  const location = useLocation();
  const from = (location.state as { from?: { pathname?: string } })?.from?.pathname;

  if (authed) {
    if (from && from !== "/login") {
      return <Navigate to={from} replace />;
    }
    if (isOwner || role === "super_admin") {
      return <Navigate to="/managements" replace />;
    }
    return <Navigate to={`/managements/${activeManagementId || DEFAULT_MANAGEMENT_ID}/dashboard`} replace />;
  }

  return (
    <Suspense
      fallback={
        <div className="min-h-screen grid place-items-center">
          <Skeleton className="h-96 w-80 rounded-2xl" />
        </div>
      }
    >
      <LoginPage initialRole={initialRole} />
    </Suspense>
  );
}

/** Route handler for direct role paths (e.g. /super-admin, /admin, /management) */
function RoleDirectRoute({ role: targetRole }: { role: "super_admin" | "admin" | "mgmt" }) {
  const authed = useIsAuthed();
  const activeManagementId = useUi((s) => s.activeManagementId) || DEFAULT_MANAGEMENT_ID;

  if (!authed) {
    if (targetRole === "super_admin") return <Navigate to="/super-admin/login" replace />;
    if (targetRole === "mgmt") return <Navigate to="/management/login" replace />;
    return <Navigate to="/admin/login" replace />;
  }

  if (targetRole === "super_admin") {
    return <Navigate to="/managements" replace />;
  }

  return <Navigate to={`/managements/${activeManagementId}/dashboard`} replace />;
}

/** Sends the authenticated user to the right entry point based on role:
 *  super_admin → management list home
 *  admin / mgmt → their management dashboard */
function RootRedirect() {
  const role = useAuthRole();
  const isOwner = useIsOwner();
  const activeManagementId = useUi((s) => s.activeManagementId) || DEFAULT_MANAGEMENT_ID;
  if (isOwner || role === "super_admin") return <Navigate to="/managements" replace />;
  return <Navigate to={`/managements/${activeManagementId}/dashboard`} replace />;
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
                <RoleGuard allowedRoles={["super_admin", "admin"]}>
                  <UsersPage />
                </RoleGuard>
              }
            />
            <Route
              path="data"
              element={
                <RoleGuard allowedRoles={["super_admin", "admin"]}>
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
        {/* Dedicated Role Login Routes */}
        <Route path="/login" element={<PublicAuthRoute />} />
        <Route path="/login/:roleParam" element={<PublicAuthRoute />} />
        <Route path="/super-admin/login" element={<PublicAuthRoute initialRole="super_admin" />} />
        <Route path="/superadmin/login" element={<Navigate to="/super-admin/login" replace />} />
        <Route path="/admin/login" element={<PublicAuthRoute initialRole="admin" />} />
        <Route path="/management/login" element={<PublicAuthRoute initialRole="mgmt" />} />
        <Route path="/mgmt/login" element={<Navigate to="/management/login" replace />} />
        <Route path="/sales/login" element={<PublicAuthRoute initialRole="sales" />} />

        {/* Direct Role Entry Routes */}
        <Route path="/super-admin" element={<RoleDirectRoute role="super_admin" />} />
        <Route path="/superadmin" element={<Navigate to="/super-admin" replace />} />
        <Route path="/admin" element={<RoleDirectRoute role="admin" />} />
        <Route path="/management" element={<RoleDirectRoute role="mgmt" />} />
        <Route path="/mgmt" element={<Navigate to="/management" replace />} />
        <Route path="/sales" element={<Navigate to="/sales/login" replace />} />

        {/* Workspaces & Management Hub */}
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
