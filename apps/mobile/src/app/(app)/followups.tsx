import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Screen, Card, Badge, SectionTitle, Empty } from '@/gs/kit';
import { useFollowUps, useUpdateFollowUp, useMarkFollowUpDone, useDeleteFollowUp, type FollowUpRow } from '@/gs/queries/followups';
import { inr, shortDate, agingDays } from '@/gs/domain';
import type { Tone } from '@/gs/theme';
import { C } from '@/gs/theme';
import { Sheet, Field, Input, Pills, ModalBtn } from '@/gs/modal';
import { useAuthUser } from '@/gs/auth';
import { ApiError } from '@/gs/api';
import { useCreateFollowUp } from '@/gs/queries/followups';
import { useCustomers } from '@/gs/queries/customers';
import { usePayments } from '@/gs/queries/payments';
import { useLeads } from '@/gs/queries/leads';
import type { EntityTypeValue } from '@greatsales/shared';

const entityTone: Record<EntityTypeValue, Tone> = {
  Projection: 'open',
  Lead: 'hot',
  Payment: 'lost',
  Customer: 'won',
  Order: 'open',
};

const entityLabel: Record<EntityTypeValue, string> = {
  Projection: 'Recurring',
  Lead: 'New Sales',
  Payment: 'Payment',
  Customer: 'Account',
  Order: 'Sales Order',
};

const byDue = (a: FollowUpRow, b: FollowUpRow) => a.dueDate.localeCompare(b.dueDate);

export default function FollowUps() {
  // Overdue / today / upcoming are buckets over the whole open set — an
  // "overdue" count that only covered the first page would be the wrong number
  // on the one screen that exists to say what is late.
  const {
    items: followups,
    isLoadingAll: isLoading,
    refetch,
  } = useFollowUps({ done: false }, { autoFetchAll: true });
  const [showAdd, setShowAdd] = useState(false);

  const overdue = followups.filter((f) => (agingDays(f.dueDate) ?? 0) > 0).sort(byDue);
  const today = followups.filter((f) => agingDays(f.dueDate) === 0).sort(byDue);
  const upcoming = followups.filter((f) => (agingDays(f.dueDate) ?? 0) < 0).sort(byDue);

  return (
    <Screen>
      <View className="mb-2">
        <Pressable onPress={() => router.back()} hitSlop={12} className="flex-row items-center gap-0.5 mb-1">
          <Text className="text-brand font-black text-xs">‹ Dashboard</Text>
        </Pressable>
        <View className="flex-row items-center justify-between">
          <Text className="text-[22px] font-black text-ink tracking-tight">Follow-up Schedule</Text>
          <Pressable onPress={() => setShowAdd(true)} className="bg-brand px-3.5 py-2 rounded-xl shadow-sm">
            <Text className="text-white font-black text-xs">+ Follow-up</Text>
          </Pressable>
        </View>
        <Text className="text-xs text-muted font-medium mt-0.5">
          {overdue.length} overdue · {today.length} scheduled today
        </Text>
      </View>

      {/* A follow-up could only be created from a projection row before this,
          so anything a rep agreed on a call about an invoice or an account had
          nowhere to live. */}
      <Sheet
        open={showAdd}
        onClose={() => setShowAdd(false)}
        title="New follow-up"
        subtitle="Against a customer, an invoice or a deal"
      >
        <AddFollowUpForm onDone={() => setShowAdd(false)} />
      </Sheet>

      {isLoading ? (
        <View className="py-20 items-center justify-center">
          <ActivityIndicator size="large" color={C.brand} />
          <Text className="text-xs text-muted font-medium mt-3">Loading follow-ups…</Text>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="gap-5 pb-24">
          <Group title="Overdue Follow-ups" tone="lost" items={overdue} onRefresh={refetch} />
          <Group title="Due Today" tone="hot" items={today} onRefresh={refetch} />
          <Group title="Upcoming Schedule" tone="open" items={upcoming} onRefresh={refetch} />
        </ScrollView>
      )}
    </Screen>
  );
}

function Group({
  title,
  tone,
  items,
  onRefresh,
}: {
  title: string;
  tone: Tone;
  items: FollowUpRow[];
  onRefresh: () => void;
}) {
  const handleOpen = (entityType: EntityTypeValue) => {
    if (entityType === 'Projection') router.push('/(app)/projections');
    else if (entityType === 'Lead') router.push('/(app)/leads');
    else if (entityType === 'Payment') router.push('/(app)/payments');
    else if (entityType === 'Customer') router.push('/(app)/customers');
    else if (entityType === 'Order') router.push('/(app)/orders');
  };

  const dotColor: Record<Tone, string> = {
    won: 'bg-brand',
    hot: 'bg-amber',
    open: 'bg-info',
    lost: 'bg-danger',
    neutral: 'bg-muted',
  };

  return (
    <View className="gap-2.5">
      <SectionTitle count={items.length}>{title}</SectionTitle>
      {items.length === 0 ? (
        <Empty text={`No items ${title.toLowerCase()}.`} />
      ) : (
        items.map((f) => {
          const d = agingDays(f.dueDate) ?? 0;
          return (
            <FollowUpCard
              key={f.id}
              f={f}
              d={d}
              tone={tone}
              dotColor={dotColor[tone]}
              onOpen={() => handleOpen(f.entityType)}
            />
          );
        })
      )}
    </View>
  );
}

