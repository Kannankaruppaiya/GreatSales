import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView, RefreshControl, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Plus, CheckSquare, Calendar, AlertCircle } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../src/design-system/theme';
import { spacing, radius, typography } from '../../src/design-system/tokens';
import {
  GSTabs,
  GSChip,
  GSSkeleton,
  GSEmptyState,
  GSErrorState,
  GSIconButton,
} from '../../src/components/ui';
import { FollowUpCard } from '../../src/components/domain';
import { CompleteFollowUpSheet, SnoozeFollowUpSheet, NewFollowUpSheet } from '../../src/components/modals';
import { useFollowUps } from '../../src/hooks';
import { hapticFeedback } from '../../src/utils/haptics';

export default function FollowUpsScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<'all' | 'overdue' | 'today' | 'upcoming' | 'completed'>('all');
  const [completeTarget, setCompleteTarget] = useState<any>(null);
  const [snoozeTarget, setSnoozeTarget] = useState<any>(null);
  const [createSheetVisible, setCreateSheetVisible] = useState(false);

  const { data: allFollowUps, isLoading, isError, refetch } = useFollowUps();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const overdueList = useMemo(() => allFollowUps?.filter((f) => f.status === 'Overdue') || [], [allFollowUps]);
  const todayList = useMemo(() => allFollowUps?.filter((f) => f.status === 'Today') || [], [allFollowUps]);
  const upcomingList = useMemo(() => allFollowUps?.filter((f) => f.status === 'Upcoming') || [], [allFollowUps]);
  const completedList = useMemo(() => allFollowUps?.filter((f) => f.status === 'Completed') || [], [allFollowUps]);

  const displayedList = useMemo(() => {
    switch (activeTab) {
      case 'overdue':
        return overdueList;
      case 'today':
        return todayList;
      case 'upcoming':
        return upcomingList;
      case 'completed':
        return completedList;
      default:
        return allFollowUps || [];
    }
  }, [activeTab, allFollowUps, overdueList, todayList, upcomingList, completedList]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header matching Screen 8 */}
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
            Follow-ups
          </Text>
          <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
            Stay on track
          </Text>
        </View>

        <GSIconButton
          icon={<Plus size={20} color={colors.white} strokeWidth={2.5} />}
          variant="brand"
          size="sm"
          accessibilityLabel="Create follow-up task"
          onPress={() => {
            hapticFeedback('light');
            setCreateSheetVisible(true);
          }}
        />
      </View>

      {/* Segment Pills matching Screen 8 */}
      <View style={[styles.filterBar, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterScroll}
        >
          <GSChip
            label={`Overdue (${overdueList.length})`}
            selected={activeTab === 'overdue'}
            onPress={() => setActiveTab('overdue')}
          />
          <View style={{ width: spacing[2] }} />
          <GSChip
            label={`Today (${todayList.length})`}
            selected={activeTab === 'today'}
            onPress={() => setActiveTab('today')}
          />
          <View style={{ width: spacing[2] }} />
          <GSChip
            label="Upcoming"
            selected={activeTab === 'upcoming'}
            onPress={() => setActiveTab('upcoming')}
          />
          <View style={{ width: spacing[2] }} />
          <GSChip
            label="All"
            selected={activeTab === 'all'}
            onPress={() => setActiveTab('all')}
          />
          <View style={{ width: spacing[2] }} />
          <GSChip
            label="Done"
            selected={activeTab === 'completed'}
            onPress={() => setActiveTab('completed')}
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
            <GSSkeleton height={110} borderRadius={radius.lg} style={{ marginBottom: spacing[3] }} />
            <GSSkeleton height={110} borderRadius={radius.lg} style={{ marginBottom: spacing[3] }} />
            <GSSkeleton height={110} borderRadius={radius.lg} />
          </>
        ) : isError ? (
          <GSErrorState onRetry={refetch} />
        ) : displayedList.length === 0 ? (
          <GSEmptyState
            title="No Follow-ups Found"
            description="You are caught up on all follow-ups for this selection."
          />
        ) : (
          displayedList.map((item) => (
            <FollowUpCard
              key={item.id}
              followUp={item}
              onPress={() => router.push(`/(app)/followups/${item.id}` as any)}
              onComplete={() => setCompleteTarget(item)}
              onSnooze={() => setSnoozeTarget(item)}
            />
          ))
        )}
      </ScrollView>

      {/* Contextual Action Sheets */}
      {completeTarget && (
        <CompleteFollowUpSheet
          visible={Boolean(completeTarget)}
          onClose={() => setCompleteTarget(null)}
          followUpId={completeTarget.id}
          title={completeTarget.title}
          customerName={completeTarget.customerName}
        />
      )}

      {snoozeTarget && (
        <SnoozeFollowUpSheet
          visible={Boolean(snoozeTarget)}
          onClose={() => setSnoozeTarget(null)}
          followUpId={snoozeTarget.id}
          customerName={snoozeTarget.customerName}
        />
      )}

      <NewFollowUpSheet
        visible={createSheetVisible}
        onClose={() => setCreateSheetVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[4],
    paddingBottom: spacing[3],
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: typography.heading1.fontSize,
    fontWeight: '800',
  },
  headerSubtitle: {
    fontSize: typography.caption.fontSize,
    marginTop: 2,
  },
  countsStrip: {
    flexDirection: 'row',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    gap: spacing[2],
    borderBottomWidth: 1,
  },
  countBlock: {
    flex: 1,
    paddingVertical: spacing[2],
    alignItems: 'center',
    borderRadius: radius.md,
  },
  countNum: {
    fontSize: typography.cardTitle.fontSize,
    fontWeight: '800',
  },
  countLabel: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  filterBar: {
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    borderBottomWidth: 1,
  },
  filterScroll: {
    paddingVertical: spacing[1],
  },
  listContent: {
    padding: spacing[4],
  },
});
