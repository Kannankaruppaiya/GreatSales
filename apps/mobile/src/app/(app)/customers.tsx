import { useRouter } from 'expo-router';
import { ActivityIndicator, FlatList, RefreshControl, View } from 'react-native';

import {
  Avatar,
  EmptyState,
  ErrorState,
  Fab,
  Loading,
  Pill,
  Row,
  Screen,
  Txt,
} from '@/components/ui';
import type { Customer } from '@greatsales/shared';
import { api } from '@/lib/api';
import { humanize } from '@/lib/format';
import { usePaginated } from '@/lib/hooks';
import { categoryColor, space, useColors } from '@/lib/theme';

export default function CustomersScreen() {
  const c = useColors();
  const router = useRouter();
  const list = usePaginated<Customer>((cursor) => api.customers.list(cursor));

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
          <EmptyState icon="people-outline" title="No customers yet" subtitle="Tap + to add your first customer." />
        }
        ListFooterComponent={
          list.loadingMore ? (
            <View style={{ paddingVertical: space.lg }}>
              <ActivityIndicator color={c.primary} />
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <Row onPress={() => router.push(`/customers/${item.id}`)}>
            <Avatar name={item.name} color={c.primary} />
            <View style={{ flex: 1, gap: 2 }}>
              <Txt variant="body" numberOfLines={1} style={{ fontWeight: '700' }}>
                {item.name}
              </Txt>
              <Txt variant="caption" numberOfLines={1}>
                {[item.area, item.paymentTerms ? humanize(item.paymentTerms) : null]
                  .filter(Boolean)
                  .join(' · ') || 'No details'}
              </Txt>
            </View>
            {item.category ? (
              <Pill label={item.category} color={categoryColor[item.category] ?? c.textMuted} />
            ) : null}
          </Row>
        )}
      />
      <Fab onPress={() => router.push('/customers/new')} />
    </Screen>
  );
}
