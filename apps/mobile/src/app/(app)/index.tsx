import { useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View, Pressable } from 'react-native';
import { router } from 'expo-router';
import { PageLayout, MonthBar, KpiStrip, Card, SectionTitle, Badge, Avatar, Btn, Empty, Progress } from '@/gs/kit';
import { useAuthUser } from '@/gs/auth';
import { useDashboard } from '@/gs/queries/dashboard';
import { useLeads } from '@/gs/queries/leads';
import { useProjections } from '@/gs/queries/projections';
import { useFollowUps } from '@/gs/queries/followups';
import { usePayments } from '@/gs/queries/payments';
import { inr, lakhs, pct, shortDate, agingDays, projTone } from '@/gs/domain';
import { TrendUpIcon } from '@/gs/icons';

const NOW = new Date();

export default function Home() {
  const [refreshing, setRefreshing] = useState(false);
  const [year, setYear] = useState(NOW.getFullYear());
  const [month, setMonth] = useState(NOW.getMonth() + 1);

  const user = useAuthUser();
  const period = `${year}-${String(month).padStart(2, '0')}`;

  const dashboard = useDashboard(period);
  const leadsQuery = useLeads();
  const projQuery = useProjections({ period });
  const followupsQuery = useFollowUps({ done: false });
  // Receivables are not part of the dashboard aggregate; they are reduced from
  // the payments list, the same way the More tab does it.
  const { items: payments } = usePayments();

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      dashboard.refetch(),
      leadsQuery.refetch(),
      projQuery.refetch(),
      followupsQuery.refetch(),
    ]);
    setRefreshing(false);
  };

  const prevMonth = () => { if (month === 1) { setMonth(12); setYear(y => y - 1); } else setMonth(m => m - 1); };
  const nextMonth = () => { if (month === 12) { setMonth(1); setYear(y => y + 1); } else setMonth(m => m + 1); };

  const d = dashboard.data;
  const leads = leadsQuery.items;
  const projLines = projQuery.data?.lines ?? [];
  const followups = followupsQuery.items;

  // Derived
  const k = d?.kpis;
  const totalAchieved = k?.totalAchieved ?? 0;
  const totalCommitted = k?.totalCommitted ?? 0;
  const achievementPct = k?.totalPct ?? 0;
  // Open new-sales value: committed counts every live lead, achieved counts the
  // ones already won, so the difference is what is still in play. The API has
  // no `weightedPipeline` field — the old code read one that never existed.
  const openPipeline = Math.max(0, (k?.newSalesCommitted ?? 0) - (k?.newSalesAchieved ?? 0));
  const totalPending = payments.reduce((sum, pay) => sum + pay.pending, 0);
  const overdueCount = k?.followUpsOverdue ?? 0;
  const recurringAchieved = k?.recurringAchieved ?? 0;
  const newAchieved = k?.newSalesAchieved ?? 0;

  const oral = leads.filter(l => l.stage === 'NegotiationOralConfirmation');
  const topOpen = projLines
    .filter(p => !['Confirmed', 'Completed', 'Lost', 'Cancelled'].includes(p.status))
    .sort((a, b) => b.projValue - a.projValue)
    .slice(0, 4);
  const dueToday = followups.filter(f => (agingDays(f.dueDate) ?? -99) >= 0);

  const isLoading = dashboard.isLoading && leadsQuery.isLoading && projQuery.isLoading;

  return (
    <PageLayout
      refreshing={refreshing}
      onRefresh={() => { void handleRefresh(); }}
      zone1={
        <View className="flex-row items-center justify-between py-1">
          <View className="flex-1">
            <Text className="text-[11px] text-muted font-extrabold uppercase tracking-wider">
              {user?.role ?? ''}
            </Text>
            <Text className="text-[20px] font-black text-ink tracking-tight mt-0.5">
              Hi, {user?.name.split(' ')[0] ?? '…'}
            </Text>
          </View>
          <Avatar name={user?.name ?? '?'} size={40} />
        </View>
      }
      zone2={<MonthBar year={year} month={month} onPrev={prevMonth} onNext={nextMonth} />}
      zone3={
        <KpiStrip items={[
          { label: 'Achieved', value: lakhs(totalAchieved), accent: true },
          { label: 'Target', value: lakhs(totalCommitted) },
          { label: 'Receivables', value: lakhs(totalPending), alert: totalPending > 500000 },
          { label: 'Follow-ups', value: String(dueToday.length), alert: overdueCount > 0 },
        ]} />
      }
    >
      {isLoading ? (
        <View className="flex-1 items-center justify-center py-20">
          <ActivityIndicator color="#10b981" size="large" />
          <Text className="text-muted text-xs mt-3 font-semibold">Loading your dashboard…</Text>
        </View>
      ) : (
        <>
          {/* Target Achievement Hero Card */}
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
              <Text style={{ fontSize: 11, color: '#94a3b8' }}>Recurring: <Text style={{ color: '#ffffff', fontWeight: '700' }}>{lakhs(recurringAchieved)}</Text></Text>
              <Text style={{ fontSize: 11, color: '#94a3b8' }}>New Sales: <Text style={{ color: '#ffffff', fontWeight: '700' }}>{lakhs(newAchieved)}</Text></Text>
              <Text style={{ fontSize: 11, color: '#94a3b8' }}>Pipeline: <Text style={{ color: '#10b981', fontWeight: '700' }}>{lakhs(openPipeline)}</Text></Text>
            </View>
          </View>

          {/* Quick Actions */}
          <View className="flex-row gap-2">
            <Btn label="+ New Lead" onPress={() => router.push('/(app)/leads')} flex small />
            <Btn label="Customers" variant="soft" onPress={() => router.push('/(app)/customers')} flex small />
            <Btn label="Orders" variant="outline" onPress={() => router.push('/(app)/orders')} flex small />
            <Btn label="Payments" variant="outline" onPress={() => router.push('/(app)/payments')} flex small />
          </View>

          {/* Deals at Oral Confirmation */}
          <Card>
            <SectionTitle count={`${oral.length} ${oral.length === 1 ? 'deal' : 'deals'}`}>Deals at Oral Confirmation</SectionTitle>
            <Text className="text-[11px] text-muted -mt-0.5 mb-2 font-medium">Hot opportunities ready for conversion.</Text>
            {oral.length === 0 ? (
              <Empty text="No deals at oral confirmation right now." />
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexDirection: 'row', gap: 10 }}>
                {oral.map(l => (
                  <Pressable key={l.id} onPress={() => router.push('/(app)/leads')} className="w-52 bg-brand-soft/50 border border-brand-border/60 rounded-xl p-3">
                    <Text className="text-[13px] font-black text-ink" numberOfLines={1}>{l.customerName}</Text>
                    <Text className="text-[11px] text-muted mt-0.5">{l.contactName}</Text>
                    <Text className="text-[16px] font-black text-brand mt-2">{inr(l.totalValue)}</Text>
                    <Text className="text-[10px] text-muted font-semibold mt-0.5">Close by {shortDate(l.expClose)}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            )}
          </Card>

          {/* Top Open Projections */}
          <Card>
            <SectionTitle count={`${topOpen.length} lines`}>Top Open Projections</SectionTitle>
            {topOpen.map(p => (
              <Pressable key={p.id} onPress={() => router.push('/(app)/projections')}
                className="flex-row items-center justify-between py-2.5 border-t border-line/80"
              >
                <View className="flex-1 pr-2">
                  <Text className="text-[13px] font-extrabold text-ink">{p.customerName}</Text>
                  <Text className="text-[11px] text-muted mt-0.5">{p.principalName} · {p.productName}</Text>
                </View>
                <View className="items-end gap-1">
                  <Text className="text-[14px] font-black text-brand">{inr(p.projValue)}</Text>
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
            {followups.slice(0, 4).map(f => {
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
                    <Text className="text-xs font-black text-ink2">{inr(f.amount ?? 0)}</Text>
                  </View>
                </Pressable>
              );
            })}
          </Card>
        </>
      )}
    </PageLayout>
  );
}
