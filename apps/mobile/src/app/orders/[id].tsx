import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';

import {
  Card,
  ErrorState,
  Header,
  Loading,
  Pill,
  Screen,
  SelectField,
  Txt,
  type Option,
} from '@/components/ui';
import type { OrderStatus } from '@greatsales/shared';
import { api } from '@/lib/api';
import { money, shortDate } from '@/lib/format';
import { useAsync } from '@/lib/hooks';
import { orderStatusColor, space, useColors } from '@/lib/theme';

const STATUSES: OrderStatus[] = [
  'Draft',
  'Confirmed',
  'Dispatched',
  'Delivered',
  'Completed',
  'Cancelled',
];
const statusOptions: Option[] = STATUSES.map((s) => ({ id: s, label: s }));

export default function OrderDetailScreen() {
  const c = useColors();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, loading, error, reload } = useAsync(() => api.orders.get(id), id);
  const [busy, setBusy] = useState(false);

  async function changeStatus(status: string) {
    setBusy(true);
    try {
      await api.orders.updateStatus(id, { status: status as OrderStatus });
      reload();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen edges={['top']}>
      <Header title="Order" onBack={() => router.back()} />
      {loading && !data ? (
        <Loading />
      ) : error && !data ? (
        <ErrorState message={error} onRetry={reload} />
      ) : (
        <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.lg }}>
          <View style={{ gap: space.sm }}>
            <Txt variant="heading">{data!.customerName}</Txt>
            <Txt variant="caption">#{data!.id.slice(-8)} · {shortDate(data!.date)}</Txt>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Txt variant="stat">{money(data!.total)}</Txt>
              <Pill label={data!.status} color={orderStatusColor[data!.status] ?? c.textMuted} />
            </View>
          </View>

          <SelectField
            label="Update status"
            value={data!.status}
            options={statusOptions}
            onSelect={changeStatus}
          />

          <View style={{ gap: space.sm }}>
            <Txt variant="heading">Items</Txt>
            {data!.items.map((it) => (
              <Card key={it.id} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <View style={{ flex: 1 }}>
                  <Txt variant="body" style={{ fontWeight: '600' }}>{it.productName}</Txt>
                  <Txt variant="caption">{it.qty} × {money(it.price)}</Txt>
                </View>
                <Txt variant="body">{money(Number(it.qty) * Number(it.price))}</Txt>
              </Card>
            ))}
          </View>

          <View style={{ gap: space.sm }}>
            <Txt variant="heading">History</Txt>
            {data!.statusHistory.map((h) => (
              <View key={h.id} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Pill label={h.status} color={orderStatusColor[h.status] ?? c.textMuted} />
                <Txt variant="caption">{shortDate(h.at)}</Txt>
              </View>
            ))}
          </View>
        </ScrollView>
      )}
    </Screen>
  );
}