function FollowUpCard({
  f,
  d,
  tone,
  dotColor,
  onOpen,
}: {
  f: FollowUpRow;
  d: number;
  tone: Tone;
  dotColor: string;
  onOpen: () => void;
}) {
  const [snoozeOpen, setSnoozeOpen] = useState(false);
  const markDone = useMarkFollowUpDone();
  const updateFollowUp = useUpdateFollowUp();
  const deleteFollowUp = useDeleteFollowUp();

  const handleSnooze = (days: number) => {
    const dt = new Date(f.dueDate);
    dt.setDate(dt.getDate() + days);
    const nextDate = dt.toISOString().slice(0, 10);
    updateFollowUp.mutate({
      id: f.id,
      patch: { dueDate: nextDate },
    });
    setSnoozeOpen(false);
  };

  return (
    <Card>
      <View className="flex-row gap-3">
        <View className={`w-2.5 h-2.5 rounded-full mt-1.5 ${dotColor}`} />
        <View className="flex-1">
          <View className="flex-row items-center justify-between gap-2">
            <Text className="text-[14px] font-black text-ink flex-1" numberOfLines={1}>
              {f.title || f.note || 'Follow-up task'}
            </Text>
            <Badge label={entityLabel[f.entityType] || f.entityType} tone={entityTone[f.entityType] || 'open'} small showDot />
          </View>
          {f.subtitle ? (
            <Text className="text-[11px] text-muted font-medium mt-0.5">{f.subtitle}</Text>
          ) : null}
          {f.note && f.title ? (
            <Text className="text-xs text-ink2 font-medium mt-1">{f.note}</Text>
          ) : null}

          {/* Status line */}
          <View className="flex-row justify-between items-center mt-3 pt-2.5 border-t border-line/80">
            <Text
              className={`text-[11px] font-extrabold ${
                tone === 'lost' ? 'text-danger' : tone === 'hot' ? 'text-amber-dark' : 'text-muted'
              }`}
            >
              {d > 0 ? `${d}d overdue` : d === 0 ? 'Due today' : `Due on ${shortDate(f.dueDate)}`}
            </Text>
            {f.amount != null ? (
              <Text className="text-[13px] font-black text-ink">{inr(f.amount)}</Text>
            ) : null}
          </View>

          {/* Action row */}
          <View className="flex-row gap-2 mt-2.5">
            {/* Done */}
            <Pressable
              onPress={() => markDone.mutate(f.id)}
              disabled={markDone.isPending}
              className="flex-1 flex-row items-center justify-center gap-1.5 py-2.5 rounded-xl bg-brand-soft border border-brand-border/60"
            >
              <View className="w-3.5 h-3.5 rounded-full bg-brand items-center justify-center">
                <Text className="text-white text-[8px] font-black">✓</Text>
              </View>
              <Text className="text-brand-dark font-black text-xs">
                {markDone.isPending ? 'Done…' : 'Done'}
              </Text>
            </Pressable>

            {/* Snooze */}
            <Pressable
              onPress={() => setSnoozeOpen(!snoozeOpen)}
              className="flex-1 flex-row items-center justify-center gap-1.5 py-2.5 rounded-xl bg-surface border border-line"
            >
              <Text className="text-muted font-black text-xs">Snooze</Text>
            </Pressable>

            {/* Open module */}
            <Pressable
              onPress={onOpen}
              className="flex-1 flex-row items-center justify-center gap-1.5 py-2.5 rounded-xl bg-surface3 border border-line/50"
            >
              <Text className="text-ink2 font-black text-xs">Open</Text>
            </Pressable>

            {/* Drop. Distinct from Done on purpose: "done" records that the
                task happened, "drop" says it should never have been raised.
                Marking a mistake as done corrupts the follow-up history that
                the overdue counts are built from. */}
            <Pressable
              onPress={() =>
                Alert.alert(
                  'Drop this follow-up?',
                  'It is removed from the timeline entirely. If you actually did it, use Done instead so it stays in the history.',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Drop',
                      style: 'destructive',
                      onPress: () => deleteFollowUp.mutate(f.id),
                    },
                  ],
                )
              }
              disabled={deleteFollowUp.isPending}
              className="px-3 flex-row items-center justify-center py-2.5 rounded-xl bg-red-soft border border-red-border/60"
            >
              <Text className="text-danger font-black text-xs">Drop</Text>
            </Pressable>
          </View>

          {/* Snooze options */}
          {snoozeOpen ? (
            <View className="flex-row gap-2 mt-2">
              {[1, 3, 7].map((days) => (
                <Pressable
                  key={days}
                  onPress={() => handleSnooze(days)}
                  disabled={updateFollowUp.isPending}
                  className="flex-1 py-2 rounded-lg bg-amber-soft border border-amber-border/60 items-center"
                >
                  <Text className="text-amber-dark font-black text-[11px]">+{days}d</Text>
                </Pressable>
              ))}
            </View>
          ) : null}
        </View>
      </View>
    </Card>
  );
}

