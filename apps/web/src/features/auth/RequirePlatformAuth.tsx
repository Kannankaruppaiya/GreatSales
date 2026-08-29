import { Navigate, useLocation } from "react-router-dom";
import { useIsPlatformAuthed } from "@/store/platformAuth";

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
  const location = useLocation();

  if (!authed) {
    return (
      <Navigate to="/platform/login" state={{ from: location }} replace />
    );
  }
  return <>{children}</>;
}
