import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { PageLayout, KpiStrip, Card, Avatar, SectionTitle } from '@/gs/kit';
import { ME } from '@/gs/mock';
import { useStore } from '@/gs/store';
import { inr, lakhs, pct } from '@/gs/domain';
import { WalletIcon, TargetIcon, ChartIcon, GridIcon } from '@/gs/icons';

export default function More() {
  const orders = useStore((s) => s.orders);
  const payments = useStore((s) => s.payments);
  const customers = useStore((s) => s.customers);
  const leads = useStore((s) => s.leads);
  const projections = useStore((s) => s.projections);
  const followups = useStore((s) => s.followups);

  const pendingPayments = payments.filter((p) => p.pending > 0);
  const totalReceivables = pendingPayments.reduce((s, p) => s + p.pending, 0);
  const openLeads = leads.filter((l) => !['Closed Won', 'Closed Lost', 'No Requirement or Cold'].includes(l.stage));
  const recurringAchieved = projections.reduce((s, p) => s + p.achievedQty * p.price, 0);
  const recurringCommitted = projections.reduce((s, p) => s + p.projectedQty * p.price, 0);
  const overdueFollowups = followups.filter((f) => {
    const d = new Date(f.dueDate);
    return d <= new Date();
  }).length;

  const links = [
    { label: 'Sales Orders', to: '/(app)/orders', hint: `${orders.length} orders tracked`, icon: <ChartIcon size={20} color="#059669" /> },
    { label: 'Payments Follow-up', to: '/(app)/payments', hint: `${pendingPayments.length} pending · ${lakhs(totalReceivables)} outstanding`, icon: <WalletIcon size={20} color="#d97706" /> },
    { label: 'My Customers', to: '/(app)/customers', hint: `${customers.length} mapped accounts`, icon: <TargetIcon size={20} color="#2563eb" /> },
    { label: 'Profile & Settings', to: '/(app)/profile', hint: 'Account security & regional division', icon: <GridIcon size={20} color="#64748b" /> },
  ] as const;

  return (
    <PageLayout
      zone1={
        <View className="flex-row items-center justify-between py-1">
          <View className="flex-1">
            <Text className="text-[11px] text-muted font-extrabold uppercase tracking-wider">More Features</Text>
            <Text className="text-[20px] font-black text-ink tracking-tight mt-0.5">Hub & Settings</Text>
          </View>
          <Avatar name={ME.name} size={40} />
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
          <Avatar name={ME.name} size={52} />
          <View className="flex-1">
            <Text className="text-[17px] font-black text-ink">{ME.name}</Text>
            <Text className="text-[11px] text-brand font-extrabold mt-0.5">
              {ME.role} · <Text className="text-muted">{ME.region}</Text>
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

      {/* Feature Links */}
      <SectionTitle>Quick Access</SectionTitle>
      <View className="gap-2.5">
        {links.map((l) => (
          <Pressable key={l.to} onPress={() => router.push(l.to as never)}>
            <Card className="flex-row items-center gap-3.5 p-4">
              <View className="w-10 h-10 rounded-xl bg-surface3/80 items-center justify-center">{l.icon}</View>
              <View className="flex-1">
                <Text className="text-[14px] font-black text-ink">{l.label}</Text>
                <Text className="text-[11px] text-muted font-medium mt-0.5">{l.hint}</Text>
              </View>
              <Text className="text-lg text-muted font-bold">›</Text>
            </Card>
          </Pressable>
        ))}
      </View>

      {/* Sign Out */}
      <Pressable onPress={() => router.replace('/')}
        className="mt-2 py-3.5 rounded-xl bg-red-soft border border-red-border/60 items-center"
      >
        <Text className="text-danger font-black text-[13px]">Sign Out</Text>
      </Pressable>
      <Text className="text-center text-muted font-medium text-[11px] mt-3">
        GreatSales Mobile Enterprise · v7.0 · Built with ui-ux-pro-max
      </Text>
    </PageLayout>
  );
}
