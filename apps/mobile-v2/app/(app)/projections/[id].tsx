import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Package, RefreshCw, Calendar, ArrowUpRight, CheckCircle2 } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/design-system/theme';
import { spacing, radius, typography } from '@/design-system/tokens';
import {
  GSHeader,
  GSAmountDisplay,
  GSStatusIndicator,
  GSProgress,
  GSSkeleton,
  GSErrorState,
  GSButton,
  GSSelect,
} from '@/components/ui';
import { useProjection, useUpdateProjectionStatus } from '@/hooks';
import { formatNumber, formatCurrencyINR } from '@/domain/formatters';
import type { ProjStatusValue } from '@/domain/types';

export default function ProjectionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const { data: projection, isLoading, isError, refetch } = useProjection(id || '');
  const updateStatusMutation = useUpdateProjectionStatus();

  const [statusSheetVisible, setStatusSheetVisible] = useState(false);

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <GSHeader title="Projection Detail" showBack />
        <View style={{ padding: spacing[4] }}>
          <GSSkeleton height={160} borderRadius={radius.lg} style={{ marginBottom: spacing[3] }} />
          <GSSkeleton height={120} borderRadius={radius.md} />
        </View>
      </View>
    );
  }

  if (isError || !projection) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <GSHeader title="Projection Detail" showBack />
        <GSErrorState title="Projection not found" onRetry={refetch} />
      </View>
    );
  }

  const projectedQty = projection.projectedQuantity ?? projection.projectedQty ?? 0;
  const achievedQty = projection.achievedQuantity ?? projection.achievedQty ?? 0;
  const rate = projection.rate ?? projection.effectivePrice ?? projection.basePrice ?? 0;
  const pct = Math.round(projection.achievementPercentage ?? projection.achievementPct ?? (projectedQty > 0 ? (achievedQty / projectedQty) * 100 : 0));
  const remainingQty = Math.max(0, projectedQty - achievedQty);
  const remainingVal = remainingQty * rate;

  const handleStatusChange = async (val: string) => {
    await updateStatusMutation.mutateAsync({
      id: projection.id,
      status: val as ProjStatusValue,
    });
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <GSHeader
        title="Recurring Projection"
        subtitle={`${projection.month || 'Current Month'} Commitment`}
        showBack
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + spacing[8] },
        ]}
      >
        {/* Customer & Product Card */}
        <View style={[styles.card, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Open customer ${projection.customerName}`}
            onPress={() => router.push(`/(app)/customers/${projection.customerId}` as any)}
            style={styles.customerRow}
          >
            <Text style={[styles.customerName, { color: colors.brand }]}>
              {projection.customerName}
            </Text>
            <ArrowUpRight size={18} color={colors.brand} />
          </Pressable>

          <Text style={[styles.productTitle, { color: colors.textPrimary }]}>
            {projection.productName}
          </Text>
          <Text style={[styles.principalText, { color: colors.textSecondary }]}>
            Brand: {projection.principalName} • SKU: {projection.sku}
          </Text>

          <View style={[styles.statusStrip, { borderTopColor: colors.borderSubtle }]}>
            <Text style={[styles.statusLabel, { color: colors.textSecondary }]}>
              Tracking Status:
            </Text>
            <GSStatusIndicator status={projection.status} type="projStatus" />
          </View>
        </View>

        {/* Achievement Breakdown Hero */}
        <View style={[styles.heroCard, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
            Monthly Fulfilment
          </Text>

          <View style={styles.qtyRow}>
            <View>
              <Text style={[styles.microLabel, { color: colors.textTertiary }]}>ACHIEVED</Text>
              <Text style={[styles.qtyNum, { color: colors.brand }]}>
                {formatNumber(achievedQty)} units
              </Text>
            </View>

            <View style={{ alignItems: 'flex-end' }}>
              <Text style={[styles.microLabel, { color: colors.textTertiary }]}>COMMITTED TARGET</Text>
              <Text style={[styles.qtyNum, { color: colors.textPrimary }]}>
                {formatNumber(projectedQty)} units
              </Text>
            </View>
          </View>

          <GSProgress value={pct} height={8} style={{ marginVertical: spacing[3] }} />

          <View style={styles.pctRow}>
            <Text style={[styles.pctText, { color: pct >= 100 ? colors.success : colors.brand }]}>
              {pct}% Completed
            </Text>
            <Text style={[styles.remText, { color: colors.textSecondary }]}>
              {remainingQty} units ({formatCurrencyINR(remainingVal)}) remaining
            </Text>
          </View>
        </View>

        {/* Pricing Specification */}
        <View style={[styles.card, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
            Contract Terms
          </Text>

          <View style={[styles.specRow, { borderBottomColor: colors.borderSubtle }]}>
            <Text style={[styles.specLabel, { color: colors.textSecondary }]}>Unit Rate</Text>
            <Text style={[styles.specVal, { color: colors.textPrimary }]}>
              {formatCurrencyINR(rate)}
            </Text>
          </View>

          <View style={[styles.specRow, { borderBottomColor: colors.borderSubtle }]}>
            <Text style={[styles.specLabel, { color: colors.textSecondary }]}>Total Projected Value</Text>
            <GSAmountDisplay amount={projectedQty * rate} size="md" variant="default" />
          </View>

          <View style={[styles.specRow, { borderBottomWidth: 0 }]}>
            <Text style={[styles.specLabel, { color: colors.textSecondary }]}>Achieved Revenue</Text>
            <GSAmountDisplay amount={achievedQty * rate} size="md" variant="brand" />
          </View>
        </View>

        {/* Status Adjustment */}
        <GSSelect
          label="Update Projection Status"
          value={projection.status}
          options={[
            { value: 'InProgress', label: 'In Progress (Active Deliveries)' },
            { value: 'NeedsAttention', label: 'Needs Attention (Under target)' },
            { value: 'Completed', label: 'Completed (Target Achieved)' },
          ]}
          onSelect={handleStatusChange}
          style={{ marginTop: spacing[2] }}
        />

        {/* CTA: Create Sales Order */}
        <GSButton
          title="Create Order for this Product"
          variant="primary"
          size="lg"
          onPress={() => router.push('/(app)/new-order')}
          style={{ marginTop: spacing[4] }}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: spacing[4],
  },
  card: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing[4],
    marginBottom: spacing[4],
  },
  customerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  customerName: {
    fontSize: typography.body.fontSize,
    fontWeight: '700',
    marginRight: 4,
  },
  productTitle: {
    fontSize: typography.heading2.fontSize,
    fontWeight: '800',
    marginBottom: 2,
  },
  principalText: {
    fontSize: typography.caption.fontSize,
    marginBottom: spacing[3],
  },
  statusStrip: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: spacing[3],
    borderTopWidth: 1,
  },
  statusLabel: {
    fontSize: typography.caption.fontSize,
    fontWeight: '600',
  },
  heroCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing[4],
    marginBottom: spacing[4],
  },
  sectionTitle: {
    fontSize: typography.cardTitle.fontSize,
    fontWeight: '800',
    marginBottom: spacing[3],
  },
  qtyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  microLabel: {
    fontSize: typography.micro.fontSize,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  qtyNum: {
    fontSize: typography.cardTitle.fontSize,
    fontWeight: '800',
  },
  pctRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pctText: {
    fontSize: typography.bodySmall.fontSize,
    fontWeight: '800',
  },
  remText: {
    fontSize: typography.caption.fontSize,
  },
  specRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing[3],
    borderBottomWidth: 1,
  },
  specLabel: {
    fontSize: typography.bodySmall.fontSize,
  },
  specVal: {
    fontSize: typography.bodySmall.fontSize,
    fontWeight: '700',
  },
});
