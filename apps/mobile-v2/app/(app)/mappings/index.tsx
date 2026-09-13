import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView, RefreshControl, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Tag, Plus } from 'lucide-react-native';
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
  GSBottomSheet,
  GSButton,
  GSInput,
} from '@/components/ui';
import { MappingCard } from '@/components/domain';
import { useMappings, useUpdateMappingPrice, usePrincipals } from '@/hooks';
import type { Mapping } from '@/domain/types';
import { formatCurrencyINR } from '@/domain/formatters';
import { hapticFeedback } from '@/utils/haptics';

export default function CustomerMappingScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [search, setSearch] = useState('');
  const [principalFilter, setPrincipalFilter] = useState('ALL');
  const [editTarget, setEditTarget] = useState<Mapping | null>(null);
  const [newPriceStr, setNewPriceStr] = useState('');

  const { data: mappings, isLoading, isError, refetch } = useMappings({ search });
  const { data: principals } = usePrincipals();
  const updatePriceMutation = useUpdateMappingPrice();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const filteredMappings = useMemo(() => {
    if (!mappings) return [];
    if (principalFilter === 'ALL') return mappings;
    return mappings.filter(
      (m) => m.principalName.toLowerCase() === principalFilter.toLowerCase()
    );
  }, [mappings, principalFilter]);

  const handleOpenEdit = (m: Mapping) => {
    setEditTarget(m);
    setNewPriceStr(String(m.effectivePrice));
  };

  const handleSavePrice = async () => {
    if (!editTarget) return;
    const num = parseFloat(newPriceStr);
    if (isNaN(num) || num <= 0) return;

    await updatePriceMutation.mutateAsync({
      id: editTarget.id,
      customPrice: num,
    });
    hapticFeedback('success');
    setEditTarget(null);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <GSHeader
        title="Customer Mapping"
        subtitle={`${filteredMappings.length} product agreements`}
        showBack
      />

      {/* Search & Brand Filters */}
      <View style={[styles.searchBox, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <GSSearchBar
          value={search}
          onChangeText={setSearch}
          placeholder="Search by customer, product, SKU..."
        />

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterScroll}
        >
          <GSChip
            label="All Brands"
            selected={principalFilter === 'ALL'}
            onPress={() => setPrincipalFilter('ALL')}
          />
          {(principals || []).map((p) => (
            <React.Fragment key={p.id}>
              <View style={{ width: spacing[2] }} />
              <GSChip
                label={p.name}
                selected={principalFilter === p.name}
                onPress={() => setPrincipalFilter(p.name)}
              />
            </React.Fragment>
          ))}
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
        ) : filteredMappings.length === 0 ? (
          <GSEmptyState
            title="No Mappings Found"
            description="No customer product pricing records match your search."
          />
        ) : (
          filteredMappings.map((mapping) => (
            <MappingCard
              key={mapping.id}
              mapping={mapping}
              onPress={() => router.push(`/(app)/customers/${mapping.customerId}` as any)}
              onEditPrice={() => handleOpenEdit(mapping)}
            />
          ))
        )}
      </ScrollView>

      {/* Edit Price Bottom Sheet */}
      {editTarget && (
        <GSBottomSheet
          visible={Boolean(editTarget)}
          onClose={() => setEditTarget(null)}
          title="Edit Agreed Price"
          subtitle={`${editTarget.customerName} • ${editTarget.productName}`}
        >
          <View style={{ paddingBottom: spacing[4] }}>
            <View style={[styles.priceBox, { backgroundColor: colors.surfaceMuted }]}>
              <Text style={[styles.catalogLabel, { color: colors.textSecondary }]}>
                Catalog Baseline: {formatCurrencyINR(editTarget.catalogPrice ?? editTarget.basePrice ?? 0)}
              </Text>
            </View>

            <GSInput
              label="Agreed Custom Price (₹) *"
              value={newPriceStr}
              onChangeText={setNewPriceStr}
              placeholder="Enter special rate"
              keyboardType="numeric"
            />

            <View style={styles.sheetActions}>
              <GSButton
                title="Cancel"
                variant="secondary"
                onPress={() => setEditTarget(null)}
                disabled={updatePriceMutation.isPending}
                style={{ flex: 1, marginRight: spacing[2] }}
              />
              <GSButton
                title="Save Price"
                variant="primary"
                onPress={handleSavePrice}
                loading={updatePriceMutation.isPending}
                style={{ flex: 1, marginLeft: spacing[2] }}
              />
            </View>
          </View>
        </GSBottomSheet>
      )}
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
  priceBox: {
    padding: spacing[3],
    borderRadius: radius.md,
    alignItems: 'center',
    marginBottom: spacing[4],
  },
  catalogLabel: {
    fontSize: typography.bodySmall.fontSize,
    fontWeight: '600',
  },
  sheetActions: {
    flexDirection: 'row',
    marginTop: spacing[4],
  },
});
