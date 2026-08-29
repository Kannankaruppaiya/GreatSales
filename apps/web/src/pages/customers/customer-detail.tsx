/**
 * Customer detail — view, edit (modal), and delete (confirmed). Handles the
 * real states: loading, not-found (404 from ownership/RLS), error+retry.
 */
import { ArrowLeft, Pencil, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import { Text } from "@/components/ui/text";
import { ApiError } from "@/lib/api/errors";
import { deleteCustomer, getCustomer, listIndustries, updateCustomer } from "@/lib/api/customers-api";
import {
  PAYMENT_TERMS_LABEL,
  PAY_ZONE_LABEL,
  PAY_ZONE_TONE,
  type CustomerDetail,
  type CustomerFormValues,
  type IndustryDto,
} from "@/lib/api/customer-types";
import { CUSTOMER_FORM_ID, CustomerForm } from "@/pages/customers/customer-form";

type LoadState =
  | { status: "loading" }
  | { status: "notfound" }
  | { status: "error" }
  | { status: "ready"; customer: CustomerDetail };

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <Text variant="bodySm" color="muted">
        {label}
      </Text>
      <div>{children}</div>
    </div>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export function CustomerDetailPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();

  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [industries, setIndustries] = useState<IndustryDto[]>([]);

  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setState({ status: "loading" });
    try {
      const customer = await getCustomer(id);
      setState({ status: "ready", customer });
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) setState({ status: "notfound" });
      else setState({ status: "error" });
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    listIndustries()
      .then(setIndustries)
      .catch(() => setIndustries([]));
  }, []);

  async function onSave(values: CustomerFormValues) {
    setSaving(true);
    setEditError(null);
    try {
      const updated = await updateCustomer(id, values);
      setState({ status: "ready", customer: updated });
      setEditOpen(false);
    } catch (err) {
      setEditError(err instanceof ApiError ? err.userMessage : "Couldn’t save changes.");
    } finally {
      setSaving(false);
    }
  }

  async function onDelete() {
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteCustomer(id);
      navigate("/customers");
    } catch (err) {
      setDeleteError(err instanceof ApiError ? err.userMessage : "Couldn’t delete the customer.");
      setDeleting(false);
    }
  }

  if (state.status === "loading") return <LoadingState label="Loading customer…" />;
  if (state.status === "notfound") {
    return (
      <EmptyState
        icon={ArrowLeft}
        title="Customer not found"
        description="It may have been deleted, or you don’t have access to it."
        actionLabel="Back to customers"
        onAction={() => navigate("/customers")}
      />
    );
  }
  if (state.status === "error") {
    return <ErrorState title="Couldn’t load this customer" onRetry={load} />;
  }

  const c = state.customer;

  return (
    <div className="flex flex-col gap-5">
      <button
        type="button"
        onClick={() => navigate("/customers")}
        className="inline-flex items-center gap-1.5 self-start text-[13px] font-semibold text-fg-secondary hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus rounded"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Customers
      </button>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Text as="h1" variant="h1" className="block break-words">
            {c.name}
          </Text>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {c.category ? <Badge label={c.category} tone="neutral" /> : null}
            {c.payZone ? <Badge label={`${PAY_ZONE_LABEL[c.payZone]} zone`} tone={PAY_ZONE_TONE[c.payZone]} /> : null}
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" leadingIcon={Pencil} onClick={() => { setEditError(null); setEditOpen(true); }}>
            Edit
          </Button>
          <Button variant="tertiary" leadingIcon={Trash2} onClick={() => { setDeleteError(null); setDeleteOpen(true); }}>
            Delete
          </Button>
        </div>
      </div>

      <Card>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <Field label="Salesperson">
            <Text variant="body">{c.salespersonName ?? "Unassigned"}</Text>
          </Field>
          <Field label="Area">
            <Text variant="body">{c.area ?? "—"}</Text>
          </Field>
          <Field label="Industry">
            <Text variant="body">{c.industryName ?? "—"}</Text>
          </Field>
          <Field label="Sub-industry">
            <Text variant="body">{c.subIndustry ?? "—"}</Text>
          </Field>
          <Field label="Payment terms">
            <Text variant="body">{c.paymentTerms ? PAYMENT_TERMS_LABEL[c.paymentTerms] : "—"}</Text>
          </Field>
          <Field label="Created">
            <Text variant="body">{formatDate(c.createdAt)}</Text>
          </Field>
        </div>
      </Card>

      <div className="flex flex-col gap-3">
        <Text as="h2" variant="h3">
          Contacts
        </Text>
        <Card padded={false}>
          {c.contacts.length === 0 ? (
            <div className="px-5 py-8">
              <Text variant="body" color="muted" className="block text-center">
                No contacts recorded.
              </Text>
            </div>
          ) : (
            <div className="divide-y divide-divider">
              {c.contacts.map((ct) => (
                <div key={ct.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-5 py-4">
                  <Text variant="bodyLg" className="font-semibold">
                    {ct.name}
                  </Text>
                  {ct.isPrimary ? <Badge label="Primary" tone="primary" /> : null}
                  {ct.designation ? (
                    <Text variant="bodySm" color="secondary" className="w-full sm:w-auto">
                      {ct.designation}
                    </Text>
                  ) : null}
                  <div className="w-full sm:ml-auto sm:w-auto sm:text-right">
                    {ct.phone ? (
                      <Text variant="bodySm" color="secondary" className="block">
                        {ct.phone}
                      </Text>
                    ) : null}
                    {ct.email ? (
                      <Text variant="bodySm" color="secondary" className="block">
                        {ct.email}
                      </Text>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Edit */}
      <Modal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title="Edit customer"
        busy={saving}
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" form={CUSTOMER_FORM_ID} loading={saving}>
              Save changes
            </Button>
          </>
        }
      >
        <CustomerForm
          industries={industries}
          submitting={saving}
          formError={editError}
          onSubmit={onSave}
          initial={{
            name: c.name,
            category: c.category ?? undefined,
            payZone: c.payZone ?? undefined,
            paymentTerms: c.paymentTerms ?? undefined,
            industryId: c.industryId ?? undefined,
            subIndustry: c.subIndustry ?? undefined,
            area: c.area ?? undefined,
          }}
        />
      </Modal>

      {/* Delete confirm */}
      <Modal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="Delete customer?"
        description={`“${c.name}” will be archived. This can be restored by an administrator.`}
        busy={deleting}
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteOpen(false)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={onDelete} loading={deleting}>
              Delete
            </Button>
          </>
        }
      >
        {deleteError ? (
          <Text variant="body" color="error">
            {deleteError}
          </Text>
        ) : (
          <Text variant="body" color="secondary">
            Are you sure you want to delete this customer? It will be removed from your list.
          </Text>
        )}
      </Modal>
    </div>
  );
}
