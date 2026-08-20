import { useState } from "react";
import { Building2, Plus, Trash2 } from "lucide-react";
import { Button, Dialog, Input, Select } from "../ui";
import {
  CUSTOMER_TIERS,
  INDUSTRIAL_AREAS,
  PAYMENT_TERMS,
  PAY_ZONES,
  type CustomerTier,
  type PayZone,
} from "../../data/constants";
import { useTrackerStore } from "../../store/trackerStore";
import { useMockOwnerId } from "../../lib/mockOwner";

interface ProductRowState {
  principalId: string;
  productId: string;
  price: number;
}

export function AddCustomerModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { principals, products, users, addCustomer } = useTrackerStore();
  const ownerId = useMockOwnerId();
  const salespeople = users.filter((u) => u.role === "sales");

  const [name, setName] = useState("");
  const [tier, setTier] = useState<CustomerTier>("Platinum");
  const [area, setArea] = useState<string>(INDUSTRIAL_AREAS[0]);
  const [contactName, setContactName] = useState("");
  const [phone, setPhone] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [sameAsMobile, setSameAsMobile] = useState(true);
  const [assignedOwnerId, setAssignedOwnerId] = useState(salespeople[0]?.id || ownerId);
  const [paymentTerms, setPaymentTerms] = useState<string>(PAYMENT_TERMS[2]); // 30 Days Credit
  const [payZone, setPayZone] = useState<PayZone>("Green Zone");

  const firstPr = principals[0]?.id || "pr_castrol";
  const firstProd = products.find((p) => p.principalId === firstPr) || products[0];

  const [productRows, setProductRows] = useState<ProductRowState[]>([
    {
      principalId: firstPr,
      productId: firstProd?.id || "",
      price: firstProd?.listPrice || 380,
    },
  ]);

  const handlePrincipalChange = (idx: number, prId: string) => {
    const prods = products.filter((p) => p.principalId === prId);
    const prod = prods[0];
    const updated = [...productRows];
    updated[idx] = {
      principalId: prId,
      productId: prod?.id || "",
      price: prod?.listPrice || 0,
    };
    setProductRows(updated);
  };

  const handleProductChange = (idx: number, prodId: string) => {
    const prod = products.find((p) => p.id === prodId);
    const updated = [...productRows];
    updated[idx].productId = prodId;
    if (prod) updated[idx].price = prod.listPrice || 0;
    setProductRows(updated);
  };

  const handleAddProductRow = () => {
    const prId = principals[0]?.id || "";
    const prods = products.filter((p) => p.principalId === prId);
    const prod = prods[0] || products[0];
    setProductRows([
      ...productRows,
      {
        principalId: prId,
        productId: prod?.id || "",
        price: prod?.listPrice || 0,
      },
    ]);
  };

  const handleRemoveProductRow = (idx: number) => {
    setProductRows(productRows.filter((_, i) => i !== idx));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    addCustomer(
      {
        name: name.trim(),
        division: "LUB",
        tier,
        type: "Existing",
        industry: "Automotive & Heavy Eng",
        area,
        contactName: contactName.trim() || "Manager",
        phone: phone.trim() || "+91 98400 00000",
        whatsapp: sameAsMobile ? phone.trim() : whatsapp.trim(),
        sameAsMobile,
        ownerId: assignedOwnerId,
        collectorId: assignedOwnerId,
        paymentTerms,
        payZone,
        active: true,
      },
      productRows.filter((p) => p.productId).map((p) => ({ productId: p.productId, price: p.price }))
    );

    onClose();
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
      description="Create a client record with tier categorization and initial product mappings"
      maxWidth="max-w-2xl"
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onClose} type="button">
            Cancel
          </Button>
          <Button size="sm" onClick={handleSubmit} disabled={!name.trim()}>
            Create Customer
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        {/* Name & Type */}
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
              Customer Category
            </label>
            <Select value={tier} onChange={(e) => setTier(e.target.value as CustomerTier)}>
              {CUSTOMER_TIERS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
          </div>
        </div>

        {/* Contact, Phone, WhatsApp */}
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="text-xs font-semibold text-muted uppercase tracking-wider block mb-1">
              Contact Person
            </label>
            <Input
              placeholder="e.g. Mr. K. Sundaram"
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
            />
          </div>
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
              WhatsApp
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
        </div>

        {/* Area, Payment Terms, Salesperson */}
        <div className="grid grid-cols-4 gap-3">
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
              Salesperson
            </label>
            <Select value={assignedOwnerId} onChange={(e) => setAssignedOwnerId(e.target.value)}>
              {salespeople.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label className="text-xs font-semibold text-muted uppercase tracking-wider block mb-1">
              Payment Risk Zone
            </label>
            <Select value={payZone} onChange={(e) => setPayZone(e.target.value as PayZone)}>
              {PAY_ZONES.map((z) => (
                <option key={z} value={z}>
                  {z}
                </option>
              ))}
            </Select>
          </div>
        </div>

        {/* Dynamic Product Mapping Rows */}
        <div className="rounded-xl border border-line bg-surface-2 p-3.5 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-ink uppercase tracking-wider">
              Principal & Sub Product Mappings (Optional)
            </span>
            <Button type="button" size="xs" variant="secondary" onClick={handleAddProductRow}>
              <Plus className="h-3 w-3 mr-1" /> Add Product
            </Button>
          </div>

          <div className="space-y-2">
            {productRows.map((row, idx) => {
              const rowProds = products.filter((p) => p.principalId === row.principalId);
              return (
                <div key={idx} className="flex items-center gap-2 text-xs">
                  {/* Principal */}
                  <Select
                    value={row.principalId}
                    onChange={(e) => handlePrincipalChange(idx, e.target.value)}
                    className="w-36"
                  >
                    {principals.map((pr) => (
                      <option key={pr.id} value={pr.id}>
                        {pr.name}
                      </option>
                    ))}
                  </Select>

                  {/* Sub-product */}
                  <Select
                    value={row.productId}
                    onChange={(e) => handleProductChange(idx, e.target.value)}
                    className="flex-1"
                  >
                    {rowProds.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </Select>

                  {/* Agreed Price */}
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="Rate ₹"
                    value={row.price || ""}
                    onChange={(e) => {
                      const updated = [...productRows];
                      updated[idx].price = Number(e.target.value);
                      setProductRows(updated);
                    }}
                    className="w-24 tabular-nums text-right font-bold"
                  />

                  {productRows.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveProductRow(idx)}
                      className="text-muted hover:text-red p-1 cursor-pointer"
                      title="Remove row"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </form>
    </Dialog>
  );
}
