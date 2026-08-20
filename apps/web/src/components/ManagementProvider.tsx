import { useEffect } from "react";
import { Navigate, useParams } from "react-router-dom";
import { useUi } from "../store/ui";
import { useIsOwner } from "../store/auth";
import { useManagementStore } from "../store/managementStore";
import { switchManagement } from "../store/managementActions";

export function ManagementProvider({ children }: { children: React.ReactNode }) {
  const { managementId } = useParams();
  const isOwner = useIsOwner();
  const activeManagementId = useUi((s) => s.activeManagementId);
  const known = useManagementStore((s) => s.managements.some((m) => m.id === managementId));

  const exists = Boolean(managementId) && known;
  const mayAccess = exists && (isOwner || managementId === activeManagementId);

  useEffect(() => {
    if (mayAccess && managementId && managementId !== activeManagementId) {
      switchManagement(managementId);
    }
  }, [mayAccess, managementId, activeManagementId]);

  if (!mayAccess) {
    if (isOwner) return <Navigate to="/managements" replace />;
    const to = activeManagementId ? `/managements/${activeManagementId}/dashboard` : "/login";
    return <Navigate to={to} replace />;
  }
  return <>{children}</>;
}
