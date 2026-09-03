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
import type { Lead } from '@greatsales/shared';
import { api } from '@/lib/api';
import { humanize } from '@/lib/format';
import { usePaginated } from '@/lib/hooks';
import { space, stageColor, useColors } from '@/lib/theme';

export default function LeadsScreen() {
  const c = useColors();
  const router = useRouter();
  const list = usePaginated<Lead>((cursor) => api.leads.list(cursor));

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
          <EmptyState icon="flag-outline" title="No leads yet" subtitle="Tap + to add a new lead." />
        }
        ListFooterComponent={
          list.loadingMore ? (
            <View style={{ paddingVertical: space.lg }}>
              <ActivityIndicator color={c.primary} />
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <Row onPress={() => router.push(`/leads/${item.id}`)}>
            <View
              style={{
                width: 6,
                alignSelf: 'stretch',
                borderRadius: 3,
                backgroundColor: stageColor[item.stage] ?? c.textMuted,
              }}
            />
            <View style={{ flex: 1, gap: 4 }}>
              <Txt variant="body" numberOfLines={1} style={{ fontWeight: '700' }}>
                {item.customerName}
              </Txt>
              <Txt variant="caption" numberOfLines={1}>
                {[item.area, item.leadStatus].filter(Boolean).join(' · ') || 'New lead'}
              </Txt>
            </View>
            <Pill label={humanize(item.stage)} color={stageColor[item.stage] ?? c.textMuted} />
          </Row>
        )}
      />
      <Fab onPress={() => router.push('/leads/new')} />
    </Screen>
  );
}
