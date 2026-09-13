import { Plus, Star, X } from "lucide-react";
import { Button, Input } from "@/components/ui";
import { cn } from "@/lib/utils";
import type { ContactInput } from "@/features/leads/types";

/**
 * The people at an account, edited as a list.
 *
 * A plant is worked through more than one person — the purchase manager signs
 * the order, the plant head decides the trial — and both forms that name a
 * contact used to offer exactly one: four flat fields, no designation, no way
 * to record the second person at all.
 *
 * One editor rather than one per form, because "which one is primary", "what
 * happens when you remove the primary" and "does WhatsApp mirror the mobile"
 * are answers that must not differ between the Add and the Edit dialog.
 */

const label = "text-2xs font-semibold text-muted uppercase tracking-wider block mb-1";

export const emptyContact = (): ContactInput => ({
  name: "",
  designation: "",
  phone: "",
  whatsapp: "",
  sameAsMobile: true,
  isPrimary: false,
  email: "",
});

/** A fresh list holding one primary contact — what a blank form starts from. */
export const startingContacts = (): ContactInput[] => [
  { ...emptyContact(), isPrimary: true },
];

/**
 * Exactly one primary, whatever the caller did.
 *
 * Removing the primary must not leave a list with none — every list cell, the
 * dashboard drill-down and the printed paperwork read the primary, and the API
 * refuses a payload that does not carry exactly one.
 */
export function normalizeContacts(rows: ContactInput[]): ContactInput[] {
  if (rows.length === 0) return startingContacts();
  const at = Math.max(
    0,
    rows.findIndex((c) => c.isPrimary),
  );
  return rows.map((c, i) => ({ ...c, isPrimary: i === at }));
}

export function ContactsEditor({
  value,
  onChange,
  disabled,
  max = 10,
}: {
  value: ContactInput[];
  onChange: (next: ContactInput[]) => void;
  disabled?: boolean;
  max?: number;
}) {
  const rows = value.length ? value : startingContacts();

  const setRow = (idx: number, patch: Partial<ContactInput>) =>
    onChange(rows.map((c, i) => (i === idx ? { ...c, ...patch } : c)));

  const remove = (idx: number) =>
    onChange(normalizeContacts(rows.filter((_, i) => i !== idx)));

  const makePrimary = (idx: number) =>
    onChange(rows.map((c, i) => ({ ...c, isPrimary: i === idx })));

  return (
    <div className="space-y-2.5">
      {rows.map((c, idx) => (
        <div
          key={idx}
          className={cn(
            "rounded-xl border p-3",
            c.isPrimary ? "border-brand/30 bg-brand-soft/30" : "border-line bg-surface-2/40",
          )}
        >
          <div className="mb-2 flex items-center justify-between gap-2">
            <span
              className={cn(
                "inline-flex items-center gap-1 text-2xs font-bold uppercase tracking-wider",
                c.isPrimary ? "text-brand-ink" : "text-muted",
              )}
            >
              {c.isPrimary && <Star className="h-3 w-3 fill-brand text-brand" />}
              {c.isPrimary ? "Primary contact" : `Contact ${idx + 1}`}
            </span>

            <div className="flex items-center gap-1.5">
              {!c.isPrimary && !disabled && (
                <button
                  type="button"
                  onClick={() => makePrimary(idx)}
                  className="cursor-pointer text-2xs font-semibold text-muted hover:text-brand"
                >
                  Make primary
                </button>
              )}
              {rows.length > 1 && !disabled && (
                <button
                  type="button"
                  aria-label={`Remove contact ${idx + 1}`}
                  onClick={() => remove(idx)}
                  className="grid h-6 w-6 cursor-pointer place-items-center rounded-md text-muted transition-colors hover:bg-red-soft hover:text-red"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            <div>
              <label htmlFor={`contact-name-${idx}`} className={label}>
                Name {c.isPrimary && <span className="text-red">*</span>}
              </label>
              <Input
                id={`contact-name-${idx}`}
                className="h-8 text-xs"
                placeholder="e.g. Mr. P. Subramanian"
                value={c.name}
                disabled={disabled}
                onChange={(e) => setRow(idx, { name: e.target.value })}
              />
            </div>
            <div>
              <label htmlFor={`contact-designation-${idx}`} className={label}>
                Designation
              </label>
              <Input
                id={`contact-designation-${idx}`}
                className="h-8 text-xs"
                placeholder="e.g. Purchase Manager"
                value={c.designation ?? ""}
                disabled={disabled}
                onChange={(e) => setRow(idx, { designation: e.target.value })}
              />
            </div>

            <div>
              <label htmlFor={`contact-phone-${idx}`} className={label}>
                Mobile
              </label>
              <Input
                id={`contact-phone-${idx}`}
                className="h-8 text-xs"
                placeholder="+91 98400 12345"
                value={c.phone ?? ""}
                disabled={disabled}
                onChange={(e) => setRow(idx, { phone: e.target.value })}
              />
            </div>
            <div>
              <label htmlFor={`contact-email-${idx}`} className={label}>
                Email
              </label>
              <Input
                id={`contact-email-${idx}`}
                type="email"
                className="h-8 text-xs"
                placeholder="purchase@acme.com"
                value={c.email ?? ""}
                disabled={disabled}
                onChange={(e) => setRow(idx, { email: e.target.value })}
              />
            </div>

            <div className="sm:col-span-2">
              <label className="flex cursor-pointer items-center gap-1.5 text-2xs font-semibold text-muted">
                <input
                  type="checkbox"
                  className="cursor-pointer"
                  checked={c.sameAsMobile ?? true}
                  disabled={disabled}
                  onChange={(e) => setRow(idx, { sameAsMobile: e.target.checked })}
                />
                WhatsApp same as mobile
              </label>
              {!(c.sameAsMobile ?? true) && (
                <Input
                  aria-label={`WhatsApp number for contact ${idx + 1}`}
                  className="mt-1.5 h-8 text-xs sm:max-w-[260px]"
                  placeholder="+91 98400 12345"
                  value={c.whatsapp ?? ""}
                  disabled={disabled}
                  onChange={(e) => setRow(idx, { whatsapp: e.target.value })}
                />
              )}
            </div>
          </div>
        </div>
      ))}

      {!disabled && rows.length < max && (
        <Button
          size="xs"
          variant="outline"
          type="button"
          onClick={() => onChange([...rows, emptyContact()])}
        >
          <Plus className="h-3 w-3" /> Add contact
        </Button>
      )}
    </div>
  );
}

/**
 * The list as the API will take it: blank rows dropped, exactly one primary.
 *
 * Returns null when nobody has been named at all, so a caller can leave
 * `contacts` off the payload entirely rather than sending an empty list the
 * schema would refuse.
 */
export function contactsPayload(rows: ContactInput[]): ContactInput[] | null {
  const named = rows.filter(
    (c) => c.name.trim() || c.phone?.trim() || c.email?.trim(),
  );
  if (named.length === 0) return null;
  const cleaned = named.map((c) => ({
    ...c,
    name: c.name.trim() || "Contact",
    designation: c.designation?.trim() || null,
    phone: c.phone?.trim() || null,
    whatsapp: c.whatsapp?.trim() || null,
    email: c.email?.trim() || null,
  }));
  return normalizeContacts(cleaned);
}
