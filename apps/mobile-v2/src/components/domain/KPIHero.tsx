import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../design-system/theme';
import { spacing, radius, typography } from '../../design-system/tokens';
import { GSProgressRing } from '../ui';
import type { DashboardMetrics } from '../../domain/types';
import { formatLakhs } from '../../domain/formatters';

export interface KPIHeroProps {
  metrics: DashboardMetrics;
}

export function KPIHero({ metrics }: KPIHeroProps) {
  const { colors, isDark } = useTheme();

  const pct = Math.round(metrics.achievementPercentage);
  const remainingGap =
    metrics.remainingGap ?? Math.max(0, metrics.totalCommitted - metrics.totalAchieved);

  const recurringPct =
    metrics.recurringPct ??
    (metrics.recurringCommitted > 0
      ? Math.round((metrics.recurringAchieved / metrics.recurringCommitted) * 100)
      : 0);

  const newSalesTargetVal = metrics.newSalesCommitted || 0;

  // The Sales Pulse card is a PREMIUM NAVY / SLATE SURFACE matching the application family
  // with a subtle low-contrast border and restrained emerald accents
  const heroBg = colors.surfaceElevated;
  const heroBorder = colors.border;

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: heroBg,
          borderColor: heroBorder,
        },
      ]}
      accessibilityRole="summary"
      accessibilityLabel={`Sales Pulse: ${formatLakhs(metrics.totalAchieved)} achieved of ${formatLakhs(metrics.totalCommitted)} committed, ${pct}% pacing, remaining gap ${formatLakhs(remainingGap)}`}
    >
      {/* Top Block: Section Title & Revenue Hero + Subtle Progress Ring */}
      <View style={styles.topRow}>
        <View style={styles.heroLeftCol}>
          <View
            style={[
              styles.periodTagRow,
              { backgroundColor: colors.surfaceActive, borderColor: colors.borderSubtle },
            ]}
          >
            <View style={[styles.pulseDot, { backgroundColor: colors.brandLight }]} />
            <Text style={[styles.periodText, { color: colors.textSecondary }]}>
              Sales Pulse • {metrics.period || 'Current Month'}
            </Text>
          </View>

          {/* 1. Dominant Hero Element */}
          <Text style={[styles.achievedHeroAmount, { color: colors.textPrimary }]}>
            {formatLakhs(metrics.totalAchieved)}
          </Text>

          {/* 3. Committed Context */}
          <Text style={[styles.committedHeroContext, { color: colors.textSecondary }]}>
            achieved of {formatLakhs(metrics.totalCommitted)} committed
          </Text>
        </View>

        {/* 2. Secondary Hierarchy: Subtle Proportional Circular Progress Ring */}
        <GSProgressRing
          value={pct}
          size={78}
          strokeWidth={6.5}
          color={colors.brand}
          trackColor={colors.surfaceActive}
        >
          <View style={styles.ringInner}>
            <Text style={[styles.ringPct, { color: colors.textPrimary }]}>
              {pct}%
            </Text>
            <Text style={[styles.ringLabel, { color: colors.brandLight }]}>
              Achieved
            </Text>
          </View>
        </GSProgressRing>
      </View>

      {/* Middle Row: Remaining Gap & Target */}
      <View style={[styles.metricsRow, { borderTopColor: colors.borderSubtle }]}>
        <View style={styles.metricItem}>
          <Text style={[styles.metricLabel, { color: colors.textTertiary }]}>
            Remaining gap
          </Text>
          <Text style={[styles.metricValue, { color: colors.textPrimary }]}>
            {formatLakhs(remainingGap)}
          </Text>
        </View>

        {metrics.target ? (
          <View style={styles.metricItem}>
            <Text style={[styles.metricLabel, { color: colors.textTertiary }]}>
              Target
            </Text>
            <Text style={[styles.metricValue, { color: colors.textSecondary }]}>
              {formatLakhs(metrics.target)}
            </Text>
          </View>
        ) : null}
      </View>

      {/* Bottom Row: Recurring vs New Sales */}
      <View style={[styles.breakdownRow, { borderTopColor: colors.borderSubtle }]}>
        <View style={styles.breakdownCol}>
          <Text style={[styles.breakdownLabel, { color: colors.textTertiary }]}>
            RECURRING
          </Text>
          <Text style={[styles.breakdownValue, { color: colors.textPrimary }]}>
            {formatLakhs(metrics.recurringAchieved)}
          </Text>
          <Text style={[styles.breakdownContext, { color: colors.brandLight }]}>
            {recurringPct}% of commitment
          </Text>
        </View>

        <View style={[styles.verticalDivider, { backgroundColor: colors.borderSubtle }]} />

        <View style={styles.breakdownCol}>
          <Text style={[styles.breakdownLabel, { color: colors.textTertiary }]}>
            NEW SALES
          </Text>
          <Text style={[styles.breakdownValue, { color: colors.textPrimary }]}>
            {formatLakhs(metrics.newSalesAchieved ?? 0)}
          </Text>
          <Text style={[styles.breakdownContext, { color: colors.textTertiary }]}>
            Target {formatLakhs(newSalesTargetVal)}
          </Text>
        </View>
      </View>
    </View>
  );
}

// Export as SalesPulse alias for semantic consistency
export const SalesPulse = KPIHero;

const styles = StyleSheet.create({
  container: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing[4],
    marginBottom: spacing[4],
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing[3],
  },
  heroLeftCol: {
    flex: 1,
    marginRight: spacing[2],
  },
  periodTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: spacing[2],
    paddingVertical: 3,
    borderRadius: radius.full,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: spacing[2],
  },
  pulseDot: {
    width: 6,
    height: 6,
    borderRadius: radius.full,
    marginRight: spacing[1],
  },
  periodText: {
    fontSize: typography.micro.fontSize,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  achievedHeroAmount: {
    fontSize: typography.displayLarge.fontSize,
    lineHeight: typography.displayLarge.lineHeight,
    fontWeight: '800',
    letterSpacing: -0.6,
  },
  committedHeroContext: {
    fontSize: typography.body.fontSize,
    marginTop: 2,
    fontWeight: '500',
  },
  ringInner: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringPct: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  ringLabel: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.4,
    marginTop: 1,
  },
  metricsRow: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: spacing[3],
    marginBottom: spacing[3],
    gap: spacing[6],
  },
  metricItem: {
    flex: 1,
  },
  metricLabel: {
    fontSize: typography.caption.fontSize,
    fontWeight: '500',
    marginBottom: 2,
  },
  metricValue: {
    fontSize: typography.sectionHeading.fontSize,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: spacing[3],
  },
  breakdownCol: {
    flex: 1,
  },
  breakdownLabel: {
    fontSize: typography.micro.fontSize,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  breakdownValue: {
    fontSize: typography.cardTitle.fontSize,
    fontWeight: '700',
    letterSpacing: -0.1,
  },
  breakdownContext: {
    fontSize: typography.caption.fontSize,
    marginTop: 2,
  },
  verticalDivider: {
    width: StyleSheet.hairlineWidth,
    height: 38,
    marginHorizontal: spacing[3],
  },
});
