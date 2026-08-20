import { useMemo, useState } from "react";
import {
  Kanban,
  LayoutList,
  MessageSquare,
  Plus,
} from "lucide-react";
import { DEAL_STAGES, type DealStage, dealTone } from "@/data/constants";
import { useTrackerStore } from "@/store/trackerStore";
import { useUi } from "@/store/ui";
import { useAuthRole } from "@/store/auth";
import { useMockOwnerId } from "@/lib/mockOwner";
import { inr } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button, Card } from "@/components/ui";
import { StatusBadge, TierBadge } from "@/components/StatusBadge";
import { AddLeadModal } from "@/features/leads/AddLeadModal";
import { LeadDetailModal } from "@/features/leads/LeadDetailModal.mock";
import { RemarksModal } from "@/components/modals/RemarksModal";
import { toast } from "@/store/toastStore";
import type { Lead } from "@/data/types";

export default function LeadsPage() {
  const { ownerFilter, principalId } = useUi();
  const role = useAuthRole();
  const ownerId = useMockOwnerId();
  const { leads, users, updateLeadStage, addLeadRemark } = useTrackerStore();

  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<"list" | "kanban">("list");
  const [stageFilter, setStageFilter] = useState("ALL");
  const [showAddLead, setShowAddLead] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [selectedRemarksLead, setSelectedRemarksLead] = useState<Lead | null>(null);

  const isReadOnly = role === "mgmt";
  const userMap = useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);

  // Scoped leads
  const scopedLeads = useMemo(() => {
    const q = search.trim().toLowerCase();
    return leads.filter((l) => {
      if (role === "sales" && l.ownerId !== ownerId) return false;
      if (ownerFilter !== "ALL" && l.ownerId !== ownerFilter) return false;
      if (stageFilter !== "ALL" && l.stage !== stageFilter) return false;
      if (principalId !== "ALL") {
        const hasPr = (l.products || []).some((p) => p.principalId === principalId);
        if (!hasPr) return false;
      }
      if (q) {
        const matchName = l.name.toLowerCase().includes(q);
        const matchContact = (l.contactName || "").toLowerCase().includes(q);
        const matchArea = (l.area || "").toLowerCase().includes(q);
        const matchInd = (l.industry || "").toLowerCase().includes(q);
        if (!matchName && !matchContact && !matchArea && !matchInd) return false;
      }
      return true;
    });
  }, [leads, role, ownerId, ownerFilter, stageFilter, principalId, search]);

  const leadTotal = (l: Lead) => (l.products || []).reduce((s, p) => s + (p.value || 0), 0);

  // Drag and drop for Kanban
  const handleDragStart = (e: React.DragEvent, leadId: string) => {
    if (isReadOnly) return;
    e.dataTransfer.setData("text/plain", leadId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    if (isReadOnly) return;
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, targetStage: DealStage) => {
    if (isReadOnly) return;
    e.preventDefault();
    const leadId = e.dataTransfer.getData("text/plain");
    if (leadId) {
      updateLeadStage(leadId, targetStage, users.find((u) => u.id === ownerId)?.name || "User");
      toast.success(`Deal moved to ${targetStage}`);
    }
  };

  return (
    <div className="space-y-4">
      <Card className="p-0 overflow-hidden shadow-xs border-line">
        {/* Top Toolbar */}
        <div className="p-3 border-b border-line flex items-center justify-between gap-2.5 flex-wrap bg-surface">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search new sales pipeline…"
            className="rounded-xl border border-line bg-surface-2 px-3 py-1.5 text-xs text-ink placeholder:text-muted focus:outline-brand focus:border-brand w-64 shadow-2xs"
          />

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setViewMode("list")}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-semibold transition-all cursor-pointer inline-flex items-center gap-1",
                viewMode === "list"
                  ? "border-brand bg-brand text-white shadow-2xs"
                  : "border-line bg-surface text-muted hover:border-muted/50 hover:text-ink"
              )}
            >
              <LayoutList className="h-3 w-3" /> List ({scopedLeads.length})
            </button>
            <button
              onClick={() => setViewMode("kanban")}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-semibold transition-all cursor-pointer inline-flex items-center gap-1",
                viewMode === "kanban"
                  ? "border-brand bg-brand text-white shadow-2xs"
                  : "border-line bg-surface text-muted hover:border-muted/50 hover:text-ink"
              )}
            >
              <Kanban className="h-3 w-3" /> Kanban Board
            </button>
          </div>

          {!isReadOnly && (
            <div className="ml-auto">
              <Button size="sm" onClick={() => setShowAddLead(true)}>
                <Plus className="h-3.5 w-3.5 mr-1" /> + Add New Sales Lead
              </Button>
            </div>
          )}
        </div>

        {/* Stage Filter Chips Bar */}
        <div className="p-2.5 border-b border-line bg-surface-2/40 flex items-center gap-1.5 overflow-x-auto">
          <button
            onClick={() => setStageFilter("ALL")}
            className={cn(
              "rounded-full border px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap transition-all cursor-pointer",
              stageFilter === "ALL"
                ? "border-brand bg-brand text-white shadow-2xs"
                : "border-line bg-surface text-muted hover:border-muted/50 hover:text-ink"
            )}
          >
            All stages
          </button>
          {DEAL_STAGES.map((s) => (
            <button
              key={s}
              onClick={() => setStageFilter(s)}
              className={cn(
                "rounded-full border px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap transition-all cursor-pointer",
                stageFilter === s
                  ? "border-brand bg-brand text-white shadow-2xs"
                  : "border-line bg-surface text-muted hover:border-muted/50 hover:text-ink"
              )}
            >
              {s}
            </button>
          ))}
        </div>

        {/* View Content */}
        {viewMode === "list" ? (
          /* List Table View */
          <div className="overflow-x-auto max-h-[68vh]">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-surface-2 text-[10.5px] font-extrabold uppercase tracking-wider text-muted sticky top-0 z-10 border-b border-line shadow-2xs">
                <tr>
                  <th className="py-2.5 px-3 min-w-[200px]">Customer</th>
                  <th className="py-2.5 px-3">Contact</th>
                  <th className="py-2.5 px-3">Mobile</th>
                  <th className="py-2.5 px-3">Industry</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Deal stage</th>
                  <th className="py-2.5 px-3 text-right font-bold text-ink">Value</th>
                  <th className="py-2.5 px-3">Next follow-up</th>
                  <th className="py-2.5 px-3">Expected closure</th>
                  {role !== "sales" && <th className="py-2.5 px-3">Salesperson</th>}
                  <th className="py-2.5 px-3 text-center">Remarks</th>
                  <th className="py-2.5 px-3 text-center"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/60">
                {scopedLeads.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="py-16 text-center text-xs text-muted">
                      No new sales leads found. Click &ldquo;+ Add New Sales Lead&rdquo; to log your first opportunity.
                    </td>
                  </tr>
                ) : (
                  scopedLeads.map((l) => {
                    const sp = userMap.get(l.ownerId)?.name || "—";
                    const val = leadTotal(l);
                    return (
                      <tr key={l.id} className="hover:bg-surface-2/70 transition-colors">
                        <td className="py-2.5 px-3">
                          <button
                            type="button"
                            onClick={() => setSelectedLead(l)}
                            className="font-bold text-ink hover:text-brand hover:underline cursor-pointer text-left block"
                          >
                            {l.name}
                          </button>
                        </td>
                        <td className="py-2.5 px-3 text-muted">{l.contactName || "—"}</td>
                        <td className="py-2.5 px-3 text-muted tabular-nums">{l.phone || l.whatsapp || "—"}</td>
                        <td className="py-2.5 px-3 text-muted">
                          {l.industry || "—"}
                          {l.subIndustry ? ` · ${l.subIndustry}` : ""}
                        </td>
                        <td className="py-2.5 px-3">
                          <TierBadge tier={l.tier || "Silver"} />
                        </td>
                        <td className="py-2.5 px-3">
                          <StatusBadge label={l.stage} tone={dealTone(l.stage)} />
                        </td>
                        <td className="py-2.5 px-3 text-right tabular-nums font-bold text-ink">
                          {val > 0 ? inr(val) : "—"}
                        </td>
                        <td className="py-2.5 px-3 tabular-nums text-muted">{l.nextFollowUp || "—"}</td>
                        <td className="py-2.5 px-3 tabular-nums text-muted">{l.expClose || "—"}</td>
                        {role !== "sales" && <td className="py-2.5 px-3 text-muted">{sp}</td>}
                        <td className="py-2.5 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => setSelectedRemarksLead(l)}
                            className="rounded-lg border border-line bg-surface px-2.5 py-1 text-xs text-muted hover:border-brand hover:text-brand transition-all cursor-pointer inline-flex items-center gap-1 font-medium shadow-2xs"
                          >
                            <MessageSquare className="h-3 w-3" />
                            <span>Remarks</span>
                            {l.remarks && l.remarks.length > 0 && (
                              <span className="rounded-full bg-brand text-white px-1.5 py-0.2 text-[10px] font-bold">
                                {l.remarks.length}
                              </span>
                            )}
                          </button>
                        </td>
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
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        ) : (
          /* Kanban Board View */
          <div className="p-3.5 overflow-x-auto">
            <div className="flex gap-3 min-w-max pb-2">
              {DEAL_STAGES.map((stage) => {
                const stageLeads = scopedLeads.filter((l) => l.stage === stage);
                const stageVal = stageLeads.reduce((s, l) => s + leadTotal(l), 0);

                return (
                  <div
                    key={stage}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, stage)}
                    className="w-64 shrink-0 rounded-2xl bg-surface-2 border border-line p-3 flex flex-col max-h-[70vh] shadow-2xs"
                  >
                    <div className="flex items-center justify-between font-bold text-xs text-ink mb-0.5">
                      <span className="truncate">{stage}</span>
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
                        stageLeads.map((l) => {
                          const sp = userMap.get(l.ownerId)?.name;
                          return (
                            <div
                              key={l.id}
                              draggable={!isReadOnly}
                              onDragStart={(e) => handleDragStart(e, l.id)}
                              onClick={() => setSelectedLead(l)}
                              className="rounded-xl border border-line bg-surface p-3 shadow-2xs hover:border-brand/60 hover:shadow-xs transition-all cursor-pointer space-y-1.5 group"
                            >
                              <div className="font-bold text-xs text-ink leading-snug group-hover:text-brand transition-colors">
                                {l.name}
                              </div>
                              {l.contactName && (
                                <div className="text-[11px] text-muted">{l.contactName}</div>
                              )}
                              <div className="flex items-center justify-between text-xs pt-1.5 border-t border-line/40">
                                <span className="font-bold text-brand tabular-nums">
                                  {inr(leadTotal(l))}
                                </span>
                                {role !== "sales" && sp && (
                                  <span className="text-[10.5px] font-semibold text-muted">{sp}</span>
                                )}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </Card>

      {/* Modals */}
      <AddLeadModal open={showAddLead} onClose={() => setShowAddLead(false)} />

      {selectedLead && (
        <LeadDetailModal
          open={!!selectedLead}
          onClose={() => setSelectedLead(null)}
          lead={selectedLead}
        />
      )}

      {selectedRemarksLead && (
        <RemarksModal
          open={!!selectedRemarksLead}
          onClose={() => setSelectedRemarksLead(null)}
          title={`Remarks — ${selectedRemarksLead.name}`}
          remarks={selectedRemarksLead.remarks || []}
          onAddRemark={(text, user) => {
            addLeadRemark(selectedRemarksLead.id, text, user);
            toast.success("Remark logged");
          }}
        />
      )}
    </div>
  );
}
