import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Package, CheckCircle2 } from 'lucide-react-native';
import { useTheme } from '../../design-system/theme';
import { spacing, radius, typography } from '../../design-system/tokens';
import { GSCard, GSProgress, GSStatusIndicator } from '../ui';
import type { ProjectionLine } from '../../domain/types';
import { formatNumber, formatCurrencyINR } from '../../domain/formatters';

export interface ProjectionCardProps {
  projection: ProjectionLine;
  onPress?: () => void;
}

export function ProjectionCard({ projection, onPress }: ProjectionCardProps) {
  const { colors } = useTheme();

  const achievedQty = projection.achievedQuantity ?? projection.achievedQty ?? 0;
  const projectedQty = projection.projectedQuantity ?? projection.projectedQty ?? 0;
  const rate = projection.rate ?? projection.effectivePrice ?? projection.basePrice ?? 0;
  const pct = Math.round(
    projection.achievementPercentage ??
      projection.achievementPct ??
      (projectedQty > 0 ? (achievedQty / projectedQty) * 100 : 0)
  );

  return (
    <GSCard
      onPress={onPress}
      variant="bordered"
      padding="md"
      style={[
        styles.card,
        {
          backgroundColor: colors.surfaceElevated,
          borderColor: colors.border,
        },
      ]}
      accessibilityLabel={`Projection for ${projection.customerName}: ${projection.productName}, ${pct}% achieved`}
    >
      {/* Top row: Customer, Principal, Status */}
      <View style={styles.topRow}>
        <View style={styles.titleCol}>
          <Text numberOfLines={1} style={[styles.customerName, { color: colors.textPrimary }]}>
            {projection.customerName}
          </Text>
          <Text numberOfLines={1} style={[styles.productName, { color: colors.textTertiary }]}>
            {projection.principalName} • {projection.productName}
          </Text>
        </View>
        <GSStatusIndicator status={projection.status} type="projStatus" />
      </View>

      {/* Quantities & Progress */}
      <View
        style={[
          styles.progressContainer,
          {
            backgroundColor: colors.surface,
            borderColor: colors.borderSubtle,
          },
        ]}
      >
        <View style={styles.qtyRow}>
          <View>
            <Text style={[styles.microLabel, { color: colors.textTertiary }]}>
              ACHIEVED / PROJECTED
            </Text>
            <Text style={[styles.qtyText, { color: colors.textPrimary }]}>
              {formatNumber(achievedQty)} / {formatNumber(projectedQty)} units
            </Text>
          </View>
          <Text style={[styles.pctText, { color: pct >= 100 ? colors.success : colors.brand }]}>
            {pct}%
          </Text>
        </View>

        <GSProgress value={pct} height={6} style={styles.bar} />
      </View>

      {/* Bottom: Rate & Target Period */}
      <View style={styles.bottomRow}>
        <Text style={[styles.rateText, { color: colors.textSecondary }]}>
          Rate: {formatCurrencyINR(rate)}/unit
        </Text>
        <Text style={[styles.monthText, { color: colors.textTertiary }]}>
          Period: {projection.month || 'Current Month'}
        </Text>
      </View>
    </GSCard>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: spacing[3],
    borderWidth: 1,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing[3],
  },
  titleCol: {
    flex: 1,
    marginRight: spacing[2],
  },
  customerName: {
    fontSize: 16,
    fontFamily: typography.cardTitle.fontFamily,
    fontWeight: '700',
    lineHeight: 22,
    letterSpacing: -0.2,
  },
  productName: {
    fontSize: 13,
    fontFamily: typography.bodySmall.fontFamily,
    marginTop: 2,
  },
  progressContainer: {
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing[3],
    marginBottom: spacing[3],
  },
  qtyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: spacing[2],
  },
  microLabel: {
    fontSize: 9,
    fontFamily: typography.micro.fontFamily,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  qtyText: {
    fontSize: 14,
    fontFamily: typography.cardTitle.fontFamily,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  pctText: {
    fontSize: 15,
    fontFamily: typography.financialMetric.fontFamily,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  bar: {
    marginTop: 2,
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rateText: {
    fontSize: 12,
    fontFamily: typography.caption.fontFamily,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  monthText: {
    fontSize: 11,
    fontFamily: typography.caption.fontFamily,
  },
});
