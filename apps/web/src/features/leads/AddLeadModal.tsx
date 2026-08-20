import { useState } from "react";
import { Plus, Target, Trash2 } from "lucide-react";
import { Button, Dialog, Input, Select, Textarea } from "@/components/ui";
import {
  CUSTOMER_TIERS,
  DEAL_STAGES,
  INDUSTRIAL_AREAS,
  INDUSTRY_TAXONOMY,
  type CustomerTier,
  type DealStage,
} from "@/data/constants";
import { inr, lakhs } from "@/lib/format";
import type { LeadProduct } from "@/data/types";
import { useTrackerStore } from "@/store/trackerStore";
import { useMockOwnerId } from "@/lib/mockOwner";

export function AddLeadModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { principals, products, users, addLead } = useTrackerStore();
  const ownerId = useMockOwnerId();
  const salespeople = users.filter((u) => u.role === "sales");

  const [name, setName] = useState("");
  const [contactName, setContactName] = useState("");
  const [phone, setPhone] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [sameAsMobile, setSameAsMobile] = useState(true);
  const [email, setEmail] = useState("");
  const [area, setArea] = useState<string>(INDUSTRIAL_AREAS[0]);
  const [address, setAddress] = useState("");
  const [industry, setIndustry] = useState<string>(Object.keys(INDUSTRY_TAXONOMY)[0]);
  const [subIndustry, setSubIndustry] = useState<string>(INDUSTRY_TAXONOMY[Object.keys(INDUSTRY_TAXONOMY)[0]][0]);
  const [tier, setTier] = useState<CustomerTier>("Platinum");
  const [assignedOwnerId, setAssignedOwnerId] = useState(salespeople[0]?.id || ownerId);
  const [stage, setStage] = useState<DealStage>("New Enquiries");
  const [expClose, setExpClose] = useState("");
  const [initialRemark, setInitialRemark] = useState("");

  const [leadProducts, setLeadProducts] = useState<LeadProduct[]>([
    {
      id: `lp_${Date.now()}_1`,
      principalId: principals[0]?.id || "pr_castrol",
      name: products[0]?.name || "Product",
      qty: 100,
      unit: "Ltr",
      price: products[0]?.listPrice || 380,
      value: (100) * (products[0]?.listPrice || 380),
    },
  ]);

  const handleIndustryChange = (ind: string) => {
    setIndustry(ind);
    const subs = INDUSTRY_TAXONOMY[ind] || [];
    setSubIndustry(subs[0] || "");
  };

  const handleAddProductRow = () => {
    const pr = principals[0];
    const prod = products.find((p) => p.principalId === pr.id) || products[0];
    setLeadProducts([
      ...leadProducts,
      {
        id: `lp_${Date.now()}_${leadProducts.length + 1}`,
        principalId: pr.id,
        name: prod?.name || "Product",
        qty: 50,
        unit: prod?.unit || "Ltr",
        price: prod?.listPrice || 400,
        value: 50 * (prod?.listPrice || 400),
      },
    ]);
  };

  const handleRemoveProductRow = (idx: number) => {
    setLeadProducts(leadProducts.filter((_, i) => i !== idx));
  };

  const handleProductRowChange = (idx: number, field: keyof LeadProduct, val: any) => {
    const updated = [...leadProducts];
    const row = { ...updated[idx], [field]: val };
    if (field === "principalId") {
      const prod = products.find((p) => p.principalId === val);
      if (prod) {
        row.name = prod.name;
        row.price = prod.listPrice;
        row.unit = prod.unit;
      }
    }
    row.value = (Number(row.qty) || 0) * (Number(row.price) || 0);
    updated[idx] = row;
    setLeadProducts(updated);
  };

  const totalDealValue = leadProducts.reduce((s, p) => s + p.value, 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    addLead(
      {
        name: name.trim(),
        division: "LUB",
        contactName: contactName.trim() || "Contact Person",
        phone: phone.trim() || "+91 98400 00000",
        whatsapp: sameAsMobile ? phone.trim() : whatsapp.trim(),
        email: email.trim() || undefined,
        sameAsMobile,
        ownerId: assignedOwnerId,
        stage,
        industry,
        subIndustry,
        area,
        address: address.trim() || undefined,
        tier,
        products: leadProducts,
        nextFollowUp: null,
        expClose: expClose || null,
      },
      initialRemark.trim() || undefined
    );

    onClose();
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
          <Button size="sm" onClick={handleSubmit} disabled={!name.trim()}>
            Create Lead ({inr(totalDealValue)})
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
              value={name}
              onChange={(e) => setName(e.target.value)}
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

        {/* Area, Tier & Sales Rep */}
        <div className="grid grid-cols-3 gap-3">
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
            <Select value={tier} onChange={(e) => setTier(e.target.value as CustomerTier)}>
              {CUSTOMER_TIERS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label className="text-xs font-semibold text-muted uppercase tracking-wider block mb-1">
              Assigned Salesperson
            </label>
            <Select value={assignedOwnerId} onChange={(e) => setAssignedOwnerId(e.target.value)}>
              {salespeople.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </Select>
          </div>
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

        {/* Industry Taxonomy */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-muted uppercase tracking-wider block mb-1">
              Industry Segment
            </label>
            <Select value={industry} onChange={(e) => handleIndustryChange(e.target.value)}>
              {Object.keys(INDUSTRY_TAXONOMY).map((ind) => (
                <option key={ind} value={ind}>
                  {ind}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label className="text-xs font-semibold text-muted uppercase tracking-wider block mb-1">
              Sub-Industry Specialization
            </label>
            <Select value={subIndustry} onChange={(e) => setSubIndustry(e.target.value)}>
              {(INDUSTRY_TAXONOMY[industry] || []).map((sub) => (
                <option key={sub} value={sub}>
                  {sub}
                </option>
              ))}
            </Select>
          </div>
        </div>

        {/* Initial Stage & Expected Close */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-muted uppercase tracking-wider block mb-1">
              Initial Pipeline Stage
            </label>
            <Select value={stage} onChange={(e) => setStage(e.target.value as DealStage)}>
              {DEAL_STAGES.map((s) => (
                <option key={s} value={s}>
                  {s}
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

          <div className="space-y-2">
            {leadProducts.map((p, idx) => (
              <div key={p.id || idx} className="grid grid-cols-12 gap-2 items-center text-xs">
                <div className="col-span-3">
                  <Select
                    value={p.principalId}
                    onChange={(e) => handleProductRowChange(idx, "principalId", e.target.value)}
                  >
                    {principals.map((pr) => (
                      <option key={pr.id} value={pr.id}>
                        {pr.name}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="col-span-4">
                  <Input
                    placeholder="Product requirement name..."
                    value={p.name}
                    onChange={(e) => handleProductRowChange(idx, "name", e.target.value)}
                  />
                </div>
                <div className="col-span-2">
                  <Input
                    type="number"
                    min={1}
                    placeholder="Qty"
                    value={p.qty}
                    onChange={(e) => handleProductRowChange(idx, "qty", Number(e.target.value))}
                    className="tabular-nums text-center"
                  />
                </div>
                <div className="col-span-2">
                  <Input
                    type="number"
                    placeholder="Rate"
                    value={p.price}
                    onChange={(e) => handleProductRowChange(idx, "price", Number(e.target.value))}
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

          <div className="flex justify-between items-center border-t border-line/60 pt-2 text-xs font-bold">
            <span className="text-muted">Total Opportunity Value:</span>
            <span className="text-brand-ink text-sm tabular-nums">
              {inr(totalDealValue)} ({lakhs(totalDealValue)})
            </span>
          </div>
        </div>

        {/* Initial Remark */}
        <div>
          <label className="text-xs font-semibold text-muted uppercase tracking-wider block mb-1">
            Initial Discussion Note / Observation (optional)
          </label>
          <Textarea
            rows={2}
            placeholder="e.g. Visited plant, met GM Purchase, initial sample required..."
            value={initialRemark}
            onChange={(e) => setInitialRemark(e.target.value)}
          />
        </div>
      </form>
    </Dialog>
  );
}
