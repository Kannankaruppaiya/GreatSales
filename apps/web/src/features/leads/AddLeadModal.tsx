import { useMemo, useState } from "react";
import { Plus, Target, Trash2 } from "lucide-react";
import { Button, Dialog, Input, Select, Textarea } from "@/components/ui";
import {
  ContactsEditor,
  contactsPayload,
  startingContacts,
} from "@/components/ContactsEditor";
import { DateField } from "@/components/DateField";
import { ConfirmActionModal } from "@/components/modals/ConfirmActionModal";
import { ApiError } from "@/lib/api";
import { INDUSTRIAL_AREAS } from "@/data/constants";
import { useCreateLead } from "@/features/leads/queries";
import { useIndustries } from "@/features/customers/queries";
import { useProducts, flattenProducts } from "@/features/products/queries";
import { useUserDirectory } from "@/features/users/queries";
import { useAuthRole, useAuthUser } from "@/store/auth";
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
  type ContactInput,
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
  salespeople,
  industries,
}: {
  open: boolean;
  onClose: () => void;
  salespeople?: LeadFkOption[];
  industries?: LeadFkOption[];
}) {
  const create = useCreateLead();
  const role = useAuthRole();
  const authUser = useAuthUser();
  const isSales = role === "sales";

  const industriesQuery = useIndustries({ enabled: open });
  const rawIndustries =
    industries !== undefined && industries.length > 0
      ? industries
      : industriesQuery.data;
  const industryOptions = Array.isArray(rawIndustries) ? rawIndustries : [];

  const needsUsersFetch = (salespeople === undefined || salespeople.length === 0) && !isSales;
  const usersQuery = useUserDirectory({ enabled: needsUsersFetch && open });
  const allUsers = useMemo(() => usersQuery.data ?? [], [usersQuery.data]);
  const fetchedSalespeople = useMemo(
    () =>
      allUsers
        .filter((u) => u && (u.roleName === "sales" || u.roleName?.includes("sales")))
        .map((u) => ({ id: u.id, name: u.name })),
    [allUsers],
  );
  const salespersonOptions =
    salespeople && salespeople.length > 0 ? salespeople : fetchedSalespeople;

  const productsQuery = useProducts({}, { enabled: open });
  const catalog = flattenProducts(productsQuery.data);
  const principalOptions = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of catalog) m.set(p.principalId, p.principalName);
    return [...m.entries()].map(([id, name]) => ({ id, name }));
  }, [catalog]);

  const [customerName, setCustomerName] = useState("");
  const [contacts, setContacts] = useState<ContactInput[]>(startingContacts);
  const [area, setArea] = useState<string>(INDUSTRIAL_AREAS[0]);
  const [customArea, setCustomArea] = useState("");
  const [address, setAddress] = useState("");
  const [industryId, setIndustryId] = useState("");
  const [subIndustry, setSubIndustry] = useState("");
  const [division, setDivision] = useState<DivisionValue>("LUB");
  const [tier, setTier] = useState<CustomerCategoryValue>("Platinum");
  const [type, setType] = useState<CustomerTypeValue>("New");
  const [salespersonId, setSalespersonId] = useState("");
  const [stage, setStage] = useState<DealStageValue>("NewEnquiries");
  const [expClose, setExpClose] = useState("");
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

  const [leadProducts, setLeadProducts] = useState<
    (LeadProductInput & { rowId: string })[]
  >([{ rowId: nextRowId(), productName: "", principalId: null, productId: null, qty: 1, unit: null, price: 0, value: 0 }]);

  // No fallback to "the first option in the list" — see
  // CreateSalesOrderModal's reset effect for the incident this class of bug
  // caused: a lead saved without the admin ever touching the field silently
  // took on whoever sorted first alphabetically, active or not.
  const selectedSalespersonId = isSales ? authUser?.id || "" : salespersonId;

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

  const isDirty = Boolean(
    customerName.trim() ||
      contacts.some((c) => c.name.trim() || c.phone?.trim() || c.email?.trim()) ||
      address.trim() ||
      subIndustry.trim() ||
      leadProducts.some((p) => p.productName.trim())
  );

  const resetForm = () => {
    setCustomerName("");
    setContacts(startingContacts());
    setArea(INDUSTRIAL_AREAS[0]);
    setCustomArea("");
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
    if (!customerName.trim() || !selectedSalespersonId) return;

    const products = leadProducts
      .filter((p) => p.productName.trim())
      .map(({ rowId: _rowId, ...p }) => p);

    const effectiveArea = area === "Other" ? (customArea.trim() || "Other") : area;

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
        area: effectiveArea,
        address: address.trim() || null,
        // Omitted entirely when nobody has been named — the schema refuses an
        // empty list, and "no contact yet" is a real state for a cold enquiry.
        ...(contactsPayload(contacts) ? { contacts: contactsPayload(contacts)! } : {}),
        nextFollowUp: null,
        expClose: expClose || null,
        products: products.length > 0 ? products : undefined,
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
            <Target className="h-4.5 w-4.5 text-brand shrink-0" />
            <span>Add New Sales Lead / Prospect</span>
          </div>
        }
        description="Record a new customer opportunity with multi-product requirements."
        maxWidth="max-w-3xl"
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
              disabled={!customerName.trim() || !selectedSalespersonId || create.isPending}
            >
              {create.isPending ? "Creating…" : `Create Lead (${inr(totalDealValue)})`}
            </Button>
          </>
        }
      >
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* Company & Contact */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="lead-company-name"
                className="text-xs font-semibold text-ink block mb-1.5"
              >
                Company Name <span className="text-red font-semibold" aria-hidden="true">*</span>
              </label>
              <Input
                id="lead-company-name"
                required
                placeholder="e.g. Acme Precision Tools Pvt Ltd"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                disabled={create.isPending}
                className="h-9"
              />
            </div>
          </div>

          {/* The people at this account. A plant is worked through more than
              one of them — the purchase manager signs the order, the plant head
              decides the trial — and this form used to offer a single name. */}
          <div>
            <div className="mb-1.5 flex items-baseline justify-between gap-2">
              <span className="text-xs font-semibold text-ink">Key Contact Persons</span>
              <span className="text-2xs text-muted">
                The primary is the one every list and the paperwork name.
              </span>
            </div>
            <ContactsEditor
              value={contacts}
              onChange={setContacts}
              disabled={create.isPending}
            />
          </div>

          {/* Area, Tier, Type & Division */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label
                htmlFor="lead-area"
                className="text-xs font-semibold text-ink block mb-1.5"
              >
                Industrial Area / Hub
              </label>
              <Select
                id="lead-area"
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
            <div>
              <label
                htmlFor="lead-tier"
                className="text-xs font-semibold text-ink block mb-1.5"
              >
                Target Customer Tier
              </label>
              <Select
                id="lead-tier"
                className="w-full"
                selectClassName="w-full h-9"
                value={tier}
                onChange={(e) => setTier(e.target.value as CustomerCategoryValue)}
                disabled={create.isPending}
              >
                {CUSTOMER_CATEGORY_VALUES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <label
                htmlFor="lead-type"
                className="text-xs font-semibold text-ink block mb-1.5"
              >
                Customer Type
              </label>
              <Select
                id="lead-type"
                className="w-full"
                selectClassName="w-full h-9"
                value={type}
                onChange={(e) => setType(e.target.value as CustomerTypeValue)}
                disabled={create.isPending}
              >
                {CUSTOMER_TYPE_VALUES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <label
                htmlFor="lead-division"
                className="text-xs font-semibold text-ink block mb-1.5"
              >
                Division
              </label>
              <Select
                id="lead-division"
                className="w-full"
                selectClassName="w-full h-9"
                value={division}
                onChange={(e) => setDivision(e.target.value as DivisionValue)}
                disabled={create.isPending}
              >
                {DIVISION_VALUES.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          {/* Conditional Custom Area Input if "Other" is picked */}
          {area === "Other" && (
            <div className="rounded-xl border border-brand/30 bg-brand-soft/40 p-3 animate-in fade-in-50 duration-200">
              <label
                htmlFor="lead-custom-area"
                className="text-xs font-semibold text-ink flex items-center justify-between mb-1.5"
              >
                <span>
                  Specify Location / Area Name <span className="text-red font-semibold" aria-hidden="true">*</span>
                </span>
                <span className="text-[11px] text-muted font-normal">e.g. Ennore, Trichy, Salem, Madurai, Ranipet</span>
              </label>
              <Input
                id="lead-custom-area"
                required
                placeholder="Enter specific industrial area / city name…"
                value={customArea}
                onChange={(e) => setCustomArea(e.target.value)}
                disabled={create.isPending}
                className="h-9 bg-surface"
              />
            </div>
          )}

          {/* Assigned Salesperson */}
          <div>
            <label
              htmlFor="lead-salesperson"
              className="text-xs font-semibold text-ink block mb-1.5"
            >
              Assigned Salesperson <span className="text-red font-semibold" aria-hidden="true">*</span>
            </label>
            {isSales ? (
              <div className="h-9 flex items-center font-semibold text-ink px-3 rounded-lg bg-surface-2 border border-line">
                Assigned to you
              </div>
            ) : salespersonOptions.length === 0 ? (
              <p className="text-[11px] text-muted py-2">
                No salespersons yet.
              </p>
            ) : (
              <Select
                id="lead-salesperson"
                className="w-full"
                selectClassName="w-full h-9"
                value={selectedSalespersonId}
                onChange={(e) => setSalespersonId(e.target.value)}
                disabled={create.isPending}
              >
                <option value="">— Select salesperson —</option>
                {salespersonOptions.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </Select>
            )}
          </div>

          {/* Full Site Address */}
          <div>
            <label
              htmlFor="lead-address"
              className="text-xs font-semibold text-ink block mb-1.5"
            >
              Full Site Address
            </label>
            <Textarea
              id="lead-address"
              rows={2}
              placeholder="Plot / unit no., street, industrial estate, city — PIN"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              disabled={create.isPending}
            />
          </div>

          {/* Industry & Sub-industry */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="lead-industry"
                className="text-xs font-semibold text-ink block mb-1.5"
              >
                Industry Segment
              </label>
              <Select
                id="lead-industry"
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
                      : "— Select industry (optional) —"}
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
                htmlFor="lead-subindustry"
                className="text-xs font-semibold text-ink block mb-1.5"
              >
                Sub-Industry Specialization
              </label>
              <Input
                id="lead-subindustry"
                placeholder="e.g. Tier-1 Engine & Transmission"
                value={subIndustry}
                onChange={(e) => setSubIndustry(e.target.value)}
                disabled={create.isPending}
                className="h-9"
              />
            </div>
          </div>

          {/* Initial Stage & Expected Close */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="lead-stage"
                className="text-xs font-semibold text-ink block mb-1.5"
              >
                Initial Pipeline Stage
              </label>
              <Select
                id="lead-stage"
                className="w-full"
                selectClassName="w-full h-9"
                value={stage}
                onChange={(e) => setStage(e.target.value as DealStageValue)}
                disabled={create.isPending}
              >
                {DEAL_STAGE_VALUES.map((s) => (
                  <option key={s} value={s}>
                    {DEAL_STAGE_LABELS[s]}
                  </option>
                ))}
              </Select>
            </div>
            <div className="sm:col-span-2">
              <label
                htmlFor="lead-exp-close"
                className="text-xs font-semibold text-ink block mb-1.5"
              >
                Expected Closure Date
              </label>
              <DateField
                id="lead-exp-close"
                label="Expected closure date"
                value={expClose}
                onChange={setExpClose}
                disabled={create.isPending}
              />
            </div>
          </div>

          {/* Multi-Product Requirement Builder */}
          <div className="space-y-2 rounded-xl border border-line bg-surface-2 p-3.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-ink uppercase tracking-wider">
                Product Requirements &amp; Deal Formulation
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
                        aria-label={`Principal brand for product requirement ${idx + 1}`}
                        className="w-full"
                        selectClassName="w-full h-8 text-xs"
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
                        aria-label={`Product requirement name ${idx + 1}`}
                        placeholder="Product requirement name..."
                        value={p.productName}
                        onChange={(e) => handleProductRowChange(idx, { productName: e.target.value })}
                        className="h-8 text-xs"
                      />
                    </div>
                    <div className="col-span-2">
                      <Input
                        aria-label={`Quantity for line ${idx + 1}`}
                        type="number"
                        min={1}
                        placeholder="Qty"
                        value={p.qty ?? ""}
                        onChange={(e) => handleProductRowChange(idx, { qty: Number(e.target.value) })}
                        className="h-8 text-xs tabular-nums text-center"
                      />
                    </div>
                    <div className="col-span-2">
                      <Input
                        aria-label={`Unit rate for line ${idx + 1}`}
                        type="number"
                        placeholder="Rate"
                        value={p.price ?? ""}
                        onChange={(e) => handleProductRowChange(idx, { price: Number(e.target.value) })}
                        className="h-8 text-xs tabular-nums text-right"
                      />
                    </div>
                    <div className="col-span-1 flex justify-center">
                      {leadProducts.length > 1 && (
                        <button
                          type="button"
                          aria-label={`Remove product line ${idx + 1}`}
                          onClick={() => handleRemoveProductRow(idx)}
                          className="text-muted hover:text-red p-1 cursor-pointer transition-colors"
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
            <p role="alert" className="text-[11.5px] font-medium text-red animate-in fade-in-50">
              {create.error instanceof ApiError ? create.error.message : "Failed to create lead."}
            </p>
          )}
        </form>
      </Dialog>

      {/* Discard confirmation modal if user attempts to exit with unsaved form input */}
      <ConfirmActionModal
        open={showDiscardConfirm}
        onClose={() => setShowDiscardConfirm(false)}
        onConfirm={handleForceClose}
        title="Discard unsaved lead?"
        body="You have entered lead information. Closing now will discard all unsaved changes."
        confirmLabel="Discard Changes"
        destructive
      />
    </>
  );
}
