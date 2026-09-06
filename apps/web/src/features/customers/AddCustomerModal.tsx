import { useMemo, useState } from "react";
import { Building2 } from "lucide-react";
import { Button, Dialog, Input, Select } from "@/components/ui";
import { ConfirmActionModal } from "@/components/modals/ConfirmActionModal";
import { ApiError } from "@/lib/api";
import { CUSTOMER_TIERS, INDUSTRIAL_AREAS } from "@/data/constants";
import {
  PAYMENT_TERMS_VALUES,
  PAYMENT_TERMS_LABELS,
  PAY_ZONE_VALUES,
  PAY_ZONE_LABELS,
  type PaymentTermsValue,
  type PayZoneValue,
} from "@/features/customers/types";
import { useCreateCustomer, useIndustries } from "@/features/customers/queries";
import { useUsers, flattenUsers } from "@/features/users/queries";
import { useAuthRole, useAuthUser } from "@/store/auth";

export interface CustomerFkOption {
  id: string;
  name: string;
}

const CUSTOMER_TYPES = ["Existing", "New"] as const;

export function AddCustomerModal({
  open,
  onClose,
  salespeople,
  collectors,
  industries,
}: {
  open: boolean;
  onClose: () => void;
  salespeople?: CustomerFkOption[];
  collectors?: CustomerFkOption[];
  industries?: CustomerFkOption[];
}) {
  const create = useCreateCustomer();
  const role = useAuthRole();
  const authUser = useAuthUser();
  const isSales = role === "sales";

  const industriesQuery = useIndustries({ enabled: open && industries === undefined });
  const rawIndustries =
    industries !== undefined
      ? industries
      : (Array.isArray(industriesQuery.data) ? industriesQuery.data : []);
  const industryOptions = Array.isArray(rawIndustries) ? rawIndustries : [];

  const needsUsersFetch = salespeople === undefined && !isSales;
  const usersQuery = useUsers({}, { enabled: needsUsersFetch && open });
  const allUsers = useMemo(() => flattenUsers(usersQuery.data), [usersQuery.data]);

  const fetchedSalespeople = useMemo(
    () =>
      allUsers
        .filter((u) => u && (u.roleName === "sales" || u.roleName?.includes("sales")))
        .map((u) => ({ id: u.id, name: u.name })),
    [allUsers],
  );
  const salespersonOptions = salespeople ?? fetchedSalespeople;
  const salespeopleLoading = needsUsersFetch && usersQuery.isLoading && salespersonOptions.length === 0;

  const fetchedCollectors = useMemo(
    () =>
      allUsers
        .filter((u) => u && u.id && u.name)
        .map((u) => ({ id: u.id, name: u.name })),
    [allUsers],
  );
  const collectorOptions = collectors ?? fetchedCollectors;

  const [name, setName] = useState("");
  const [contactName, setContactName] = useState("");
  const [phone, setPhone] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [salespersonId, setSalespersonId] = useState("");
  const [category, setCategory] = useState<string>(CUSTOMER_TIERS[0]);
  const [type, setType] = useState<string>(CUSTOMER_TYPES[0]);
  const [industryId, setIndustryId] = useState("");
  const [subIndustry, setSubIndustry] = useState("");
  const [area, setArea] = useState<string>(INDUSTRIAL_AREAS[0]);
  const [customArea, setCustomArea] = useState("");
  const [paymentTerms, setPaymentTerms] = useState<PaymentTermsValue>("Credit30");
  const [payZone, setPayZone] = useState<PayZoneValue>("GreenZone");
  const [collectorId, setCollectorId] = useState("");
  const [outstanding, setOutstanding] = useState<string>("");
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

  const selectedSalespersonId = isSales
    ? authUser?.id || ""
    : salespersonId || salespersonOptions[0]?.id || "";

  const isDirty = Boolean(
    name.trim() ||
      contactName.trim() ||
      phone.trim() ||
      whatsapp.trim() ||
      outstanding.trim() ||
      subIndustry.trim() ||
      (area === "Other" && customArea.trim())
  );

  const resetForm = () => {
    setName("");
    setContactName("");
    setPhone("");
    setWhatsapp("");
    setSalespersonId("");
    setCategory(CUSTOMER_TIERS[0]);
    setType(CUSTOMER_TYPES[0]);
    setIndustryId("");
    setSubIndustry("");
    setArea(INDUSTRIAL_AREAS[0]);
    setCustomArea("");
    setPaymentTerms("Credit30");
    setPayZone("GreenZone");
    setCollectorId("");
    setOutstanding("");
    setShowDiscardConfirm(false);
  };

  const handleAttemptClose = () => {
    if (create.isPending) return;
    if (isDirty) {
      setShowDiscardConfirm(true);
    } else {
      resetForm();
      onClose();
    }
  };

  const handleForceClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !selectedSalespersonId) return;

    const effectiveArea = area === "Other" ? (customArea.trim() || "Other") : area;

    try {
      await create.mutateAsync({
        name: name.trim(),
        salespersonId: selectedSalespersonId,
        division: "LUB",
        category,
        type,
        industryId: industryId || null,
        subIndustry: subIndustry.trim() || null,
        area: effectiveArea,
        paymentTerms,
        payZone,
        outstanding: outstanding.trim() ? Number(outstanding) : undefined,
        collectorId: collectorId || null,
        active: true,
        contactName: contactName.trim() || null,
        phone: phone.trim() || null,
        whatsapp: whatsapp.trim() || (phone.trim() || null),
      });

      resetForm();
      onClose();
    } catch {
      // Surfaced inline below via create.error.
    }
  };

  return (
    <>
      <Dialog
        open={open}
        onClose={handleAttemptClose}
        title={
          <div className="flex items-center gap-2">
            <Building2 className="h-4.5 w-4.5 text-brand shrink-0" />
            <span>Add New Customer Account</span>
          </div>
        }
        description="Create a client record and assign it to a salesperson."
        maxWidth="max-w-2xl"
        footer={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={handleAttemptClose}
              type="button"
              disabled={create.isPending}
            >
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
          {/* Row 1: Company Name & Category */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label
                htmlFor="cust-name"
                className="text-xs font-semibold text-ink block mb-1.5"
              >
                Customer / Company Name <span className="text-red font-semibold" aria-hidden="true">*</span>
              </label>
              <Input
                id="cust-name"
                required
                placeholder="e.g. Anand Automotive Systems Pvt Ltd"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={create.isPending}
                className="h-9"
              />
            </div>
            <div>
              <label
                htmlFor="cust-category"
                className="text-xs font-semibold text-ink block mb-1.5"
              >
                Category
              </label>
              <Select
                id="cust-category"
                className="w-full"
                selectClassName="w-full h-9"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                disabled={create.isPending}
              >
                {CUSTOMER_TIERS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          {/* Row 2: Contact Person, Mobile, WhatsApp */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label
                htmlFor="cust-contact"
                className="text-xs font-semibold text-ink block mb-1.5"
              >
                Contact Person
              </label>
              <Input
                id="cust-contact"
                placeholder="e.g. Priya Ramesh"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                disabled={create.isPending}
                className="h-9"
              />
            </div>
            <div>
              <label
                htmlFor="cust-phone"
                className="text-xs font-semibold text-ink block mb-1.5"
              >
                Mobile Number
              </label>
              <Input
                id="cust-phone"
                placeholder="10-digit mobile"
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value);
                  if (!whatsapp || whatsapp === phone) setWhatsapp(e.target.value);
                }}
                disabled={create.isPending}
                className="h-9"
              />
            </div>
            <div>
              <label
                htmlFor="cust-whatsapp"
                className="text-xs font-semibold text-ink block mb-1.5"
              >
                WhatsApp Number
              </label>
              <Input
                id="cust-whatsapp"
                placeholder="WhatsApp number"
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                disabled={create.isPending}
                className="h-9"
              />
            </div>
          </div>

          {/* Row 3: Salesperson, Collector, Customer Type */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label
                htmlFor="cust-salesperson"
                className="text-xs font-semibold text-ink block mb-1.5"
              >
                Salesperson <span className="text-red font-semibold" aria-hidden="true">*</span>
              </label>
              {isSales ? (
                <div className="h-9 flex items-center font-semibold text-ink px-3 rounded-lg bg-surface-2 border border-line">
                  Assigned to you
                </div>
              ) : (
                <Select
                  id="cust-salesperson"
                  className="w-full"
                  selectClassName="w-full h-9"
                  value={selectedSalespersonId}
                  onChange={(e) => setSalespersonId(e.target.value)}
                  disabled={create.isPending || salespeopleLoading || salespersonOptions.length === 0}
                >
                  <option value="">
                    {salespeopleLoading
                      ? "Loading salespersons…"
                      : salespersonOptions.length === 0
                        ? "— No salespersons yet —"
                        : "— Select salesperson —"}
                  </option>
                  {salespersonOptions.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </Select>
              )}
            </div>
            <div>
              <label
                htmlFor="cust-collector"
                className="text-xs font-semibold text-ink block mb-1.5"
              >
                Collector
              </label>
              <Select
                id="cust-collector"
                className="w-full"
                selectClassName="w-full h-9"
                value={collectorId}
                onChange={(e) => setCollectorId(e.target.value)}
                disabled={create.isPending || (usersQuery.isLoading && collectorOptions.length === 0)}
              >
                <option value="">
                  {usersQuery.isLoading && collectorOptions.length === 0
                    ? "Loading collectors…"
                    : collectorOptions.length === 0
                      ? "— No collectors available —"
                      : "— Select collector (optional) —"}
                </option>
                {collectorOptions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <label
                htmlFor="cust-type"
                className="text-xs font-semibold text-ink block mb-1.5"
              >
                Customer Type
              </label>
              <Select
                id="cust-type"
                className="w-full"
                selectClassName="w-full h-9"
                value={type}
                onChange={(e) => setType(e.target.value)}
                disabled={create.isPending}
              >
                {CUSTOMER_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          {/* Row 4: Industry, Sub-industry, Territory */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label
                htmlFor="cust-industry"
                className="text-xs font-semibold text-ink block mb-1.5"
              >
                Industry
              </label>
              <Select
                id="cust-industry"
                className="w-full"
                selectClassName="w-full h-9"
                value={industryId}
                onChange={(e) => setIndustryId(e.target.value)}
                disabled={create.isPending || (industriesQuery.isLoading && industryOptions.length === 0)}
              >
                <option value="">
                  {industriesQuery.isLoading && industryOptions.length === 0
                    ? "Loading industries…"
                    : industryOptions.length === 0
                      ? "— No industries yet —"
                      : "— Select industry —"}
                </option>
                {industryOptions.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <label
                htmlFor="cust-subindustry"
                className="text-xs font-semibold text-ink block mb-1.5"
              >
                Sub-industry
              </label>
              <Input
                id="cust-subindustry"
                placeholder="e.g. Tier-1 Engine & Transmission"
                value={subIndustry}
                onChange={(e) => setSubIndustry(e.target.value)}
                disabled={create.isPending}
                className="h-9"
              />
            </div>
            <div>
              <label
                htmlFor="cust-area"
                className="text-xs font-semibold text-ink block mb-1.5"
              >
                Territory / Area
              </label>
              <Select
                id="cust-area"
                className="w-full"
                selectClassName="w-full h-9"
                value={area}
                onChange={(e) => {
                  setArea(e.target.value);
                  if (e.target.value !== "Other") setCustomArea("");
                }}
                disabled={create.isPending}
              >
                {INDUSTRIAL_AREAS.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          {/* Conditional Custom Area Input if "Other" is picked */}
          {area === "Other" && (
            <div className="rounded-xl border border-brand/30 bg-brand-soft/40 p-3 animate-in fade-in-50 duration-200">
              <label
                htmlFor="cust-custom-area"
                className="text-xs font-semibold text-ink flex items-center justify-between mb-1.5"
              >
                <span>
                  Specify Location / Area Name <span className="text-red font-semibold" aria-hidden="true">*</span>
                </span>
                <span className="text-[11px] text-muted font-normal">e.g. Ennore, Trichy, Salem, Madurai, Ranipet</span>
              </label>
              <Input
                id="cust-custom-area"
                required
                placeholder="Enter specific industrial area / city name…"
                value={customArea}
                onChange={(e) => setCustomArea(e.target.value)}
                disabled={create.isPending}
                className="h-9 bg-surface"
              />
            </div>
          )}

          {/* Row 5: Payment Terms, Payment Risk Zone, Outstanding */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label
                htmlFor="cust-payment-terms"
                className="text-xs font-semibold text-ink block mb-1.5"
              >
                Payment Terms
              </label>
              <Select
                id="cust-payment-terms"
                className="w-full"
                selectClassName="w-full h-9"
                value={paymentTerms}
                onChange={(e) => setPaymentTerms(e.target.value as PaymentTermsValue)}
                disabled={create.isPending}
              >
                {PAYMENT_TERMS_VALUES.map((t) => (
                  <option key={t} value={t}>
                    {PAYMENT_TERMS_LABELS[t]}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <label
                htmlFor="cust-pay-zone"
                className="text-xs font-semibold text-ink block mb-1.5"
              >
                Payment Risk Zone
              </label>
              <Select
                id="cust-pay-zone"
                className="w-full"
                selectClassName="w-full h-9"
                value={payZone}
                onChange={(e) => setPayZone(e.target.value as PayZoneValue)}
                disabled={create.isPending}
              >
                {PAY_ZONE_VALUES.map((z) => (
                  <option key={z} value={z}>
                    {PAY_ZONE_LABELS[z]}
                  </option>
                ))}
              </Select>
            </div>
            <div className="sm:col-span-2">
              <div className="flex items-center gap-1.5 mb-1.5">
                <label
                  htmlFor="cust-outstanding"
                  className="text-xs font-semibold text-ink"
                >
                  Opening Outstanding
                </label>
                <span className="text-[11px] text-muted font-normal">(Optional)</span>
              </div>
              <div className="relative flex items-center">
                <span className="pointer-events-none absolute left-3 text-xs font-semibold text-muted select-none">
                  ₹
                </span>
                <Input
                  id="cust-outstanding"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={outstanding}
                  onChange={(e) => setOutstanding(e.target.value)}
                  disabled={create.isPending}
                  className="h-9 pl-7 tabular-nums text-xs"
                />
              </div>
            </div>
          </div>

          {create.isError && (
            <p role="alert" className="text-[11.5px] font-medium text-red animate-in fade-in-50">
              {create.error instanceof ApiError ? create.error.message : "Failed to create customer."}
            </p>
          )}
        </form>
      </Dialog>

      {/* Discard confirmation modal if user attempts to exit with unsaved form input */}
      <ConfirmActionModal
        open={showDiscardConfirm}
        onClose={() => setShowDiscardConfirm(false)}
        onConfirm={handleForceClose}
        title="Discard unsaved customer?"
        body="You have entered customer account details. Closing now will discard all unsaved changes."
        confirmLabel="Discard Changes"
        destructive
      />
    </>
  );
}
