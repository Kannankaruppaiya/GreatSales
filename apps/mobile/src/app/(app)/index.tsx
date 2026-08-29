/**
 * Home — the authenticated landing. Shows the real signed-in identity from
 * `/auth/me` and an honest map of the salesperson modules that are on the way.
 * It deliberately shows NO fabricated metrics: the backend endpoints for
 * customers/leads/orders/etc. don't exist yet, so those rows are presented as
 * disabled "coming soon" rather than faked with placeholder numbers.
 */
import { useState } from 'react';
import { View } from 'react-native';

import { Badge } from '@/components/ui/badge';
import { Banner } from '@/components/ui/banner';
import { Card } from '@/components/ui/card';
import { Divider } from '@/components/ui/divider';
import { ListRow } from '@/components/ui/list-row';
import { Screen } from '@/components/ui/screen';
import { ErrorState, LoadingState } from '@/components/ui/states';
import { Text } from '@/components/ui/text';
import type { IconName } from '@/components/ui/icon';
import { useAuth } from '@/lib/auth/auth-context';
import { useTheme } from '@/theme/theme-provider';

const MODULES: { key: string; title: string; subtitle: string; icon: IconName }[] = [
  { key: 'customers', title: 'Customers', subtitle: 'Your accounts and contacts', icon: 'people-outline' },
  { key: 'leads', title: 'Leads', subtitle: 'Pipeline and deal stages', icon: 'trending-up-outline' },
  { key: 'orders', title: 'Orders', subtitle: 'Sales orders and status', icon: 'cart-outline' },
  { key: 'payments', title: 'Payments', subtitle: 'Invoices and collections', icon: 'card-outline' },
  { key: 'targets', title: 'Targets', subtitle: 'Your monthly goals', icon: 'flag-outline' },
  { key: 'followups', title: 'Follow-ups', subtitle: 'What’s due today', icon: 'checkmark-done-outline' },
];

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || name;
}

export default function HomeScreen() {
  const { spacing } = useTheme();
  const { user, profileStatus, reloadProfile } = useAuth();
  const [refreshing, setRefreshing] = useState(false);

  async function onRefresh() {
    setRefreshing(true);
    await reloadProfile();
    setRefreshing(false);
  }

  // No cached profile yet — show real loading / error states, never a blank.
  if (!user && profileStatus === 'loading') return <Screen center><LoadingState label="Loading your workspace…" /></Screen>;
  if (!user && profileStatus === 'error') {
    return (
      <Screen center>
        <ErrorState
          title="Couldn’t load your workspace"
          description="We couldn’t reach the server. Check your connection and try again."
          onRetry={reloadProfile}
        />
      </Screen>
    );
  }

  return (
    <Screen scroll refreshing={refreshing} onRefresh={onRefresh} contentStyle={{ gap: spacing.xl }}>
      <View style={{ gap: spacing.xs }}>
        <Text variant="bodySm" color="muted">
          Welcome back
        </Text>
        <Text variant="h1">{user ? firstName(user.name) : 'Your workspace'}</Text>
      </View>

      {user ? (
        <Card>
          <View style={{ gap: spacing.md }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md }}>
              <Text variant="h3" numberOfLines={1} style={{ flexShrink: 1 }}>
                {user.name}
              </Text>
              {user.role ? <Badge label={user.role} tone="primary" /> : null}
            </View>
            <Divider />
            <View style={{ gap: spacing.xs }}>
              <Text variant="bodySm" color="muted">
                Signed in as
              </Text>
              <Text variant="body" numberOfLines={1}>
                {user.email}
              </Text>
            </View>
          </View>
        </Card>
      ) : null}

      <View style={{ gap: spacing.sm }}>
        <Text variant="label" color="secondary" style={{ textTransform: 'uppercase' }}>
          Your workspace
        </Text>
        <Banner
          tone="info"
          message="These modules are being built. You’re seeing the finished design ahead of the data."
        />
        <Card padded={false}>
          {MODULES.map((m, i) => (
            <View key={m.key}>
              {i > 0 ? <Divider inset /> : null}
              <ListRow
                title={m.title}
                subtitle={m.subtitle}
                leadingIcon={m.icon}
                disabled
                trailing={<Badge label="Soon" tone="neutral" />}
              />
            </View>
          ))}
        </Card>
      </View>
    </Screen>
  );
}
