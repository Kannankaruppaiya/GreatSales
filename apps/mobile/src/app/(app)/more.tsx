import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { PageLayout, KpiStrip, Card, Avatar, SectionTitle } from '@/gs/kit';
import { useAuthUser } from '@/gs/auth';
import { useDashboard } from '@/gs/queries/dashboard';
import { useOrders } from '@/gs/queries/orders';
import { usePayments } from '@/gs/queries/payments';
import { useCustomers } from '@/gs/queries/customers';
import { useLeads } from '@/gs/queries/leads';
import { useMappings } from '@/gs/queries/catalog';
import { currentPeriod } from '@greatsales/shared';
import { lakhs, pct } from '@/gs/domain';
import { WalletIcon, TargetIcon, ChartIcon, GridIcon, SparklesIcon } from '@/gs/icons';

export default function More() {
  const user = useAuthUser();

  const { data: d } = useDashboard(currentPeriod());
  // `total` for the hint counts, `items` for the rows the tiles reduce over.
  // The hints used to read `orders.length` off a capped single request, so a
  // rep with 300 orders was told they had 100.
  const { items: orders, total: orderTotal } = useOrders();
  const { items: payments } = usePayments();
  const { items: customers, total: customerTotal } = useCustomers();
  const { items: leads } = useLeads();
  // Count only — the hint says how many rows the mapping screen holds.
  const { total: mappingTotal } = useMappings();

  const totalReceivables = payments.reduce((s, p) => s + p.pending, 0);
  const openLeads = leads.filter((l) => !['ClosedWon', 'ClosedLost', 'NoRequirementOrCold'].includes(l.stage));
  const recurringAchieved = d?.kpis.recurringAchieved ?? 0;
  const recurringCommitted = d?.kpis.recurringCommitted ?? 0;
  const overdueFollowups = d?.kpis.followUpsOverdue ?? 0;

  const pendingPayments = payments.filter((p) => p.pending > 0);

  const links = [
    { label: 'Sales Orders', to: '/(app)/orders', hint: `${orderTotal} orders tracked`, icon: <ChartIcon size={20} color="#059669" /> },
    { label: 'Payments Follow-up', to: '/(app)/payments', hint: `${pendingPayments.length} pending · ${lakhs(totalReceivables)} outstanding`, icon: <WalletIcon size={20} color="#d97706" /> },
    { label: 'My Customers', to: '/(app)/customers', hint: `${customerTotal} mapped accounts`, icon: <TargetIcon size={20} color="#2563eb" /> },
    { label: 'My Customer Mapping', to: '/(app)/mappings', hint: `${mappingTotal} customer x product rows`, icon: <SparklesIcon size={20} color="#7c3aed" /> },
    { label: 'Profile & Settings', to: '/(app)/profile', hint: 'Account security & session', icon: <GridIcon size={20} color="#64748b" /> },
  ] as const;

  return (
    <PageLayout
      zone1={
        <View className="flex-row items-center justify-between py-1">
          <View className="flex-1">
            <Text className="text-[11px] text-muted font-extrabold uppercase tracking-wider">More Features</Text>
            <Text className="text-[20px] font-black text-ink tracking-tight mt-0.5">Hub & Settings</Text>
          </View>
          <Avatar name={user?.name || 'User'} size={40} />
        </View>
      }
      zone2={
        <KpiStrip items={[
          { label: 'Recurring', value: lakhs(recurringAchieved), accent: recurringAchieved > 0 },
          { label: 'Pipeline', value: String(openLeads.length) },
          { label: 'Receivables', value: lakhs(totalReceivables), alert: totalReceivables > 200000 },
          { label: 'Overdue FU', value: String(overdueFollowups), alert: overdueFollowups > 0 },
        ]} />
      }
    >
      {/* Salesperson Profile Card */}
      <Card onPress={() => router.push('/(app)/profile')}>
        <View className="flex-row items-center gap-3.5">
          <Avatar name={user?.name || 'User'} size={52} />
          <View className="flex-1">
            <Text className="text-[17px] font-black text-ink">{user?.name || 'User'}</Text>
            <Text className="text-[11px] text-brand font-extrabold mt-0.5">
              {user?.role || 'Salesperson'} · <Text className="text-muted">{user?.email || ''}</Text>
            </Text>
          </View>
          <View className="bg-surface3 w-8 h-8 rounded-full items-center justify-center">
            <Text className="text-muted font-black text-sm">›</Text>
          </View>
        </View>
      </Card>

      {/* This Month Scorecard */}
      <Card>
        <SectionTitle>This Month Scorecard</SectionTitle>
        <View className="flex-row gap-2 mt-2">
          <View className="flex-1 bg-brand-soft border border-brand-border/60 rounded-xl p-3 items-center">
            <Text className="text-[20px] font-black text-brand">{orders.length}</Text>
            <Text className="text-[10px] font-extrabold text-muted uppercase tracking-wide mt-0.5">Orders</Text>
          </View>
          <View className="flex-1 bg-amber-soft border border-amber-border/60 rounded-xl p-3 items-center">
            <Text className="text-[20px] font-black text-amber">{openLeads.length}</Text>
            <Text className="text-[10px] font-extrabold text-muted uppercase tracking-wide mt-0.5">Prospects</Text>
          </View>
          <View className="flex-1 bg-surface border border-line rounded-xl p-3 items-center">
            <Text className="text-[20px] font-black text-ink">{customers.length}</Text>
            <Text className="text-[10px] font-extrabold text-muted uppercase tracking-wide mt-0.5">Customers</Text>
          </View>
          <View className={`flex-1 rounded-xl p-3 items-center border ${overdueFollowups > 0 ? 'bg-danger-soft border-danger-border/60' : 'bg-surface border-line'}`}>
            <Text className={`text-[20px] font-black ${overdueFollowups > 0 ? 'text-danger' : 'text-ink'}`}>{overdueFollowups}</Text>
            <Text className="text-[10px] font-extrabold text-muted uppercase tracking-wide mt-0.5">Overdue</Text>
          </View>
        </View>
        <View className="mt-3 pt-2.5 border-t border-line/80 flex-row justify-between items-center">
          <Text className="text-[11px] text-muted font-medium">Recurring achieved:</Text>
          <Text className="text-[13px] font-black text-ink">{lakhs(recurringAchieved)} / {lakhs(recurringCommitted)}</Text>
        </View>
        <View className="mt-1.5 flex-row justify-between items-center">
          <Text className="text-[11px] text-muted font-medium">Outstanding receivables:</Text>
          <Text className={`text-[13px] font-black ${totalReceivables > 500000 ? 'text-danger' : 'text-ink'}`}>{lakhs(totalReceivables)}</Text>
        </View>
      </Card>

      {/* Module Links */}
      <View className="gap-2">
        <SectionTitle>Modules</SectionTitle>
        {links.map((link) => (
          <Card key={link.to} onPress={() => router.push(link.to as any)}>
            <View className="flex-row items-center gap-3.5">
              <View className="w-10 h-10 rounded-xl bg-surface3 items-center justify-center">
                {link.icon}
              </View>
              <View className="flex-1">
                <Text className="text-[14px] font-black text-ink">{link.label}</Text>
                <Text className="text-[11px] text-muted font-medium mt-0.5">{link.hint}</Text>
              </View>
              <Text className="text-muted font-black text-base">›</Text>
            </View>
          </Card>
        ))}
      </View>
    </PageLayout>
  );
}
