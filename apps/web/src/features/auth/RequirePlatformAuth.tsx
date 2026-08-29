import { Navigate, useLocation } from "react-router-dom";
import { useIsPlatformAuthed, usePlatformStatus } from "@/store/platformAuth";

/**
 * Gate for the platform (owner) surface. The owner is a platform principal, not
 * a tenant user, so this checks the platform session — NOT the tenant `useAuth`.
 * Unauthenticated owners are sent to the dedicated platform login.
 */
export function RequirePlatformAuth({
  children,
}: {
  children: React.ReactNode;
}) {
  const authed = useIsPlatformAuthed();
  const status = usePlatformStatus();
  const location = useLocation();

  // On a reload the access token is gone and bootstrap is still asking the
  // refresh cookie for a new one. Bouncing to /platform/login here would sign
  // the owner out on every refresh.
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
    return (
      <Navigate to="/platform/login" state={{ from: location }} replace />
    );
  }
  return <>{children}</>;
}
