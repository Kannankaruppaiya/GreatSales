import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Screen, Card, Badge, SectionTitle, Empty } from '@/gs/kit';
import { useStore, actions } from '@/gs/store';
import { inr, shortDate, agingDays, type FollowUp, type FollowUpKind } from '@/gs/domain';
import type { Tone } from '@/gs/theme';

const kindTone: Record<FollowUpKind, Tone> = { projection: 'open', lead: 'hot', payment: 'lost' };
const kindLabel: Record<FollowUpKind, string> = { projection: 'Recurring', lead: 'New Sales', payment: 'Payment' };

export default function FollowUps() {
  const followups = useStore((s) => s.followups);
  const overdue = followups.filter((f) => (agingDays(f.dueDate) ?? 0) > 0).sort(byDue);
  const today = followups.filter((f) => agingDays(f.dueDate) === 0).sort(byDue);
  const upcoming = followups.filter((f) => (agingDays(f.dueDate) ?? 0) < 0).sort(byDue);

  return (
    <Screen>
      <View className="mb-2">
        <Text className="text-[22px] font-black text-ink tracking-tight">Follow-up Schedule</Text>
        <Text className="text-xs text-muted font-medium mt-0.5">
          {overdue.length} overdue · {today.length} scheduled today
        </Text>
      </View>

      <Group title="Overdue Follow-ups" tone="lost" items={overdue} />
      <Group title="Due Today" tone="hot" items={today} />
      <Group title="Upcoming Schedule" tone="open" items={upcoming} />
    </Screen>
  );
}

const byDue = (a: FollowUp, b: FollowUp) => a.dueDate.localeCompare(b.dueDate);

function Group({ title, tone, items }: { title: string; tone: Tone; items: FollowUp[] }) {
  const handleOpen = (kind: FollowUpKind) => {
    if (kind === 'projection') router.push('/(app)/projections');
    else if (kind === 'lead') router.push('/(app)/leads');
    else if (kind === 'payment') router.push('/(app)/payments');
  };

  const dotColor: Record<Tone, string> = { won: 'bg-brand', hot: 'bg-amber', open: 'bg-info', lost: 'bg-danger', neutral: 'bg-muted' };

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
              onOpen={() => handleOpen(f.kind)}
            />
          );
        })
      )}
    </View>
  );
}

function FollowUpCard({
  f, d, tone, dotColor, onOpen,
}: {
  f: FollowUp;
  d: number;
  tone: Tone;
  dotColor: string;
  onOpen: () => void;
}) {
  const [snoozeOpen, setSnoozeOpen] = useState(false);

  return (
    <Card>
      <View className="flex-row gap-3">
        <View className={`w-2.5 h-2.5 rounded-full mt-1.5 ${dotColor}`} />
        <View className="flex-1">
          <View className="flex-row items-center justify-between gap-2">
            <Text className="text-[14px] font-black text-ink flex-1" numberOfLines={1}>{f.title}</Text>
            <Badge label={f.kind === 'projection' ? 'Recurring' : f.kind === 'lead' ? 'New Sales' : 'Payment'} tone={kindTone[f.kind]} small showDot />
          </View>
          <Text className="text-[11px] text-muted font-medium mt-0.5">{f.subtitle}</Text>

          {/* Status line */}
          <View className="flex-row justify-between items-center mt-3 pt-2.5 border-t border-line/80">
            <Text
              className={`text-[11px] font-extrabold ${
                tone === 'lost' ? 'text-danger' : tone === 'hot' ? 'text-amber-dark' : 'text-muted'
              }`}
            >
              {d > 0 ? `${d}d overdue` : d === 0 ? 'Due today' : `Due on ${shortDate(f.dueDate)}`}
            </Text>
            <Text className="text-[13px] font-black text-ink">{inr(f.amount)}</Text>
          </View>

          {/* Action row */}
          <View className="flex-row gap-2 mt-2.5">
            {/* Done */}
            <Pressable
              onPress={() => actions.markFollowUpDone(f.id)}
              className="flex-1 flex-row items-center justify-center gap-1.5 py-2.5 rounded-xl bg-brand-soft border border-brand-border/60"
            >
              <View className="w-3.5 h-3.5 rounded-full bg-brand items-center justify-center">
                <Text className="text-white text-[8px] font-black">✓</Text>
              </View>
              <Text className="text-brand-dark font-black text-xs">Done</Text>
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
          </View>

          {/* Snooze options */}
          {snoozeOpen ? (
            <View className="flex-row gap-2 mt-2">
              {[1, 3, 7].map((days) => (
                <Pressable
                  key={days}
                  onPress={() => { actions.snoozeFollowUp(f.id, days); setSnoozeOpen(false); }}
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
