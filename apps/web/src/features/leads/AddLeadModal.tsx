import { useMemo, useState } from "react";
import { Plus, Target, Trash2 } from "lucide-react";
import { Button, Dialog, Input, Select, Textarea } from "@/components/ui";
import { ApiError } from "@/lib/api";
import { INDUSTRIAL_AREAS } from "@/data/constants";
import { useCreateLead } from "@/features/leads/queries";
import { useProducts, flattenProducts } from "@/features/products/queries";
import {
  DEAL_STAGE_VALUES,
  DEAL_STAGE_LABELS,
  CUSTOMER_CATEGORY_VALUES,
  CUSTOMER_TYPE_VALUES,
  DIVISION_VALUES,
  type DealStageValue,
  type CustomerCategoryValue,
  type CustomerTypeValue,
  type DivisionValue,
  type LeadProductInput,
} from "@/features/leads/types";
import { inr, lakhs } from "@/lib/format";

export interface LeadFkOption {
  id: string;
  name: string;
}

let rowSeq = 0;
function nextRowId() {
  rowSeq += 1;
  return `lp_new_${rowSeq}`;
}

export function AddLeadModal({
  open,
  onClose,
  salespeople = [],
  industries = [],
}: {
  open: boolean;
  onClose: () => void;
  salespeople?: LeadFkOption[];
  industries?: LeadFkOption[];
}) {
  const create = useCreateLead();

  // The product catalog (principals + sub products) has its own dedicated
  // endpoint (see features/products), so unlike salespeople/industries —
  // which have no source but the loaded lead rows — this modal fetches it
  // directly, the same "needsOwnFetch" self-fetch shape CreateSalesOrderModal
  // uses for its product picker.
  const productsQuery = useProducts({}, { enabled: open });
  const catalog = flattenProducts(productsQuery.data);
  const principalOptions = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of catalog) m.set(p.principalId, p.principalName);
    return [...m.entries()].map(([id, name]) => ({ id, name }));
  }, [catalog]);

  const [customerName, setCustomerName] = useState("");
  const [contactName, setContactName] = useState("");
  const [phone, setPhone] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [sameAsMobile, setSameAsMobile] = useState(true);
  const [email, setEmail] = useState("");
  const [area, setArea] = useState<string>(INDUSTRIAL_AREAS[0]);
  const [address, setAddress] = useState("");
  const [industryId, setIndustryId] = useState("");
  const [subIndustry, setSubIndustry] = useState("");
  const [division, setDivision] = useState<DivisionValue>("LUB");
  const [tier, setTier] = useState<CustomerCategoryValue>("Platinum");
  const [type, setType] = useState<CustomerTypeValue>("New");
  const [salespersonId, setSalespersonId] = useState(salespeople[0]?.id || "");
  const [stage, setStage] = useState<DealStageValue>("NewEnquiries");
  const [expClose, setExpClose] = useState("");

  const [leadProducts, setLeadProducts] = useState<
    (LeadProductInput & { rowId: string })[]
  >([{ rowId: nextRowId(), productName: "", principalId: null, productId: null, qty: 1, unit: null, price: 0, value: 0 }]);

  const selectedSalespersonId = salespersonId || salespeople[0]?.id || "";

  const handleAddProductRow = () => {
    setLeadProducts([
      ...leadProducts,
      { rowId: nextRowId(), productName: "", principalId: null, productId: null, qty: 1, unit: null, price: 0, value: 0 },
    ]);
  };

  const handleRemoveProductRow = (idx: number) => {
    setLeadProducts(leadProducts.filter((_, i) => i !== idx));
  };

  const handleProductRowChange = (idx: number, patch: Partial<LeadProductInput>) => {
    const updated = [...leadProducts];
    const row = { ...updated[idx], ...patch };
    row.value = (Number(row.qty) || 0) * (Number(row.price) || 0);
    updated[idx] = row;
    setLeadProducts(updated);
  };

  const handleProductPick = (idx: number, principalId: string) => {
    const options = catalog.filter((p) => p.principalId === principalId);
    const prod = options[0];
    handleProductRowChange(idx, {
      principalId,
      productId: prod?.id ?? null,
      productName: prod?.name ?? "",
      unit: prod?.unit ?? null,
      price: prod?.basePrice ?? 0,
    });
  };

  const totalDealValue = leadProducts.reduce((s, p) => s + (p.value || 0), 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName.trim() || !selectedSalespersonId) return;

    const products = leadProducts
      .filter((p) => p.productName.trim())
      .map(({ rowId, ...p }) => p);

    try {
      await create.mutateAsync({
        customerName: customerName.trim(),
        salespersonId: selectedSalespersonId,
        stage,
        division,
        tier,
        type,
        industryId: industryId || null,
        subIndustry: subIndustry.trim() || null,
        area,
        address: address.trim() || null,
        contactName: contactName.trim() || null,
        phone: phone.trim() || null,
        whatsapp: sameAsMobile ? phone.trim() || null : whatsapp.trim() || null,
        sameAsMobile,
        email: email.trim() || null,
        nextFollowUp: null,
        expClose: expClose || null,
        products: products.length > 0 ? products : undefined,
      });

      setCustomerName("");
      setContactName("");
      setPhone("");
      setWhatsapp("");
      setSameAsMobile(true);
      setEmail("");
      setArea(INDUSTRIAL_AREAS[0]);
      setAddress("");
      setIndustryId("");
      setSubIndustry("");
      setDivision("LUB");
      setTier("Platinum");
      setType("New");
      setStage("NewEnquiries");
      setExpClose("");
      setLeadProducts([
        { rowId: nextRowId(), productName: "", principalId: null, productId: null, qty: 1, unit: null, price: 0, value: 0 },
      ]);
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
          <Target className="h-4 w-4 text-brand" />
          <span>Add New Sales Lead / Prospect</span>
        </div>
      }
      description="Record a new customer opportunity with multi-product requirements"
      maxWidth="max-w-3xl"
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onClose} type="button">
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={!customerName.trim() || !selectedSalespersonId || create.isPending}
          >
            {create.isPending ? "Creating…" : `Create Lead (${inr(totalDealValue)})`}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Company & Contact */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-muted uppercase tracking-wider block mb-1">
              Company Name *
            </label>
            <Input
              required
              placeholder="e.g. Acme Precision Tools Pvt Ltd"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted uppercase tracking-wider block mb-1">
              Key Contact Person
            </label>
            <Input
              placeholder="e.g. Mr. Raja (Purchase Manager)"
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
            />
          </div>
        </div>

        {/* Mobile, WhatsApp & Email */}
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="text-xs font-semibold text-muted uppercase tracking-wider block mb-1">
              Mobile Number
            </label>
            <Input
              placeholder="+91 98400 12345"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted uppercase tracking-wider block mb-1">
              WhatsApp Number
            </label>
            <Input
              disabled={sameAsMobile}
              placeholder="+91 98400 12345"
              value={sameAsMobile ? phone : whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
            />
            <label className="flex items-center gap-1.5 text-[11px] text-muted mt-1 cursor-pointer">
              <input
                type="checkbox"
                checked={sameAsMobile}
                onChange={(e) => setSameAsMobile(e.target.checked)}
                className="h-3 w-3 accent-brand"
              />
              Same as mobile
            </label>
          </div>
          <div>
            <label className="text-xs font-semibold text-muted uppercase tracking-wider block mb-1">
              Email Address
            </label>
            <Input
              type="email"
              placeholder="purchase@acme.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
        </div>

        {/* Area, Tier, Type & Sales Rep */}
        <div className="grid grid-cols-4 gap-3">
          <div>
            <label className="text-xs font-semibold text-muted uppercase tracking-wider block mb-1">
              Industrial Area / Hub
            </label>
            <Select value={area} onChange={(e) => setArea(e.target.value)}>
              {INDUSTRIAL_AREAS.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label className="text-xs font-semibold text-muted uppercase tracking-wider block mb-1">
              Target Customer Tier
            </label>
            {/* `<option value>` is the raw DB enum value; CustomerCategory
                labels already equal their raw values (see features/leads/
                types.ts doc comment), so no separate label map is needed. */}
            <Select value={tier} onChange={(e) => setTier(e.target.value as CustomerCategoryValue)}>
              {CUSTOMER_CATEGORY_VALUES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label className="text-xs font-semibold text-muted uppercase tracking-wider block mb-1">
              Customer Type
            </label>
            <Select value={type} onChange={(e) => setType(e.target.value as CustomerTypeValue)}>
              {CUSTOMER_TYPE_VALUES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label className="text-xs font-semibold text-muted uppercase tracking-wider block mb-1">
              Division
            </label>
            <Select value={division} onChange={(e) => setDivision(e.target.value as DivisionValue)}>
              {DIVISION_VALUES.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold text-muted uppercase tracking-wider block mb-1">
            Assigned Salesperson *
          </label>
          {salespeople.length === 0 ? (
            <p className="text-[11px] text-muted">
              No salespersons yet — add a lead for an existing salesperson first.
            </p>
          ) : (
            <Select value={selectedSalespersonId} onChange={(e) => setSalespersonId(e.target.value)}>
              {salespeople.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </Select>
          )}
        </div>

        {/* Full Site Address */}
        <div>
          <label className="text-xs font-semibold text-muted uppercase tracking-wider block mb-1">
            Full Site Address
          </label>
          <Textarea
            rows={2}
            placeholder="Plot / unit no., street, industrial estate, city — PIN"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
          />
        </div>

        {/* Industry */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-muted uppercase tracking-wider block mb-1">
              Industry Segment
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
              Sub-Industry Specialization
            </label>
            <Input
              placeholder="e.g. Tier-1 Engine & Transmission"
              value={subIndustry}
              onChange={(e) => setSubIndustry(e.target.value)}
            />
          </div>
        </div>

        {/* Initial Stage & Expected Close */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-muted uppercase tracking-wider block mb-1">
              Initial Pipeline Stage
            </label>
            {/* `<option value>` is the raw DealStageValue — DEAL_STAGE_LABELS
                supplies only the visible text (see features/leads/types.ts). */}
            <Select value={stage} onChange={(e) => setStage(e.target.value as DealStageValue)}>
              {DEAL_STAGE_VALUES.map((s) => (
                <option key={s} value={s}>
                  {DEAL_STAGE_LABELS[s]}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label className="text-xs font-semibold text-muted uppercase tracking-wider block mb-1">
              Expected Closure Date
            </label>
            <Input type="date" value={expClose} onChange={(e) => setExpClose(e.target.value)} />
          </div>
        </div>

        {/* Multi-Product Requirement Builder */}
        <div className="space-y-2 rounded-xl border border-line bg-surface-2 p-3.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-ink uppercase tracking-wider">
              Product Requirements & Deal Formulation
            </span>
            <Button type="button" size="xs" variant="secondary" onClick={handleAddProductRow}>
              <Plus className="h-3 w-3 mr-1" /> Add Product Line
            </Button>
          </div>

          {productsQuery.isLoading ? (
            <p className="text-[11px] text-muted">Loading product catalog…</p>
          ) : (
            <div className="space-y-2">
              {leadProducts.map((p, idx) => (
                <div key={p.rowId} className="grid grid-cols-12 gap-2 items-center text-xs">
                  <div className="col-span-3">
                    <Select
                      value={p.principalId ?? ""}
                      onChange={(e) => handleProductPick(idx, e.target.value)}
                    >
                      <option value="">— Principal —</option>
                      {principalOptions.map((pr) => (
                        <option key={pr.id} value={pr.id}>
                          {pr.name}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div className="col-span-4">
                    <Input
                      placeholder="Product requirement name..."
                      value={p.productName}
                      onChange={(e) => handleProductRowChange(idx, { productName: e.target.value })}
                    />
                  </div>
                  <div className="col-span-2">
                    <Input
                      type="number"
                      min={1}
                      placeholder="Qty"
                      value={p.qty ?? ""}
                      onChange={(e) => handleProductRowChange(idx, { qty: Number(e.target.value) })}
                      className="tabular-nums text-center"
                    />
                  </div>
                  <div className="col-span-2">
                    <Input
                      type="number"
                      placeholder="Rate"
                      value={p.price ?? ""}
                      onChange={(e) => handleProductRowChange(idx, { price: Number(e.target.value) })}
                      className="tabular-nums text-right"
                    />
                  </div>
                  <div className="col-span-1 flex justify-center">
                    {leadProducts.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveProductRow(idx)}
                        className="text-muted hover:text-red p-1 cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex justify-between items-center border-t border-line/60 pt-2 text-xs font-bold">
            <span className="text-muted">Total Opportunity Value:</span>
            <span className="text-brand-ink text-sm tabular-nums">
              {inr(totalDealValue)} ({lakhs(totalDealValue)})
            </span>
          </div>
        </div>

        {create.isError && (
          <p className="text-[11.5px] font-medium text-red">
            {create.error instanceof ApiError ? create.error.message : "Failed to create lead."}
          </p>
        )}
      </form>
    </Dialog>
  );
}
