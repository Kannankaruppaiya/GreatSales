import { useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View, Pressable } from 'react-native';
import { router } from 'expo-router';
import { PageLayout, MonthBar, Card, SectionTitle, Badge, Avatar, Empty, BreakdownBars, BentoTile } from '@/gs/kit';
import { Arrive, CountUp, GrowBar } from '@/gs/motion';
import { C } from '@/gs/theme';
import { useAuthUser } from '@/gs/auth';
import { useDashboard } from '@/gs/queries/dashboard';
import { useFollowUps } from '@/gs/queries/followups';
import { usePayments } from '@/gs/queries/payments';
import { inr, lakhs, pct, shortDate, agingDays, projTone } from '@/gs/domain';
import { TrendUpIcon, PlusIcon, BuildingIcon, GridIcon, WalletIcon } from '@/gs/icons';

const NOW = new Date();

export default function Home() {
  const [refreshing, setRefreshing] = useState(false);
  const [year, setYear] = useState(NOW.getFullYear());
  const [month, setMonth] = useState(NOW.getMonth() + 1);

  const user = useAuthUser();
  const period = `${year}-${String(month).padStart(2, '0')}`;

  const dashboard = useDashboard(period);
  const followupsQuery = useFollowUps({ done: false });
  // Receivables are not part of the dashboard aggregate; they are reduced from
  // the payments list, the same way the More tab does it.
  const { items: payments } = usePayments();

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([dashboard.refetch(), followupsQuery.refetch()]);
    setRefreshing(false);
  };

  const prevMonth = () => { if (month === 1) { setMonth(12); setYear(y => y - 1); } else setMonth(m => m - 1); };
  const nextMonth = () => { if (month === 12) { setMonth(1); setYear(y => y + 1); } else setMonth(m => m + 1); };

  const d = dashboard.data;
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
  // Both halves of the follow-ups tile come from the server. Counting "due"
  // from the phone's clock while reading "overdue" off the aggregate is how the
  // tile ended up saying 0 due and 8 overdue at the same time — and the API
  // resolves the business day for the tenant, so two users in different
  // timezones would otherwise see different numbers for the same data.
  const dueCount = k?.followUpsDue ?? 0;
  const recurringAchieved = k?.recurringAchieved ?? 0;
  const newAchieved = k?.newSalesAchieved ?? 0;

  // Both lists come from the aggregate: the server already selected the oral
  // confirmation deals and the highest-value open projection lines, and both
  // are capped there.
  const oral = d?.oralConfirmationDeals ?? [];
  const topOpen = (d?.topOpenProjections ?? []).slice(0, 4);
  const bySalesperson = d?.bySalesperson ?? [];
  const byPrincipal = d?.byPrincipal ?? [];
  const byCategory = (d?.byCategory ?? []).filter(c => c.committed > 0 || c.achieved > 0);

  const isLoading = dashboard.isLoading;

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
    >
      {isLoading ? (
        <View className="flex-1 items-center justify-center py-20">
          <ActivityIndicator color="#10b981" size="large" />
          <Text className="text-muted text-xs mt-3 font-semibold">Loading your dashboard…</Text>
        </View>
      ) : (
        <>
          {/* ── Hero: the one number that matters, at the size it deserves ── */}
          <Arrive index={0}>
          <View style={{ backgroundColor: C.ink, borderRadius: 22, padding: 18, borderWidth: 1, borderColor: C.ink2, shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 6 }}>
            <View className="flex-row items-center justify-between mb-3">
              <View>
                <Text style={{ fontSize: 10, color: C.faint, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase' }}>Monthly Sales Target</Text>
                <View className="flex-row items-baseline gap-1.5 mt-1">
                  {/* Counting up is what makes a month-to-month change visible
                      instead of something you have to hold in your head. */}
                  <CountUp
                    value={totalAchieved}
                    format={lakhs}
                    style={{ fontSize: 44, lineHeight: 50, color: '#ffffff', fontWeight: '900', letterSpacing: -1.5 }}
                  />
                  <Text style={{ fontSize: 13, color: C.muted, fontWeight: '700' }}>/ {lakhs(totalCommitted)}</Text>
                </View>
              </View>
              <View style={{ backgroundColor: 'rgba(16,185,129,0.15)', borderWidth: 1, borderColor: 'rgba(16,185,129,0.35)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                <TrendUpIcon size={13} color={C.brandLight} />
                <Text style={{ color: C.brandLight, fontWeight: '900', fontSize: 12 }}>{pct(achievementPct, 0)} Achieved</Text>
              </View>
            </View>
            <GrowBar value={achievementPct} height={8} trackColor={C.ink2} fillColor={C.brandLight} />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: C.ink2 }}>
              <Text style={{ fontSize: 11, color: C.faint }}>Recurring: <Text style={{ color: '#ffffff', fontWeight: '700' }}>{lakhs(recurringAchieved)}</Text></Text>
              <Text style={{ fontSize: 11, color: C.faint }}>New Sales: <Text style={{ color: '#ffffff', fontWeight: '700' }}>{lakhs(newAchieved)}</Text></Text>
              <Text style={{ fontSize: 11, color: C.faint }}>Pipeline: <Text style={{ color: C.brandLight, fontWeight: '700' }}>{lakhs(openPipeline)}</Text></Text>
            </View>
          </View>
          </Arrive>

          {/* ── Bento grid. Varied emphasis, one number per tile, filled colour
                where the number is an obligation rather than an achievement. ── */}
          <View className="flex-row flex-wrap justify-between" style={{ gap: 10 }}>
            <BentoTile
              index={1}
              label="Achievement"
              value={pct(achievementPct, 0)}
              hint={`of ${lakhs(totalCommitted)} committed`}
              tone="brand"
            />
            <BentoTile
              index={2}
              label="Open pipeline"
              value={lakhs(openPipeline)}
              hint="new sales still in play"
            />
            <BentoTile
              index={3}
              label="Receivables"
              value={lakhs(totalPending)}
              hint={totalPending > 0 ? 'outstanding' : 'all collected'}
              tone={totalPending > 500000 ? 'amber' : 'neutral'}
              onPress={() => router.push('/(app)/payments')}
            />
            {/* The API counts these disjointly: `due` is today only, `overdue`
                is everything before today. Leading with "due" therefore
                announced 0 while eight follow-ups were already late — the most
                actionable number on the screen, hidden under the least. So the
                tile leads with whatever is actually demanding attention. */}
            <BentoTile
              index={4}
              label={overdueCount > 0 ? 'Follow-ups overdue' : 'Follow-ups due'}
              value={overdueCount > 0 ? overdueCount : dueCount}
              animate
              hint={
                overdueCount > 0
                  ? `${dueCount} more due today`
                  : dueCount > 0
                    ? 'due today, none late'
                    : 'nothing outstanding'
              }
              tone={overdueCount > 0 ? 'danger' : dueCount > 0 ? 'amber' : 'neutral'}
              onPress={() => router.push('/(app)/followups')}
            />
          </View>

          {/* Quick Actions */}
          <Arrive index={5}>
          <View className="flex-row justify-between px-1">
            {[
              { label: 'New Lead', Icon: PlusIcon, to: '/(app)/leads', accent: true },
              { label: 'Customers', Icon: BuildingIcon, to: '/(app)/customers' },
              { label: 'Orders', Icon: GridIcon, to: '/(app)/orders' },
              { label: 'Payments', Icon: WalletIcon, to: '/(app)/payments' },
            ].map(({ label, Icon, to, accent }) => (
              <Pressable
                key={label}
                onPress={() => router.push(to as never)}
                className="items-center gap-1.5"
                style={{ minWidth: 64, minHeight: 44 }}
              >
                <View
                  className={`h-14 w-14 rounded-full items-center justify-center border ${
                    accent ? 'bg-brand border-brand' : 'bg-surface border-line'
                  }`}
                >
                  <Icon size={20} color={accent ? '#ffffff' : '#334155'} />
                </View>
                <Text className="text-[10px] font-extrabold text-body">{label}</Text>
              </Pressable>
            ))}
          </View>
          </Arrive>

          {/* Deals at Oral Confirmation */}
          <Arrive index={6}>
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
          </Arrive>

          {/* Top Open Projections */}
          <Arrive index={7}>
          <Card>
            <SectionTitle count={`${topOpen.length} ${topOpen.length === 1 ? 'line' : 'lines'}`}>
              Top Open Projections
            </SectionTitle>
            {topOpen.length === 0 && <Empty text="No open projection lines this period." />}
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
          </Arrive>

          {/* Team, principal and category breakdowns.
              All three arrive in the dashboard aggregate and mobile was
              throwing them away. Each renders only when the server sent rows,
              which is also the role gate: bySalesperson comes back empty for a
              sales user looking at their own numbers. */}
          {bySalesperson.length > 0 && (
            <Card>
              <SectionTitle count={`${bySalesperson.length} ${bySalesperson.length === 1 ? 'person' : 'people'}`}>
                Committed vs Achieved
              </SectionTitle>
              <Text className="text-[11px] text-muted -mt-0.5 mb-1 font-medium">By salesperson, this period.</Text>
              <BreakdownBars rows={bySalesperson} format={lakhs} />
            </Card>
          )}

          {byPrincipal.length > 0 && (
            <Card>
              <SectionTitle count={`${byPrincipal.length} ${byPrincipal.length === 1 ? 'principal' : 'principals'}`}>
                Principal Performance
              </SectionTitle>
              <Text className="text-[11px] text-muted -mt-0.5 mb-1 font-medium">Recurring projections only.</Text>
              <BreakdownBars rows={byPrincipal} format={lakhs} />
            </Card>
          )}

          {byCategory.length > 0 && (
            <Card>
              <SectionTitle count={`${byCategory.length} ${byCategory.length === 1 ? 'tier' : 'tiers'}`}>
                Customer Category Mix
              </SectionTitle>
              <BreakdownBars
                rows={byCategory.map(c => ({ name: c.tier, committed: c.committed, achieved: c.achieved }))}
                format={lakhs}
                max={4}
              />
            </Card>
          )}

          {/* Follow-ups Feed */}
          <Card>
            <View className="flex-row items-center justify-between mb-1">
              <SectionTitle count={`${followups.length} scheduled`}>Follow-ups by Date</SectionTitle>
              <Pressable onPress={() => router.push('/(app)/followups')}>
                <Text className="text-xs font-extrabold text-brand">View all ›</Text>
              </Pressable>
            </View>
            <Text className="text-[11px] text-muted -mt-0.5 mb-2 font-medium">Recurring + New Sales + Collections</Text>
            {followups.length === 0 && <Empty text="Nothing scheduled. New follow-ups appear here." />}
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
