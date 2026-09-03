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
import type { DealStage } from '@greatsales/shared';
import { api } from '@/lib/api';
import { humanize, money, relativeDate, shortDate } from '@/lib/format';
import { useAsync } from '@/lib/hooks';
import { space, stageColor, useColors } from '@/lib/theme';

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
const stageOptions: Option[] = STAGES.map((s) => ({ id: s, label: humanize(s) }));

export default function LeadDetailScreen() {
  const c = useColors();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, loading, error, reload } = useAsync(() => api.leads.get(id), id);

  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  async function changeStage(stage: string) {
    setBusy(true);
    try {
      await api.leads.update(id, { stage: stage as DealStage });
      reload();
    } finally {
      setBusy(false);
    }
  }

  async function addNote() {
    if (!note.trim()) return;
    setBusy(true);
    try {
      await api.leads.addActivity(id, { note: note.trim() });
      setNote('');
      reload();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen edges={['top']}>
      <Header title="Lead" onBack={() => router.back()} />
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
              <View style={{ flexDirection: 'row', gap: space.sm }}>
                <Pill label={humanize(data!.stage)} color={stageColor[data!.stage] ?? c.textMuted} />
                {data!.leadStatus ? <Pill label={data!.leadStatus} color={c.primary} /> : null}
              </View>
              <Txt variant="caption">
                {[data!.area, `Opened ${shortDate(data!.createdAt)}`].filter(Boolean).join(' · ')}
              </Txt>
            </View>

            <View style={{ gap: 6 }}>
              <SelectField
                label="Stage"
                value={data!.stage}
                options={stageOptions}
                onSelect={changeStage}
              />
            </View>

            <View style={{ gap: space.sm }}>
              <Txt variant="heading">Products</Txt>
              {data!.products.length === 0 ? (
                <Card>
                  <Txt variant="caption">No products attached.</Txt>
                </Card>
              ) : (
                data!.products.map((p) => (
                  <Card key={p.id} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <View style={{ flex: 1 }}>
                      <Txt variant="body" style={{ fontWeight: '600' }}>{p.productName}</Txt>
                      {p.brand ? <Txt variant="caption">{p.brand}</Txt> : null}
                    </View>
                    {p.value ? <Txt variant="body">{money(p.value)}</Txt> : null}
                  </Card>
                ))
              )}
            </View>

            <View style={{ gap: space.sm }}>
              <Txt variant="heading">Activity</Txt>
              <Card style={{ gap: space.sm }}>
                <Field
                  label="Add a note"
                  value={note}
                  onChangeText={setNote}
                  placeholder="Called the buyer, sent quote…"
                  multiline
                />
                <Button title="Log activity" onPress={addNote} loading={busy} icon="add" variant="secondary" />
              </Card>
              {data!.activities.map((a) => (
                <Card key={a.id} style={{ gap: 4 }}>
                  <Txt variant="body">{a.note}</Txt>
                  <Txt variant="caption">{relativeDate(a.date)} · {shortDate(a.date)}</Txt>
                </Card>
              ))}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </Screen>
  );
}
