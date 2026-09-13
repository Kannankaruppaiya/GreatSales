import { useEffect, useMemo, useState } from "react";
import { CalendarClock, CheckCircle2, Loader2, Plus, RefreshCw, Trash2 } from "lucide-react";
import { useAuthRole } from "@/store/auth";
import { useUi } from "@/store/ui";
import { daysFromToday, inr, today } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ApiError } from "@/lib/api";
import { Button, Card } from "@/components/ui";
import { QueryBoundary } from "@/components/common/QueryBoundary";
import { FollowUpModal } from "@/features/followups/FollowUpModal";
import {
  useFollowUps,
  useUpdateFollowUp,
  useDeleteFollowUp,
  flattenFollowUps,
} from "@/features/followups/queries";
import { ENTITY_TYPE_VALUES } from "@/features/followups/types";
import type { FollowUpRow } from "@/features/followups/types";

/**
 * Debounces a fast-changing value (e.g. search input) so downstream effects
 * (e.g. a query key) only settle `delayMs` after the user stops typing.
 * Mirrors the same local hook in ProductsPage.tsx / CustomersPage.tsx.
 */
function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

function dueDateLabel(dueDate: string, todayStr: string): string {
  if (dueDate === todayStr) return "Today";
  const tomorrow = daysFromToday(1);
  if (dueDate === tomorrow) return "Tomorrow";
  const dt = new Date(dueDate + "T00:00:00");
  if (isNaN(dt.getTime())) return dueDate;
  return dt.toLocaleDateString("en-IN", { weekday: "short", day: "2-digit", month: "short" });
}

