import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { BarChart3, TrendingUp, DollarSign, Calendar, Clock } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/design-system/theme';
import { spacing, radius, typography } from '@/design-system/tokens';
import {
  GSHeader,
  GSTabs,
  GSAmountDisplay,
  GSProgress,
  GSProgressRing,
  GSSkeleton,
} from '@/components/ui';
import { useToday, usePayments, useLeads, useProjections } from '@/hooks';
import { formatLakhs, formatPercentage } from '@/domain/formatters';

export default function ReportsScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const [reportTab, setReportTab] = useState<'sales' | 'payments' | 'pipeline'>('sales');

  const { metrics, isLoading: metricsLoading } = useToday();
  const { data: payments } = usePayments();
  const { data: leads } = useLeads();
  const { data: projections } = useProjections();

  // Receivables Aging Breakdown
  const agingBreakdown = useMemo(() => {
    if (!payments) return { current: 0, d30: 0, d60: 0, d90: 0, d90plus: 0, total: 0 };
    let current = 0;
    let d30 = 0;
    let d60 = 0;
    let d90 = 0;
    let d90plus = 0;
    let total = 0;

    for (const p of payments) {
      total += p.amount;
      if (p.agingDays <= 0) current += p.amount;
      else if (p.agingDays <= 30) d30 += p.amount;
      else if (p.agingDays <= 60) d60 += p.amount;
      else if (p.agingDays <= 90) d90 += p.amount;
      else d90plus += p.amount;
    }

    return { current, d30, d60, d90, d90plus, total };
  }, [payments]);

  // Pipeline summary
  const pipelineSummary = useMemo(() => {
    if (!leads) return { totalVal: 0, wonVal: 0, oralVal: 0, activeCount: 0 };
    let totalVal = 0;
    let wonVal = 0;
    let oralVal = 0;

    for (const l of leads) {
      const val = l.value ?? l.totalValue ?? 0;
      totalVal += val;
      if (l.stage === 'OrderClosedWon' || (l.stage as string) === 'ClosedWon') wonVal += val;
      if (l.stage === 'NegotiationOralConfirmation') oralVal += val;
    }

    return { totalVal, wonVal, oralVal, activeCount: leads.length };
  }, [leads]);

  // Monthly Sales Trend data
  const monthlyTrend = [
    { month: 'Apr', achieved: 18, target: 25 },
    { month: 'May', achieved: 22, target: 25 },
    { month: 'Jun', achieved: 28, target: 30 },
    { month: 'Aug', achieved: 32, target: 35 },
    { month: 'Sep', achieved: 35, target: 38 },
  ];

  // Top Customers by Revenue
  const topCustomers = [
    { name: 'ABC Industrial', revenue: 1840000 },
    { name: 'Kovai Engineering', revenue: 1260000 },
    { name: 'Southern Auto Works', revenue: 820000 },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <GSHeader
        title="Reports"
        subtitle="Insights for better decisions"
        showBack
      />

      <View style={[styles.tabsBox, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <GSTabs
          activeTab={reportTab}
          onChangeTab={(k: string) => setReportTab(k as any)}
          tabs={[
            { key: 'sales', label: 'Sales' },
            { key: 'payments', label: 'Payments' },
            { key: 'pipeline', label: 'Pipeline' },
          ]}
        />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + spacing[8] },
        ]}
      >
        {/* REPORT 1: SALES PERFORMANCE */}
        {reportTab === 'sales' && metrics && (
          <View>
            {/* Target Hero */}
            <View style={[styles.card, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
              <Text style={[styles.cardHeading, { color: colors.textPrimary }]}>
                Monthly Target Achievement
              </Text>

              <View style={styles.heroRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.microLabel, { color: colors.textTertiary }]}>TOTAL COMMITTED</Text>
                  <GSAmountDisplay amount={metrics.totalCommitted} size="lg" variant="default" showLakhs />

                  <View style={{ height: spacing[3] }} />

                  <Text style={[styles.microLabel, { color: colors.textTertiary }]}>TOTAL ACHIEVED</Text>
                  <GSAmountDisplay amount={metrics.totalAchieved} size="hero" variant="brand" showLakhs />
                </View>

                <GSProgressRing
                  value={metrics.achievementPercentage}
                  size={84}
                  strokeWidth={7}
                  color={colors.brand}
                >
                  <Text style={[styles.ringText, { color: colors.textPrimary }]}>
                    {Math.round(metrics.achievementPercentage)}%
                  </Text>
                </GSProgressRing>
              </View>
            </View>

            {/* Sales Trend Chart matching Screen 10 */}
            <View style={[styles.card, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
              <View style={styles.trendHeader}>
                <Text style={[styles.cardHeading, { color: colors.textPrimary }]}>Sales Trend</Text>
                <View style={styles.trendLegend}>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: colors.brand }]} />
                    <Text style={[styles.legendText, { color: colors.textSecondary }]}>Achieved</Text>
                  </View>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: colors.info }]} />
                    <Text style={[styles.legendText, { color: colors.textSecondary }]}>Target</Text>
                  </View>
                </View>
              </View>

              <View style={styles.chartContainer}>
                {monthlyTrend.map((item) => (
                  <View key={item.month} style={styles.chartCol}>
                    <View style={styles.barsWrap}>
                      <View
                        style={[
                          styles.bar,
                          {
                            height: (item.achieved / 40) * 80,
                            backgroundColor: colors.brand,
                          },
                        ]}
                      />
                      <View
                        style={[
                          styles.bar,
                          {
                            height: (item.target / 40) * 80,
                            backgroundColor: colors.infoSoft,
                            borderWidth: 1,
                            borderColor: colors.info,
                          },
                        ]}
                      />
                    </View>
                    <Text style={[styles.chartMonth, { color: colors.textTertiary }]}>
                      {item.month}
                    </Text>
                  </View>
                ))}
              </View>
            </View>

            {/* Top Customers matching Screen 10 */}
            <View style={[styles.card, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
              <Text style={[styles.cardHeading, { color: colors.textPrimary }]}>Top Customers</Text>
              <View style={styles.topCustList}>
                {topCustomers.map((c, i) => (
                  <View
                    key={c.name}
                    style={[
                      styles.topCustRow,
                      i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.borderSubtle },
                    ]}
                  >
                    <View style={styles.topCustLeft}>
                      <View style={[styles.custBadge, { backgroundColor: colors.brandSoft }]}>
                        <Text style={[styles.custBadgeText, { color: colors.brand }]}>
                          {c.name.split(' ').map((w) => w[0]).slice(0, 2).join('')}
                        </Text>
                      </View>
                      <Text style={[styles.custName, { color: colors.textPrimary }]}>{c.name}</Text>
                    </View>
                    <Text style={[styles.custRev, { color: colors.textPrimary }]}>
                      {formatLakhs(c.revenue)}
                    </Text>
                  </View>
                ))}
              </View>
            </View>

            {/* Recurring vs New Sales Bars */}
            <View style={[styles.card, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
              <Text style={[styles.cardHeading, { color: colors.textPrimary }]}>
                Stream Breakdown
              </Text>

              <View style={styles.streamItem}>
                <View style={styles.streamHeader}>
                  <Text style={[styles.streamName, { color: colors.textPrimary }]}>Recurring Projections</Text>
                  <Text style={[styles.streamVal, { color: colors.brand }]}>
                    {formatLakhs(metrics.recurringAchieved)} / {formatLakhs(metrics.recurringCommitted)}
                  </Text>
                </View>
                <GSProgress
                  value={(metrics.recurringAchieved / (metrics.recurringCommitted || 1)) * 100}
                  height={6}
                />
              </View>

              <View style={styles.streamItem}>
                <View style={styles.streamHeader}>
                  <Text style={[styles.streamName, { color: colors.textPrimary }]}>New Sales Opportunities</Text>
                  <Text style={[styles.streamVal, { color: colors.info }]}>
                    {formatLakhs(metrics.newSalesAchieved)} / {formatLakhs(metrics.newSalesCommitted)}
                  </Text>
                </View>
                <GSProgress
                  value={(metrics.newSalesAchieved / (metrics.newSalesCommitted || 1)) * 100}
                  color={colors.info}
                  height={6}
                />
              </View>
            </View>
          </View>
        )}

        {/* REPORT 2: RECEIVABLES AGING */}
        {reportTab === 'payments' && (
          <View>
            <View style={[styles.card, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
              <Text style={[styles.cardHeading, { color: colors.textPrimary }]}>
                Outstanding Aging Buckets
              </Text>
              <Text style={[styles.cardSubtitle, { color: colors.textSecondary }]}>
                Total Outstanding: {formatLakhs(agingBreakdown.total)}
              </Text>

              <View style={styles.bucketRow}>
                <Text style={[styles.bucketLabel, { color: colors.textPrimary }]}>Current (On Schedule)</Text>
                <Text style={[styles.bucketVal, { color: colors.success }]}>{formatLakhs(agingBreakdown.current)}</Text>
              </View>
              <GSProgress value={(agingBreakdown.current / (agingBreakdown.total || 1)) * 100} color={colors.success} height={5} />

              <View style={styles.bucketRow}>
                <Text style={[styles.bucketLabel, { color: colors.textPrimary }]}>1 - 30 Days Overdue</Text>
                <Text style={[styles.bucketVal, { color: colors.warning }]}>{formatLakhs(agingBreakdown.d30)}</Text>
              </View>
              <GSProgress value={(agingBreakdown.d30 / (agingBreakdown.total || 1)) * 100} color={colors.warning} height={5} />

              <View style={styles.bucketRow}>
                <Text style={[styles.bucketLabel, { color: colors.textPrimary }]}>31 - 60 Days Overdue</Text>
                <Text style={[styles.bucketVal, { color: colors.warning }]}>{formatLakhs(agingBreakdown.d60)}</Text>
              </View>
              <GSProgress value={(agingBreakdown.d60 / (agingBreakdown.total || 1)) * 100} color={colors.warning} height={5} />

              <View style={styles.bucketRow}>
                <Text style={[styles.bucketLabel, { color: colors.textPrimary }]}>61 - 90 Days Overdue</Text>
                <Text style={[styles.bucketVal, { color: colors.danger }]}>{formatLakhs(agingBreakdown.d90)}</Text>
              </View>
              <GSProgress value={(agingBreakdown.d90 / (agingBreakdown.total || 1)) * 100} color={colors.danger} height={5} />

              <View style={styles.bucketRow}>
                <Text style={[styles.bucketLabel, { color: colors.danger, fontWeight: '800' }]}>90+ Days (Critical Red Zone)</Text>
                <Text style={[styles.bucketVal, { color: colors.danger, fontWeight: '800' }]}>{formatLakhs(agingBreakdown.d90plus)}</Text>
              </View>
              <GSProgress value={(agingBreakdown.d90plus / (agingBreakdown.total || 1)) * 100} color={colors.danger} height={6} />
            </View>
          </View>
        )}

        {/* REPORT 3: PIPELINE FUNNEL */}
        {reportTab === 'pipeline' && (
          <View>
            <View style={[styles.card, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
              <Text style={[styles.cardHeading, { color: colors.textPrimary }]}>
                Pipeline Funnel Summary
              </Text>

              <View style={[styles.pipelineBox, { borderBottomColor: colors.borderSubtle }]}>
                <Text style={[styles.microLabel, { color: colors.textTertiary }]}>TOTAL PIPELINE VALUE</Text>
                <GSAmountDisplay amount={pipelineSummary.totalVal} size="hero" variant="default" showLakhs />
              </View>

              <View style={styles.funnelItem}>
                <View style={styles.funnelHeader}>
                  <Text style={[styles.funnelLabel, { color: colors.textPrimary }]}>Closed Won Revenue</Text>
                  <Text style={[styles.funnelVal, { color: colors.success }]}>{formatLakhs(pipelineSummary.wonVal)}</Text>
                </View>
                <GSProgress value={(pipelineSummary.wonVal / (pipelineSummary.totalVal || 1)) * 100} color={colors.success} height={6} />
              </View>

              <View style={styles.funnelItem}>
                <View style={styles.funnelHeader}>
                  <Text style={[styles.funnelLabel, { color: colors.textPrimary }]}>Oral Confirmation Stage</Text>
                  <Text style={[styles.funnelVal, { color: colors.brand }]}>{formatLakhs(pipelineSummary.oralVal)}</Text>
                </View>
                <GSProgress value={(pipelineSummary.oralVal / (pipelineSummary.totalVal || 1)) * 100} color={colors.brand} height={6} />
              </View>
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  tabsBox: {
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    borderBottomWidth: 1,
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
  cardHeading: {
    fontSize: typography.cardTitle.fontSize,
    fontWeight: '800',
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: typography.caption.fontSize,
    marginBottom: spacing[4],
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing[2],
  },
  microLabel: {
    fontSize: typography.micro.fontSize,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  ringText: {
    fontSize: typography.cardTitle.fontSize,
    fontWeight: '800',
  },
  streamItem: {
    marginTop: spacing[3],
  },
  streamHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  streamName: {
    fontSize: typography.bodySmall.fontSize,
    fontWeight: '600',
  },
  streamVal: {
    fontSize: typography.bodySmall.fontSize,
    fontWeight: '700',
  },
  bucketRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing[3],
    marginBottom: 4,
  },
  bucketLabel: {
    fontSize: typography.bodySmall.fontSize,
  },
  bucketVal: {
    fontSize: typography.bodySmall.fontSize,
    fontWeight: '700',
  },
  pipelineBox: {
    paddingVertical: spacing[3],
    borderBottomWidth: 1,
    marginBottom: spacing[3],
  },
  funnelItem: {
    marginTop: spacing[3],
  },
  funnelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  funnelLabel: {
    fontSize: typography.bodySmall.fontSize,
  },
  funnelVal: {
    fontSize: typography.bodySmall.fontSize,
    fontWeight: '700',
  },
  trendHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing[4],
  },
  trendLegend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 11,
    fontFamily: typography.caption.fontFamily,
  },
  chartContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
    height: 110,
    paddingTop: spacing[2],
  },
  chartCol: {
    alignItems: 'center',
    gap: 6,
  },
  barsWrap: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4,
  },
  bar: {
    width: 14,
    borderRadius: radius.xs,
  },
  chartMonth: {
    fontSize: 11,
    fontFamily: typography.caption.fontFamily,
  },
  topCustList: {
    marginTop: spacing[2],
  },
  topCustRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing[3],
  },
  topCustLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  custBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  custBadgeText: {
    fontSize: 12,
    fontFamily: typography.cardTitle.fontFamily,
    fontWeight: '700',
  },
  custName: {
    fontSize: 14,
    fontFamily: typography.cardTitle.fontFamily,
    fontWeight: '600',
  },
  custRev: {
    fontSize: 14,
    fontFamily: typography.cardTitle.fontFamily,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
});
