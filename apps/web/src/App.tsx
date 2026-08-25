import { lazy, Suspense } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useUi, DEFAULT_MANAGEMENT_ID } from "@/store/ui";
import {
  useIsAuthed,
  useMustChangePassword,
  useAuthRole,
  useIsOwner,
  useSessionStatus,
} from "@/store/auth";
import { Layout } from "@/components/layout";
import { Skeleton } from "@/components/ui";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { RoleGuard } from "@/features/auth/RoleGuard";
import { RequireOwner } from "@/features/auth/RequireOwner";
import type { LoginRole } from "@/features/auth/LoginPage";

// Lazy like every page, and for a stronger reason than code size: this is the
// only static import that reaches `trackerStore`, the client-side mock the
// management feature still reads (roadmap F14). Keeping it lazy keeps that
// whole subtree off the pre-auth path.
const ManagementProvider = lazy(() =>
  import("@/features/management/ManagementProvider").then((m) => ({
    default: m.ManagementProvider,
  })),
);
const LoginPage = lazy(() => import("@/features/auth/LoginPage"));
const DashboardPage = lazy(() => import("@/features/dashboard/DashboardPage"));
const ProjectionsPage = lazy(() => import("@/features/projections/ProjectionsPage"));
const LeadsPage = lazy(() => import("@/features/leads/LeadsPage"));
const OrdersPage = lazy(() => import("@/features/orders/OrdersPage"));
const PaymentsPage = lazy(() => import("@/features/payments/PaymentsPage"));
const FollowUpsPage = lazy(() => import("@/features/followups/FollowUpsPage"));
const CustomersPage = lazy(() => import("@/features/customers/CustomersPage"));
const ProductsPage = lazy(() => import("@/features/products/ProductsPage"));
const UsersPage = lazy(() => import("@/features/users/UsersPage"));
const ChangePasswordPage = lazy(
  () => import("@/features/auth/ChangePasswordPage"),
);
const DataPage = lazy(() => import("@/features/data/DataPage"));
const ManagementHomePage = lazy(() => import("@/features/management/ManagementHomePage"));
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

/** The one route a user with a pending forced password change may reach. */
const CHANGE_PASSWORD_PATH = "/change-password";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const authed = useIsAuthed();
  const status = useSessionStatus();
  const mustChange = useMustChangePassword();
  const location = useLocation();

  // On a reload the access token is gone (it is never persisted) and bootstrap
  // is still asking the refresh cookie for a new one. Bouncing to /login here
  // would sign out every user on every refresh.
  if (!authed && status === "unknown") {
    return (
      <div
        role="status"
        aria-live="polite"
        className="grid min-h-screen place-items-center text-muted"
      >
        Restoring your session…
      </div>
    );
  }

  if (!authed) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // An admin-set password is a shared secret until its owner replaces it. The
  // server refuses every other endpoint while this flag is set, so routing
  // anywhere else would only produce a 403 the user cannot act on.
  if (mustChange && location.pathname !== CHANGE_PASSWORD_PATH) {
    return <Navigate to={CHANGE_PASSWORD_PATH} replace />;
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
function RoleDirectRoute({ role: targetRole }: { role: "super_admin" | "admin" | "mgmt" | "sales" }) {
  const authed = useIsAuthed();
  const activeManagementId = useUi((s) => s.activeManagementId) || DEFAULT_MANAGEMENT_ID;

  if (!authed) {
    if (targetRole === "super_admin") return <Navigate to="/super-admin/login" replace />;
    if (targetRole === "mgmt") return <Navigate to="/management/login" replace />;
    if (targetRole === "sales") return <Navigate to="/sales/login" replace />;
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
            <Route
              path="products"
              element={
                <RoleGuard allowedRoles={["super_admin", "admin", "mgmt"]}>
                  <ProductsPage />
                </RoleGuard>
              }
            />
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
        <Route path="/sales" element={<RoleDirectRoute role="sales" />} />

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
              <Suspense fallback={<PageLoadingSkeleton />}>
                <ManagementProvider>
                  <AppLayout />
                </ManagementProvider>
              </Suspense>
            </ProtectedRoute>
          }
        />
        <Route
          path={CHANGE_PASSWORD_PATH}
          element={
            <ProtectedRoute>
              <Suspense fallback={<PageLoadingSkeleton />}>
                <ChangePasswordPage />
              </Suspense>
            </ProtectedRoute>
          }
        />

        <Route path="/" element={<ProtectedRoute><RootRedirect /></ProtectedRoute>} />
        <Route path="*" element={<ProtectedRoute><RootRedirect /></ProtectedRoute>} />
      </Routes>
    </ErrorBoundary>
  );
}
