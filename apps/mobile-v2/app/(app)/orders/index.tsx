import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView, RefreshControl, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Plus } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/design-system/theme';
import { spacing, radius, typography } from '@/design-system/tokens';
import {
  GSHeader,
  GSSearchBar,
  GSChip,
  GSSkeleton,
  GSEmptyState,
  GSErrorState,
  GSIconButton,
} from '@/components/ui';
import { OrderCard } from '@/components/domain';
import { useOrders } from '@/hooks';

export default function SalesOrdersScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const { data: orders, isLoading, isError, refetch } = useOrders({ search });
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const filteredOrders = useMemo(() => {
    if (!orders) return [];
    if (statusFilter === 'ALL') return orders;
    return orders.filter((o) => o.status === statusFilter);
  }, [orders, statusFilter]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <GSHeader
        title="Sales Orders"
        subtitle={`${filteredOrders.length} orders tracked`}
        showBack
        rightActions={
          <GSIconButton
            icon={<Plus size={18} color={colors.white} />}
            variant="brand"
            size="sm"
            accessibilityLabel="New Order"
            onPress={() => router.push('/(app)/new-order')}
          />
        }
      />

      {/* Search Bar */}
      <View style={[styles.searchBox, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <GSSearchBar
          value={search}
          onChangeText={setSearch}
          placeholder="Search by SO number, customer or transporter..."
        />

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterScroll}
        >
          <GSChip
            label="All Orders"
            selected={statusFilter === 'ALL'}
            onPress={() => setStatusFilter('ALL')}
          />
          <View style={{ width: spacing[2] }} />
          <GSChip
            label="Created"
            selected={statusFilter === 'Created'}
            onPress={() => setStatusFilter('Created')}
          />
          <View style={{ width: spacing[2] }} />
          <GSChip
            label="Acknowledged"
            selected={statusFilter === 'Acknowledged'}
            onPress={() => setStatusFilter('Acknowledged')}
          />
          <View style={{ width: spacing[2] }} />
          <GSChip
            label="Dispatched"
            selected={statusFilter === 'Dispatched'}
            onPress={() => setStatusFilter('Dispatched')}
          />
          <View style={{ width: spacing[2] }} />
          <GSChip
            label="Delivered"
            selected={statusFilter === 'DeliveredFromWarehouse'}
            onPress={() => setStatusFilter('DeliveredFromWarehouse')}
          />
        </ScrollView>
      </View>

      {/* Main List */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: insets.bottom + spacing[8] },
        ]}
      >
        {isLoading ? (
          <>
            <GSSkeleton height={140} borderRadius={radius.lg} style={{ marginBottom: spacing[3] }} />
            <GSSkeleton height={140} borderRadius={radius.lg} style={{ marginBottom: spacing[3] }} />
            <GSSkeleton height={140} borderRadius={radius.lg} />
          </>
        ) : isError ? (
          <GSErrorState onRetry={refetch} />
        ) : filteredOrders.length === 0 ? (
          <GSEmptyState
            title="No Orders Found"
            description="No sales orders match your search or status selection."
            actionLabel="Create Sales Order"
            onAction={() => router.push('/(app)/new-order')}
          />
        ) : (
          filteredOrders.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              onPress={() => router.push(`/(app)/orders/${order.id}` as any)}
            />
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  searchBox: {
    paddingHorizontal: spacing[4],
    paddingTop: spacing[3],
    paddingBottom: spacing[2],
    borderBottomWidth: 1,
  },
  filterScroll: {
    paddingTop: spacing[2],
  },
  listContent: {
    padding: spacing[4],
  },
});
