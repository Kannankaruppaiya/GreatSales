import { useEffect } from "react";
import { Navigate, useParams } from "react-router-dom";
import { useUi } from "@/store/ui";
import { useManagements } from "@/features/management/queries";

/**
 * Gates the /managements/:managementId subtree.
 *
 * The check is now against the workspaces the SERVER says this user can reach,
 * not against a localStorage list. Previously a management "existed" if a
 * zustand `persist` store in that browser said so, which made the gate a
 * client-side fiction: clearing site data removed workspaces, and seeding that
 * store would have invented them.
 *
 * This is a routing convenience, never authorization — every request the
 * subtree makes is tenant-bound server-side by the caller's own token and by
 * RLS, so a pasted URL for another tenant returns that tenant nothing.
 */
export function ManagementProvider({ children }: { children: React.ReactNode }) {
  const { managementId } = useParams();
  const activeManagementId = useUi((s) => s.activeManagementId);
  const setActiveManagement = useUi((s) => s.setActiveManagement);
  const { data: managements, isLoading, isError } = useManagements();

  const known = managements?.find((m) => m.id === managementId) ?? null;

  useEffect(() => {
    if (known && managementId && managementId !== activeManagementId) {
      setActiveManagement(managementId);
    }
  }, [known, managementId, activeManagementId, setActiveManagement]);

  // Render the subtree WITHOUT waiting on this query.
  //
  // Blocking on it put an extra round trip in front of every page load, and
  // bought nothing: this is a routing convenience, not authorization. Each
  // request the subtree makes is bound to the caller's own tenant by their
  // token and by RLS, so a wrong id in the URL returns nothing either way.
  //
  // Only redirect once the list has actually come back and positively does not
  // contain this id — never on a pending or failed query, which would bounce a
  // user off a URL they are allowed to open because the network hiccuped.
  const answered = !isLoading && !isError && !!managements;
  if (answered && !known) {
    const fallback = managements[0]?.id;
    return (
      <Navigate
        to={fallback ? `/managements/${fallback}/dashboard` : "/login"}
        replace
      />
    );
  }

  return <>{children}</>;
}
