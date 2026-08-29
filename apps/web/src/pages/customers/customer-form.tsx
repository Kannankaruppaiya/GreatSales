/**
 * CustomerForm — the create/edit form body. Lives inside a Modal; its submit
 * button is rendered in the modal footer and wired via the shared form id.
 * Owns only field state + local validation; the parent performs the API call
 * and passes back submit state / server error.
 */
import { useState, type FormEvent } from "react";

import { Banner } from "@/components/ui/banner";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  CUSTOMER_CATEGORIES,
  PAYMENT_TERMS,
  PAYMENT_TERMS_LABEL,
  PAY_ZONES,
  PAY_ZONE_LABEL,
  type CustomerCategory,
  type CustomerFormValues,
  type IndustryDto,
  type PayZone,
  type PaymentTerms,
} from "@/lib/api/customer-types";

export const CUSTOMER_FORM_ID = "customer-form";

type Props = {
  initial?: Partial<CustomerFormValues>;
  industries: IndustryDto[];
  submitting: boolean;
  formError?: string | null;
  onSubmit: (values: CustomerFormValues) => void;
};

function opt<T extends string>(values: readonly T[], label?: (v: T) => string) {
  return values.map((v) => ({ value: v, label: label ? label(v) : v }));
}

export function CustomerForm({ initial, industries, submitting, formError, onSubmit }: Props) {
  const [name, setName] = useState(initial?.name ?? "");
  const [category, setCategory] = useState<string>(initial?.category ?? "");
  const [payZone, setPayZone] = useState<string>(initial?.payZone ?? "");
  const [paymentTerms, setPaymentTerms] = useState<string>(initial?.paymentTerms ?? "");
  const [industryId, setIndustryId] = useState<string>(initial?.industryId ?? "");
  const [subIndustry, setSubIndustry] = useState(initial?.subIndustry ?? "");
  const [area, setArea] = useState(initial?.area ?? "");
  const [nameError, setNameError] = useState<string>();

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setNameError("Name is required.");
      return;
    }
    onSubmit({
      name: name.trim(),
      category: (category || undefined) as CustomerCategory | undefined,
      payZone: (payZone || undefined) as PayZone | undefined,
      paymentTerms: (paymentTerms || undefined) as PaymentTerms | undefined,
      industryId: industryId || undefined,
      subIndustry: subIndustry.trim() || undefined,
      area: area.trim() || undefined,
    });
  }

  return (
    <form id={CUSTOMER_FORM_ID} onSubmit={submit} className="flex flex-col gap-4" noValidate>
      {formError ? <Banner tone="error" message={formError} /> : null}

      <Input
        label="Name"
        required
        value={name}
        onChange={(e) => {
          setName(e.target.value);
          if (nameError) setNameError(undefined);
        }}
        error={nameError}
        disabled={submitting}
        autoFocus
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Select
          label="Category"
          placeholder="—"
          options={opt(CUSTOMER_CATEGORIES)}
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          disabled={submitting}
        />
        <Select
          label="Pay zone"
          placeholder="—"
          options={opt(PAY_ZONES, (v) => PAY_ZONE_LABEL[v])}
          value={payZone}
          onChange={(e) => setPayZone(e.target.value)}
          disabled={submitting}
        />
        <Select
          label="Payment terms"
          placeholder="—"
          options={opt(PAYMENT_TERMS, (v) => PAYMENT_TERMS_LABEL[v])}
          value={paymentTerms}
          onChange={(e) => setPaymentTerms(e.target.value)}
          disabled={submitting}
        />
        <Select
          label="Industry"
          placeholder="—"
          options={industries.map((i) => ({ value: i.id, label: i.name }))}
          value={industryId}
          onChange={(e) => {
            setIndustryId(e.target.value);
            setSubIndustry("");
          }}
          disabled={submitting}
        />
        <Input
          label="Sub-industry"
          value={subIndustry}
          onChange={(e) => setSubIndustry(e.target.value)}
          disabled={submitting}
        />
        <Input
          label="Area"
          value={area}
          onChange={(e) => setArea(e.target.value)}
          disabled={submitting}
        />
      </div>
    </form>
  );
}
