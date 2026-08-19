import { Navigate } from "react-router-dom";
import { useUi } from "../store/ui";

export function RequireOwner({ children }: { children: React.ReactNode }) {
  const isOwner = useUi((s) => s.isOwner);
  const activeManagementId = useUi((s) => s.activeManagementId);

  if (!isOwner) {
    const to = activeManagementId ? `/managements/${activeManagementId}/dashboard` : "/login";
    return <Navigate to={to} replace />;
  }
  return <>{children}</>;
}