/**
 * Create a follow-up against a customer, an invoice or a deal.
 *
 * `entityType` + `entityId` are required by the API — a follow-up is always
 * ABOUT something, and one floating free would never surface on the record it
 * concerns. So the form makes you pick the record, rather than accepting a
 * title and quietly inventing an id.
 */
function AddFollowUpForm({ onDone }: { onDone: () => void }) {
  const user = useAuthUser();
  const createFollowUp = useCreateFollowUp();
  const [kind, setKind] = useState<'Customer' | 'Payment' | 'Lead'>('Customer');
  const [entityId, setEntityId] = useState('');
  const [dueDate, setDueDate] = useState(new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState('');
  const [err, setErr] = useState('');

  const customersQ = useCustomers({}, { enabled: kind === 'Customer', autoFetchAll: true });
  const paymentsQ = usePayments({}, { enabled: kind === 'Payment', autoFetchAll: true });
  const leadsQ = useLeads({}, { enabled: kind === 'Lead', autoFetchAll: true });

  const options: { id: string; label: string }[] =
    kind === 'Customer'
      ? customersQ.items.map((c) => ({ id: c.id, label: c.name }))
      : kind === 'Payment'
        ? paymentsQ.items.map((p) => ({
            id: p.id,
            label: `${p.refNo || p.invoiceNo || 'Invoice'} · ${p.customerName || ''}`,
          }))
        : leadsQ.items.map((l) => ({ id: l.id, label: l.customerName }));

  const submit = async () => {
    setErr('');
    if (!entityId) { setErr('Pick the record this follow-up is about.'); return; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) { setErr('Due date must be YYYY-MM-DD.'); return; }
    try {
      await createFollowUp.mutateAsync({
        entityType: kind,
        entityId,
        dueDate,
        salespersonId: user?.userId ?? null,
        title: options.find((o) => o.id === entityId)?.label ?? null,
        note: note.trim() || null,
      });
      onDone();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Could not save the follow-up.');
    }
  };

  return (
    <View className="gap-3">
      <Field label="About">
        <Pills
          options={['Customer', 'Payment', 'Lead']}
          value={kind}
          onChange={(k) => {
            setKind(k as 'Customer' | 'Payment' | 'Lead');
            // The old id belongs to the old record type.
            setEntityId('');
          }}
        />
      </Field>

      <Field label="Record">
        {options.length === 0 ? (
          <Text className="text-xs text-muted font-medium px-1 py-2">Nothing to choose yet.</Text>
        ) : (
          <ScrollView style={{ maxHeight: 170 }} className="border border-line rounded-xl p-1 bg-surface">
            {options.map((o) => (
              <Pressable
                key={o.id}
                onPress={() => setEntityId(o.id)}
                className={`px-3 py-2 rounded-lg ${entityId === o.id ? 'bg-brand' : ''}`}
              >
                <Text className={`text-xs font-black ${entityId === o.id ? 'text-white' : 'text-ink'}`}>
                  {o.label}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        )}
      </Field>

      <Field label="Due Date (YYYY-MM-DD)">
        <Input value={dueDate} onChangeText={setDueDate} placeholder="2026-09-30" />
      </Field>

      <Field label="Note (optional)">
        <Input value={note} onChangeText={setNote} placeholder="What was agreed?" />
      </Field>

      {err ? <Text className="text-xs text-danger font-bold">{err}</Text> : null}

      <View className="flex-row gap-2 mt-1">
        <ModalBtn label="Cancel" variant="ghost" onPress={onDone} />
        <ModalBtn
          label={createFollowUp.isPending ? 'Saving…' : 'Create Follow-up'}
          disabled={!entityId || createFollowUp.isPending}
          onPress={() => void submit()}
        />
      </View>
    </View>
  );
}
