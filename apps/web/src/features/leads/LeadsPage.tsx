import { useEffect, useMemo, useState } from "react";
import { Kanban, LayoutList, Loader2, Plus, RefreshCw } from "lucide-react";
import { useAuthRole } from "@/store/auth";
import { useUi } from "@/store/ui";
import { inr } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button, Card } from "@/components/ui";
import { QueryBoundary } from "@/components/common/QueryBoundary";
import { StatusBadge, TierBadge } from "@/components/StatusBadge";
import { AddLeadModal } from "@/features/leads/AddLeadModal";
import { LeadDetailModal } from "@/features/leads/LeadDetailModal";
import { useLeads, useUpdateLead, flattenLeads } from "@/features/leads/queries";
import {
  DEAL_STAGE_VALUES,
  DEAL_STAGE_LABELS,
  dealStageTone,
  type DealStageValue,
  type LeadRow,
} from "@/features/leads/types";

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

export default function LeadsPage() {
  const role = useAuthRole();
  const globalOwnerFilter = useUi((s) => s.ownerFilter);
  const globalPrincipal = useUi((s) => s.principalId);
  const isReadOnly = role === "mgmt";

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 300);
  const [viewMode, setViewMode] = useState<"list" | "kanban">("kanban");
  const [ownerId, setOwnerId] = useState("ALL");
  const [showAddLead, setShowAddLead] = useState(false);
  const [selectedLead, setSelectedLead] = useState<LeadRow | null>(null);

  const effectiveOwner = ownerId !== "ALL" ? ownerId : globalOwnerFilter !== "ALL" ? globalOwnerFilter : undefined;

  const params = {
    search: debouncedSearch.trim() || undefined,
    ownerId: effectiveOwner,
    principalId: globalPrincipal === "ALL" ? undefined : globalPrincipal,
  };
  const q = useLeads(params);
  const update = useUpdateLead();
  const leads = flattenLeads(q.data);

  // The Kanban board groups ALL leads by stage — a partially-loaded list
  // would show incomplete columns, so every page is fetched automatically
  // (same "fetch-all" pattern as PaymentsPage.tsx), guarded on hasNextPage
  // && !isFetchingNextPage so this terminates once the last page
  // (nextCursor: null) comes back.
  useEffect(() => {
    if (q.hasNextPage && !q.isFetchingNextPage) {
      q.fetchNextPage();
    }
  }, [q.hasNextPage, q.isFetchingNextPage, q.fetchNextPage]);

  const isLoadingFullBoard = q.isLoading || q.hasNextPage === true;

  // Salesperson filter options — no dedicated endpoint, derived from the
  // loaded rows (same pattern as ProductsPage's principals / PaymentsPage's
  // salespersonOptions). Also handed down to the modals as the salesperson
  // picker (see the brief's "derive FK options from rows").
  const salespersonOptions = useMemo(() => {
    const m = new Map<string, string>();
    for (const l of leads) {
      if (l.salespersonId) m.set(l.salespersonId, l.salespersonName || l.salespersonId);
    }
    return [...m.entries()].map(([id, name]) => ({ id, name }));
  }, [leads]);

  // Industry filter options — likewise no dedicated /industries endpoint,
  // derived from whatever industryId/industryName pairs already appear on
  // loaded leads (mirrors AddCustomerModal's `industries` prop, which
  // CustomersPage also never has a dedicated source for).
  const industryOptions = useMemo(() => {
    const m = new Map<string, string>();
    for (const l of leads) {
      if (l.industryId && l.industryName) m.set(l.industryId, l.industryName);
    }
    return [...m.entries()].map(([id, name]) => ({ id, name }));
  }, [leads]);

  // Drag and drop for Kanban — drop target carries the raw DealStageValue
  // (the Kanban column key), so this always PATCHes the raw enum string,
  // never a display label. Invalidation (built into useUpdateLead) refetches
  // the list so the card settles into its new column.
  const handleDragStart = (e: React.DragEvent, leadId: string) => {
    if (isReadOnly) return;
    e.dataTransfer.setData("text/plain", leadId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    if (isReadOnly) return;
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, targetStage: DealStageValue) => {
    if (isReadOnly) return;
    e.preventDefault();
    const leadId = e.dataTransfer.getData("text/plain");
    if (leadId) {
      update.mutate({ id: leadId, patch: { stage: targetStage } });
    }
  };

  return (
    <div className="space-y-4">
      {isLoadingFullBoard && (
        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-muted">
          <Loader2 className="h-3 w-3 animate-spin" />
          Loading full pipeline… ({leads.length} leads so far)
        </div>
      )}

      <Card className="p-0 overflow-hidden shadow-xs border-line">
        {/* Top Toolbar */}
        <div className="p-3 border-b border-line flex items-center justify-between gap-2.5 flex-wrap bg-surface">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search new sales pipeline…"
            className="h-8.5 w-64 rounded-lg border border-line bg-surface px-3 text-xs text-ink placeholder:text-muted/60 transition-all hover:border-muted/40 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 shadow-2xs"
          />

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

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setViewMode("list")}
              className={cn(
                "rounded-lg border px-3 py-1 text-xs font-semibold transition-all cursor-pointer inline-flex items-center gap-1 shadow-2xs",
                viewMode === "list"
                  ? "border-brand bg-brand text-white shadow-xs"
                  : "border-line bg-surface text-muted hover:border-muted/40 hover:text-ink"
              )}
            >
              <LayoutList className="h-3 w-3" /> List ({leads.length})
            </button>
            <button
              onClick={() => setViewMode("kanban")}
              className={cn(
                "rounded-lg border px-3 py-1 text-xs font-semibold transition-all cursor-pointer inline-flex items-center gap-1 shadow-2xs",
                viewMode === "kanban"
                  ? "border-brand bg-brand text-white shadow-xs"
                  : "border-line bg-surface text-muted hover:border-muted/40 hover:text-ink"
              )}
            >
              <Kanban className="h-3 w-3" /> Kanban ({leads.length})
            </button>
          </div>

          <Button size="sm" variant="outline" onClick={() => q.refetch()}>
            <RefreshCw className={cn("h-3.5 w-3.5 mr-1", q.isFetching && "animate-spin")} />
            Refresh
          </Button>

          {!isReadOnly && (
            <div className="ml-auto">
              <Button size="sm" onClick={() => setShowAddLead(true)}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Add New Sales Lead
              </Button>
            </div>
          )}
        </div>

        <QueryBoundary
          isLoading={q.isLoading}
          isError={q.isError}
          error={q.error}
          isEmpty={leads.length === 0}
          emptyLabel='No new sales leads found. Click "Add New Sales Lead" to log your first opportunity.'
        >
          {viewMode === "list" ? (
            /* List Table View */
            <div className="overflow-x-auto max-h-[68vh]">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-surface-2 text-[10.5px] font-extrabold uppercase tracking-wider text-muted sticky top-0 z-10 border-b border-line shadow-2xs whitespace-nowrap">
                  <tr>
                    <th className="py-2.5 px-3 min-w-[200px]">Customer</th>
                    <th className="py-2.5 px-3">Contact</th>
                    <th className="py-2.5 px-3">Mobile</th>
                    <th className="py-2.5 px-3">Industry</th>
                    <th className="py-2.5 px-3">Tier</th>
                    <th className="py-2.5 px-3">Deal stage</th>
                    <th className="py-2.5 px-3 text-right font-bold text-ink">Value</th>
                    <th className="py-2.5 px-3">Next follow-up</th>
                    <th className="py-2.5 px-3">Expected closure</th>
                    {role !== "sales" && (
                      <th className="py-2.5 px-3">Salesperson</th>
                    )}
                    <th className="py-2.5 px-3 text-center"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/60">
                  {leads.map((l) => (
                    <tr key={l.id} className="hover:bg-surface-2/70 transition-colors">
                      <td className="py-2.5 px-3">
                        <button
                          type="button"
                          onClick={() => setSelectedLead(l)}
                          className="font-bold text-ink hover:text-brand hover:underline cursor-pointer text-left block"
                        >
                          {l.customerName}
                        </button>
                      </td>
                      <td className="py-2.5 px-3 text-muted">{l.contactName || "—"}</td>
                      <td className="py-2.5 px-3 text-muted tabular-nums">{l.phone || l.whatsapp || "—"}</td>
                      <td className="py-2.5 px-3 text-muted">
                        {l.industryName || "—"}
                        {l.subIndustry ? ` · ${l.subIndustry}` : ""}
                      </td>
                      <td className="py-2.5 px-3">
                        <TierBadge tier={l.tier || undefined} />
                      </td>
                      <td className="py-2.5 px-3">
                        <StatusBadge
                          label={DEAL_STAGE_LABELS[l.stage as DealStageValue] ?? l.stage}
                          tone={dealStageTone(l.stage)}
                        />
                      </td>
                      <td className="py-2.5 px-3 text-right tabular-nums font-bold text-ink">
                        {l.totalValue > 0 ? inr(l.totalValue) : "—"}
                      </td>
                      <td className="py-2.5 px-3 tabular-nums text-muted">{l.nextFollowUp || "—"}</td>
                      <td className="py-2.5 px-3 tabular-nums text-muted">{l.expClose || "—"}</td>
                      {role !== "sales" && (
                        <td className="py-2.5 px-3 text-muted">{l.salespersonName}</td>
                      )}
                      <td className="py-2.5 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => setSelectedLead(l)}
                          className="rounded-lg border border-line bg-surface px-2.5 py-1 text-xs font-bold text-ink hover:border-brand hover:text-brand transition-all cursor-pointer shadow-2xs"
                        >
                          Open
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            /* Kanban Board View */
            <div className="p-3.5 overflow-x-auto">
              <div className="flex gap-3 min-w-max pb-2">
                {DEAL_STAGE_VALUES.map((stage) => {
                  const stageLeads = leads.filter((l) => l.stage === stage);
                  const stageVal = stageLeads.reduce((s, l) => s + (l.totalValue || 0), 0);

                  return (
                    <div
                      key={stage}
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleDrop(e, stage)}
                      className="w-64 shrink-0 rounded-2xl bg-surface-2 border border-line p-3 flex flex-col max-h-[70vh] shadow-2xs"
                    >
                      <div className="flex items-center justify-between font-bold text-xs text-ink mb-0.5">
                        <span className="truncate">{DEAL_STAGE_LABELS[stage]}</span>
                        <span className="rounded-full bg-surface border border-line px-1.5 py-0.2 text-[10px] font-bold text-muted shadow-2xs">
                          {stageLeads.length}
                        </span>
                      </div>
                      <div className="text-[11.5px] font-bold text-brand tabular-nums mb-2.5">
                        {stageVal > 0 ? inr(stageVal) : "₹0"}
                      </div>

                      <div className="space-y-2 overflow-y-auto flex-1 pr-1">
                        {stageLeads.length === 0 ? (
                          <div className="text-center py-8 text-xs text-muted border border-dashed border-line/60 rounded-xl">
                            Drag deals here
                          </div>
                        ) : (
                          stageLeads.map((l) => (
                            <div
                              key={l.id}
                              draggable={!isReadOnly}
                              onDragStart={(e) => handleDragStart(e, l.id)}
                              onClick={() => setSelectedLead(l)}
                              className="rounded-xl border border-line bg-surface p-3 shadow-2xs hover:border-brand/60 hover:shadow-xs transition-all cursor-pointer space-y-1.5 group"
                            >
                              <div className="font-bold text-xs text-ink leading-snug group-hover:text-brand transition-colors">
                                {l.customerName}
                              </div>
                              {l.contactName && (
                                <div className="text-[11px] text-muted">{l.contactName}</div>
                              )}
                              <div className="flex items-center justify-between text-xs pt-1.5 border-t border-line/40">
                                <span className="font-bold text-brand tabular-nums">
                                  {inr(l.totalValue || 0)}
                                </span>
                                {role !== "sales" && l.salespersonName && (
                                  <span className="text-[10.5px] font-semibold text-muted">
                                    {l.salespersonName}
                                  </span>
                                )}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </QueryBoundary>

        {q.hasNextPage && (
          <div className="p-3 border-t border-line flex items-center justify-center gap-1.5 text-[11px] font-medium text-muted">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Loading remaining leads…
          </div>
        )}
      </Card>

      {/* Modals */}
      <AddLeadModal
        open={showAddLead}
        onClose={() => setShowAddLead(false)}
        salespeople={salespersonOptions}
        industries={industryOptions}
      />

      {selectedLead && (
        <LeadDetailModal
          open={!!selectedLead}
          onClose={() => setSelectedLead(null)}
          lead={selectedLead}
        />
      )}
    </div>
  );
}
