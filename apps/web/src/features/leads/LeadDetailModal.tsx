import { useEffect, useState } from "react";
import { Plus, X } from "lucide-react";
import { Button, Dialog, Input, Select } from "@/components/ui";
import { DateField } from "@/components/DateField";
import {
  ContactsEditor,
  contactsPayload,
  startingContacts,
} from "@/components/ContactsEditor";
import { ApiError } from "@/lib/api";
import { inr } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useAuthRole } from "@/store/auth";
import { useDeleteLead, useUpdateLead } from "@/features/leads/queries";
import { useProducts, flattenProducts } from "@/features/products/queries";
import { usePrincipals } from "@/features/products/queries";
import { useIndustries } from "@/features/customers/queries";
import { useUserDirectory } from "@/features/users/queries";
import { DeleteAction } from "@/components/modals/DeleteAction";
import { RemarksPanel } from "@/features/remarks/RemarksPanel";
import { AttachmentsPanel } from "@/features/attachments/AttachmentsPanel";
import {
  DEAL_STAGE_VALUES,
  DEAL_STAGE_LABELS,
  CUSTOMER_CATEGORY_VALUES,
  CUSTOMER_TYPE_VALUES,
  DIVISION_VALUES,
  type DealStageValue,
  type LeadProductInput,
  type LeadRow,
  type ContactInput,
} from "@/features/leads/types";

/**
 * A lead, as it is worked — not as it was first written down.
 *
 * This modal used to edit three fields: the stage, the next follow-up and the
 * expected close. Everything else about a deal was fixed at the moment the
 * enquiry was typed. The contact leaves, the grade gets decided, the address
 * turns out to be the other plant, the customer asks for twice the quantity at
 * a different price — and none of it could be recorded, although the API had
 * accepted every one of those fields all along. Ten leads in the Promech
 * workspace carry no tier, no division, no type and no address, and there was
 * no way in the product to give them one.
 *
 * The line items are the sharpest case. A pipeline with stages called
 * "Proposals & Price Quote" and "Negotiation / Oral Confirmation" is one where
 * quantity and price ARE the conversation, and the only way to correct either
 * was to delete the lead and type it again — losing its remarks, its files and
 * its stage history with it.
 */

let rowSeq = 0;
const nextRowId = () => `row_${++rowSeq}`;

type ProductRow = LeadProductInput & { rowId: string };

const emptyRow = (): ProductRow => ({
  rowId: nextRowId(),
  productName: "",
  principalId: null,
  productId: null,
  qty: 1,
  unit: null,
  price: 0,
  value: 0,
});

/**
 * One titled block of fields.
 *
 * Seventeen editable fields in a single undifferentiated grid is a wall, not a
 * form: "Address" sat between "Area" and "Contact" with nothing to say they
 * belong to different questions, and the eye had no rung to rest on. The
 * header strip is deliberately the same `bg-surface-2/60` hairline the dialog's
 * own header uses, so a section reads as part of the same object rather than a
 * second card pasted inside the first.
 *
 * Declared at module scope, not inside the modal: a component defined during
 * render is a new type on every keystroke, which remounts everything under it —
 * that would throw away the DateField's half-typed date and the focus ring with
 * it.
 */
function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-line bg-surface overflow-hidden">
      <header className="flex items-center justify-between gap-2 border-b border-line bg-surface-2/60 px-3.5 py-2.5">
        <h4 className="text-2xs font-bold uppercase tracking-wider text-ink">{title}</h4>
        {action}
      </header>
      <div className="p-3.5">{children}</div>
    </section>
  );
}

/**
 * The line-item columns, as one template shared by the header row and the rows.
 *
 * Previously each row was `grid-cols-12` with the line total crammed into the
 * last twelfth — about 44px in this dialog, for a number like ₹5,04,000 that
 * needs 62 plus a remove button. `justify-end` then painted it straight over
 * the price field beside it. Named widths mean a column is as wide as the thing
 * in it, and the total can no longer collide with anything.
 *
 * Below `sm` the template does not apply at all: the row becomes two columns of
 * labelled fields, because six controls do not fit on a phone at any width.
 */
