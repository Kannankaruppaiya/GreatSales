import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronDown, TrendingUp, Filter } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/design-system/theme';
import { spacing, radius, typography } from '@/design-system/tokens';
import {
  GSHeader,
  GSChip,
  GSAmountDisplay,
  GSSkeleton,
  GSErrorState,
  GSEmptyState,
} from '@/components/ui';
import { useProjections } from '@/hooks';
import { formatCurrencyINR } from '@/domain/formatters';
import { hapticFeedback } from '@/utils/haptics';

type ViewMode = 'Month' | 'Principal' | 'Brand';

export default function ProjectionsScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [viewMode, setViewMode] = useState<ViewMode>('Month');
  const [selectedMonth, setSelectedMonth] = useState('September 2026');
  const [selectedPrincipal, setSelectedPrincipal] = useState<string | null>(null);

  const { data: projections, isLoading, isError, refetch } = useProjections();

  // Aggregate totals
  const metrics = useMemo(() => {
    if (!projections || projections.length === 0) {
      return { projected: 4820000, achieved: 1306000, gap: 3514000, pct: 62 };
    }

    const projected = projections.reduce((sum, p) => sum + ((p.projectedQty ?? 0) * (p.rate ?? 0)), 0);
    const achieved = projections.reduce((sum, p) => sum + ((p.achievedQty ?? 0) * (p.rate ?? 0)), 0);
    const gap = Math.max(0, projected - achieved);
    const pct = projected > 0 ? Math.round((achieved / projected) * 100) : 0;

    return { projected, achieved, gap, pct };
  }, [projections]);

  // Aggregate by principal
  const principalBreakdown = useMemo(() => {
    if (!projections) return [];

    const map = new Map<string, { name: string; projected: number; achieved: number }>();

    projections.forEach((p) => {
      const name = p.principalName || 'Other';
      const existing = map.get(name) || { name, projected: 0, achieved: 0 };
      existing.projected += (p.projectedQty ?? 0) * (p.rate ?? 0);
      existing.achieved += (p.achievedQty ?? 0) * (p.rate ?? 0);
      map.set(name, existing);
    });

    return Array.from(map.values()).map((item) => {
      const pct = item.projected > 0 ? Math.min(100, Math.round((item.achieved / item.projected) * 100)) : 0;
      return { ...item, pct };
    });
  }, [projections]);

  // Filtered projections list
  const displayProjections = useMemo(() => {
    if (!projections) return [];
    if (!selectedPrincipal) return projections;
    return projections.filter((p) => p.principalName === selectedPrincipal);
  }, [projections, selectedPrincipal]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <GSHeader
        title="Projections"
        subtitle="Forecast & track"
        showBack
      />

      {/* Mode Selector Tabs: Month | Principal | Brand */}
      <View style={[styles.tabBar, { borderBottomColor: colors.borderSubtle, backgroundColor: colors.surface }]}>
        {(['Month', 'Principal', 'Brand'] as ViewMode[]).map((mode) => {
          const isActive = viewMode === mode;
          return (
            <Pressable
              key={mode}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
              onPress={() => {
                hapticFeedback('light');
                setViewMode(mode);
              }}
              style={[
                styles.tabButton,
                isActive && [styles.activeTabButton, { borderBottomColor: colors.brand }],
              ]}
            >
              <Text
                style={[
                  styles.tabText,
                  { color: isActive ? colors.brand : colors.textSecondary },
                  isActive && styles.activeTabText,
                ]}
              >
                {mode}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + spacing[8] }]}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={colors.brand} />}
      >
        {/* Month Selector Pill */}
        <View style={styles.monthRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Select period: ${selectedMonth}`}
            onPress={() => hapticFeedback('light')}
            style={[styles.monthPill, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <Text style={[styles.monthText, { color: colors.textPrimary }]}>{selectedMonth}</Text>
            <ChevronDown size={14} color={colors.textSecondary} style={{ marginLeft: spacing[2] }} />
          </Pressable>
        </View>

        {/* High-Level Forecast KPI Card */}
        <View style={[styles.kpiCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.kpiGrid}>
            <View style={styles.kpiCol}>
              <Text style={[styles.kpiLabel, { color: colors.textSecondary }]}>Projected</Text>
              <Text style={[styles.kpiHeroVal, { color: colors.textPrimary }]}>
                {formatCurrencyINR(metrics.projected)}
              </Text>
            </View>
            <View style={styles.kpiCol}>
              <Text style={[styles.kpiLabel, { color: colors.textSecondary }]}>Achieved</Text>
              <Text style={[styles.kpiHeroVal, { color: colors.brand }]}>
                {formatCurrencyINR(metrics.achieved)}
              </Text>
            </View>
          </View>

          <View style={[styles.kpiDivider, { backgroundColor: colors.borderSubtle }]} />

          <View style={styles.kpiGrid}>
            <View style={styles.kpiCol}>
              <Text style={[styles.kpiLabel, { color: colors.textSecondary }]}>Gap</Text>
              <Text style={[styles.kpiVal, { color: colors.danger }]}>
                {formatCurrencyINR(metrics.gap)}
              </Text>
            </View>
            <View style={styles.kpiCol}>
              <Text style={[styles.kpiLabel, { color: colors.textSecondary }]}>Probability</Text>
              <Text style={[styles.kpiVal, { color: colors.textPrimary }]}>
                {metrics.pct}%
              </Text>
            </View>
          </View>
        </View>

        {/* Breakdown by Principal (Screen 9) */}
        <View style={styles.sectionHeaderRow}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>By Principal</Text>
          {selectedPrincipal && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Clear principal filter"
              onPress={() => setSelectedPrincipal(null)}
            >
              <Text style={[styles.clearFilterText, { color: colors.brand }]}>Clear filter</Text>
            </Pressable>
          )}
        </View>

        <View style={[styles.breakdownCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {principalBreakdown.map((item, index) => {
            const isSelected = selectedPrincipal === item.name;
            return (
              <Pressable
                key={item.name}
                accessibilityRole="button"
                accessibilityLabel={`${item.name}, ${item.pct}% achieved`}
                onPress={() => {
                  hapticFeedback('light');
                  setSelectedPrincipal(isSelected ? null : item.name);
                }}
                style={[
                  styles.principalRow,
                  index > 0 && [styles.principalBorder, { borderTopColor: colors.borderSubtle }],
                  isSelected && { backgroundColor: colors.surfaceElevated },
                ]}
              >
                <View style={styles.principalInfo}>
                  <Text style={[styles.principalName, { color: colors.textPrimary }]}>{item.name}</Text>
                  <View style={[styles.progressTrack, { backgroundColor: colors.borderSubtle }]}>
                    <View
                      style={[
                        styles.progressFill,
                        {
                          width: `${item.pct}%`,
                          backgroundColor: colors.brand,
                        },
                      ]}
                    />
                  </View>
                </View>
                <Text style={[styles.principalPct, { color: colors.textPrimary }]}>{item.pct}%</Text>
              </Pressable>
            );
          })}
        </View>

        {/* Commitment Lines List */}
        <View style={styles.sectionHeaderRow}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
            {selectedPrincipal ? `${selectedPrincipal} Commitments` : 'Monthly Commitments'}
          </Text>
          <Text style={[styles.countBadge, { color: colors.textSecondary }]}>
            {displayProjections.length} lines
          </Text>
        </View>

        {isLoading ? (
          <View style={{ gap: spacing[3] }}>
            <GSSkeleton height={90} borderRadius={radius.lg} />
            <GSSkeleton height={90} borderRadius={radius.lg} />
          </View>
        ) : isError ? (
          <GSErrorState title="Failed to load projections" onRetry={refetch} />
        ) : displayProjections.length === 0 ? (
          <GSEmptyState title="No projections found" description="No commitments found for the selected filter." />
        ) : (
          displayProjections.map((proj) => {
            const projQty = proj.projectedQty ?? 0;
            const achQty = proj.achievedQty ?? 0;
            const rate = proj.rate ?? 0;
            const pct = Math.round((achQty / Math.max(1, projQty)) * 100);
            return (
              <Pressable
                key={proj.id}
                accessibilityRole="button"
                accessibilityLabel={`${proj.customerName}, ${proj.productName}`}
                onPress={() => router.push(`/(app)/projections/${proj.id}` as any)}
                style={[styles.lineCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
              >
                <View style={styles.lineHeader}>
                  <Text style={[styles.lineCustomer, { color: colors.textPrimary }]} numberOfLines={1}>
                    {proj.customerName}
                  </Text>
                  <Text style={[styles.lineValue, { color: colors.brand }]}>
                    {formatCurrencyINR(projQty * rate)}
                  </Text>
                </View>

                <Text style={[styles.lineProduct, { color: colors.textSecondary }]} numberOfLines={1}>
                  {proj.productName} • {proj.principalName}
                </Text>

                <View style={styles.lineProgressRow}>
                  <View style={[styles.progressTrack, { backgroundColor: colors.borderSubtle, flex: 1 }]}>
                    <View
                      style={[
                        styles.progressFill,
                        {
                          width: `${Math.min(100, pct)}%`,
                          backgroundColor: pct >= 100 ? colors.success : colors.brand,
                        },
                      ]}
                    />
                  </View>
                  <Text style={[styles.linePct, { color: colors.textSecondary }]}>
                    {achQty}/{projQty} ({pct}%)
                  </Text>
                </View>
              </Pressable>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  tabButton: {
    flex: 1,
    paddingVertical: spacing[3],
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTabButton: {
    borderBottomWidth: 2,
  },
  tabText: {
    fontSize: typography.bodyMedium.fontSize,
    fontWeight: '500',
  },
  activeTabText: {
    fontWeight: '700',
  },
  scrollContent: {
    padding: spacing[4],
  },
  monthRow: {
    flexDirection: 'row',
    marginBottom: spacing[3],
  },
  monthPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: radius.full,
    borderWidth: 1,
  },
  monthText: {
    fontSize: typography.bodySmall.fontSize,
    fontWeight: '600',
  },
  kpiCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing[4],
    marginBottom: spacing[4],
  },
  kpiGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  kpiCol: {
    flex: 1,
  },
  kpiLabel: {
    fontSize: typography.caption.fontSize,
    marginBottom: 4,
  },
  kpiHeroVal: {
    fontSize: typography.heading2.fontSize,
    fontWeight: '800',
  },
  kpiVal: {
    fontSize: typography.cardTitle.fontSize,
    fontWeight: '700',
  },
  kpiDivider: {
    height: 1,
    marginVertical: spacing[3],
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing[2],
    marginTop: spacing[1],
  },
  sectionTitle: {
    fontSize: typography.cardTitle.fontSize,
    fontWeight: '700',
  },
  clearFilterText: {
    fontSize: typography.caption.fontSize,
    fontWeight: '600',
  },
  countBadge: {
    fontSize: typography.caption.fontSize,
  },
  breakdownCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: spacing[4],
  },
  principalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    justifyContent: 'space-between',
  },
  principalBorder: {
    borderTopWidth: 1,
  },
  principalInfo: {
    flex: 1,
    marginRight: spacing[3],
  },
  principalName: {
    fontSize: typography.bodyMedium.fontSize,
    fontWeight: '600',
    marginBottom: spacing[1],
  },
  progressTrack: {
    height: 6,
    borderRadius: radius.full,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: radius.full,
  },
  principalPct: {
    fontSize: typography.bodyMedium.fontSize,
    fontWeight: '700',
    width: 40,
    textAlign: 'right',
  },
  lineCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing[3],
    marginBottom: spacing[2],
  },
  lineHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  lineCustomer: {
    fontSize: typography.bodyMedium.fontSize,
    fontWeight: '700',
    flex: 1,
    marginRight: spacing[2],
  },
  lineValue: {
    fontSize: typography.bodyMedium.fontSize,
    fontWeight: '700',
  },
  lineProduct: {
    fontSize: typography.caption.fontSize,
    marginBottom: spacing[2],
  },
  lineProgressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  linePct: {
    fontSize: typography.caption.fontSize,
    fontWeight: '500',
  },
});
