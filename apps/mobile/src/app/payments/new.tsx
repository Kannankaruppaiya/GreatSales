import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView } from 'react-native';

import {
  Button,
  Field,
  Header,
  Loading,
  Screen,
  SelectField,
  Txt,
  type Option,
} from '@/components/ui';
import type { PayZone } from '@greatsales/shared';
import { api } from '@/lib/api';
import { humanize } from '@/lib/format';
import { useAsync } from '@/lib/hooks';
import { space, useColors } from '@/lib/theme';

const ZONES: PayZone[] = ['RedZone', 'YellowZone', 'GreenZone', 'Blacklist'];
const zoneOptions: Option[] = ZONES.map((z) => ({ id: z, label: humanize(z) }));

export default function NewPaymentScreen() {
  const c = useColors();
  const router = useRouter();
  const params = useLocalSearchParams<{ customerId?: string }>();
  const { data: lookups, loading } = useAsync(() => api.lookups());

  const [customerId, setCustomerId] = useState<string | null>(
    params.customerId ?? null,
  );
  const [invoiceNo, setInvoiceNo] = useState('');
  const [amount, setAmount] = useState('');
  const [zone, setZone] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit() {
    setError(null);
    const value = Number(amount);
    if (!customerId) return setError('Please choose a customer.');
    if (!invoiceNo.trim()) return setError('Invoice number is required.');
    if (!amount || Number.isNaN(value) || value <= 0) {
      return setError('Enter a valid amount.');
    }
    setSubmitting(true);
    try {
      const created = await api.payments.create({
        customerId,
        invoiceNo: invoiceNo.trim(),
        amount: value,
        payZone: (zone as PayZone) ?? undefined,
      });
      router.replace(`/payments/${created.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not record payment.');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading && !lookups) {
    return (
      <Screen edges={['top']}>
        <Header title="Record Payment" onBack={() => router.back()} />
        <Loading />
      </Screen>
    );
  }

  return (
    <Screen edges={['top']}>
      <Header title="Record Payment" onBack={() => router.back()} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={{ padding: space.lg, gap: space.lg, paddingBottom: 48 }}
          keyboardShouldPersistTaps="handled">
          <SelectField
            label="Customer"
            value={customerId}
            options={lookups?.customers ?? []}
            onSelect={setCustomerId}
          />
          <Field label="Invoice number" value={invoiceNo} onChangeText={setInvoiceNo} placeholder="INV-2026-001" autoCapitalize="characters" />
          <Field label="Amount" value={amount} onChangeText={setAmount} placeholder="125000" keyboardType="numeric" />
          <SelectField label="Pay zone" value={zone} onSelect={setZone} options={zoneOptions} />

          {error ? <Txt variant="body" color={c.danger}>{error}</Txt> : null}

          <Button title="Record payment" onPress={onSubmit} loading={submitting} icon="checkmark" />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
