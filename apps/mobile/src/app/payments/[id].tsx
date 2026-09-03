import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';

import {
  Button,
  Card,
  ErrorState,
  Field,
  Header,
  Loading,
  Pill,
  Screen,
  SelectField,
  Txt,
  type Option,
} from '@/components/ui';
import type { PaymentStatus } from '@greatsales/shared';
import { api } from '@/lib/api';
import { money, shortDate } from '@/lib/format';
import { useAsync } from '@/lib/hooks';
import { paymentStatusColor, space, useColors } from '@/lib/theme';

const STATUSES: PaymentStatus[] = ['Pending', 'PartiallyPaid', 'Paid', 'Overdue'];
const statusOptions: Option[] = STATUSES.map((s) => ({ id: s, label: s }));

export default function PaymentDetailScreen() {
  const c = useColors();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, loading, error, reload } = useAsync(() => api.payments.get(id), id);

  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  async function changeStatus(status: string) {
    setBusy(true);
    try {
      await api.payments.update(id, { status: status as PaymentStatus });
      reload();
    } finally {
      setBusy(false);
    }
  }

  async function addFollowup() {
    if (!note.trim()) return;
    setBusy(true);
    try {
      await api.payments.addFollowup(id, { note: note.trim() });
      setNote('');
      reload();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen edges={['top']}>
      <Header title="Invoice" onBack={() => router.back()} />
      {loading && !data ? (
        <Loading />
      ) : error && !data ? (
        <ErrorState message={error} onRetry={reload} />
      ) : (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.lg }}>
            <View style={{ gap: space.sm }}>
              <Txt variant="heading">{data!.customerName}</Txt>
              <Txt variant="caption">Invoice {data!.invoiceNo}</Txt>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Txt variant="stat">{money(data!.amount)}</Txt>
                <Pill label={data!.status} color={paymentStatusColor[data!.status] ?? c.textMuted} />
              </View>
            </View>

            <Card style={{ gap: space.md }}>
              <DetailRow label="Due date" value={shortDate(data!.dueDate)} />
              <DetailRow label="Aging" value={data!.agingDays != null ? `${data!.agingDays} days` : '—'} />
              <DetailRow label="Pay zone" value={data!.payZone ?? '—'} />
            </Card>

            <SelectField
              label="Update status"
              value={data!.status}
              options={statusOptions}
              onSelect={changeStatus}
            />

            <View style={{ gap: space.sm }}>
              <Txt variant="heading">Collection follow-ups</Txt>
              <Card style={{ gap: space.sm }}>
                <Field
                  label="Add a follow-up note"
                  value={note}
                  onChangeText={setNote}
                  placeholder="Spoke to accounts, promised by Friday…"
                  multiline
                />
                <Button title="Log follow-up" onPress={addFollowup} loading={busy} icon="add" variant="secondary" />
              </Card>
              {data!.followups.map((f) => (
                <Card key={f.id} style={{ gap: 4 }}>
                  <Txt variant="body">{f.note}</Txt>
                  <Txt variant="caption">
                    {shortDate(f.date)}
                    {f.nextFollowupDate ? ` · next ${shortDate(f.nextFollowupDate)}` : ''}
                  </Txt>
                </Card>
              ))}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </Screen>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
      <Txt variant="label">{label}</Txt>
      <Txt variant="body">{value}</Txt>
    </View>
  );
}
