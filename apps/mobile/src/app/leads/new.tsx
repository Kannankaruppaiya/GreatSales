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
import type { DealStage, LeadStatus } from '@greatsales/shared';
import { api } from '@/lib/api';
import { humanize } from '@/lib/format';
import { useAsync } from '@/lib/hooks';
import { space, useColors } from '@/lib/theme';

const STAGES: DealStage[] = [
  'NewEnquiries',
  'NeedsAnalysis',
  'TrialsAndSampleTests',
  'ProposalsAndPriceQuote',
  'NegotiationOralConfirmation',
  'ClosedWon',
  'ClosedLost',
  'NoRequirementOrCold',
  'TrialProblem',
];
const STATUSES: LeadStatus[] = ['Platinum', 'Gold', 'Silver', 'Bronze'];
const opts = (v: string[]): Option[] => v.map((x) => ({ id: x, label: humanize(x) }));

export default function NewLeadScreen() {
  const c = useColors();
  const router = useRouter();
  const { data: lookups } = useAsync(() => api.lookups());

  const [customerName, setCustomerName] = useState('');
  const [area, setArea] = useState('');
  const [stage, setStage] = useState<string | null>('NewEnquiries');
  const [status, setStatus] = useState<string | null>(null);
  const [industryId, setIndustryId] = useState<string | null>(null);
  const [productName, setProductName] = useState('');
  const [productValue, setProductValue] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit() {
    setError(null);
    if (!customerName.trim()) {
      setError('Customer name is required.');
      return;
    }
    const value = productValue ? Number(productValue) : undefined;
    if (productValue && Number.isNaN(value)) {
      setError('Product value must be a number.');
      return;
    }
    setSubmitting(true);
    try {
      const created = await api.leads.create({
        customerName: customerName.trim(),
        area: area.trim() || undefined,
        stage: (stage as DealStage) ?? undefined,
        leadStatus: (status as LeadStatus) ?? undefined,
        industryId: industryId ?? undefined,
        products: productName.trim()
          ? [{ productName: productName.trim(), value }]
          : undefined,
      });
      router.replace(`/leads/${created.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create lead.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Screen edges={['top']}>
      <Header title="New Lead" onBack={() => router.back()} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={{ padding: space.lg, gap: space.lg, paddingBottom: 48 }}
          keyboardShouldPersistTaps="handled">
          <Field label="Customer name" value={customerName} onChangeText={setCustomerName} placeholder="Prospect name" />
          <Field label="Area" value={area} onChangeText={setArea} placeholder="Coimbatore" />
          <SelectField label="Stage" value={stage} onSelect={setStage} options={opts(STAGES)} />
          <SelectField label="Lead status" value={status} onSelect={setStatus} options={opts(STATUSES)} />
          <SelectField label="Industry" value={industryId} onSelect={setIndustryId} options={lookups?.industries ?? []} />
          <Txt variant="label">Interested product (optional)</Txt>
          <Field label="Product name" value={productName} onChangeText={setProductName} placeholder="Product A" />
          <Field label="Estimated value" value={productValue} onChangeText={setProductValue} placeholder="50000" keyboardType="numeric" />

          {error ? <Txt variant="body" color={c.danger}>{error}</Txt> : null}

          <Button title="Create lead" onPress={onSubmit} loading={submitting} icon="checkmark" />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
