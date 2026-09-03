import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { RefreshControl, ScrollView, View } from 'react-native';

import { Card, ErrorState, Loading, Pill, Screen, Txt } from '@/components/ui';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { compact, humanize, money } from '@/lib/format';
import { useAsync } from '@/lib/hooks';
import { space, stageColor, useColors } from '@/lib/theme';

export default function DashboardScreen() {
  const c = useColors();
  const router = useRouter();
  const { user } = useAuth();
  const { data, loading, error, reload } = useAsync(() => api.dashboardSummary());

  if (loading && !data) {
    return (
      <Screen>
        <Loading />
      </Screen>
    );
  }
  if (error && !data) {
    return (
      <Screen>
        <ErrorState message={error} onRetry={reload} />
      </Screen>
    );
  }

  const s = data!;
  const stats: {
    label: string;
    value: string;
    icon: keyof typeof Ionicons.glyphMap;
    color: string;
    href?: string;
  }[] = [
    { label: 'Customers', value: compact(s.customers), icon: 'people', color: c.primary, href: '/(app)/customers' },
    { label: 'Active Leads', value: compact(s.leads), icon: 'flag', color: '#7C3AED', href: '/(app)/leads' },
    { label: 'Open Orders', value: compact(s.openOrders), icon: 'cart', color: '#0891B2', href: '/(app)/orders' },
    { label: 'Overdue', value: compact(s.overdueInvoices), icon: 'alert-circle', color: c.danger, href: '/(app)/payments' },
  ];

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{ padding: space.lg, gap: space.lg }}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={reload} tintColor={c.primary} />
        }>
        <View>
          <Txt variant="caption">Welcome back</Txt>
          <Txt variant="title">{user?.name ?? 'Salesperson'}</Txt>
          {user?.role ? <Pill label={humanize(user.role)} color={c.primary} /> : null}
        </View>

        {/* Revenue banner */}
        <Card style={{ backgroundColor: c.primary, borderColor: c.primary }}>
          <Txt variant="label" color="#FFFFFFCC">
            Order revenue (all time)
          </Txt>
          <Txt variant="stat" color="#FFFFFF" style={{ marginTop: 4 }}>
            {money(s.orderRevenue)}
          </Txt>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: space.sm }}>
            <Ionicons name="cash-outline" size={16} color="#FFFFFFCC" />
            <Txt variant="caption" color="#FFFFFFCC">
              {money(s.outstandingReceivables)} outstanding
            </Txt>
          </View>
        </Card>

        {/* Stat grid */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.md }}>
          {stats.map((st) => (
            <Card
              key={st.label}
              style={{ flexGrow: 1, flexBasis: '46%', gap: space.sm }}>
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  backgroundColor: st.color + '22',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                <Ionicons name={st.icon} size={20} color={st.color} />
              </View>
              <Txt variant="stat">{st.value}</Txt>
              <Txt variant="caption">{st.label}</Txt>
            </Card>
          ))}
        </View>

        {/* Pipeline */}
        <View style={{ gap: space.sm }}>
          <Txt variant="heading">Pipeline by stage</Txt>
          <Card style={{ gap: space.md }}>
            {s.pipeline.length === 0 ? (
              <Txt variant="caption">No leads in the pipeline yet.</Txt>
            ) : (
              s.pipeline.map((p) => (
                <View
                  key={p.stage}
                  style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                    <View
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: 5,
                        backgroundColor: stageColor[p.stage] ?? c.textMuted,
                      }}
                    />
                    <Txt variant="body">{humanize(p.stage)}</Txt>
                  </View>
                  <Txt variant="body" style={{ fontWeight: '700' }}>
                    {p.count}
                  </Txt>
                </View>
              ))
            )}
          </Card>
        </View>
      </ScrollView>
    </Screen>
  );
}
