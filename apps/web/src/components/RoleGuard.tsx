import { ShieldAlert, ArrowLeft, Home } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuthRole } from "../store/auth";
import { roleLabel, type Role } from "../data/constants";
import { Button, Card, PageHeader } from "./ui";

export function RoleGuard({
  allowedRoles,
  children,
}: {
  allowedRoles: Role[];
  children: React.ReactNode;
}) {
  const role = useAuthRole();
  const navigate = useNavigate();

  const isAllowed = allowedRoles.includes(role);

  if (!isAllowed) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Access Restricted"
          subtitle="You do not have the required administrative role to view this surface."
          actions={
            <Button variant="outline" size="sm" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-4 w-4 mr-1" /> Previous Page
            </Button>
          }
        />

        <Card className="p-8 text-center max-w-lg mx-auto space-y-5 border-line shadow-card">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-600 shadow-2xs">
            <ShieldAlert className="h-7 w-7" />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-center gap-2">
              <span className="rounded-full bg-amber-100 border border-amber-300 px-2.5 py-0.5 text-[11px] font-bold text-amber-900 uppercase tracking-wider">
                Current Role: {roleLabel(role)}
              </span>
            </div>
            <h3 className="text-lg font-bold text-ink font-sans">
              Administrative Permission Required
            </h3>
            <p className="text-xs text-muted leading-relaxed max-w-md mx-auto">
              This module is strictly restricted to {allowedRoles.map((r) => roleLabel(r)).join(", ")}. If you need access, contact your system administrator or switch role in settings.
            </p>
          </div>

          <div className="pt-2 flex items-center justify-center gap-3">
            <Button variant="primary" size="sm" onClick={() => navigate("/dashboard")}>
              <Home className="h-4 w-4 mr-1" /> Return to Dashboard
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}
