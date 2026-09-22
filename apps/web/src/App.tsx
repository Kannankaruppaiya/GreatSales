import { lazy, Suspense } from "react";
import { Navigate, Route, Routes, useLocation, useParams } from "react-router-dom";
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
import { loginPathFor, loginPathForPath, roleForPath, rolePathFor } from "@/lib/rolePath";

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
const MappingsPage = lazy(() => import("@/features/mappings/MappingsPage"));
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
    const door = loginPathForPath(location.pathname) ?? loginPathFor("sales");
    return <Navigate to={door} state={{ from: location }} replace />;
  }

  if (mustChange && location.pathname !== CHANGE_PASSWORD_PATH) {
    return <Navigate to={CHANGE_PASSWORD_PATH} replace />;
  }

  return <>{children}</>;
}


function RequireRolePath({ children }: { children: React.ReactNode }) {
  const { rolePath } = useParams<{ rolePath?: string }>();
  const role = useAuthRole();
  const location = useLocation();

  const claimed = roleForPath(rolePath);
  if (claimed !== role) {
    // Keep everything after the segment, so a deep link survives the correction.
    const rest = location.pathname.split("/").slice(2).join("/");
    return <Navigate to={`/${rolePathFor(role)}/${rest}${location.search}`} replace />;
  }
  return <>{children}</>;
}

/** Old un-prefixed workspace URLs, kept working by moving them under the role. */
function LegacyManagementRedirect() {
  const role = useAuthRole();
  const location = useLocation();
  return (
    <Navigate
      to={`/${rolePathFor(role)}${location.pathname}${location.search}`}
      replace
    />
  );
}

function LoginDoorRedirect() {
  const { roleParam } = useParams<{ roleParam?: string }>();
  const named = roleForPath(roleParam);
  return <Navigate to={loginPathFor(named ?? "sales")} replace />;
}

function PublicAuthRoute({ initialRole }: { initialRole?: LoginRole }) {
  const authed = useIsAuthed();
  const isOwner = useIsOwner();
  const role = useAuthRole();
  const activeManagementId = useUi((s) => s.activeManagementId);
  const location = useLocation();
  const from = (location.state as { from?: { pathname?: string } })?.from?.pathname;

  if (authed) {
    if (from && !from.endsWith("/login")) {
      return <Navigate to={from} replace />;
    }
    if (isOwner || role === "super_admin") {
      return <Navigate to="/managements" replace />;
    }
    return (
      <Navigate
        to={`/${rolePathFor(role)}/managements/${activeManagementId || DEFAULT_MANAGEMENT_ID}/dashboard`}
        replace
      />
    );
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


function RootRedirect() {
  const role = useAuthRole();
  const isOwner = useIsOwner();
  const activeManagementId = useUi((s) => s.activeManagementId) || DEFAULT_MANAGEMENT_ID;
  if (isOwner || role === "super_admin") return <Navigate to="/managements" replace />;
  return (
    <Navigate
      to={`/${rolePathFor(role)}/managements/${activeManagementId}/dashboard`}
      replace
    />
  );
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
            {/* No RoleGuard: every role that can reach this app holds
                projection.read, and the server scopes a sales user to their own
                mappings. Gating it here would only hide it from the people who
                maintain it. */}
            <Route path="mappings" element={<MappingsPage />} />
            <Route
              path="products"
              element={
                <RoleGuard feature="products">
                  <ProductsPage />
                </RoleGuard>
              }
            />
            <Route
              path="users"
              element={
                <RoleGuard feature="users">
                  <UsersPage />
                </RoleGuard>
              }
            />
            <Route
              path="data"
              element={
                <RoleGuard feature="data">
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
        {/* There is no shared /login. It used to be a fifth door that served
            everybody and defaulted to the ADMINISTRATOR form, which is the
            thing the four per-role addresses exist to prevent. Someone who
            reaches it is sent to the door their address names, and to the
            SALES one when it names none — the least privileged of the four, so
            a guessed URL can never land on the administrator form again. */}
        <Route path="/login" element={<LoginDoorRedirect />} />
        <Route path="/login/:roleParam" element={<LoginDoorRedirect />} />
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
          path="/:rolePath/managements/:managementId/*"
          element={
            <ProtectedRoute>
              <RequireRolePath>
                <Suspense fallback={<PageLoadingSkeleton />}>
                  <ManagementProvider>
                    <AppLayout />
                  </ManagementProvider>
                </Suspense>
              </RequireRolePath>
            </ProtectedRoute>
          }
        />
        {/* Anything still pointing at the un-prefixed URL — a bookmark, an old
            link in an email — lands in the right place instead of 404ing. */}
        <Route
          path="/managements/:managementId/*"
          element={
            <ProtectedRoute>
              <LegacyManagementRedirect />
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
