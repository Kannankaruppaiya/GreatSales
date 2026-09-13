import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView, RefreshControl, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { UserPlus } from 'lucide-react-native';
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
import { CustomerCard } from '@/components/domain';
import { useCustomers } from '@/hooks';

export default function CustomersScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [search, setSearch] = useState('');
  const [zoneFilter, setZoneFilter] = useState<'ALL' | 'Green' | 'Yellow' | 'Red'>('ALL');

  const { data: customers, isLoading, isError, refetch } = useCustomers({ search });
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const filteredCustomers = useMemo(() => {
    if (!customers) return [];
    if (zoneFilter === 'ALL') return customers;
    return customers.filter((c) => c.paymentZone === zoneFilter);
  }, [customers, zoneFilter]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <GSHeader
        title="Customers"
        subtitle={`${filteredCustomers.length} registered accounts`}
        showBack
        rightActions={
          <GSIconButton
            icon={<UserPlus size={18} color={colors.white} />}
            variant="brand"
            size="sm"
            accessibilityLabel="Add customer"
            onPress={() => router.push('/(app)/customers/new')}
          />
        }
      />

      {/* Search Bar */}
      <View style={[styles.searchBox, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <GSSearchBar
          value={search}
          onChangeText={setSearch}
          placeholder="Search by name, area, contact or phone..."
        />

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterScroll}
        >
          <GSChip
            label="All Zones"
            selected={zoneFilter === 'ALL'}
            onPress={() => setZoneFilter('ALL')}
          />
          <View style={{ width: spacing[2] }} />
          <GSChip
            label="Green Zone"
            selected={zoneFilter === 'Green'}
            onPress={() => setZoneFilter('Green')}
          />
          <View style={{ width: spacing[2] }} />
          <GSChip
            label="Yellow Zone"
            selected={zoneFilter === 'Yellow'}
            onPress={() => setZoneFilter('Yellow')}
          />
          <View style={{ width: spacing[2] }} />
          <GSChip
            label="Red Zone"
            selected={zoneFilter === 'Red'}
            onPress={() => setZoneFilter('Red')}
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
        ) : filteredCustomers.length === 0 ? (
          <GSEmptyState
            title="No Customers Found"
            description="Try searching with a different name or resetting the zone filter."
            actionLabel="Add Customer"
            onAction={() => router.push('/(app)/customers/new')}
          />
        ) : (
          filteredCustomers.map((customer) => (
            <CustomerCard
              key={customer.id}
              customer={customer}
              onPress={() => router.push(`/(app)/customers/${customer.id}` as any)}
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
