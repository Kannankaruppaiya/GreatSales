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
import type { Order } from '@greatsales/shared';
import { api } from '@/lib/api';
import { money, shortDate } from '@/lib/format';
import { usePaginated } from '@/lib/hooks';
import { orderStatusColor, space, useColors } from '@/lib/theme';

export default function OrdersScreen() {
  const c = useColors();
  const router = useRouter();
  const list = usePaginated<Order>((cursor) => api.orders.list(cursor));

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
          <EmptyState icon="cart-outline" title="No orders yet" subtitle="Tap + to create a sales order." />
        }
        ListFooterComponent={
          list.loadingMore ? (
            <View style={{ paddingVertical: space.lg }}>
              <ActivityIndicator color={c.primary} />
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <Row onPress={() => router.push(`/orders/${item.id}`)}>
            <View style={{ flex: 1, gap: 4 }}>
              <Txt variant="body" numberOfLines={1} style={{ fontWeight: '700' }}>
                {item.customerName}
              </Txt>
              <Txt variant="caption">
                {shortDate(item.date)} · #{item.id.slice(-6)}
              </Txt>
            </View>
            <View style={{ alignItems: 'flex-end', gap: 4 }}>
              <Txt variant="body" style={{ fontWeight: '700' }}>
                {money(item.total)}
              </Txt>
              <Pill label={item.status} color={orderStatusColor[item.status] ?? c.textMuted} />
            </View>
          </Row>
        )}
      />
      <Fab onPress={() => router.push('/orders/new')} />
    </Screen>
  );
}
