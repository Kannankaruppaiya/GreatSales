import { useState } from "react";
import { Building2 } from "lucide-react";
import { Button, Dialog, Input, Select } from "@/components/ui";
import { ApiError } from "@/lib/api";
import { CUSTOMER_TIERS, INDUSTRIAL_AREAS, PAYMENT_TERMS, PAY_ZONES } from "@/data/constants";
import { useUpdateCustomer } from "@/features/customers/queries";
import type { CustomerRow } from "@/features/customers/types";
import type { CustomerFkOption } from "@/features/customers/AddCustomerModal";

const CUSTOMER_TYPES = ["Existing", "New"] as const;

export function EditCustomerModal({
  open,
  onClose,
  customer,
  salespeople = [],
  collectors = [],
  industries = [],
}: {
  open: boolean;
  onClose: () => void;
  customer: CustomerRow | null;
  salespeople?: CustomerFkOption[];
  collectors?: CustomerFkOption[];
  industries?: CustomerFkOption[];
}) {
  const update = useUpdateCustomer();

  if (!customer) return null;

  const [name, setName] = useState(customer.name);
  const [salespersonId, setSalespersonId] = useState(customer.salespersonId);
  const [category, setCategory] = useState(customer.category || CUSTOMER_TIERS[0]);
  const [type, setType] = useState(customer.type || CUSTOMER_TYPES[0]);
  const [industryId, setIndustryId] = useState(customer.industryId || "");
  const [subIndustry, setSubIndustry] = useState(customer.subIndustry || "");
  const [area, setArea] = useState(customer.area || "");
  const [paymentTerms, setPaymentTerms] = useState(customer.paymentTerms || PAYMENT_TERMS[2]);
  const [payZone, setPayZone] = useState(customer.payZone || PAY_ZONES[0]);
  const [collectorId, setCollectorId] = useState(customer.collectorId || "");
  const [outstanding, setOutstanding] = useState(String(customer.outstanding ?? ""));
  const [active, setActive] = useState(customer.active);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !salespersonId) return;

    try {
      await update.mutateAsync({
        id: customer.id,
        patch: {
          name: name.trim(),
          salespersonId,
          category,
          type,
          industryId: industryId || null,
          subIndustry: subIndustry.trim() || null,
          area: area || null,
          paymentTerms,
          payZone,
          collectorId: collectorId || null,
          outstanding: outstanding.trim() ? Number(outstanding) : undefined,
          active,
        },
      });
      onClose();
    } catch {
      // Surfaced inline below via update.error.
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-brand" />
          <span>Edit Customer: {customer.name}</span>
        </div>
      }
      description="Update customer details and salesperson allocation"
      maxWidth="max-w-lg"
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onClose} type="button">
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={!name.trim() || !salespersonId || update.isPending}
          >
            {update.isPending ? "Saving…" : "Save Changes"}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
        <div>
          <label className="text-xs font-semibold text-muted uppercase tracking-wider block mb-1">
            Customer Name *
          </label>
          <Input
            required
            placeholder="Company name…"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-3 gap-2.5">
          <div>
            <label className="text-xs font-semibold text-muted uppercase tracking-wider block mb-1">
              Category
            </label>
            <Select value={category} onChange={(e) => setCategory(e.target.value)}>
              {CUSTOMER_TIERS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label className="text-xs font-semibold text-muted uppercase tracking-wider block mb-1">
              Type
            </label>
            <Select value={type} onChange={(e) => setType(e.target.value)}>
              {CUSTOMER_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label className="text-xs font-semibold text-muted uppercase tracking-wider block mb-1">
              Territory / Area
            </label>
            <Select value={area} onChange={(e) => setArea(e.target.value)}>
              {INDUSTRIAL_AREAS.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <div>
            <label className="text-xs font-semibold text-muted uppercase tracking-wider block mb-1">
              Salesperson *
            </label>
            {salespeople.length === 0 ? (
              <p className="text-[11px] text-muted">No salespersons available.</p>
            ) : (
              <Select value={salespersonId} onChange={(e) => setSalespersonId(e.target.value)}>
                {salespeople.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <div>
            <label className="text-xs font-semibold text-muted uppercase tracking-wider block mb-1">
              Collector
            </label>
            {collectors.length === 0 ? (
              <p className="text-[11px] text-muted">No collectors available.</p>
            ) : (
              <Select value={collectorId} onChange={(e) => setCollectorId(e.target.value)}>
                <option value="">— None —</option>
                {collectors.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            )}
          </div>
          <div>
            <label className="text-xs font-semibold text-muted uppercase tracking-wider block mb-1">
              Industry
            </label>
            {industries.length === 0 ? (
              <p className="text-[11px] text-muted">No industries available.</p>
            ) : (
              <Select value={industryId} onChange={(e) => setIndustryId(e.target.value)}>
                <option value="">— None —</option>
                {industries.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name}
                  </option>
                ))}
              </Select>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <div>
            <label className="text-xs font-semibold text-muted uppercase tracking-wider block mb-1">
              Payment Terms
            </label>
            <Select value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)}>
              {PAYMENT_TERMS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label className="text-xs font-semibold text-muted uppercase tracking-wider block mb-1">
              Payment Risk Zone
            </label>
            <Select value={payZone} onChange={(e) => setPayZone(e.target.value)}>
              {PAY_ZONES.map((z) => (
                <option key={z} value={z}>
                  {z}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <div>
            <label className="text-xs font-semibold text-muted uppercase tracking-wider block mb-1">
              Outstanding ₹
            </label>
            <Input
              type="number"
              step="0.01"
              value={outstanding}
              onChange={(e) => setOutstanding(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted uppercase tracking-wider block mb-1">
              Sub-industry
            </label>
            <Input value={subIndustry} onChange={(e) => setSubIndustry(e.target.value)} />
          </div>
        </div>

        <label className="flex items-center gap-2 text-xs font-semibold text-ink pt-1 cursor-pointer">
          <input
            type="checkbox"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
            className="h-4 w-4 rounded accent-brand cursor-pointer"
          />
          Active Account
        </label>

        {update.isError && (
          <p className="text-[11.5px] font-medium text-red">
            {update.error instanceof ApiError ? update.error.message : "Failed to save customer."}
          </p>
        )}
      </form>
    </Dialog>
  );
}
