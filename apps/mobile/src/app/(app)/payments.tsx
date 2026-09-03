import { useRouter } from 'expo-router';
import { ActivityIndicator, FlatList, RefreshControl, View } from 'react-native';

import {
  EmptyState,
  ErrorState,
  Fab,
  Loading,
  Pill,
  Row,
  Screen,
  Txt,
} from '@/components/ui';
import type { Payment } from '@greatsales/shared';
import { api } from '@/lib/api';
import { money, shortDate } from '@/lib/format';
import { usePaginated } from '@/lib/hooks';
import { paymentStatusColor, space, useColors } from '@/lib/theme';

export default function PaymentsScreen() {
  const c = useColors();
  const router = useRouter();
  const list = usePaginated<Payment>((cursor) => api.payments.list(cursor));

  if (list.loading && list.items.length === 0) {
    return (
      <Screen>
        <Loading />
      </Screen>
    );
  }
  if (list.error && list.items.length === 0) {
    return (
      <Screen>
        <ErrorState message={list.error} onRetry={list.refresh} />
      </Screen>
    );
  }

  return (
    <Screen>
      <FlatList
        data={list.items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: space.lg, gap: space.sm, paddingBottom: 96 }}
        refreshControl={
          <RefreshControl refreshing={list.refreshing} onRefresh={list.refresh} tintColor={c.primary} />
        }
        onEndReachedThreshold={0.4}
        onEndReached={list.loadMore}
        ListEmptyComponent={
          <EmptyState icon="card-outline" title="No invoices yet" subtitle="Tap + to record a receivable." />
        }
        ListFooterComponent={
          list.loadingMore ? (
            <View style={{ paddingVertical: space.lg }}>
              <ActivityIndicator color={c.primary} />
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <Row onPress={() => router.push(`/payments/${item.id}`)}>
            <View style={{ flex: 1, gap: 4 }}>
              <Txt variant="body" numberOfLines={1} style={{ fontWeight: '700' }}>
                {item.customerName}
              </Txt>
              <Txt variant="caption">
                {item.invoiceNo}
                {item.dueDate ? ` · due ${shortDate(item.dueDate)}` : ''}
                {item.agingDays != null && item.agingDays > 0 ? ` · ${item.agingDays}d` : ''}
              </Txt>
            </View>
            <View style={{ alignItems: 'flex-end', gap: 4 }}>
              <Txt variant="body" style={{ fontWeight: '700' }}>
                {money(item.amount)}
              </Txt>
              <Pill label={item.status} color={paymentStatusColor[item.status] ?? c.textMuted} />
            </View>
          </Row>
        )}
      />
      <Fab onPress={() => router.push('/payments/new')} />
    </Screen>
  );
}
