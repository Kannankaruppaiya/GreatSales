import { projTone } from "@/data/constants";
import { inr, longDate } from "@/lib/format";
import { Card } from "@/components/ui";
import { StatusBadge } from "@/components/StatusBadge";
import { PROJ_STATUS_LABELS, type ProjectionLine } from "@/features/projections/types";

/**
 * The highest-value open recurring lines for the reporting window.
 *
 * One component rather than a copy per role. The aggregate has always carried
 * these lines for every role, but only the sales branch of the dashboard drew
 * them, so an administrator was sent ten rows a page that never rendered.
 *
 * `onLogFollowUp` is optional because management reads the workspace rather
 * than writing to it: without a handler the action column is not drawn at all,
 * which is a truer answer than a button that would be refused.
 */
export function TopOpenProjectionsCard({
  rows,
  windowLabel,
  onCustomer,
  onLogFollowUp,
}: {
  rows: ProjectionLine[];
  windowLabel: string;
  onCustomer: (customerId: string) => void;
  onLogFollowUp?: (line: ProjectionLine) => void;
}) {
  const columns = onLogFollowUp ? 7 : 6;

  return (
    <Card className="p-0 overflow-hidden shadow-xs border-line">
      <div className="p-3.5 border-b border-line flex items-center justify-between bg-surface-2/40">
        <div className="font-bold text-sm text-ink">Top open projections — {windowLabel}</div>
        <span className="text-xs text-muted font-medium">{rows.length} lines</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead className="bg-surface-2 text-2xs font-bold uppercase tracking-wider text-muted border-b border-line whitespace-nowrap">
            <tr>
              <th className="py-2.5 px-3">Customer</th>
              <th className="py-2.5 px-3">Principal</th>
              <th className="py-2.5 px-3">Sub product</th>
              <th className="py-2.5 px-3 text-right">Proj value</th>
              <th className="py-2.5 px-3">Status</th>
              <th className="py-2.5 px-3">Next follow-up</th>
              {onLogFollowUp && <th className="py-2.5 px-3 text-center"></th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-line/60">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={columns} className="py-8 text-center text-xs text-muted">
                  No open projections in this window.
                </td>
              </tr>
            ) : (
              rows.map((p) => (
                <tr key={p.id} className="hover:bg-surface-2/60 transition-colors">
                  <td className="py-2.5 px-3">
                    <button
                      type="button"
                      onClick={() => onCustomer(p.customerId)}
                      className="font-bold text-ink hover:text-brand hover:underline cursor-pointer text-left"
                    >
                      {p.customerName}
                    </button>
                  </td>
                  <td className="py-2.5 px-3 text-muted">{p.principalName}</td>
                  <td className="py-2.5 px-3 font-semibold text-ink">{p.productName}</td>
                  <td className="py-2.5 px-3 text-right tabular-nums font-bold text-ink">
                    {p.projValue > 0 ? inr(p.projValue) : "—"}
                  </td>
                  <td className="py-2.5 px-3">
                    <StatusBadge
                      label={PROJ_STATUS_LABELS[p.status] ?? p.status}
                      tone={projTone(PROJ_STATUS_LABELS[p.status] ?? p.status)}
                    />
                  </td>
                  <td className="py-2.5 px-3 tabular-nums text-muted whitespace-nowrap">
                    {longDate(p.nextFollowUp)}
                  </td>
                  {onLogFollowUp && (
                    <td className="py-2.5 px-3 text-center">
                      <button
                        type="button"
                        onClick={() => onLogFollowUp(p)}
                        className="rounded-lg border border-line bg-surface px-2.5 py-1 text-xs font-bold text-ink hover:border-brand hover:text-brand cursor-pointer shadow-2xs transition-colors"
                      >
                        Log Follow-Up
                      </button>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
