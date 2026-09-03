import { useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView } from 'react-native';

import {
  Button,
  Field,
  Header,
  Screen,
  SelectField,
  Txt,
  type Option,
} from '@/components/ui';
import type {
  CustomerCategory,
  PaymentTerms,
  PayZone,
} from '@greatsales/shared';
import { api } from '@/lib/api';
import { humanize } from '@/lib/format';
import { useAsync } from '@/lib/hooks';
import { space, useColors } from '@/lib/theme';

const CATEGORIES: CustomerCategory[] = ['Platinum', 'Gold', 'Silver', 'Brass'];
const TERMS: PaymentTerms[] = [
  'Immediate',
  'Credit15',
  'Credit30',
  'Credit45',
  'CashOnDelivery',
  'AdvancePayment',
];
const ZONES: PayZone[] = ['RedZone', 'YellowZone', 'GreenZone', 'Blacklist'];

const enumOptions = (values: string[]): Option[] =>
  values.map((v) => ({ id: v, label: humanize(v) }));

export default function NewCustomerScreen() {
  const c = useColors();
  const router = useRouter();
  const { data: lookups } = useAsync(() => api.lookups());

  const [name, setName] = useState('');
  const [area, setArea] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const [terms, setTerms] = useState<string | null>(null);
  const [zone, setZone] = useState<string | null>(null);
  const [industryId, setIndustryId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit() {
    setError(null);
    if (!name.trim()) {
      setError('Customer name is required.');
      return;
    }
    setSubmitting(true);
    try {
      const created = await api.customers.create({
        name: name.trim(),
        area: area.trim() || undefined,
        category: (category as CustomerCategory) ?? undefined,
        paymentTerms: (terms as PaymentTerms) ?? undefined,
        payZone: (zone as PayZone) ?? undefined,
        industryId: industryId ?? undefined,
      });
      router.replace(`/customers/${created.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create customer.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Screen edges={['top']}>
      <Header title="New Customer" onBack={() => router.back()} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={{ padding: space.lg, gap: space.lg, paddingBottom: 48 }}
          keyboardShouldPersistTaps="handled">
          <Field label="Name" value={name} onChangeText={setName} placeholder="Acme Industries Pvt Ltd" />
          <Field label="Area" value={area} onChangeText={setArea} placeholder="Chennai" />
          <SelectField label="Category" value={category} onSelect={setCategory} options={enumOptions(CATEGORIES)} />
          <SelectField label="Payment terms" value={terms} onSelect={setTerms} options={enumOptions(TERMS)} />
          <SelectField label="Pay zone" value={zone} onSelect={setZone} options={enumOptions(ZONES)} />
          <SelectField
            label="Industry"
            value={industryId}
            onSelect={setIndustryId}
            options={lookups?.industries ?? []}
          />

          {error ? <Txt variant="body" color={c.danger}>{error}</Txt> : null}

          <Button title="Create customer" onPress={onSubmit} loading={submitting} icon="checkmark" />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
