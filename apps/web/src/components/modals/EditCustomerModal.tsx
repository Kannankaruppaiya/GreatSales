import { useState } from "react";
import { Building2 } from "lucide-react";
import { Button, Dialog, Input, Select } from "../ui";
import {
  CUSTOMER_TIERS,
  PAYMENT_TERMS,
  type CustomerTier,
} from "../../data/constants";
import type { Customer } from "../../data/types";
import { useTrackerStore } from "../../store/trackerStore";

export function EditCustomerModal({
  open,
  onClose,
  customer,
}: {
  open: boolean;
  onClose: () => void;
  customer: Customer | null;
}) {
  const { users, updateCustomer } = useTrackerStore();
  const salespeople = users.filter((u) => u.role === "sales");

  if (!customer) return null;

  const [name, setName] = useState(customer.name);
  const [tier, setTier] = useState<CustomerTier>(customer.tier || "Platinum");
  const [contactName, setContactName] = useState(customer.contactName || "");
  const [phone, setPhone] = useState(customer.phone || customer.mobile || "");
  const [whatsapp, setWhatsapp] = useState(customer.whatsapp || "");
  const [sameAsMobile, setSameAsMobile] = useState(customer.sameAsMobile ?? (!customer.whatsapp || customer.whatsapp === customer.phone));
  const [ownerId, setOwnerId] = useState(customer.ownerId);
  const [paymentTerms, setPaymentTerms] = useState(customer.paymentTerms || PAYMENT_TERMS[2]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    updateCustomer(customer.id, {
      name: name.trim(),
      tier,
      contactName: contactName.trim(),
      phone: phone.trim(),
      whatsapp: sameAsMobile ? phone.trim() : whatsapp.trim(),
      sameAsMobile,
      ownerId,
      collectorId: ownerId,
      paymentTerms,
    });

    onClose();
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
      maxWidth="max-w-md"
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onClose} type="button">
            Cancel
          </Button>
          <Button size="sm" onClick={handleSubmit} disabled={!name.trim()}>
            Save Changes
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

        <div className="grid grid-cols-2 gap-2.5">
          <div>
            <label className="text-xs font-semibold text-muted uppercase tracking-wider block mb-1">
              Contact Person
            </label>
            <Input
              placeholder="e.g. Mr. Sundaram"
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
            />
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
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <div>
            <label className="text-xs font-semibold text-muted uppercase tracking-wider block mb-1">
              Mobile
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

        <div className="grid grid-cols-2 gap-2.5">
          <div>
            <label className="text-xs font-semibold text-muted uppercase tracking-wider block mb-1">
              Category
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
              Salesperson
            </label>
            <Select value={ownerId} onChange={(e) => setOwnerId(e.target.value)}>
              {salespeople.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </Select>
          </div>
        </div>
      </form>
    </Dialog>
  );
}