export default function FollowUpsPage() {
  const role = useAuthRole();
  const globalOwnerFilter = useUi((s) => s.ownerFilter);
  const canEdit = role !== "mgmt"; // mgmt is read-only; admin and sales can edit

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 300);
  const [entityType, setEntityType] = useState("ALL");
  const [ownerId, setOwnerId] = useState("ALL");
  const [showAdd, setShowAdd] = useState(false);
  const [editRow, setEditRow] = useState<FollowUpRow | null>(null);

  const effectiveOwner = ownerId !== "ALL" ? ownerId : globalOwnerFilter !== "ALL" ? globalOwnerFilter : undefined;

  const params = {
    search: debouncedSearch.trim() || undefined,
    entityType: entityType === "ALL" ? undefined : (entityType as (typeof ENTITY_TYPE_VALUES)[number]),
    ownerId: effectiveOwner,
    done: false,
  };
  const q = useFollowUps(params);
  const update = useUpdateFollowUp();
  const del = useDeleteFollowUp();

  const rows = flattenFollowUps(q.data);

  // Salesperson filter options — there is no dedicated endpoint, so they're
  // derived from the loaded rows, same pattern as ProductsPage's principals /
  // CustomersPage's salespersons.
  const salespersonOptions = useMemo(() => {
    const opts = new Map<string, string>();
    for (const r of rows) opts.set(r.salespersonId, r.salespersonName);
    return [...opts.entries()].map(([id, name]) => ({ id, name }));
  }, [rows]);

  const todayStr = today();

  // Bucket the fetched (already done: false) rows client-side by comparing
  // each row's dueDate to today.
  const { overdue, dueToday, upcoming } = useMemo(() => {
    const overdue: FollowUpRow[] = [];
    const dueToday: FollowUpRow[] = [];
    const upcoming: FollowUpRow[] = [];
    for (const r of rows) {
      if (r.dueDate < todayStr) overdue.push(r);
      else if (r.dueDate === todayStr) dueToday.push(r);
      else upcoming.push(r);
    }
    const byDate = (a: FollowUpRow, b: FollowUpRow) => (a.dueDate < b.dueDate ? -1 : 1);
    return {
      overdue: overdue.sort(byDate),
      dueToday: dueToday.sort(byDate),
      upcoming: upcoming.sort(byDate),
    };
  }, [rows, todayStr]);

  const buckets: { key: string; label: string; items: FollowUpRow[]; toneClass: string }[] = [
    { key: "overdue", label: "Overdue", items: overdue, toneClass: "text-red" },
    { key: "today", label: "Due today", items: dueToday, toneClass: "text-brand" },
    { key: "upcoming", label: "Upcoming", items: upcoming, toneClass: "text-muted" },
  ];

  return (
    <div className="space-y-4">
      <Card className="p-0 overflow-hidden shadow-xs border-line">
        <div className="p-3 border-b border-line flex items-center justify-between gap-2.5 flex-wrap bg-surface">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search follow-ups…"
            className="h-8.5 w-64 rounded-lg border border-line bg-surface px-3 text-xs text-ink placeholder:text-muted/60 transition-all hover:border-muted/40 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 shadow-2xs"
          />

          <select
            value={entityType}
            onChange={(e) => setEntityType(e.target.value)}
            className="h-8.5 rounded-lg border border-line bg-surface px-2.5 text-xs font-medium text-ink transition-all hover:border-muted/40 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 shadow-2xs cursor-pointer"
          >
            <option value="ALL">All entity types</option>
            {ENTITY_TYPE_VALUES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>

          {salespersonOptions.length > 0 && (
            <select
              value={ownerId}
              onChange={(e) => setOwnerId(e.target.value)}
              className="h-8.5 rounded-lg border border-line bg-surface px-2.5 text-xs font-medium text-ink transition-all hover:border-muted/40 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 shadow-2xs cursor-pointer"
            >
              <option value="ALL">All salespersons</option>
              {salespersonOptions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          )}

          <span className="text-xs text-muted font-medium">{rows.length} open follow-ups</span>

          <Button size="sm" variant="outline" onClick={() => q.refetch()} className="ml-auto">
            <RefreshCw className={cn("h-3.5 w-3.5 mr-1", q.isFetching && "animate-spin")} />
            Refresh
          </Button>

          {canEdit && (
            <Button size="sm" onClick={() => setShowAdd(true)}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Add Follow-Up
            </Button>
          )}
        </div>

        <div className="p-4 max-h-[70vh] overflow-y-auto space-y-5">
          <QueryBoundary
            isLoading={q.isLoading}
            isError={q.isError}
            error={q.error}
            isEmpty={rows.length === 0}
            emptyLabel="No open follow-ups. Add one to get started."
          >
            <div className="space-y-5">
              {buckets.map(
                (b) =>
                  b.items.length > 0 && (
                    <div key={b.key} className="space-y-2">
                      <div
                        className={cn(
                          "text-[10.5px] font-black uppercase tracking-wider pb-1 border-b border-line",
                          b.toneClass,
                        )}
                      >
                        {b.label} ({b.items.length})
                      </div>
                      <div className="space-y-1.5">
                        {b.items.map((r) => (
                          <div
                            key={r.id}
                            className="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-surface hover:bg-surface-2/80 border border-line/70 shadow-2xs transition-colors"
                          >
                            <CalendarClock className={cn("h-4 w-4 shrink-0", b.toneClass)} />
                            <div className="flex-1 min-w-0">
                              <div className="font-bold text-xs text-ink truncate">
                                {r.title || `${r.entityType} · ${r.entityId}`}
                              </div>
                              <div className="text-[11px] text-muted truncate">
                                <span className="font-semibold text-brand-ink">{r.entityType}</span>
                                {r.subtitle ? ` · ${r.subtitle}` : ""}
                                {r.amount != null ? ` · ${inr(r.amount)}` : ""}
                                {role !== "sales" ? ` · ${r.salespersonName}` : ""}
                                {` · ${dueDateLabel(r.dueDate, todayStr)}`}
                              </div>
                            </div>
                            {canEdit && (
                              <div className="flex items-center gap-1.5 shrink-0">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setEditRow(r)}
                                  className="text-xs py-1 h-7"
                                >
                                  Open
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => update.mutate({ id: r.id, patch: { done: true } })}
                                  disabled={update.isPending}
                                  className="text-xs py-1 h-7"
                                  title="Mark done"
                                >
                                  <CheckCircle2 className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    if (window.confirm("Delete this follow-up? This cannot be undone.")) {
                                      del.mutate(r.id);
                                    }
                                  }}
                                  disabled={del.isPending}
                                  className="text-xs py-1 h-7 text-red"
                                  title="Delete permanently"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ),
              )}
            </div>
          </QueryBoundary>
        </div>

        {q.hasNextPage && (
          <div className="p-3 border-t border-line flex justify-center">
            <Button
              size="sm"
              variant="outline"
              onClick={() => q.fetchNextPage()}
              disabled={q.isFetchingNextPage}
            >
              {q.isFetchingNextPage && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}
              Load more
            </Button>
          </div>
        )}

        {(update.isError || del.isError) && (
          <div className="px-3.5 pb-3 text-[11px] font-medium text-red">
            {(update.error instanceof ApiError && update.error.message) ||
              (del.error instanceof ApiError && del.error.message) ||
              "Failed to save follow-up."}
          </div>
        )}
      </Card>

      {/* Modals */}
      {showAdd && <FollowUpModal open={showAdd} onClose={() => setShowAdd(false)} />}
      {editRow && (
        <FollowUpModal open={!!editRow} onClose={() => setEditRow(null)} followUp={editRow} />
      )}
    </div>
  );
}
