import { Link } from "react-router-dom";

import { featurePath } from "@/data/features";
import { inr, shortDate } from "@/lib/format";
import { useRolePath } from "@/lib/rolePath";
import { useUi } from "@/store/ui";
import { cn } from "@/lib/utils";
import { Dialog } from "@/components/ui";
import type { EntityTypeValue } from "@/features/followups/types";
import type { DashboardFollowUp } from "@/features/dashboard/types";

/**
 * The follow-ups the tile counted — the same rows the Follow-ups page lists.
 *
 * The tile used to count the `nextFollowUp` dates on leads and recurring lines,
 * which are columns on those records and not follow-ups, so it could read "8
 * overdue" above a Follow-ups page holding nothing. It counts that page's rows
 * now, and this opens them so the number can be checked rather than trusted.
 */

/** Where a row leads, by the record it hangs off — the mobile screen routes the
 *  same way, and a follow-up is only ever about one of these. */
const FEATURE: Record<EntityTypeValue, string> = {
  Customer: "customers",
  Lead: "leads",
  Order: "orders",
  Payment: "payments",
  Projection: "projections",
};

const TONE: Record<EntityTypeValue, string> = {
  Customer: "bg-surface-2 text-ink-2 border-line",
  Lead: "bg-blue-soft text-blue border-blue/30",
  Order: "bg-violet-soft text-violet border-violet/30",
  Payment: "bg-amber-soft text-amber border-amber/30",
  Projection: "bg-brand-soft text-brand-ink border-brand/20",
};

/** "Today", or how late it is. Whole days, resolved server-side. */
function lateness(days: number): string {
  if (days <= 0) return "Today";
  return days === 1 ? "1 day late" : `${days} days late`;
}

export function FollowUpsDueModal({
  open,
  onClose,
  items,
  due,
  overdue,
}: {
  open: boolean;
  onClose: () => void;
  items: DashboardFollowUp[];
  due: number;
  overdue: number;
}) {
  const rolePath = useRolePath();
  const activeManagementId = useUi((s) => s.activeManagementId);
  const total = due + overdue;
  // The server caps the list; the counts above it are whole, so say so rather
  // than letting a short list read as a smaller number.
  const hidden = total - items.length;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Follow-ups due"
      description={
        overdue > 0
          ? `${total} outstanding · ${overdue} overdue`
          : `${total} outstanding, none overdue`
      }
      maxWidth="max-w-3xl"
    >
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead className="bg-surface-2 text-3xs font-bold uppercase tracking-wider text-muted border-b border-line whitespace-nowrap">
            <tr>
              <th className="py-2 px-3">Where</th>
              <th className="py-2 px-3">What</th>
              <th className="py-2 px-3">Owner</th>
              <th className="py-2 px-3">Due</th>
              <th className="py-2 px-3 text-right">Value</th>
              <th className="py-2 px-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line/60">
            {items.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-xs text-muted">
                  Nothing outstanding in this window.
                </td>
              </tr>
            ) : (
              items.map((f) => (
                <tr key={f.id} className="hover:bg-surface-2/60 transition-colors">
                  <td className="py-2 px-3">
                    <span
                      className={cn(
                        "inline-flex items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-3xs font-bold",
                        TONE[f.entityType],
                      )}
                    >
                      {f.entityType}
                    </span>
                  </td>
                  <td className="py-2 px-3">
                    <div className="font-bold text-ink">{f.title}</div>
                    {f.subtitle && <div className="text-3xs text-muted">{f.subtitle}</div>}
                  </td>
                  <td className="py-2 px-3 text-muted">{f.ownerName ?? "—"}</td>
                  <td className="py-2 px-3 whitespace-nowrap">
                    <div className="tabular-nums text-ink">{shortDate(f.dueDate)}</div>
                    <div className={cn("text-3xs font-bold", f.daysOverdue > 0 ? "text-red" : "text-muted")}>
                      {lateness(f.daysOverdue)}
                    </div>
                  </td>
                  <td className="py-2 px-3 text-right tabular-nums font-bold text-ink">
                    {f.amount == null ? "—" : inr(f.amount)}
                  </td>
                  <td className="py-2 px-3 text-right">
                    {activeManagementId ? (
                      <Link
                        to={featurePath(FEATURE[f.entityType], activeManagementId, rolePath)}
                        onClick={onClose}
                        className="text-xs font-bold text-brand hover:underline whitespace-nowrap"
                      >
                        Open
                      </Link>
                    ) : null}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {hidden > 0 && (
        <div className="px-3 py-2 text-3xs text-muted border-t border-line">
          Showing the {items.length} most overdue of {total}.
        </div>
      )}
    </Dialog>
  );
}
