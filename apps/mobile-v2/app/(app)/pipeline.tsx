import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView, RefreshControl, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Plus, Filter, SlidersHorizontal, ArrowUpDown } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../src/design-system/theme';
import { spacing, radius, typography } from '../../src/design-system/tokens';
import {
  GSSearchBar,
  GSChip,
  GSSkeleton,
  GSEmptyState,
  GSErrorState,
  GSIconButton,
  GSBottomSheet,
  GSButton,
  GSAmountDisplay,
} from '../../src/components/ui';
import { LeadCard, ProjectionCard } from '../../src/components/domain';
import { useLeads, useProjections, usePrincipals } from '../../src/hooks';
import { hapticFeedback } from '../../src/utils/haptics';

export default function PipelineScreen() {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<'leads' | 'recurring'>('leads');
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState('ALL');
  const [principalFilter, setPrincipalFilter] = useState('ALL');
  const [isFilterSheetOpen, setIsFilterSheetOpen] = useState(false);
  const [sortBy, setSortBy] = useState<'value_desc' | 'close_asc' | 'prob_desc'>('value_desc');

  const {
    data: leads,
    isLoading: leadsLoading,
    isError: leadsError,
    refetch: refetchLeads,
  } = useLeads({ search });

  const {
    data: projections,
    isLoading: projLoading,
    isError: projError,
    refetch: refetchProj,
  } = useProjections({ search });

  const { data: principals } = usePrincipals();

  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    hapticFeedback('light');
    if (activeTab === 'leads') {
      await refetchLeads();
    } else {
      await refetchProj();
    }
    setRefreshing(false);
  };

  // Pipeline Metrics Summary
  const pipelineSummary = useMemo(() => {
    if (!leads) return { totalVal: 0, highProbVal: 0, dealsCount: 0 };
    const active = leads.filter(
      (l) => !['ClosedLost', 'NoRequirementOrCold', 'TrialProblem'].includes(l.stage)
    );
    const totalVal = active.reduce((sum, l) => sum + (l.totalValue ?? l.value ?? 0), 0);
    const highProbVal = active
      .filter((l) => l.stage === 'NegotiationOralConfirmation' || l.probability >= 70)
      .reduce((sum, l) => sum + (l.totalValue ?? l.value ?? 0), 0);
    return {
      totalVal,
      highProbVal,
      dealsCount: active.length,
    };
  }, [leads]);

  // Filtered & Sorted Leads
  const filteredLeads = useMemo(() => {
    if (!leads) return [];
    let list = [...leads];

    if (stageFilter === 'ORAL') {
      list = list.filter((l) => l.stage === 'NegotiationOralConfirmation' || l.probability >= 90);
    } else if (stageFilter === 'NEGOTIATION') {
      list = list.filter((l) => l.stage === 'NegotiationOralConfirmation' || l.stage === 'ProposalsAndPriceQuote');
    } else if (stageFilter === 'PROPOSAL') {
      list = list.filter((l) => l.stage === 'ProposalsAndPriceQuote');
    } else if (stageFilter === 'WON') {
      list = list.filter((l) => l.stage === 'OrderClosedWon' || l.stage === 'ClosedWon');
    }

    if (sortBy === 'value_desc') {
      list.sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
    } else if (sortBy === 'prob_desc') {
      list.sort((a, b) => (b.probability ?? 0) - (a.probability ?? 0));
    } else if (sortBy === 'close_asc') {
      list.sort((a, b) => (a.expectedClose || '').localeCompare(b.expectedClose || ''));
    }

    return list;
  }, [leads, stageFilter, sortBy]);

  // Filtered Projections
  const filteredProjections = useMemo(() => {
    if (!projections) return [];
    if (principalFilter === 'ALL') return projections;
    return projections.filter(
      (p) => p.principalName.toLowerCase().includes(principalFilter.toLowerCase())
    );
  }, [projections, principalFilter]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Top Header */}
      <View
        style={[
          styles.headerRow,
          {
            paddingTop: insets.top + spacing[2],
            backgroundColor: colors.surface,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <View>
          <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
            Pipeline
          </Text>
          <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
            {activeTab === 'leads'
              ? `${filteredLeads.length} active opportunities`
              : `${filteredProjections.length} recurring commitments`}
          </Text>
        </View>

        <GSIconButton
          icon={<Plus size={20} color={colors.white} strokeWidth={2.5} />}
          variant="brand"
          size="sm"
          accessibilityLabel="Add New Lead"
          onPress={() => {
            hapticFeedback('light');
            router.push('/(app)/new-lead');
          }}
        />
      </View>

      {/* Segmented Switch: Opportunities vs Recurring */}
      <View style={[styles.switchContainer, { backgroundColor: colors.surface }]}>
        <View
          style={[
            styles.segmentedTrack,
            {
              backgroundColor: colors.surfaceElevated,
              borderColor: colors.border,
            },
          ]}
        >
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected: activeTab === 'leads' }}
            onPress={() => {
              hapticFeedback('light');
              setActiveTab('leads');
            }}
            style={[
              styles.segmentedTab,
              activeTab === 'leads' && {
                backgroundColor: colors.surface,
                borderColor: colors.borderStrong,
                borderWidth: 1,
              },
            ]}
          >
            <Text
              style={[
                styles.tabText,
                {
                  color: activeTab === 'leads' ? colors.brand : colors.textTertiary,
                  fontWeight: activeTab === 'leads' ? '700' : '500',
                },
              ]}
            >
              Opportunities ({leads?.length || 0})
            </Text>
          </Pressable>

          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected: activeTab === 'recurring' }}
            onPress={() => {
              hapticFeedback('light');
              setActiveTab('recurring');
            }}
            style={[
              styles.segmentedTab,
              activeTab === 'recurring' && {
                backgroundColor: colors.surface,
                borderColor: colors.borderStrong,
                borderWidth: 1,
              },
            ]}
          >
            <Text
              style={[
                styles.tabText,
                {
                  color: activeTab === 'recurring' ? colors.brand : colors.textTertiary,
                  fontWeight: activeTab === 'recurring' ? '700' : '500',
                },
              ]}
            >
              Recurring ({projections?.length || 0})
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Search Bar */}
      <View style={[styles.searchContainer, { backgroundColor: colors.surface }]}>
        <GSSearchBar
          value={search}
          onChangeText={setSearch}
          placeholder={
            activeTab === 'leads'
              ? 'Search by customer, deal, product...'
              : 'Search recurring projections...'
          }
        />
      </View>

      {/* Filter Row */}
      <View style={[styles.filterBar, { borderBottomColor: colors.border }]}>
        {activeTab === 'leads' ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterScroll}
          >
            <GSChip
              label="All Deals"
              selected={stageFilter === 'ALL'}
              onPress={() => setStageFilter('ALL')}
            />
            <View style={{ width: spacing[2] }} />
            <GSChip
              label="Oral Confirmation"
              selected={stageFilter === 'ORAL'}
              onPress={() => setStageFilter('ORAL')}
            />
            <View style={{ width: spacing[2] }} />
            <GSChip
              label="Negotiation"
              selected={stageFilter === 'NEGOTIATION'}
              onPress={() => setStageFilter('NEGOTIATION')}
            />
            <View style={{ width: spacing[2] }} />
            <GSChip
              label="Proposal"
              selected={stageFilter === 'PROPOSAL'}
              onPress={() => setStageFilter('PROPOSAL')}
            />
            <View style={{ width: spacing[2] }} />
            <GSChip
              label="Won"
              selected={stageFilter === 'WON'}
              onPress={() => setStageFilter('WON')}
            />
          </ScrollView>
        ) : (
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
                  selected={principalFilter.toLowerCase() === p.name.toLowerCase()}
                  onPress={() => setPrincipalFilter(p.name)}
                />
              </React.Fragment>
            ))}
          </ScrollView>
        )}

        {/* Filter / Sort Button */}
        {activeTab === 'leads' && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open filter options"
            onPress={() => {
              hapticFeedback('light');
              setIsFilterSheetOpen(true);
            }}
            style={[
              styles.filterBtn,
              {
                backgroundColor: colors.surfaceElevated,
                borderColor: sortBy !== 'value_desc' ? colors.brand : colors.border,
              },
            ]}
          >
            <SlidersHorizontal
              size={15}
              color={sortBy !== 'value_desc' ? colors.brand : colors.textSecondary}
            />
            {sortBy !== 'value_desc' && (
              <View
                style={[
                  styles.filterActiveDot,
                  { backgroundColor: colors.brand },
                ]}
              />
            )}
          </Pressable>
        )}
      </View>

      {/* Pipeline Summary Metrics Strip */}
      {activeTab === 'leads' && (
        <View
          style={[
            styles.summaryStrip,
            {
              backgroundColor: colors.surfaceElevated,
              borderColor: colors.borderSubtle,
            },
          ]}
        >
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryLabel, { color: colors.textTertiary }]}>TOTAL PIPELINE</Text>
            <GSAmountDisplay amount={pipelineSummary.totalVal} size="md" variant="brand" showLakhs />
          </View>
          <View style={[styles.summaryDivider, { backgroundColor: colors.borderSubtle }]} />
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryLabel, { color: colors.textTertiary }]}>HIGH PROBABILITY</Text>
            <GSAmountDisplay amount={pipelineSummary.highProbVal} size="md" variant="default" showLakhs />
          </View>
          <View style={[styles.summaryDivider, { backgroundColor: colors.borderSubtle }]} />
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryLabel, { color: colors.textTertiary }]}>ACTIVE DEALS</Text>
            <Text style={[styles.summaryVal, { color: colors.textPrimary }]}>
              {pipelineSummary.dealsCount}
            </Text>
          </View>
        </View>
      )}

      {/* Main Opportunity / Projection List */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.brand}
          />
        }
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: insets.bottom + spacing[8] },
        ]}
      >
        {activeTab === 'leads' ? (
          leadsLoading ? (
            <>
              <GSSkeleton height={130} borderRadius={radius.lg} style={{ marginBottom: spacing[3] }} />
              <GSSkeleton height={130} borderRadius={radius.lg} style={{ marginBottom: spacing[3] }} />
              <GSSkeleton height={130} borderRadius={radius.lg} />
            </>
          ) : leadsError ? (
            <GSErrorState onRetry={refetchLeads} />
          ) : filteredLeads.length === 0 ? (
            <GSEmptyState
              title="No opportunities found"
              description="No deals match your search and filter criteria."
              actionLabel="Clear Filters"
              onAction={() => {
                setStageFilter('ALL');
                setSearch('');
              }}
            />
          ) : (
            filteredLeads.map((lead) => (
              <LeadCard
                key={lead.id}
                lead={lead}
                onPress={() => router.push(`/(app)/leads/${lead.id}` as any)}
              />
            ))
          )
        ) : projLoading ? (
          <>
            <GSSkeleton height={130} borderRadius={radius.lg} style={{ marginBottom: spacing[3] }} />
            <GSSkeleton height={130} borderRadius={radius.lg} style={{ marginBottom: spacing[3] }} />
            <GSSkeleton height={130} borderRadius={radius.lg} />
          </>
        ) : projError ? (
          <GSErrorState onRetry={refetchProj} />
        ) : filteredProjections.length === 0 ? (
          <GSEmptyState
            title="No projections found"
            description="No recurring commitments match your search criteria."
            actionLabel="Reset Brand Filter"
            onAction={() => {
              setPrincipalFilter('ALL');
              setSearch('');
            }}
          />
        ) : (
          filteredProjections.map((proj) => (
            <ProjectionCard
              key={proj.id}
              projection={proj}
              onPress={() => router.push(`/(app)/projections/${proj.id}` as any)}
            />
          ))
        )}
      </ScrollView>

      {/* Filter Bottom Sheet */}
      <GSBottomSheet
        visible={isFilterSheetOpen}
        onClose={() => setIsFilterSheetOpen(false)}
        title="Sort & Filter Opportunities"
      >
        <View style={styles.sheetContent}>
          <Text style={[styles.sheetSectionTitle, { color: colors.textSecondary }]}>
            SORT BY
          </Text>
          <View style={styles.sheetOptions}>
            <GSChip
              label="Highest Value First"
              selected={sortBy === 'value_desc'}
              onPress={() => setSortBy('value_desc')}
            />
            <GSChip
              label="Highest Probability"
              selected={sortBy === 'prob_desc'}
              onPress={() => setSortBy('prob_desc')}
            />
            <GSChip
              label="Expected Close Date"
              selected={sortBy === 'close_asc'}
              onPress={() => setSortBy('close_asc')}
            />
          </View>

          <View style={{ height: spacing[4] }} />

          <Text style={[styles.sheetSectionTitle, { color: colors.textSecondary }]}>
            DEAL STAGE
          </Text>
          <View style={styles.sheetOptions}>
            <GSChip
              label="All Stages"
              selected={stageFilter === 'ALL'}
              onPress={() => setStageFilter('ALL')}
            />
            <GSChip
              label="Oral Confirmation"
              selected={stageFilter === 'ORAL'}
              onPress={() => setStageFilter('ORAL')}
            />
            <GSChip
              label="Negotiation"
              selected={stageFilter === 'NEGOTIATION'}
              onPress={() => setStageFilter('NEGOTIATION')}
            />
            <GSChip
              label="Won Deals"
              selected={stageFilter === 'WON'}
              onPress={() => setStageFilter('WON')}
            />
          </View>

          <View style={{ height: spacing[6] }} />

          <GSButton
            title="Apply Filters"
            onPress={() => setIsFilterSheetOpen(false)}
            fullWidth
          />
        </View>
      </GSBottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing[4],
    paddingBottom: spacing[3],
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 22,
    fontFamily: typography.heading1.fontFamily,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 12,
    fontFamily: typography.caption.fontFamily,
    marginTop: 2,
  },
  switchContainer: {
    paddingHorizontal: spacing[4],
    paddingTop: spacing[3],
    paddingBottom: spacing[2],
  },
  segmentedTrack: {
    flexDirection: 'row',
    borderRadius: radius.md,
    padding: 3,
    borderWidth: 1,
  },
  segmentedTab: {
    flex: 1,
    paddingVertical: spacing[2],
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
  },
  tabText: {
    fontSize: 13,
    fontFamily: typography.bodySmallMedium.fontFamily,
  },
  searchContainer: {
    paddingHorizontal: spacing[4],
    paddingBottom: spacing[3],
  },
  filterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[4],
    paddingBottom: spacing[2],
    borderBottomWidth: 1,
  },
  filterScroll: {
    alignItems: 'center',
    paddingRight: spacing[2],
  },
  filterBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    marginLeft: spacing[2],
    position: 'relative',
  },
  filterActiveDot: {
    position: 'absolute',
    top: 5,
    right: 5,
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  summaryStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing[4],
    marginTop: spacing[2],
    marginBottom: spacing[1],
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2] + 2,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryDivider: {
    width: 1,
    height: 28,
    marginHorizontal: spacing[1],
  },
  summaryLabel: {
    fontSize: 9,
    fontFamily: typography.micro.fontFamily,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  summaryVal: {
    fontSize: 16,
    fontFamily: typography.cardTitle.fontFamily,
    fontWeight: '700',
  },
  listContent: {
    paddingHorizontal: spacing[4],
    paddingTop: spacing[3],
  },
  sheetContent: {
    paddingVertical: spacing[2],
  },
  sheetSectionTitle: {
    fontSize: 11,
    fontFamily: typography.micro.fontFamily,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: spacing[2],
  },
  sheetOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
  },
});
