/**
 * CustomerForm — the create/edit form body for mobile. Owns field state + local
 * validation; the parent screen performs the API call and passes back submit
 * state / server error. Renders its own submit button.
 */
import { useState } from 'react';
import { View } from 'react-native';

import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { Select, type SelectOption } from '@/components/ui/select';
import { Text } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
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
} from '@/lib/api/customer-types';
import { useTheme } from '@/theme/theme-provider';

type Props = {
  initial?: Partial<CustomerFormValues>;
  industries: IndustryDto[];
  submitting: boolean;
  formError?: string | null;
  submitLabel: string;
  onSubmit: (values: CustomerFormValues) => void;
};

const CATEGORY_OPTS: SelectOption[] = CUSTOMER_CATEGORIES.map((v) => ({ value: v, label: v }));
const PAY_ZONE_OPTS: SelectOption[] = PAY_ZONES.map((v) => ({ value: v, label: PAY_ZONE_LABEL[v] }));
const PAYMENT_OPTS: SelectOption[] = PAYMENT_TERMS.map((v) => ({ value: v, label: PAYMENT_TERMS_LABEL[v] }));

export function CustomerForm({ initial, industries, submitting, formError, submitLabel, onSubmit }: Props) {
  const { spacing } = useTheme();
  const [name, setName] = useState(initial?.name ?? '');
  const [category, setCategory] = useState<string | undefined>(initial?.category);
  const [payZone, setPayZone] = useState<string | undefined>(initial?.payZone);
  const [paymentTerms, setPaymentTerms] = useState<string | undefined>(initial?.paymentTerms);
  const [industryId, setIndustryId] = useState<string | undefined>(initial?.industryId);
  const [subIndustry, setSubIndustry] = useState(initial?.subIndustry ?? '');
  const [area, setArea] = useState(initial?.area ?? '');
  const [nameError, setNameError] = useState<string>();

  function submit() {
    if (!name.trim()) {
      setNameError('Name is required.');
      return;
    }
    onSubmit({
      name: name.trim(),
      category: category as CustomerCategory | undefined,
      payZone: payZone as PayZone | undefined,
      paymentTerms: paymentTerms as PaymentTerms | undefined,
      industryId: industryId || undefined,
      subIndustry: subIndustry.trim() || undefined,
      area: area.trim() || undefined,
    });
  }

  return (
    <View style={{ gap: spacing.lg }}>
      {formError ? <Banner tone="error" message={formError} /> : null}

      <TextField
        label="Name"
        required
        value={name}
        onChangeText={(v) => {
          setName(v);
          if (nameError) setNameError(undefined);
        }}
        error={nameError}
        editable={!submitting}
        autoCapitalize="words"
      />
      <Select label="Category" value={category} options={CATEGORY_OPTS} onChange={setCategory} disabled={submitting} />
      <Select label="Pay zone" value={payZone} options={PAY_ZONE_OPTS} onChange={setPayZone} disabled={submitting} />
      <Select
        label="Payment terms"
        value={paymentTerms}
        options={PAYMENT_OPTS}
        onChange={setPaymentTerms}
        disabled={submitting}
      />
      <Select
        label="Industry"
        value={industryId}
        options={industries.map((i) => ({ value: i.id, label: i.name }))}
        onChange={(v) => {
          setIndustryId(v);
          setSubIndustry('');
        }}
        disabled={submitting}
      />
      <TextField label="Sub-industry" value={subIndustry} onChangeText={setSubIndustry} editable={!submitting} />
      <TextField label="Area" value={area} onChangeText={setArea} editable={!submitting} />

      <Button label={submitLabel} onPress={submit} loading={submitting} />
      <Text variant="caption" color="muted" center>
        Fields other than name are optional.
      </Text>
    </View>
  );
}
