import { useState } from "react";
import { Mail, Phone, Pencil, Plus, Star, Trash2, UserRound } from "lucide-react";
import { Button, Dialog, Input } from "@/components/ui";
import { ApiError } from "@/lib/api";
import {
  useCustomerContacts,
  useCreateContact,
  useUpdateContact,
  useDeleteContact,
} from "@/features/customers/queries";
import type {
  CustomerContactCreate,
  CustomerContactRow,
} from "@/features/customers/types";

/**
 * Contacts manager for the customer 360 drawer. Lists a customer's contacts and
 * — when the viewer can edit (`canEdit`) — adds, edits, deletes, and promotes a
 * primary. The server owns the "one primary per customer" invariant, so the UI
 * only ever asks to promote (Make primary); it never clears a primary directly.
 */
export function ContactsPanel({
  customerId,
  canEdit,
}: {
  customerId: string;
  canEdit: boolean;
}) {
  const q = useCustomerContacts(customerId);
  const del = useDeleteContact(customerId);
  const update = useUpdateContact(customerId);
  const [editing, setEditing] = useState<CustomerContactRow | null>(null);
  const [adding, setAdding] = useState(false);
  const [actionError, setActionError] = useState("");

  const contacts = q.data?.items ?? [];

  const handleDelete = async (c: CustomerContactRow) => {
    if (!confirm(`Remove contact "${c.name}"?`)) return;
    setActionError("");
    try {
      await del.mutateAsync(c.id);
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Failed to remove contact.");
    }
  };

  const handlePromote = async (c: CustomerContactRow) => {
    setActionError("");
    try {
      await update.mutateAsync({ id: c.id, patch: { isPrimary: true } });
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Failed to set primary.");
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-xs font-bold text-ink uppercase tracking-wider">
          Contacts {contacts.length > 0 && <span className="text-muted">({contacts.length})</span>}
        </div>
        {canEdit && (
          <Button variant="outline" size="sm" onClick={() => setAdding(true)}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Add
          </Button>
        )}
      </div>

      {q.isLoading ? (
        <div className="text-[11px] text-muted">Loading contacts…</div>
      ) : q.isError ? (
        <div className="text-[11px] text-red">
          {q.error instanceof ApiError ? q.error.message : "Failed to load contacts."}
        </div>
      ) : contacts.length === 0 ? (
        <div className="py-4 text-center text-[11px] text-muted border border-dashed border-line rounded-xl">
          No contacts yet.
        </div>
      ) : (
        <ul className="space-y-2">
          {contacts.map((c) => (
            <li
              key={c.id}
              className="rounded-xl border border-line bg-surface p-3 flex items-start justify-between gap-2"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <UserRound className="h-3.5 w-3.5 text-muted shrink-0" />
                  <span className="font-bold text-ink truncate">{c.name}</span>
                  {c.isPrimary && (
                    <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-bold bg-brand-soft text-brand-ink">
                      <Star className="h-2.5 w-2.5 fill-current" /> Primary
                    </span>
                  )}
                  {c.designation && <span className="text-[11px] text-muted">· {c.designation}</span>}
                </div>
                <div className="mt-1 flex items-center gap-3 text-[11px] text-muted flex-wrap">
                  {(c.mobile || c.phone) && (
                    <a
                      href={`tel:${c.mobile || c.phone}`}
                      className="inline-flex items-center gap-1 hover:text-brand"
                    >
                      <Phone className="h-3 w-3" /> {c.mobile || c.phone}
                    </a>
                  )}
                  {c.email && (
                    <a
                      href={`mailto:${c.email}`}
                      className="inline-flex items-center gap-1 hover:text-brand truncate"
                    >
                      <Mail className="h-3 w-3" /> {c.email}
                    </a>
                  )}
                </div>
              </div>

              {canEdit && (
                <div className="flex items-center gap-0.5 shrink-0">
                  {!c.isPrimary && (
                    <button
                      type="button"
                      title="Make primary"
                      onClick={() => handlePromote(c)}
                      disabled={update.isPending}
                      className="p-1 text-muted hover:text-brand cursor-pointer disabled:opacity-50"
                    >
                      <Star className="h-3.5 w-3.5" />
                    </button>
                  )}
                  <button
                    type="button"
                    title="Edit contact"
                    onClick={() => setEditing(c)}
                    className="p-1 text-muted hover:text-ink cursor-pointer"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    title="Remove contact"
                    onClick={() => handleDelete(c)}
                    disabled={del.isPending}
                    className="p-1 text-red/60 hover:text-red cursor-pointer disabled:opacity-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {actionError && <p className="text-[11px] font-medium text-red">{actionError}</p>}

      {(adding || editing) && (
        <ContactFormModal
          customerId={customerId}
          contact={editing}
          hasContacts={contacts.length > 0}
          onClose={() => {
            setAdding(false);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function ContactFormModal({
  customerId,
  contact,
  hasContacts,
  onClose,
}: {
  customerId: string;
  contact: CustomerContactRow | null;
  hasContacts: boolean;
  onClose: () => void;
}) {
  const isEdit = !!contact;
  const create = useCreateContact(customerId);
  const update = useUpdateContact(customerId);
  const pending = create.isPending || update.isPending;
  const error = create.error ?? update.error;

  const [name, setName] = useState(contact?.name ?? "");
  const [designation, setDesignation] = useState(contact?.designation ?? "");
  const [mobile, setMobile] = useState(contact?.mobile ?? "");
  const [phone, setPhone] = useState(contact?.phone ?? "");
  const [email, setEmail] = useState(contact?.email ?? "");
  const [whatsapp, setWhatsapp] = useState(contact?.whatsapp ?? "");
  const [sameAsMobile, setSameAsMobile] = useState(contact?.sameAsMobile ?? true);
  // Only offer the primary toggle where it does something: a brand-new contact
  // on a customer that already has one (the first contact is primary anyway),
  // or a non-primary contact being edited. A current primary can't be un-set
  // here (promote another instead).
  const [makePrimary, setMakePrimary] = useState(contact ? contact.isPrimary : false);
  const canTogglePrimary = isEdit ? !contact!.isPrimary : hasContacts;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const body: CustomerContactCreate = {
      name: name.trim(),
      designation: designation.trim() || null,
      mobile: mobile.trim() || null,
      phone: phone.trim() || null,
      email: email.trim() || null,
      whatsapp: (sameAsMobile ? mobile.trim() : whatsapp.trim()) || null,
      sameAsMobile,
      // Never send isPrimary:false — the server ignores it, and a current
      // primary stays primary until another is promoted.
      ...(canTogglePrimary && makePrimary ? { isPrimary: true } : {}),
    };
    try {
      if (isEdit) {
        await update.mutateAsync({ id: contact!.id, patch: body });
      } else {
        await create.mutateAsync(body);
      }
      onClose();
    } catch {
      // Surfaced inline below.
    }
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title={isEdit ? "Edit Contact" : "Add Contact"}
      maxWidth="max-w-md"
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onClose} type="button">
            Cancel
          </Button>
          <Button size="sm" onClick={handleSubmit} disabled={!name.trim() || pending}>
            {pending ? "Saving…" : isEdit ? "Save" : "Add Contact"}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-3 text-xs">
        <div>
          <label className="text-xs font-semibold text-muted uppercase tracking-wider block mb-1">
            Name *
          </label>
          <Input value={name} onChange={(e) => setName(e.target.value)} required placeholder="Contact name" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-muted uppercase tracking-wider block mb-1">
              Designation
            </label>
            <Input value={designation} onChange={(e) => setDesignation(e.target.value)} placeholder="e.g. Purchase Head" />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted uppercase tracking-wider block mb-1">
              Mobile
            </label>
            <Input value={mobile} onChange={(e) => setMobile(e.target.value)} placeholder="9000000000" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-muted uppercase tracking-wider block mb-1">
              Phone
            </label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Landline / alt" />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted uppercase tracking-wider block mb-1">
              Email
            </label>
            <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@company.com" />
          </div>
        </div>

        <label className="flex items-center gap-2 text-[11px] font-medium text-ink">
          <input
            type="checkbox"
            checked={sameAsMobile}
            onChange={(e) => setSameAsMobile(e.target.checked)}
          />
          WhatsApp same as mobile
        </label>
        {!sameAsMobile && (
          <div>
            <label className="text-xs font-semibold text-muted uppercase tracking-wider block mb-1">
              WhatsApp number
            </label>
            <Input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="WhatsApp number" />
          </div>
        )}

        {canTogglePrimary && (
          <label className="flex items-center gap-2 text-[11px] font-medium text-ink">
            <input
              type="checkbox"
              checked={makePrimary}
              onChange={(e) => setMakePrimary(e.target.checked)}
            />
            Set as primary contact
          </label>
        )}

        {error && (
          <p className="text-[11px] font-medium text-red">
            {error instanceof ApiError ? error.message : "Failed to save contact."}
          </p>
        )}
      </form>
    </Dialog>
  );
}
