import { useState } from "react";
import { Building2 } from "lucide-react";
import { Button, Dialog, Input, Select } from "@/components/ui";
import { ApiError } from "@/lib/api";
import {
  CUSTOMER_TIERS,
  INDUSTRIAL_AREAS,
  PAYMENT_TERMS,
  PAY_ZONES,
} from "@/data/constants";
import { useCreateCustomer } from "@/features/customers/queries";

export interface CustomerFkOption {
  id: string;
  name: string;
}

const CUSTOMER_TYPES = ["Existing", "New"] as const;

export function AddCustomerModal({
  open,
  onClose,
  salespeople = [],
  collectors = [],
  industries = [],
}: {
  open: boolean;
  onClose: () => void;
  salespeople?: CustomerFkOption[];
  collectors?: CustomerFkOption[];
  industries?: CustomerFkOption[];
}) {
  const create = useCreateCustomer();

  const [name, setName] = useState("");
  const [salespersonId, setSalespersonId] = useState("");
  const [category, setCategory] = useState<string>(CUSTOMER_TIERS[0]);
  const [type, setType] = useState<string>(CUSTOMER_TYPES[0]);
  const [industryId, setIndustryId] = useState("");
  const [subIndustry, setSubIndustry] = useState("");
  const [area, setArea] = useState<string>(INDUSTRIAL_AREAS[0]);
  const [paymentTerms, setPaymentTerms] = useState<string>(PAYMENT_TERMS[2]); // 30 Days Credit
  const [payZone, setPayZone] = useState<string>(PAY_ZONES[0]);
  const [collectorId, setCollectorId] = useState("");
  const [outstanding, setOutstanding] = useState<string>("");

  const selectedSalespersonId = salespersonId || salespeople[0]?.id || "";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !selectedSalespersonId) return;

    try {
      await create.mutateAsync({
        name: name.trim(),
        salespersonId: selectedSalespersonId,
        division: "LUB",
        category,
        type,
        industryId: industryId || null,
        subIndustry: subIndustry.trim() || null,
        area,
        paymentTerms,
        payZone,
        outstanding: outstanding.trim() ? Number(outstanding) : undefined,
        collectorId: collectorId || null,
        active: true,
      });

      setName("");
      setSalespersonId("");
      setCategory(CUSTOMER_TIERS[0]);
      setType(CUSTOMER_TYPES[0]);
      setIndustryId("");
      setSubIndustry("");
      setArea(INDUSTRIAL_AREAS[0]);
      setPaymentTerms(PAYMENT_TERMS[2]);
      setPayZone(PAY_ZONES[0]);
      setCollectorId("");
      setOutstanding("");
      onClose();
    } catch {
      // Surfaced inline below via create.error.
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-brand" />
          <span>Add New Customer Account</span>
        </div>
      }
      description="Create a client record and assign it to a salesperson"
      maxWidth="max-w-2xl"
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onClose} type="button">
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={!name.trim() || !selectedSalespersonId || create.isPending}
          >
            {create.isPending ? "Creating…" : "Create Customer"}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2">
            <label className="text-xs font-semibold text-muted uppercase tracking-wider block mb-1">
              Customer / Company Name *
            </label>
            <Input
              required
              placeholder="e.g. Anand Automotive Systems Pvt Ltd"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
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
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="text-xs font-semibold text-muted uppercase tracking-wider block mb-1">
              Salesperson *
            </label>
            {salespeople.length === 0 ? (
              <p className="text-[11px] text-muted">
                No salespersons yet — add a customer for an existing salesperson first.
              </p>
            ) : (
              <Select value={selectedSalespersonId} onChange={(e) => setSalespersonId(e.target.value)}>
                {salespeople.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            )}
          </div>
          <div>
            <label className="text-xs font-semibold text-muted uppercase tracking-wider block mb-1">
              Collector
            </label>
            {collectors.length === 0 ? (
              <p className="text-[11px] text-muted">No collectors yet.</p>
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
              Customer Type
            </label>
            <Select value={type} onChange={(e) => setType(e.target.value)}>
              {CUSTOMER_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="text-xs font-semibold text-muted uppercase tracking-wider block mb-1">
              Industry
            </label>
            {industries.length === 0 ? (
              <p className="text-[11px] text-muted">No industries yet.</p>
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
          <div>
            <label className="text-xs font-semibold text-muted uppercase tracking-wider block mb-1">
              Sub-industry
            </label>
            <Input
              placeholder="e.g. Tier-1 Engine & Transmission"
              value={subIndustry}
              onChange={(e) => setSubIndustry(e.target.value)}
            />
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

        <div className="grid grid-cols-4 gap-3">
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
          <div className="col-span-2">
            <label className="text-xs font-semibold text-muted uppercase tracking-wider block mb-1">
              Opening Outstanding ₹ (Optional)
            </label>
            <Input
              type="number"
              step="0.01"
              placeholder="e.g. 0"
              value={outstanding}
              onChange={(e) => setOutstanding(e.target.value)}
            />
          </div>
        </div>

        {create.isError && (
          <p className="text-[11.5px] font-medium text-red">
            {create.error instanceof ApiError ? create.error.message : "Failed to create customer."}
          </p>
        )}
      </form>
    </Dialog>
  );
}
