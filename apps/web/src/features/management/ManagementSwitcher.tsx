import { Building2 } from "lucide-react";
import { useManagements } from "@/features/management/queries";
import { useUi } from "@/store/ui";

/**
 * The workspace the user is in.
 *
 * A LABEL, not a switcher, and that is the honest shape today: a `User` row
 * carries exactly one `tenantId`, so `GET /managements` returns one row and
 * there is nothing to switch to. The dropdown this replaces listed workspaces
 * from a localStorage store and "switched" by swapping which client-side mock
 * dataset was in memory — it never changed tenant, and the data it showed
 * afterwards belonged to no one.
 *
 * When platform auth lands and the endpoint returns more than one row, this
 * becomes a menu again; until then it says where you are.
 */
export function ManagementSwitcher() {
  const activeManagementId = useUi((s) => s.activeManagementId);
  const { data: managements } = useManagements();

  const current =
    managements?.find((m) => m.id === activeManagementId) ?? managements?.[0];
  if (!current) return null;

  return (
    <div
      className="flex items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 py-1 text-xs font-bold text-ink"
      title={`Workspace: ${current.name}`}
    >
      <Building2 className="h-3.5 w-3.5 text-muted" />
      <span className="max-w-[160px] truncate">{current.name}</span>
    </div>
  );
}
