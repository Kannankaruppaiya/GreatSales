import { useEffect } from "react";
import { Navigate, useParams } from "react-router-dom";
import { useUi } from "@/store/ui";
import { useAuthUser } from "@/store/auth";
import { useIsPlatformAuthed } from "@/store/platformAuth";

/**
 * Guards a management workspace (`/managements/:managementId/*`).
 *
 * The invariant it enforces: the active TENANT session must belong to the
 * management in the URL. That session is real — a tenant user's own login, or
 * the session an owner minted by opening a management (assume) — so this reads
 * the tenant `useAuth`, not the mock store it replaced.
 *
 * A mismatch is not something to paper over by silently swapping data (the old
 * localStorage behaviour): the session's tenant is fixed by its token. An owner
 * lands back on the Home grid to pick a management (which mints the right
 * session); a tenant user is sent to their own workspace.
 */
export function ManagementProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { managementId } = useParams();
  const user = useAuthUser();
  const isPlatformOwner = useIsPlatformAuthed();
  const setActiveManagement = useUi((s) => s.setActiveManagement);

  const matches = !!user && !!managementId && user.tenantId === managementId;

  useEffect(() => {
    if (matches && managementId) setActiveManagement(managementId);
  }, [matches, managementId, setActiveManagement]);

  if (!matches) {
    if (isPlatformOwner) return <Navigate to="/managements" replace />;
    if (user) {
      return (
        <Navigate to={`/managements/${user.tenantId}/dashboard`} replace />
      );
    }
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}
