import { useState } from "react";
import { Button, Dialog, Select } from "@/components/ui";
import { ApiError } from "@/lib/api";
import { useUpdateCustomer } from "@/features/customers/queries";
import type { CustomerRow } from "@/features/customers/types";
import type { CustomerFkOption } from "@/features/customers/AddCustomerModal";

export function ReassignCustomersModal({
  open,
  onClose,
  customers,
  salespeople = [],
  initialTargetSalespersonId,
}: {
  open: boolean;
  onClose: () => void;
  customers: CustomerRow[];
  salespeople?: CustomerFkOption[];
  initialTargetSalespersonId?: string;
}) {
  const update = useUpdateCustomer();

  const [targetSalespersonId, setTargetSalespersonId] = useState(
    initialTargetSalespersonId || salespeople[0]?.id || ""
  );
  const [search, setSearch] = useState("");
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<Set<string>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const filteredCustomers = customers.filter(
    (c) =>
      !search ||
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.primaryContactName || "").toLowerCase().includes(search.toLowerCase())
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

  const clearSelection = () => setSelectedCustomerIds(new Set());

  const handleApply = async () => {
    if (selectedCustomerIds.size === 0 || !targetSalespersonId) return;
    setError("");
    setIsSubmitting(true);
    try {
      await Promise.all(
        Array.from(selectedCustomerIds).map((id) =>
          update.mutateAsync({ id, patch: { salespersonId: targetSalespersonId } })
        )
      );
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to reassign one or more accounts.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const targetName = salespeople.find((s) => s.id === targetSalespersonId)?.name || "Salesperson";

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Bulk Customer Assignment"
      description={`Select accounts to assign or reassign to ${targetName}.`}
      maxWidth="max-w-xl"
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onClose} type="button">
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleApply}
            disabled={selectedCustomerIds.size === 0 || !targetSalespersonId || isSubmitting}
          >
            {isSubmitting
              ? "Assigning…"
              : `Assign ${selectedCustomerIds.size} Accounts to ${targetName}`}
          </Button>
        </>
      }
    >
      <div className="space-y-4 text-xs">
        {/* Target Salesperson Select */}
        <div>
          <label
            htmlFor="reassign-salesperson"
            className="text-xs font-semibold text-muted uppercase tracking-wider block mb-1.5"
          >
            Target Salesperson
          </label>
          {salespeople.length === 0 ? (
            <p className="text-[11px] text-muted">No salespersons available yet.</p>
          ) : (
            <Select
              id="reassign-salesperson"
              value={targetSalespersonId}
              onChange={(e) => setTargetSalespersonId(e.target.value)}
            >
              {salespeople.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({customers.filter((c) => c.salespersonId === s.id).length} accounts)
                </option>
              ))}
            </Select>
          )}
        </div>

        {/* Customer Search & Quick Actions */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <label htmlFor="reassign-search" className="sr-only">
              Search customers
            </label>
            <input
              id="reassign-search"
              type="text"
              placeholder="Search customers…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="rounded-lg border border-line bg-surface px-3 py-1.5 text-xs text-ink placeholder:text-muted focus:outline-brand focus:border-brand w-60"
            />
          </div>

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

              return (
                <label
                  key={c.id}
                  htmlFor={`customer-select-${c.id}`}
                  className="flex items-center justify-between p-2.5 hover:bg-surface-2 cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <input
                      id={`customer-select-${c.id}`}
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleCustomer(c.id)}
                      className="h-3.5 w-3.5 rounded accent-brand"
                    />
                    <div>
                      <div className="font-bold text-ink text-xs">{c.name}</div>
                      <div className="text-[11px] text-muted">
                        {c.category || "—"} · {c.area || "—"}
                      </div>
                    </div>
                  </div>

                  <div className="text-right text-[11px]">
                    <span className="text-muted block">Current:</span>
                    <span className="font-semibold text-ink">{c.salespersonName || "Unassigned"}</span>
                  </div>
                </label>
              );
            })
          )}
        </div>

        {error && <p role="alert" className="text-[11.5px] font-medium text-red">{error}</p>}
      </div>
    </Dialog>
  );
}

