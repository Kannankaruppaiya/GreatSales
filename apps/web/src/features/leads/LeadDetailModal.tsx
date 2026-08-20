import { useState } from "react";
import { Plus, Target, Trash2 } from "lucide-react";
import { Button, Dialog, Input, Select } from "@/components/ui";
import { DEAL_STAGES, type DealStage } from "@/data/constants";
import { useTrackerStore } from "@/store/trackerStore";
import { useAuthRole } from "@/store/auth";
import { useMockOwnerId } from "@/lib/mockOwner";
import { inr } from "@/lib/format";
import type { Lead, LeadProduct } from "@/data/types";

export function LeadDetailModal({
  open,
  onClose,
  lead,
}: {
  open: boolean;
  onClose: () => void;
  lead: Lead | null;
}) {
  const { principals, products, users, updateLeadStage, addLeadRemark } =
    useTrackerStore();
  const role = useAuthRole();
  const ownerId = useMockOwnerId();
  const salespeople = users.filter((u) => u.role === "sales");

  if (!lead) return null;

  const [stage, setStage] = useState<DealStage>(lead.stage);
  const [nextFollowUp, setNextFollowUp] = useState(lead.nextFollowUp || "");
  const [expClose, setExpClose] = useState(lead.expClose || "");
  const [newRemark, setNewRemark] = useState("");

  const [leadProducts, setLeadProducts] = useState<LeadProduct[]>(lead.products || []);

  const totalValue = leadProducts.reduce((s, p) => s + (p.value || 0), 0);
  const currentUser = users.find((u) => u.id === ownerId)?.name || "User";

  const handleAddProduct = () => {
    const prId = principals[0]?.id || "pr_castrol";
    const prods = products.filter((p) => p.principalId === prId);
    const prod = prods[0] || products[0];
    setLeadProducts([
      ...leadProducts,
      {
        principalId: prId,
        productId: prod?.id,
        name: prod?.name || "Product",
        qty: 1,
        unit: "Ltr",
        price: prod?.listPrice || 380,
        value: prod?.listPrice || 380,
      },
    ]);
  };

  const handleUpdateProduct = (idx: number, updates: Partial<LeadProduct>) => {
    const updated = [...leadProducts];
    const curr = { ...updated[idx], ...updates };
    curr.value = curr.qty * curr.price;
    updated[idx] = curr;
    setLeadProducts(updated);
  };

  const handleRemoveProduct = (idx: number) => {
    setLeadProducts(leadProducts.filter((_, i) => i !== idx));
  };

  const handleAddRemark = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRemark.trim()) return;
    addLeadRemark(lead.id, newRemark.trim(), currentUser);
    setNewRemark("");
  };

  const handleSaveAll = () => {
    if (stage !== lead.stage) {
      updateLeadStage(lead.id, stage, currentUser);
    }
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4 text-brand" />
          <span>New Sales Lead: {lead.name}</span>
        </div>
      }
      description={`${lead.contactName || "Direct Contact"} · ${lead.area || "Territory"} · Total ${inr(totalValue)}`}
      maxWidth="max-w-2xl"
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onClose} type="button">
            Cancel
          </Button>
          <Button size="sm" onClick={handleSaveAll}>
            Save Changes
          </Button>
        </>
      }
    >
      <div className="space-y-4 text-xs">
        {/* Deal Stage Selector */}
        <div className="rounded-xl border border-line bg-surface-2 p-3 flex items-center justify-between gap-3">
          <span className="font-bold text-xs text-ink uppercase tracking-wider">
            Deal Pipeline Stage:
          </span>
          <Select
            value={stage}
            onChange={(e) => setStage(e.target.value as DealStage)}
            className="font-bold text-brand max-w-[260px]"
          >
            {DEAL_STAGES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </div>

        {/* Lead Metadata Grid */}
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="text-xs font-semibold text-muted uppercase tracking-wider block mb-1">
              Salesperson
            </label>
            <div className="font-semibold text-ink p-2 rounded-lg bg-surface border border-line">
              {salespeople.find((u) => u.id === lead.ownerId)?.name || "—"}
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-muted uppercase tracking-wider block mb-1">
              Next Follow-Up
            </label>
            <Input
              type="date"
              value={nextFollowUp}
              onChange={(e) => setNextFollowUp(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted uppercase tracking-wider block mb-1">
              Expected Closure
            </label>
            <Input
              type="date"
              value={expClose}
              onChange={(e) => setExpClose(e.target.value)}
            />
          </div>
        </div>

        {/* Product Requirements Table */}
        <div className="rounded-xl border border-line bg-surface p-3.5 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-ink uppercase tracking-wider">
              Enquiry Products & Estimated Values
            </span>
            {role !== "mgmt" && (
              <Button type="button" size="xs" variant="secondary" onClick={handleAddProduct}>
                <Plus className="h-3 w-3 mr-1" /> Add Product
              </Button>
            )}
          </div>

          <div className="space-y-2">
            {leadProducts.map((p, idx) => (
              <div key={idx} className="flex items-center gap-2 text-xs">
                <Select
                  value={p.principalId}
                  onChange={(e) => {
                    const prId = e.target.value;
                    const prods = products.filter((pr) => pr.principalId === prId);
                    const prod = prods[0];
                    handleUpdateProduct(idx, {
                      principalId: prId,
                      productId: prod?.id,
                      name: prod?.name || "Product",
                      price: prod?.listPrice || 0,
                    });
                  }}
                  className="w-32"
                >
                  {principals.map((pr) => (
                    <option key={pr.id} value={pr.id}>
                      {pr.name}
                    </option>
                  ))}
                </Select>

                <Input
                  placeholder="Product name"
                  value={p.name}
                  onChange={(e) => handleUpdateProduct(idx, { name: e.target.value })}
                  className="flex-1"
                />

                <Input
                  type="number"
                  placeholder="Qty"
                  value={p.qty || ""}
                  onChange={(e) => handleUpdateProduct(idx, { qty: Number(e.target.value) })}
                  className="w-16 text-right tabular-nums"
                />

                <Input
                  type="number"
                  placeholder="Rate ₹"
                  value={p.price || ""}
                  onChange={(e) => handleUpdateProduct(idx, { price: Number(e.target.value) })}
                  className="w-20 text-right tabular-nums"
                />

                <div className="w-24 text-right font-bold text-ink tabular-nums">
                  {inr(p.value || 0)}
                </div>

                {role !== "mgmt" && (
                  <button
                    type="button"
                    onClick={() => handleRemoveProduct(idx)}
                    className="text-muted hover:text-red p-1 cursor-pointer"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>

          <div className="pt-2 border-t border-line flex items-center justify-between text-xs font-bold">
            <span className="text-muted uppercase tracking-wider">Total Deal Value</span>
            <span className="text-brand tabular-nums text-sm">{inr(totalValue)}</span>
          </div>
        </div>

        {/* Remarks and Interaction Log */}
        <div className="rounded-xl border border-line bg-surface p-3.5 space-y-2.5">
          <span className="text-xs font-bold text-ink uppercase tracking-wider block">
            Interaction Log & Remarks ({lead.remarks?.length || 0})
          </span>

          <form onSubmit={handleAddRemark} className="flex gap-2">
            <Input
              placeholder="Log note or follow-up discussion…"
              value={newRemark}
              onChange={(e) => setNewRemark(e.target.value)}
              className="flex-1"
            />
            <Button size="sm" type="submit" disabled={!newRemark.trim()}>
              Add Note
            </Button>
          </form>

          <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
            {(lead.remarks || []).map((r, i) => (
              <div
                key={i}
                className="rounded-lg border border-line bg-surface-2/60 p-2 text-xs text-ink space-y-0.5"
              >
                <div className="flex items-center justify-between text-[10.5px] text-muted">
                  <span className="font-semibold">{r.userName || r.user || "Sales Rep"}</span>
                  <span>
                    {new Date(r.timestamp || r.date || Date.now()).toLocaleString("en-IN", {
                      day: "2-digit",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
                <div>{r.text}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Dialog>
  );
}