const LINE_COLS =
  "sm:grid-cols-[minmax(0,0.9fr)_minmax(0,1.6fr)_6rem_7rem_6.5rem_1.75rem]";
const LINE_HEAD = "text-3xs font-semibold uppercase tracking-wider text-muted";

export function LeadDetailModal({
  open,
  onClose,
  lead,
}: {
  open: boolean;
  onClose: () => void;
  lead: LeadRow | null;
}) {
  const role = useAuthRole();
  const canEdit = role !== "mgmt";
  const update = useUpdateLead();
  const del = useDeleteLead();

  // Asked of the API rather than derived from the rows already on screen. A
  // salesperson with no leads yet cannot appear in a list built from leads, so
  // handing a deal to a new hire was impossible; an industry nobody has used
  // yet was likewise unreachable.
  const usersQuery = useUserDirectory({ enabled: open && canEdit });
  const people = usersQuery.data ?? [];
  const industriesQuery = useIndustries({ enabled: open && canEdit });
  const industries = industriesQuery.data ?? [];
  const principalsQuery = usePrincipals({ enabled: open && canEdit });
  const principals = principalsQuery.data?.items ?? [];
  const productsQuery = useProducts({}, { enabled: open && canEdit });
  const catalog = flattenProducts(productsQuery.data);

  const [customerName, setCustomerName] = useState("");
  const [salespersonId, setSalespersonId] = useState("");
  const [stage, setStage] = useState<DealStageValue>("NewEnquiries");
  const [division, setDivision] = useState("");
  const [tier, setTier] = useState("");
  const [type, setType] = useState("");
  const [industryId, setIndustryId] = useState("");
  const [subIndustry, setSubIndustry] = useState("");
  const [area, setArea] = useState("");
  const [address, setAddress] = useState("");
  const [contacts, setContacts] = useState<ContactInput[]>(startingContacts);
  const [nextFollowUp, setNextFollowUp] = useState("");
  const [expClose, setExpClose] = useState("");
  const [rows, setRows] = useState<ProductRow[]>([]);

  // Re-seeded whenever a different lead is opened, or the one on screen comes
  // back from the server changed.
  useEffect(() => {
    if (!lead) return;
    setCustomerName(lead.customerName);
    setSalespersonId(lead.salespersonId || "");
    setStage((lead.stage as DealStageValue) || "NewEnquiries");
    setDivision(lead.division || "");
    setTier(lead.tier || "");
    setType(lead.type || "");
    setIndustryId(lead.industryId || "");
    setSubIndustry(lead.subIndustry || "");
    setArea(lead.area || "");
    setAddress(lead.address || "");
    setContacts(
      lead.contacts.length
        ? lead.contacts.map((c) => ({
            name: c.name,
            designation: c.designation ?? "",
            phone: c.phone ?? "",
            whatsapp: c.whatsapp ?? "",
            sameAsMobile: c.sameAsMobile,
            email: c.email ?? "",
            isPrimary: c.isPrimary,
          }))
        : startingContacts(),
    );
    setNextFollowUp(lead.nextFollowUp || "");
    setExpClose(lead.expClose || "");
    setRows(
      lead.products.map((p) => ({
        rowId: nextRowId(),
        productName: p.productName,
        principalId: p.principalId,
        productId: p.productId,
        qty: p.qty,
        unit: p.unit,
        price: p.price,
        value: p.value,
      })),
    );
  }, [lead?.id, lead?.updatedAt]);

  if (!lead) return null;

  const setRow = (idx: number, patch: Partial<LeadProductInput>) => {
    setRows((prev) => {
      const next = [...prev];
      const row = { ...next[idx], ...patch };
      // The line's value is always its own quantity times its own price —
      // never typed, so the total under it cannot disagree with the lines.
      row.value = (Number(row.qty) || 0) * (Number(row.price) || 0);
      next[idx] = row;
      return next;
    });
  };

  const pickPrincipal = (idx: number, principalId: string) => {
    const first = catalog.find((p) => p.principalId === principalId);
    setRow(idx, {
      principalId: principalId || null,
      productId: first?.id ?? null,
      productName: first?.name ?? rows[idx].productName,
      unit: first?.unit ?? null,
      price: first?.basePrice ?? rows[idx].price,
    });
  };

  const pickProduct = (idx: number, productId: string) => {
    const prod = catalog.find((p) => p.id === productId);
    setRow(idx, {
      productId: productId || null,
      productName: prod?.name ?? rows[idx].productName,
      principalId: prod?.principalId ?? rows[idx].principalId,
      unit: prod?.unit ?? null,
      price: prod?.basePrice ?? rows[idx].price,
    });
  };

  const totalValue = rows.reduce((s, r) => s + (r.value || 0), 0);

  const productsChanged = () => {
    const before = lead.products.map((p) =>
      [p.productName, p.productId, p.principalId, p.qty, p.price].join("|"),
    );
    const after = rows
      .filter((r) => r.productName.trim())
      .map((r) => [r.productName, r.productId, r.principalId, r.qty, r.price].join("|"));
    return before.join("~") !== after.join("~");
  };

  const handleSave = async () => {
    // Only what actually changed. `stage` goes as its raw DealStageValue,
    // never the display label (see DEAL_STAGE_LABELS).
    const patch: Record<string, unknown> = {};
    const scalar = <T,>(key: string, now: T, was: T) => {
      if (now !== was) patch[key] = now;
    };
    scalar("customerName", customerName.trim(), lead.customerName);
    scalar("salespersonId", salespersonId, lead.salespersonId || "");
    scalar("stage", stage, lead.stage);
    scalar("division", division || null, lead.division);
    scalar("tier", tier || null, lead.tier);
    scalar("type", type || null, lead.type);
    scalar("industryId", industryId || null, lead.industryId);
    scalar("subIndustry", subIndustry.trim() || null, lead.subIndustry);
    scalar("area", area.trim() || null, lead.area);
    scalar("address", address.trim() || null, lead.address);

    // Contacts go as a whole list or not at all — the API replaces them, and
    // "these are the contacts now" is the only instruction that can express
    // somebody having left the account. Compared field by field so that opening
    // and closing the modal is not a write.
    const nextContacts = contactsPayload(contacts);
    const before = JSON.stringify(
      lead.contacts.map((c) => [
        c.name,
        c.designation ?? null,
        c.phone ?? null,
        c.whatsapp ?? null,
        c.sameAsMobile,
        c.email ?? null,
        c.isPrimary,
      ]),
    );
    const after = JSON.stringify(
      (nextContacts ?? []).map((c) => [
        c.name,
        c.designation ?? null,
        c.phone ?? null,
        (c.sameAsMobile ?? true) ? c.phone ?? null : c.whatsapp ?? null,
        c.sameAsMobile ?? true,
        c.email ?? null,
        !!c.isPrimary,
      ]),
    );
    if (nextContacts && before !== after) patch.contacts = nextContacts;

    scalar("nextFollowUp", nextFollowUp || null, lead.nextFollowUp);
    scalar("expClose", expClose || null, lead.expClose);

    if (productsChanged()) {
      patch.products = rows
        .filter((r) => r.productName.trim())
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        .map(({ rowId, ...p }) => p);
    }

    if (Object.keys(patch).length === 0) {
      onClose();
      return;
    }

    try {
      await update.mutateAsync({ id: lead.id, patch });
      onClose();
    } catch {
      // Surfaced inline below via update.error.
    }
  };

  const label = "text-2xs font-semibold text-muted uppercase tracking-wider block mb-1.5";

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`Sales Lead: ${lead.customerName}`}
      description={`${lead.contactName || "Direct Contact"} · ${lead.area || "Territory"} · Total ${inr(totalValue)}`}
      maxWidth="max-w-3xl"
      footer={
        <>
          {canEdit && (
            <DeleteAction
              label="Delete Lead"
              title={`Delete ${lead.customerName}?`}
              body="The deal, its line items and its activity history are removed. Won deals are usually better left in place for reporting — cancel the lead instead."
              onDelete={() => del.mutateAsync(lead.id)}
              onDeleted={onClose}
            />
          )}
          <Button variant="outline" size="sm" onClick={onClose} type="button">
            Cancel
          </Button>
          {canEdit && (
            <Button size="sm" onClick={handleSave} disabled={update.isPending}>
              {update.isPending ? "Saving…" : "Save Changes"}
            </Button>
          )}
        </>
      }
    >
      <div className="space-y-3.5 text-xs">
        {/* Stage — the one control that moves a deal, kept at the top and
            tinted so it does not read as the first of seventeen fields. */}
        <div className="flex items-center justify-between gap-3 rounded-xl border border-brand/20 bg-brand-soft/40 px-3.5 py-3">
          <label htmlFor="lead-stage" className="text-xs font-bold uppercase tracking-wider text-ink">
            Deal Pipeline Stage
          </label>
          <Select
            id="lead-stage"
            value={stage}
            onChange={(e) => setStage(e.target.value as DealStageValue)}
            disabled={!canEdit}
            className="max-w-[280px] font-bold text-brand"
          >
            {DEAL_STAGE_VALUES.map((s) => (
              <option key={s} value={s}>
                {DEAL_STAGE_LABELS[s]}
              </option>
            ))}
          </Select>
        </div>

        <Section title="Account">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <label htmlFor="lead-name" className={label}>
                Customer
              </label>
              <Input
                id="lead-name"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                disabled={!canEdit}
              />
            </div>
            <div>
              <label htmlFor="lead-owner" className={label}>
                Salesperson
              </label>
              <Select
                id="lead-owner"
                value={salespersonId}
                onChange={(e) => setSalespersonId(e.target.value)}
                disabled={!canEdit}
              >
                {/* The current owner is always an option, even while the user
                    list is still loading or no longer holds them. */}
                {!people.some((u) => u.id === salespersonId) && (
                  <option value={salespersonId}>{lead.salespersonName || "—"}</option>
                )}
                {people.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <label htmlFor="lead-tier" className={label}>
                Tier
              </label>
              <Select
                id="lead-tier"
                value={tier}
                onChange={(e) => setTier(e.target.value)}
                disabled={!canEdit}
              >
                <option value="">— Not graded —</option>
                {CUSTOMER_CATEGORY_VALUES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <label htmlFor="lead-type" className={label}>
                Customer type
              </label>
              <Select
                id="lead-type"
                value={type}
                onChange={(e) => setType(e.target.value)}
                disabled={!canEdit}
              >
                <option value="">— Unknown —</option>
                {CUSTOMER_TYPE_VALUES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <label htmlFor="lead-division" className={label}>
                Division
              </label>
              <Select
                id="lead-division"
                value={division}
                onChange={(e) => setDivision(e.target.value)}
                disabled={!canEdit}
              >
                <option value="">— None —</option>
                {DIVISION_VALUES.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <label htmlFor="lead-industry" className={label}>
                Industry
              </label>
              <Select
                id="lead-industry"
                value={industryId}
                onChange={(e) => setIndustryId(e.target.value)}
                disabled={!canEdit}
              >
                <option value="">— None —</option>
                {industries.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <label htmlFor="lead-subindustry" className={label}>
                Sub-industry
              </label>
              <Input
                id="lead-subindustry"
                value={subIndustry}
                onChange={(e) => setSubIndustry(e.target.value)}
                disabled={!canEdit}
              />
            </div>
            <div>
              <label htmlFor="lead-area" className={label}>
                Area
              </label>
              <Input
                id="lead-area"
                value={area}
                onChange={(e) => setArea(e.target.value)}
                disabled={!canEdit}
              />
            </div>
          </div>
        </Section>

        <Section title="Address & Contacts">
          <div className="space-y-3">
            <div>
              <label htmlFor="lead-address" className={label}>
                Address
              </label>
              <Input
                id="lead-address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                disabled={!canEdit}
              />
            </div>

            {/* A deal is worked through more than one person. This used to be a
                single name, mobile, WhatsApp and email flattened onto the lead
                itself, so the second person at the plant could not be recorded
                anywhere. */}
            <div>
              <div className="mb-1.5 flex items-baseline justify-between gap-2">
                <span className={label}>Key contact persons</span>
                <span className="text-2xs text-muted">
                  The primary is the one every list and the paperwork name.
                </span>
              </div>
              <ContactsEditor
                value={contacts}
                onChange={setContacts}
                disabled={!canEdit}
              />
            </div>
          </div>
        </Section>

        {/* Two dates, side by side. They used to take two-thirds of a
            three-column grid each, which stacked them and left a third of the
            row empty beside both. */}
        <Section title="Timeline">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="lead-next-followup" className={label}>
                Next Follow-Up
              </label>
              <DateField
                id="lead-next-followup"
                label="Next follow-up"
                disabled={!canEdit}
                value={nextFollowUp}
                onChange={setNextFollowUp}
              />
            </div>
            <div>
              <label htmlFor="lead-exp-close" className={label}>
                Expected Closure
              </label>
              <DateField
                id="lead-exp-close"
                label="Expected closure"
                disabled={!canEdit}
                value={expClose}
                onChange={setExpClose}
              />
            </div>
          </div>
        </Section>

        {/* The line items — the numbers a negotiation actually moves. */}
        <Section
          title="Enquiry Products & Estimated Values"
          action={
            canEdit && (
              <Button
                size="xs"
                variant="secondary"
                onClick={() => setRows((r) => [...r, emptyRow()])}
              >
                <Plus className="h-3 w-3" /> Add line
              </Button>
            )
          }
        >
          {rows.length === 0 ? (
            <p className="text-2xs text-muted">No product lines recorded on this lead.</p>
          ) : (
            <div className="space-y-2 sm:space-y-1.5">
              {/* One header row for the table, instead of the same four labels
                  repeated above every line. */}
              <div className={cn("hidden items-center gap-2 px-0.5 sm:grid", LINE_COLS)}>
                <span className={LINE_HEAD}>Brand</span>
                <span className={LINE_HEAD}>Product</span>
                <span className={LINE_HEAD}>Qty</span>
                <span className={LINE_HEAD}>Unit price</span>
                <span className={cn(LINE_HEAD, "text-right")}>Line total</span>
                <span />
              </div>

              {rows.map((r, idx) => (
                <div
                  key={r.rowId}
                  className={cn(
                    "grid grid-cols-2 items-center gap-2 rounded-lg border border-line bg-surface-2/40 p-2.5",
                    "sm:rounded-none sm:border-0 sm:border-b sm:border-line/40 sm:bg-transparent sm:px-0.5 sm:py-1.5 sm:last:border-0",
                    LINE_COLS,
                  )}
                >
                  <div>
                    <span className={cn(LINE_HEAD, "mb-1 block sm:hidden")}>Brand</span>
                    <Select
                      aria-label={`Brand for line ${idx + 1}`}
                      value={r.principalId ?? ""}
                      onChange={(e) => pickPrincipal(idx, e.target.value)}
                      disabled={!canEdit}
                      selectClassName="h-8 text-2xs"
                    >
                      <option value="">—</option>
                      {principals.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </Select>
                  </div>

                  <div>
                    <span className={cn(LINE_HEAD, "mb-1 block sm:hidden")}>Product</span>
                    {/* A lead may name a product the workspace does not stock —
                        that is what a new enquiry often is — so the catalogue
                        narrows the choice without being the only way to name
                        one. */}
                    <Select
                      aria-label={`Product for line ${idx + 1}`}
                      value={r.productId ?? ""}
                      onChange={(e) => pickProduct(idx, e.target.value)}
                      disabled={!canEdit}
                      selectClassName="h-8 text-2xs"
                    >
                      <option value="">{r.productName || "— Off catalogue —"}</option>
                      {catalog
                        .filter((p) => !r.principalId || p.principalId === r.principalId)
                        .map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                    </Select>
                  </div>

                  <div>
                    <span className={cn(LINE_HEAD, "mb-1 block sm:hidden")}>Qty</span>
                    {/* The unit sits inside the field rather than in a column of
                        its own: it is a property of the number typed beside it,
                        and a sixth column for "NOS" would cost more width than
                        it earns. */}
                    <div className="relative">
                      <Input
                        aria-label={`Quantity for line ${idx + 1}`}
                        type="number"
                        min="0"
                        value={r.qty ?? ""}
                        onChange={(e) => setRow(idx, { qty: Number(e.target.value) })}
                        disabled={!canEdit}
                        className={cn("h-8 text-2xs tabular-nums", r.unit && "pr-9")}
                      />
                      {r.unit && (
                        <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-3xs font-semibold uppercase text-muted">
                          {r.unit}
                        </span>
                      )}
                    </div>
                  </div>

                  <div>
                    <span className={cn(LINE_HEAD, "mb-1 block sm:hidden")}>Unit price</span>
                    <div className="relative">
                      <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-2xs text-muted">
                        ₹
                      </span>
                      <Input
                        aria-label={`Price for line ${idx + 1}`}
                        type="number"
                        min="0"
                        value={r.price ?? ""}
                        onChange={(e) => setRow(idx, { price: Number(e.target.value) })}
                        disabled={!canEdit}
                        className="h-8 pl-6 text-2xs tabular-nums"
                      />
                    </div>
                  </div>

                  {/* Its own column, wide enough for the number it holds. */}
                  <div className="flex items-center justify-between gap-2 sm:justify-end">
                    <span className={cn(LINE_HEAD, "sm:hidden")}>Line total</span>
                    <span
                      className={cn(
                        "text-2xs font-bold tabular-nums",
                        r.value ? "text-ink" : "text-muted",
                      )}
                    >
                      {inr(r.value || 0)}
                    </span>
                  </div>

                  <div className="flex justify-end sm:justify-center">
                    {canEdit && (
                      <button
                        type="button"
                        aria-label={`Remove line ${idx + 1}`}
                        onClick={() => setRows((prev) => prev.filter((_, i) => i !== idx))}
                        className="grid h-6 w-6 cursor-pointer place-items-center rounded-md text-muted transition-colors hover:bg-red-soft hover:text-red"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-3 flex items-center justify-between rounded-lg bg-surface-2 px-3 py-2.5">
            <span className="text-2xs font-bold uppercase tracking-wider text-muted">
              Total Deal Value
            </span>
            <span className="text-sm font-bold tabular-nums text-brand">{inr(totalValue)}</span>
          </div>
        </Section>
        {update.isError && (
          <p role="alert" className="text-2xs font-medium text-red">
            {update.error instanceof ApiError ? update.error.message : "Failed to save change."}
          </p>
        )}

        <AttachmentsPanel
          entityType="Lead"
          entityId={lead.id}
          enabled={open}
          canWrite={canEdit}
        />

        <RemarksPanel
          entityType="Lead"
          entityId={lead.id}
          enabled={open}
          canWrite={canEdit}
        />
      </div>
    </Dialog>
  );
}
