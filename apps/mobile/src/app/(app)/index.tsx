import { useState } from 'react';
import { ScrollView, Text, View, Pressable } from 'react-native';
import { router } from 'expo-router';
import { PageLayout, MonthBar, KpiStrip, Card, SectionTitle, Badge, Avatar, Btn, Empty, Progress, QuickActionRow } from '@/gs/kit';
import { ME } from '@/gs/mock';
import { useStore } from '@/gs/store';
import { inr, lakhs, pct, shortDate, agingDays, projTone } from '@/gs/domain';
import { TrendUpIcon, PhoneIcon, TargetIcon, WalletIcon } from '@/gs/icons';

const NOW = new Date();

export default function Home() {
  const [refreshing, setRefreshing] = useState(false);
  const [year, setYear] = useState(NOW.getFullYear());
  const [month, setMonth] = useState(NOW.getMonth() + 1);

  const projections = useStore((s) => s.projections);
  const leads = useStore((s) => s.leads);
  const payments = useStore((s) => s.payments);
  const followups = useStore((s) => s.followups);

  const handleRefresh = () => { setRefreshing(true); setTimeout(() => setRefreshing(false), 500); };
  const prevMonth = () => { if (month === 1) { setMonth(12); setYear(y => y - 1); } else setMonth(m => m - 1); };
  const nextMonth = () => { if (month === 12) { setMonth(1); setYear(y => y + 1); } else setMonth(m => m + 1); };

  const recurringCommitted = projections.reduce((s, p) => s + p.projectedQty * p.price, 0);
  const recurringAchieved = projections.reduce((s, p) => s + p.achievedQty * p.price, 0);
  const newCommitted = leads.filter((l) => !['Closed Lost', 'No Requirement or Cold'].includes(l.stage)).reduce((s, l) => s + l.value, 0);
  const newAchieved = leads.filter((l) => l.stage === 'Closed Won').reduce((s, l) => s + l.value, 0);
  const totalCommitted = recurringCommitted + newCommitted;
  const totalAchieved = recurringAchieved + newAchieved;
  const achievementPct = totalCommitted > 0 ? (totalAchieved / totalCommitted) * 100 : 0;
  const weightedPipeline = projections.reduce((s, p) => s + p.projectedQty * p.price * (p.probability / 100), 0);
  const totalPending = payments.reduce((s, p) => s + p.pending, 0);
  const oral = leads.filter((l) => l.stage === 'Negotiation / Oral Confirmation');
  const topOpen = projections.filter((p) => p.projectedQty > 0 && !['Confirmed', 'Completed', 'Lost', 'Cancelled'].includes(p.status))
    .sort((a, b) => b.projectedQty * b.price - a.projectedQty * a.price).slice(0, 4);
  const dueToday = followups.filter((f) => (agingDays(f.dueDate) ?? -99) >= 0);
  const overdueCount = followups.filter((f) => (agingDays(f.dueDate) ?? -99) > 0).length;

  return (
    <PageLayout
      refreshing={refreshing}
      onRefresh={handleRefresh}
      zone1={
        <View className="flex-row items-center justify-between py-1">
          <View className="flex-1">
            <Text className="text-[11px] text-muted font-extrabold uppercase tracking-wider">{ME.region}</Text>
            <Text className="text-[20px] font-black text-ink tracking-tight mt-0.5">Hi, {ME.name.split(' ')[0]}</Text>
          </View>
          <Avatar name={ME.name} size={40} />
        </View>
      }
      zone2={
        <MonthBar year={year} month={month} onPrev={prevMonth} onNext={nextMonth} />
      }
      zone3={
        <KpiStrip items={[
          { label: 'Achieved', value: lakhs(totalAchieved), accent: true },
          { label: 'Target', value: lakhs(totalCommitted) },
          { label: 'Receivables', value: lakhs(totalPending), alert: totalPending > 500000 },
          { label: 'Follow-ups', value: String(dueToday.length), alert: overdueCount > 0 },
        ]} />
      }
    >
      {/* Target Achievement Hero Card — dark bg-ink card */}
      <View style={{ backgroundColor: '#0f172a', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#1e293b', shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 5 }}>
        <View className="flex-row items-center justify-between mb-3">
          <View>
            <Text style={{ fontSize: 10, color: '#94a3b8', fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase' }}>Monthly Sales Target</Text>
            <View className="flex-row items-baseline gap-1 mt-0.5">
              <Text style={{ fontSize: 24, color: '#ffffff', fontWeight: '900', letterSpacing: -0.5 }}>{lakhs(totalAchieved)}</Text>
              <Text style={{ fontSize: 14, color: '#64748b', fontWeight: '600' }}>/ {lakhs(totalCommitted)}</Text>
            </View>
          </View>
          <View style={{ backgroundColor: 'rgba(16,185,129,0.15)', borderWidth: 1, borderColor: 'rgba(16,185,129,0.35)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <TrendUpIcon size={13} color="#10b981" />
            <Text style={{ color: '#10b981', fontWeight: '900', fontSize: 12 }}>{pct(achievementPct, 0)} Achieved</Text>
          </View>
        </View>
        <Progress value={achievementPct} tone="won" height={8} />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#1e293b' }}>
          <Text style={{ fontSize: 11, color: '#94a3b8' }}>
            Recurring: <Text style={{ color: '#ffffff', fontWeight: '700' }}>{lakhs(recurringAchieved)}</Text>
          </Text>
          <Text style={{ fontSize: 11, color: '#94a3b8' }}>
            New Sales: <Text style={{ color: '#ffffff', fontWeight: '700' }}>{lakhs(newAchieved)}</Text>
          </Text>
          <Text style={{ fontSize: 11, color: '#94a3b8' }}>
            Pipeline: <Text style={{ color: '#10b981', fontWeight: '700' }}>{lakhs(weightedPipeline)}</Text>
          </Text>
        </View>
      </View>

      {/* Commercial Quick Action Bar */}
      <View className="flex-row gap-2">
        <Btn label="+ New Lead" onPress={() => router.push('/(app)/leads')} flex small />
        <Btn label="Customers" variant="soft" onPress={() => router.push('/(app)/customers')} flex small />
        <Btn label="Orders" variant="outline" onPress={() => router.push('/(app)/orders')} flex small />
        <Btn label="Payments" variant="outline" onPress={() => router.push('/(app)/payments')} flex small />
      </View>

      {/* Priority Deals at Oral Confirmation */}
      <Card>
        <SectionTitle count={`${oral.length} ${oral.length === 1 ? 'deal' : 'deals'}`}>Deals at Oral Confirmation</SectionTitle>
        <Text className="text-[11px] text-muted -mt-0.5 mb-2 font-medium">Hot opportunities ready for conversion.</Text>
        {oral.length === 0 ? (
          <Empty text="No deals at oral confirmation right now." />
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexDirection: 'row', gap: 10 }}>
            {oral.map((l) => (
              <Pressable
                key={l.id}
                onPress={() => router.push('/(app)/leads')}
                className="w-52 bg-brand-soft/50 border border-brand-border/60 rounded-xl p-3"
              >
                <Text className="text-[13px] font-black text-ink" numberOfLines={1}>{l.name}</Text>
                <Text className="text-[11px] text-muted mt-0.5">{l.contactName}</Text>
                <Text className="text-[16px] font-black text-brand mt-2">{inr(l.value)}</Text>
                <Text className="text-[10px] text-muted font-semibold mt-0.5">Close by {shortDate(l.expClose)}</Text>
              </Pressable>
            ))}
          </ScrollView>
        )}
      </Card>

      {/* Top Open Projections */}
      <Card>
        <SectionTitle count={`${topOpen.length} lines`}>Top Open Projections</SectionTitle>
        {topOpen.map((p) => (
          <Pressable key={p.id} onPress={() => router.push('/(app)/projections')}
            className="flex-row items-center justify-between py-2.5 border-t border-line/80"
          >
            <View className="flex-1 pr-2">
              <Text className="text-[13px] font-extrabold text-ink">{p.customerName}</Text>
              <Text className="text-[11px] text-muted mt-0.5">{p.principal} · {p.product}</Text>
            </View>
            <View className="items-end gap-1">
              <Text className="text-[14px] font-black text-brand">{inr(p.projectedQty * p.price)}</Text>
              <Badge label={p.status} tone={projTone(p.status)} small />
            </View>
          </Pressable>
        ))}
      </Card>

      {/* Follow-ups Feed */}
      <Card>
        <View className="flex-row items-center justify-between mb-1">
          <SectionTitle count={`${followups.length} scheduled`}>Follow-ups by Date</SectionTitle>
          <Pressable onPress={() => router.push('/(app)/followups')}>
            <Text className="text-xs font-extrabold text-brand">View all ›</Text>
          </Pressable>
        </View>
        <Text className="text-[11px] text-muted -mt-0.5 mb-2 font-medium">Recurring + New Sales + Collections</Text>
        {followups.slice(0, 4).map((f) => {
          const d = agingDays(f.dueDate) ?? 0;
          return (
            <Pressable key={f.id} onPress={() => router.push('/(app)/followups')}
              className="flex-row items-center justify-between py-2.5 border-t border-line/80"
            >
              <View className="flex-1 pr-2">
                <Text className="text-[13px] font-extrabold text-ink" numberOfLines={1}>{f.title}</Text>
                <Text className="text-[11px] text-muted mt-0.5">{f.subtitle}</Text>
              </View>
              <View className="items-end gap-0.5">
                <Text className={`text-[11px] font-extrabold ${d > 0 ? 'text-danger' : d === 0 ? 'text-amber' : 'text-muted'}`}>
                  {d > 0 ? `${d}d overdue` : d === 0 ? 'Due today' : shortDate(f.dueDate)}
                </Text>
                <Text className="text-xs font-black text-ink2">{inr(f.amount)}</Text>
              </View>
            </Pressable>
          );
        })}
      </Card>
    </PageLayout>
  );
}
