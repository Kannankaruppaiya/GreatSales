import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScrollView, View } from 'react-native';

import {
  Avatar,
  Button,
  Card,
  ErrorState,
  Header,
  Loading,
  Pill,
  Screen,
  Txt,
} from '@/components/ui';
import { api } from '@/lib/api';
import { humanize, shortDate } from '@/lib/format';
import { useAsync } from '@/lib/hooks';
import { categoryColor, space, useColors } from '@/lib/theme';

export default function CustomerDetailScreen() {
  const c = useColors();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, loading, error, reload } = useAsync(
    () => api.customers.get(id),
    id,
  );

  return (
    <Screen edges={['top']}>
      <Header title="Customer" onBack={() => router.back()} />
      {loading && !data ? (
        <Loading />
      ) : error && !data ? (
        <ErrorState message={error} onRetry={reload} />
      ) : (
        <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.lg }}>
          <View style={{ alignItems: 'center', gap: space.sm }}>
            <Avatar name={data!.name} color={c.primary} />
            <Txt variant="heading" style={{ textAlign: 'center' }}>
              {data!.name}
            </Txt>
            <View style={{ flexDirection: 'row', gap: space.sm }}>
              {data!.category ? (
                <Pill label={data!.category} color={categoryColor[data!.category] ?? c.textMuted} />
              ) : null}
              {data!.payZone ? <Pill label={humanize(data!.payZone)} color={c.warning} /> : null}
            </View>
          </View>

          <Card style={{ gap: space.md }}>
            <DetailRow label="Area" value={data!.area ?? '—'} />
            <DetailRow label="Payment terms" value={data!.paymentTerms ? humanize(data!.paymentTerms) : '—'} />
            <DetailRow label="Sub-industry" value={data!.subIndustry ?? '—'} />
            <DetailRow label="Since" value={shortDate(data!.createdAt)} />
          </Card>

          <Txt variant="heading">Contacts</Txt>
          {data!.contacts.length === 0 ? (
            <Card>
              <Txt variant="caption">No contacts recorded.</Txt>
            </Card>
          ) : (
            data!.contacts.map((ct) => (
              <Card key={ct.id} style={{ gap: 4 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                  <Txt variant="body" style={{ fontWeight: '700' }}>
                    {ct.name}
                  </Txt>
                  {ct.isPrimary ? <Pill label="Primary" color={c.success} /> : null}
                </View>
                {ct.designation ? <Txt variant="caption">{ct.designation}</Txt> : null}
                {ct.phone ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Ionicons name="call-outline" size={14} color={c.textMuted} />
                    <Txt variant="caption">{ct.phone}</Txt>
                  </View>
                ) : null}
                {ct.email ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Ionicons name="mail-outline" size={14} color={c.textMuted} />
                    <Txt variant="caption">{ct.email}</Txt>
                  </View>
                ) : null}
              </Card>
            ))
          )}

          <View style={{ gap: space.sm, marginTop: space.sm }}>
            <Button
              title="New order for this customer"
              icon="cart-outline"
              variant="secondary"
              onPress={() => router.push(`/orders/new?customerId=${data!.id}`)}
            />
            <Button
              title="Record a payment"
              icon="card-outline"
              variant="secondary"
              onPress={() => router.push(`/payments/new?customerId=${data!.id}`)}
            />
          </View>
        </ScrollView>
      )}
    </Screen>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space.md }}>
      <Txt variant="label">{label}</Txt>
      <Txt variant="body" numberOfLines={1} style={{ flexShrink: 1, textAlign: 'right' }}>
        {value}
      </Txt>
    </View>
  );
}
