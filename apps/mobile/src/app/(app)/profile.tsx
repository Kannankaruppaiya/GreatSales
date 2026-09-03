import { ScrollView, View } from 'react-native';

import { Avatar, Button, Card, Screen, Txt } from '@/components/ui';
import { API_BASE_URL } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { humanize } from '@/lib/format';
import { space, useColors } from '@/lib/theme';

export default function ProfileScreen() {
  const c = useColors();
  const { user, signOut } = useAuth();

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.lg }}>
        <View style={{ alignItems: 'center', gap: space.sm, paddingVertical: space.lg }}>
          <Avatar name={user?.name ?? '?'} color={c.primary} />
          <Txt variant="heading">{user?.name ?? 'Unknown'}</Txt>
          <Txt variant="caption">{user?.email}</Txt>
        </View>

        <Card style={{ gap: space.md }}>
          <InfoRow label="Role" value={user?.role ? humanize(user.role) : '—'} />
          <InfoRow label="Username" value={user?.username ?? '—'} />
          <InfoRow label="Tenant" value={user?.tenantId ?? '—'} />
          <InfoRow label="API" value={API_BASE_URL} />
        </Card>

        <Button title="Sign out" variant="danger" icon="log-out-outline" onPress={signOut} />

        <Txt variant="caption" style={{ textAlign: 'center' }}>
          GreatSales · v1.0.0
        </Txt>
      </ScrollView>
    </Screen>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space.md }}>
      <Txt variant="label">{label}</Txt>
      <Txt variant="body" numberOfLines={1} style={{ flexShrink: 1, textAlign: 'right' }}>
        {value}
      </Txt>
    </View>
  );
}
