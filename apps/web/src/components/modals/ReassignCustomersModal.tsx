import { useState } from "react";
import { UserCheck } from "lucide-react";
import { Button, Dialog, Select } from "../ui";
import { useTrackerStore } from "../../store/trackerStore";
import type { User } from "../../data/types";

export function ReassignCustomersModal({
  open,
  onClose,
  initialTargetUser,
}: {
  open: boolean;
  onClose: () => void;
  initialTargetUser?: User | null;
}) {
  const { users, customers, reassignCustomers } = useTrackerStore();
  const salespeople = users.filter((u) => u.role === "sales");

  const [targetUserId, setTargetUserId] = useState(
    initialTargetUser?.id || salespeople[0]?.id || ""
  );
  const [search, setSearch] = useState("");
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<Set<string>>(new Set());

  const userMap = new Map(users.map((u) => [u.id, u]));

  const filteredCustomers = customers.filter(
    (c) =>
      !search ||
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.contactName || "").toLowerCase().includes(search.toLowerCase())
  );

  const toggleCustomer = (id: string) => {
    const next = new Set(selectedCustomerIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedCustomerIds(next);
  };

  const selectAllFiltered = () => {
    const next = new Set(selectedCustomerIds);
    filteredCustomers.forEach((c) => next.add(c.id));
    setSelectedCustomerIds(next);
  };

  const clearSelection = () => {
    setSelectedCustomerIds(new Set());
  };

  const handleApply = () => {
    if (selectedCustomerIds.size === 0 || !targetUserId) return;
    reassignCustomers(Array.from(selectedCustomerIds), targetUserId);
    onClose();
  };

  const targetName = userMap.get(targetUserId)?.name || "Salesperson";

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2">
          <UserCheck className="h-4 w-4 text-brand" />
          <span>Bulk Customer Assignment</span>
        </div>
      }
      description={`Select accounts to assign or reassign to ${targetName}`}
      maxWidth="max-w-xl"
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onClose} type="button">
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleApply}
            disabled={selectedCustomerIds.size === 0 || !targetUserId}
          >
            Assign {selectedCustomerIds.size} Accounts to {targetName}
          </Button>
        </>
      }
    >
      <div className="space-y-4 text-xs">
        {/* Target Salesperson Select */}
        <div>
          <label className="text-xs font-semibold text-muted uppercase tracking-wider block mb-1">
            Target Salesperson
          </label>
          <Select value={targetUserId} onChange={(e) => setTargetUserId(e.target.value)}>
            {salespeople.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({customers.filter((c) => c.ownerId === s.id).length} accounts)
              </option>
            ))}
          </Select>
        </div>

        {/* Customer Search & Quick Actions */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <input
            type="text"
            placeholder="Search customers…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="rounded-lg border border-line bg-surface px-3 py-1.5 text-xs text-ink placeholder:text-muted focus:outline-brand focus:border-brand w-60"
          />

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={selectAllFiltered}
              className="text-xs font-semibold text-brand hover:underline cursor-pointer"
            >
              Select filtered ({filteredCustomers.length})
            </button>
            <span className="text-muted">·</span>
            <button
              type="button"
              onClick={clearSelection}
              className="text-xs font-semibold text-muted hover:underline cursor-pointer"
            >
              Clear all
            </button>
          </div>
        </div>

        {/* Customers Multi-Select List */}
        <div className="border border-line rounded-xl max-h-64 overflow-y-auto divide-y divide-line/60 bg-surface">
          {filteredCustomers.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted">No accounts match search.</div>
          ) : (
            filteredCustomers.map((c) => {
              const isSelected = selectedCustomerIds.has(c.id);
              const currentOwner = userMap.get(c.ownerId)?.name || "Unassigned";

              return (
                <label
                  key={c.id}
                  className="flex items-center justify-between p-2.5 hover:bg-surface-2 cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleCustomer(c.id)}
                      className="h-3.5 w-3.5 rounded accent-brand"
                    />
                    <div>
                      <div className="font-bold text-ink text-xs">{c.name}</div>
                      <div className="text-[11px] text-muted">
                        {c.tier} · {c.area}
                      </div>
                    </div>
                  </div>

                  <div className="text-right text-[11px]">
                    <span className="text-muted block">Current:</span>
                    <span className="font-semibold text-ink">{currentOwner}</span>
                  </div>
                </label>
              );
            })
          )}
        </div>
      </div>
    </Dialog>
  );
}
