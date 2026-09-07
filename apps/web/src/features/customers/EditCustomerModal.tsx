import { useMemo, useState } from "react";
import { LocationField, type Pin } from "./LocationField";
import { Building2 } from "lucide-react";
import { Button, Dialog, Input, Select } from "@/components/ui";
import { ConfirmActionModal } from "@/components/modals/ConfirmActionModal";
import { ApiError } from "@/lib/api";
import { CUSTOMER_TIERS, INDUSTRIAL_AREAS } from "@/data/constants";
import { useUpdateCustomer, useIndustries } from "@/features/customers/queries";
import { useUsers, flattenUsers } from "@/features/users/queries";
import {
  PAYMENT_TERMS_VALUES,
  PAYMENT_TERMS_LABELS,
  PAY_ZONE_VALUES,
  PAY_ZONE_LABELS,
  type PaymentTermsValue,
  type PayZoneValue,
  type CustomerRow,
} from "@/features/customers/types";
import type { CustomerFkOption } from "@/features/customers/AddCustomerModal";

const CUSTOMER_TYPES = ["Existing", "New"] as const;

export function EditCustomerModal({
  open,
  onClose,
  customer,
  salespeople,
  collectors,
  industries,
}: {
  open: boolean;
  onClose: () => void;
  customer: CustomerRow | null;
  salespeople?: CustomerFkOption[];
  collectors?: CustomerFkOption[];
  industries?: CustomerFkOption[];
}) {
  const update = useUpdateCustomer();

  const industriesQuery = useIndustries({ enabled: open && industries === undefined });
  const rawIndustries =
    industries !== undefined
      ? industries
      : (Array.isArray(industriesQuery.data) ? industriesQuery.data : []);
  const industryOptions = Array.isArray(rawIndustries) ? rawIndustries : [];

  const needsUsersFetch = salespeople === undefined || collectors === undefined;
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

  const fetchedCollectors = useMemo(
    () =>
      allUsers
        .filter((u) => u && u.id && u.name)
        .map((u) => ({ id: u.id, name: u.name })),
    [allUsers],
  );
  const collectorOptions = collectors ?? fetchedCollectors;

  if (!customer) return null;

  const isKnownArea = INDUSTRIAL_AREAS.slice(0, -1).includes((customer.area || "") as any);
  const initialAreaSelect = isKnownArea ? (customer.area || INDUSTRIAL_AREAS[0]) : "Other";
  const initialCustomArea = isKnownArea ? "" : (customer.area === "Other" ? "" : (customer.area || ""));

  const [name, setName] = useState(customer.name);
  const [salespersonId, setSalespersonId] = useState(customer.salespersonId);
  const [category, setCategory] = useState(customer.category || CUSTOMER_TIERS[0]);
  const [type, setType] = useState(customer.type || CUSTOMER_TYPES[0]);
  const [industryId, setIndustryId] = useState(customer.industryId || "");
  const [subIndustry, setSubIndustry] = useState(customer.subIndustry || "");
  const [area, setArea] = useState(initialAreaSelect);
  const [customArea, setCustomArea] = useState(initialCustomArea);
  const [paymentTerms, setPaymentTerms] = useState<PaymentTermsValue>(
    (customer.paymentTerms as PaymentTermsValue) || "Credit30",
  );
  const [payZone, setPayZone] = useState<PayZoneValue>(
    (customer.payZone as PayZoneValue) || "GreenZone",
  );
  const [collectorId, setCollectorId] = useState(customer.collectorId || "");
  const [outstanding, setOutstanding] = useState(String(customer.outstanding ?? ""));
  const [active, setActive] = useState(customer.active);
  const [pin, setPin] = useState<Pin | null>(
    customer.latitude != null && customer.longitude != null
      ? {
          latitude: customer.latitude,
          longitude: customer.longitude,
          locationAccuracyM: customer.locationAccuracyM,
        }
      : null,
  );
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

  const effectiveArea = area === "Other" ? (customArea.trim() || "Other") : area;

  const isDirty = useMemo(() => {
    return (
      name.trim() !== customer.name ||
      salespersonId !== customer.salespersonId ||
      category !== (customer.category || CUSTOMER_TIERS[0]) ||
      type !== (customer.type || CUSTOMER_TYPES[0]) ||
      industryId !== (customer.industryId || "") ||
      subIndustry.trim() !== (customer.subIndustry || "") ||
      effectiveArea !== (customer.area || "") ||
      paymentTerms !== ((customer.paymentTerms as PaymentTermsValue) || "Credit30") ||
      payZone !== ((customer.payZone as PayZoneValue) || "GreenZone") ||
      collectorId !== (customer.collectorId || "") ||
      outstanding.trim() !== String(customer.outstanding ?? "") ||
      (pin?.latitude ?? null) !== customer.latitude ||
      (pin?.longitude ?? null) !== customer.longitude ||
      active !== customer.active
    );
  }, [
    pin,
    customer,
    name,
    salespersonId,
    category,
    type,
    industryId,
    subIndustry,
    effectiveArea,
    paymentTerms,
    payZone,
    collectorId,
    outstanding,
    active,
  ]);

  const handleAttemptClose = () => {
    if (update.isPending) return;
    if (isDirty) {
      setShowDiscardConfirm(true);
    } else {
      onClose();
    }
  };

  const handleForceClose = () => {
    setShowDiscardConfirm(false);
    onClose();
  };

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
          area: effectiveArea || null,
          paymentTerms,
          payZone,
          collectorId: collectorId || null,
          outstanding: outstanding.trim() ? Number(outstanding) : undefined,
          latitude: pin?.latitude ?? null,
          longitude: pin?.longitude ?? null,
          locationAccuracyM: pin?.locationAccuracyM ?? null,
          active,
        },
      });
      onClose();
    } catch {
      // Surfaced inline below via update.error.
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
            <span>Edit Customer: {customer.name}</span>
          </div>
        }
        description="Update customer details, credit settings, and salesperson allocation."
        maxWidth="max-w-xl"
        footer={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={handleAttemptClose}
              type="button"
              disabled={update.isPending}
            >
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
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* Row 1: Company Name */}
          <div>
            <label
              htmlFor="edit-cust-name"
              className="text-xs font-semibold text-ink block mb-1.5"
            >
              Customer Name / Company <span className="text-red font-semibold" aria-hidden="true">*</span>
            </label>
            <Input
              id="edit-cust-name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={update.isPending}
              className="h-9"
            />
          </div>

          {/* Row 2: Category Tier & Customer Type */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label
                htmlFor="edit-cust-category"
                className="text-xs font-semibold text-ink block mb-1.5"
              >
                Customer Tier
              </label>
              <Select
                id="edit-cust-category"
                className="w-full"
                selectClassName="w-full h-9"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                disabled={update.isPending}
              >
                {CUSTOMER_TIERS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <label
                htmlFor="edit-cust-type"
                className="text-xs font-semibold text-ink block mb-1.5"
              >
                Customer Type
              </label>
              <Select
                id="edit-cust-type"
                className="w-full"
                selectClassName="w-full h-9"
                value={type}
                onChange={(e) => setType(e.target.value)}
                disabled={update.isPending}
              >
                {CUSTOMER_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <label
                htmlFor="edit-cust-area"
                className="text-xs font-semibold text-ink block mb-1.5"
              >
                Territory / Area
              </label>
              <Select
                id="edit-cust-area"
                className="w-full"
                selectClassName="w-full h-9"
                value={area}
                onChange={(e) => {
                  setArea(e.target.value);
                  if (e.target.value !== "Other") setCustomArea("");
                }}
                disabled={update.isPending}
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
                htmlFor="edit-cust-custom-area"
                className="text-xs font-semibold text-ink flex items-center justify-between mb-1.5"
              >
                <span>
                  Specify Location / Area Name <span className="text-red font-semibold" aria-hidden="true">*</span>
                </span>
                <span className="text-[11px] text-muted font-normal">e.g. Ennore, Trichy, Salem, Madurai, Ranipet</span>
              </label>
              <Input
                id="edit-cust-custom-area"
                required
                placeholder="Enter specific industrial area / city name…"
                value={customArea}
                onChange={(e) => setCustomArea(e.target.value)}
                disabled={update.isPending}
                className="h-9 bg-surface"
              />
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="edit-cust-salesperson"
                className="text-xs font-semibold text-ink block mb-1.5"
              >
                Salesperson <span className="text-red font-semibold" aria-hidden="true">*</span>
              </label>
              <Select
                id="edit-cust-salesperson"
                className="w-full"
                selectClassName="w-full h-9"
                value={salespersonId}
                onChange={(e) => setSalespersonId(e.target.value)}
                disabled={update.isPending || (usersQuery.isLoading && salespersonOptions.length === 0)}
              >
                <option value="">
                  {usersQuery.isLoading && salespersonOptions.length === 0
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
            </div>
            <div>
              <label
                htmlFor="edit-cust-collector"
                className="text-xs font-semibold text-ink block mb-1.5"
              >
                Collector
              </label>
              <Select
                id="edit-cust-collector"
                className="w-full"
                selectClassName="w-full h-9"
                value={collectorId}
                onChange={(e) => setCollectorId(e.target.value)}
                disabled={update.isPending || (usersQuery.isLoading && collectorOptions.length === 0)}
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
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="edit-cust-industry"
                className="text-xs font-semibold text-ink block mb-1.5"
              >
                Industry
              </label>
              <Select
                id="edit-cust-industry"
                className="w-full"
                selectClassName="w-full h-9"
                value={industryId}
                onChange={(e) => setIndustryId(e.target.value)}
                disabled={update.isPending || (industriesQuery.isLoading && industryOptions.length === 0)}
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
                htmlFor="edit-cust-subindustry"
                className="text-xs font-semibold text-ink block mb-1.5"
              >
                Sub-industry
              </label>
              <Input
                id="edit-cust-subindustry"
                value={subIndustry}
                onChange={(e) => setSubIndustry(e.target.value)}
                disabled={update.isPending}
                className="h-9"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label
                htmlFor="edit-cust-terms"
                className="text-xs font-semibold text-ink block mb-1.5"
              >
                Payment Terms
              </label>
              <Select
                id="edit-cust-terms"
                className="w-full"
                selectClassName="w-full h-9"
                value={paymentTerms}
                onChange={(e) => setPaymentTerms(e.target.value as PaymentTermsValue)}
                disabled={update.isPending}
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
                htmlFor="edit-cust-zone"
                className="text-xs font-semibold text-ink block mb-1.5"
              >
                Payment Risk Zone
              </label>
              <Select
                id="edit-cust-zone"
                className="w-full"
                selectClassName="w-full h-9"
                value={payZone}
                onChange={(e) => setPayZone(e.target.value as PayZoneValue)}
                disabled={update.isPending}
              >
                {PAY_ZONE_VALUES.map((z) => (
                  <option key={z} value={z}>
                    {PAY_ZONE_LABELS[z]}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <div className="flex items-center gap-1.5 mb-1.5">
                <label
                  htmlFor="edit-cust-outstanding"
                  className="text-xs font-semibold text-ink"
                >
                  Outstanding
                </label>
                <span className="text-[11px] text-muted font-normal">(Optional)</span>
              </div>
              <div className="relative flex items-center">
                <span className="pointer-events-none absolute left-3 text-xs font-semibold text-muted select-none">
                  ₹
                </span>
                <Input
                  id="edit-cust-outstanding"
                  type="number"
                  step="0.01"
                  value={outstanding}
                  onChange={(e) => setOutstanding(e.target.value)}
                  disabled={update.isPending}
                  className="h-9 pl-7 tabular-nums text-xs"
                />
              </div>
            </div>
            <div className="sm:col-span-2">
              <div className="flex items-center gap-1.5 mb-1.5">
                <span className="text-xs font-semibold text-ink">Location</span>
                <span className="text-[11px] text-muted font-normal">(Optional)</span>
              </div>
              <LocationField
                value={pin}
                accuracyM={pin?.locationAccuracyM}
                pinnedAt={customer.locationPinnedAt}
                pinnedByName={customer.locationPinnedByName}
                customerName={name.trim() || customer.name}
                onChange={setPin}
                disabled={update.isPending}
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-xs font-medium text-ink pt-1 cursor-pointer">
            <input
              type="checkbox"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
              disabled={update.isPending}
              className="h-3.5 w-3.5 rounded border-line accent-brand"
            />
            <span>Active Account</span>
          </label>

          {update.isError && (
            <p role="alert" className="text-[11.5px] font-medium text-red animate-in fade-in-50">
              {update.error instanceof ApiError ? update.error.message : "Failed to save customer."}
            </p>
          )}
        </form>
      </Dialog>

      {/* Discard confirmation modal if user attempts to exit with unsaved edits */}
      <ConfirmActionModal
        open={showDiscardConfirm}
        onClose={() => setShowDiscardConfirm(false)}
        onConfirm={handleForceClose}
        title="Discard unsaved changes?"
        body="You have modified customer account details. Closing now will discard all unsaved changes."
        confirmLabel="Discard Changes"
        destructive
      />
    </>
  );
}
