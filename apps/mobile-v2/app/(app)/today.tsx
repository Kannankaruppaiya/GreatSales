import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  StyleSheet,
  Pressable,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  Search,
  Bell,
  AlertTriangle,
  ArrowRight,
  Plus,
  UsersRound,
  Package,
  CreditCard,
  Phone,
  Clock,
  Check,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../src/design-system/theme';
import { spacing, radius, typography } from '../../src/design-system/tokens';
import {
  GSSkeleton,
  GSErrorState,
  GSIconButton,
  GSAvatar,
} from '../../src/components/ui';
import {
  KPIHero,
  FollowUpCard,
  PaymentCard,
  LeadCard,
  ProjectionCard,
} from '../../src/components/domain';
import {
  CompleteFollowUpSheet,
  SnoozeFollowUpSheet,
  RecordPaymentSheet,
  ChangeLeadStageSheet,
} from '../../src/components/modals';
import { useToday, useCurrentUser, useNotifications } from '../../src/hooks';
import {
  calculatePriorityItems,
  type RankedPriorityItem,
} from '../../src/domain/calculations';
import { formatShortDate, formatLakhs } from '../../src/domain/formatters';
import { hapticFeedback } from '../../src/utils/haptics';

export default function TodayScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const { data: currentUser } = useCurrentUser();
  const { data: notifications } = useNotifications();
  const unreadNotifications = notifications?.filter((n) => !n.read).length || 0;

  const {
    metrics,
    oralDeals,
    topProjections,
    priorityFollowUps,
    paymentAlerts,
    isLoading,
    isError,
    refetchAll,
  } = useToday();

  const [refreshing, setRefreshing] = useState(false);

  // Modal targets for contextual action sheets
  const [completeTarget, setCompleteTarget] = useState<any>(null);
  const [snoozeTarget, setSnoozeTarget] = useState<any>(null);
  const [paymentTarget, setPaymentTarget] = useState<any>(null);
  const [stageTarget, setStageTarget] = useState<any>(null);

  const onRefresh = async () => {
    setRefreshing(true);
    hapticFeedback('light');
    await refetchAll();
    setRefreshing(false);
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  // Section-level Loading Skeletons
  if (isLoading && !metrics) {
    return (
      <View
        style={[
          styles.container,
          { backgroundColor: colors.background, paddingTop: insets.top + spacing[2] },
        ]}
      >
        <View style={styles.headerRow}>
          <GSSkeleton width={140} height={26} />
          <GSSkeleton width={38} height={38} borderRadius={radius.full} />
        </View>
        <View style={{ paddingHorizontal: spacing[4], paddingTop: spacing[4] }}>
          <GSSkeleton height={190} borderRadius={radius.lg} style={{ marginBottom: spacing[4] }} />
          <View style={{ flexDirection: 'row', gap: spacing[2], marginBottom: spacing[4] }}>
            <GSSkeleton height={42} style={{ flex: 1 }} borderRadius={radius.md} />
            <GSSkeleton height={42} style={{ flex: 1 }} borderRadius={radius.md} />
            <GSSkeleton height={42} style={{ flex: 1 }} borderRadius={radius.md} />
          </View>
          <GSSkeleton width={180} height={20} style={{ marginBottom: spacing[3] }} />
          <GSSkeleton height={130} borderRadius={radius.md} style={{ marginBottom: spacing[3] }} />
          <GSSkeleton height={90} borderRadius={radius.md} />
        </View>
      </View>
    );
  }

  // Recovery-oriented Error State
  if (isError && !metrics) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <GSErrorState
          title="Unable to load today's sales data"
          message="Please check your connection and retry"
          onRetry={refetchAll}
        />
      </View>
    );
  }

  // Centralized priority calculation (urgency, overdue status, business value, payment risk)
  const rankedPriorities = calculatePriorityItems(paymentAlerts || [], priorityFollowUps || []);
  const priorityTotalCount = rankedPriorities.length;
  const featuredItem = rankedPriorities.length > 0 ? rankedPriorities[0] : null;
  const secondaryPriorities = rankedPriorities.length > 1 ? rankedPriorities.slice(1, 4) : [];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* 1. Fixed Header: Dynamic Greeting, Name, Search, Notifications, Real Avatar */}
      <View
        style={[
          styles.headerRow,
          {
            paddingTop: insets.top + spacing[2],
            backgroundColor: colors.surface,
            borderBottomColor: colors.borderSubtle,
          },
        ]}
      >
        <View style={styles.userProfileCol}>
          <Text style={[styles.greetingText, { color: colors.textSecondary }]}>
            {getGreeting()}
          </Text>
          <Text numberOfLines={1} style={[styles.userNameText, { color: colors.textPrimary }]}>
            {currentUser?.name || 'Megala'}
          </Text>
        </View>

        <View style={styles.headerActions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Search records"
            onPress={() => router.push('/(app)/search')}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={({ pressed }) => [
              styles.headerIconButton,
              { opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <Search size={21} color={colors.textSecondary} strokeWidth={2.2} />
          </Pressable>

          <View style={{ width: spacing[2] }} />

          <View style={{ position: 'relative' }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Notifications"
              onPress={() => router.push('/(app)/notifications')}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={({ pressed }) => [
                styles.headerIconButton,
                { opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <Bell size={21} color={colors.textSecondary} strokeWidth={2.2} />
            </Pressable>
            {unreadNotifications > 0 && (
              <View style={[styles.unreadBadge, { backgroundColor: colors.danger, borderColor: colors.background }]}>
                <Text style={styles.unreadBadgeText}>
                  {unreadNotifications > 9 ? '9+' : unreadNotifications}
                </Text>
              </View>
            )}
          </View>

          <View style={{ width: spacing[3] }} />

          <GSAvatar
            uri={currentUser?.avatarUrl}
            name={currentUser?.name || 'Megala'}
            size="md"
            variant="identity"
            onPress={() => {
              hapticFeedback('light');
              router.push('/(app)/profile');
            }}
          />
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} />
        }
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + spacing[8] },
        ]}
      >
        {/* 2. SALES PULSE (The Required Top Card: Pacing & Revenue Performance) */}
        {metrics && <KPIHero metrics={metrics} />}

        {/* 3. QUICK ACTIONS (Immediately Below Sales Pulse) */}
        <View style={styles.quickActionsBar}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Create New Lead"
            onPress={() => {
              hapticFeedback('light');
              router.push('/(app)/new-lead');
            }}
            style={({ pressed }) => [
              styles.quickActionBtn,
              {
                backgroundColor: pressed ? colors.surfaceActive : colors.surfaceElevated,
                borderColor: colors.border,
                transform: [{ scale: pressed ? 0.98 : 1 }],
              },
            ]}
          >
            <View style={[styles.quickIconWrap, { backgroundColor: colors.brandSoft }]}>
              <Plus size={16} color={colors.brandLight} strokeWidth={2.4} />
            </View>
            <Text style={[styles.quickActionText, { color: colors.textPrimary }]}>Lead</Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Create Sales Order"
            onPress={() => {
              hapticFeedback('light');
              router.push('/(app)/new-order');
            }}
            style={({ pressed }) => [
              styles.quickActionBtn,
              {
                backgroundColor: pressed ? colors.surfaceActive : colors.surfaceElevated,
                borderColor: colors.border,
                transform: [{ scale: pressed ? 0.98 : 1 }],
              },
            ]}
          >
            <View style={[styles.quickIconWrap, { backgroundColor: colors.infoSoft }]}>
              <Package size={16} color={colors.info} strokeWidth={2.4} />
            </View>
            <Text style={[styles.quickActionText, { color: colors.textPrimary }]}>Order</Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Add Customer"
            onPress={() => {
              hapticFeedback('light');
              router.push('/(app)/customers/new');
            }}
            style={({ pressed }) => [
              styles.quickActionBtn,
              {
                backgroundColor: pressed ? colors.surfaceActive : colors.surfaceElevated,
                borderColor: colors.border,
                transform: [{ scale: pressed ? 0.98 : 1 }],
              },
            ]}
          >
            <View style={[styles.quickIconWrap, { backgroundColor: colors.warningSoft }]}>
              <UsersRound size={16} color={colors.warning} strokeWidth={2.4} />
            </View>
            <Text style={[styles.quickActionText, { color: colors.textPrimary }]}>Customer</Text>
          </Pressable>
        </View>

        {/* 4. PRIORITY TODAY (Action-Oriented Sales Execution) */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleCol}>
              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
                {priorityTotalCount > 0
                  ? `${priorityTotalCount} actions need attention`
                  : "You're clear for now"}
              </Text>
              <Text style={[styles.sectionSubtitle, { color: colors.textTertiary }]}>
                {priorityTotalCount > 0
                  ? 'Prioritized by urgency, overdue status & value'
                  : 'All urgent follow-ups and receivables are up to date'}
              </Text>
            </View>

            {priorityTotalCount > 0 && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="View all follow-ups"
                onPress={() => router.push('/(app)/followups')}
                style={styles.seeAllBtn}
              >
                <Text style={[styles.seeAllText, { color: colors.brand }]}>View All</Text>
                <ArrowRight size={14} color={colors.brand} />
              </Pressable>
            )}
          </View>

          {/* Featured Top Urgent Item */}
          {featuredItem && (
            <FeaturedPriorityCard
              item={featuredItem}
              onRecordPayment={() => setPaymentTarget(featuredItem.raw)}
              onFollowUp={() => {
                hapticFeedback('light');
                router.push('/(app)/followups');
              }}
              onComplete={() => setCompleteTarget(featuredItem.raw)}
              onSnooze={() => setSnoozeTarget(featuredItem.raw)}
              onOpen={() => {
                if (featuredItem.type === 'payment') {
                  router.push(`/(app)/payments/${featuredItem.id}` as any);
                } else {
                  router.push(`/(app)/followups/${featuredItem.id}` as any);
                }
              }}
            />
          )}

          {/* Secondary Priority Items (Compact, Non-redundant) */}
          {secondaryPriorities.map((item) => {
            if (item.type === 'payment') {
              return (
                <PaymentCard
                  key={`p-${item.id}`}
                  payment={item.raw}
                  onPress={() => router.push(`/(app)/payments/${item.id}` as any)}
                  onRecordPayment={() => setPaymentTarget(item.raw)}
                  onFollowUp={() => router.push('/(app)/followups' as any)}
                />
              );
            }
            return (
              <FollowUpCard
                key={`f-${item.id}`}
                followUp={item.raw}
                onPress={() => router.push(`/(app)/followups/${item.id}` as any)}
                onComplete={() => setCompleteTarget(item.raw)}
                onSnooze={() => setSnoozeTarget(item.raw)}
              />
            );
          })}
        </View>

        {/* 5. HOT OPPORTUNITIES (Revenue & Deal-Oriented) */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleCol}>
              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
                Hot Opportunities ({oralDeals?.length || 0})
              </Text>
              <Text style={[styles.sectionSubtitle, { color: colors.textTertiary }]}>
                {oralDeals && oralDeals.length > 0
                  ? `${oralDeals.length} deals ready to close`
                  : 'No high-priority deals right now'}
              </Text>
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="View full pipeline"
              onPress={() => router.push('/(app)/pipeline')}
              style={styles.seeAllBtn}
            >
              <Text style={[styles.seeAllText, { color: colors.brand }]}>Pipeline</Text>
              <ArrowRight size={14} color={colors.brand} />
            </Pressable>
          </View>

          {oralDeals && oralDeals.length > 0 ? (
            oralDeals.slice(0, 3).map((lead) => (
              <LeadCard
                key={lead.id}
                lead={lead}
                onPress={() => router.push(`/(app)/leads/${lead.id}` as any)}
                onChangeStage={() => setStageTarget(lead)}
                onCall={() => hapticFeedback('light')}
                onFollowUp={() => router.push('/(app)/followups' as any)}
              />
            ))
          ) : (
            <View style={[styles.emptySectionCard, { backgroundColor: colors.surfaceElevated, borderColor: colors.borderSubtle }]}>
              <Text style={[styles.emptySectionText, { color: colors.textSecondary }]}>
                No deals at Oral Confirmation stage. Check pipeline to advance earlier-stage leads.
              </Text>
            </View>
          )}
        </View>

        {/* 6. RECURRING SALES TRACKING (Projection & Performance-Oriented) */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleCol}>
              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
                Recurring Sales Tracking
              </Text>
              <Text style={[styles.sectionSubtitle, { color: colors.textTertiary }]}>
                Monthly recurring commitments & pacing
              </Text>
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="View all projections"
              onPress={() => router.push('/(app)/projections' as any)}
              style={styles.seeAllBtn}
            >
              <Text style={[styles.seeAllText, { color: colors.brand }]}>All</Text>
              <ArrowRight size={14} color={colors.brand} />
            </Pressable>
          </View>

          {topProjections && topProjections.length > 0 ? (
            topProjections.slice(0, 3).map((proj) => (
              <ProjectionCard
                key={proj.id}
                projection={proj}
                onPress={() => router.push(`/(app)/projections/${proj.id}` as any)}
              />
            ))
          ) : (
            <View style={[styles.emptySectionCard, { backgroundColor: colors.surfaceElevated, borderColor: colors.borderSubtle }]}>
              <Text style={[styles.emptySectionText, { color: colors.textSecondary }]}>
                No recurring sales tracked this month.
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Contextual Action Bottom Sheets */}
      {completeTarget && (
        <CompleteFollowUpSheet
          visible={!!completeTarget}
          onClose={() => setCompleteTarget(null)}
          followUpId={completeTarget.id}
          title={completeTarget.title}
          customerName={completeTarget.customerName || ''}
        />
      )}

      {snoozeTarget && (
        <SnoozeFollowUpSheet
          visible={!!snoozeTarget}
          onClose={() => setSnoozeTarget(null)}
          followUpId={snoozeTarget.id}
          customerName={snoozeTarget.customerName || ''}
        />
      )}

      {paymentTarget && (
        <RecordPaymentSheet
          visible={!!paymentTarget}
          onClose={() => setPaymentTarget(null)}
          paymentId={paymentTarget.id}
          invoiceCode={paymentTarget.invoiceCode || paymentTarget.invoiceNo || ''}
          customerName={paymentTarget.customerName || ''}
          outstandingAmount={paymentTarget.amount || 0}
        />
      )}

      {stageTarget && (
        <ChangeLeadStageSheet
          visible={!!stageTarget}
          onClose={() => setStageTarget(null)}
          leadId={stageTarget.id}
          currentStage={stageTarget.stage}
          customerName={stageTarget.customerName || ''}
        />
      )}
    </View>
  );
}

/**
 * FeaturedPriorityCard
 * Prominently presents the single highest-urgency action answering:
 * WHO? WHAT? WHY NOW? VALUE? WHEN? WHAT SHOULD I DO?
 * Avoids red overload by using one dominant status signal.
 */
function FeaturedPriorityCard({
  item,
  onRecordPayment,
  onFollowUp,
  onComplete,
  onSnooze,
  onOpen,
}: {
  item: RankedPriorityItem;
  onRecordPayment?: () => void;
  onFollowUp?: () => void;
  onComplete?: () => void;
  onSnooze?: () => void;
  onOpen?: () => void;
}) {
  const { colors } = useTheme();

  if (item.type === 'payment') {
    return (
      <Pressable
        onPress={onOpen}
        accessibilityRole="button"
        accessibilityLabel={`Urgent payment collection: ${item.customerName}, ${formatLakhs(item.amount)} outstanding`}
        style={({ pressed }) => [
          styles.featuredCard,
          {
            backgroundColor: colors.surfaceElevated,
            borderColor: item.isRedZone ? colors.dangerBorder : colors.border,
            borderLeftWidth: item.isRedZone ? 3 : 1,
            borderLeftColor: item.isRedZone ? colors.danger : colors.border,
            transform: [{ scale: pressed ? 0.99 : 1 }],
          },
        ]}
      >
        {/* Header Tag */}
        <View style={styles.featuredTagRow}>
          <View
            style={[
              styles.featuredTag,
              { backgroundColor: item.isRedZone ? colors.dangerSoft : colors.warningSoft },
            ]}
          >
            <AlertTriangle size={12} color={item.isRedZone ? colors.danger : colors.warning} />
            <Text
              style={[
                styles.featuredTagText,
                { color: item.isRedZone ? colors.danger : colors.warning },
              ]}
            >
              {item.isRedZone ? 'PAYMENT · RED ZONE' : 'PAYMENT · OVERDUE'}
            </Text>
          </View>
          <Text style={[styles.featuredDueText, { color: colors.textSecondary }]}>
            {item.agingDays > 0 ? `${item.agingDays}d overdue` : `Due ${formatShortDate(item.dueDate)}`}
          </Text>
        </View>

        {/* Customer & Value Statement */}
        <Text numberOfLines={1} style={[styles.featuredCustomerName, { color: colors.textPrimary }]}>
          {item.customerName}
        </Text>

        <View style={styles.featuredAmountRow}>
          <Text style={[styles.featuredAmount, { color: item.isRedZone ? colors.danger : colors.textPrimary }]}>
            {formatLakhs(item.amount)}
          </Text>
          <Text style={[styles.featuredAmountSub, { color: colors.textSecondary }]}>
            outstanding • {item.title}
          </Text>
        </View>

        <Text style={[styles.featuredMetaText, { color: colors.textSecondary }]}>
          Due {formatShortDate(item.dueDate)}
          {item.reminderCount > 0 ? ` · ${item.reminderCount} reminder${item.reminderCount > 1 ? 's' : ''} sent` : ''}
        </Text>

        {/* Direct Semantic Actions */}
        <View style={styles.featuredActionRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Record Payment"
            onPress={(e) => {
              e.stopPropagation();
              onRecordPayment?.();
            }}
            style={({ pressed }) => [
              styles.primaryActionBtn,
              { backgroundColor: colors.brand, opacity: pressed ? 0.9 : 1 },
            ]}
          >
            <CreditCard size={14} color={colors.white} />
            <Text style={styles.primaryActionBtnText}>Record Payment</Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Follow up on payment"
            onPress={(e) => {
              e.stopPropagation();
              onFollowUp?.();
            }}
            style={({ pressed }) => [
              styles.secondaryActionBtn,
              {
                backgroundColor: pressed ? colors.surfaceActive : colors.surfaceElevated,
                borderColor: colors.borderStrong,
              },
            ]}
          >
            <Phone size={13} color={colors.textPrimary} />
            <Text style={[styles.secondaryActionBtnText, { color: colors.textPrimary }]}>
              Follow Up
            </Text>
          </Pressable>
        </View>
      </Pressable>
    );
  }

  // Follow-up Featured Card
  return (
    <Pressable
      onPress={onOpen}
      accessibilityRole="button"
      accessibilityLabel={`Urgent follow up: ${item.customerName}, ${item.title}`}
      style={({ pressed }) => [
        styles.featuredCard,
        {
          backgroundColor: colors.surfaceElevated,
          borderColor: item.isOverdue ? colors.dangerBorder : colors.border,
          borderLeftWidth: item.isOverdue ? 3 : 1,
          borderLeftColor: item.isOverdue ? colors.danger : colors.border,
          transform: [{ scale: pressed ? 0.99 : 1 }],
        },
      ]}
    >
      <View style={styles.featuredTagRow}>
        <View
          style={[
            styles.featuredTag,
            { backgroundColor: item.isOverdue ? colors.dangerSoft : colors.warningSoft },
          ]}
        >
          <Clock size={12} color={item.isOverdue ? colors.danger : colors.warning} />
          <Text
            style={[
              styles.featuredTagText,
              { color: item.isOverdue ? colors.danger : colors.warning },
            ]}
          >
            {item.isOverdue ? 'FOLLOW-UP · OVERDUE' : 'FOLLOW-UP · DUE TODAY'}
          </Text>
        </View>
        <Text
          style={[
            styles.featuredDueText,
            { color: item.isOverdue ? colors.danger : colors.textSecondary },
          ]}
        >
          Due {formatShortDate(item.dueDate)}
        </Text>
      </View>

      <Text numberOfLines={1} style={[styles.featuredCustomerName, { color: colors.textPrimary }]}>
        {item.customerName}
      </Text>

      <Text numberOfLines={2} style={[styles.featuredTaskTitle, { color: colors.textSecondary }]}>
        {item.title}
      </Text>

      {item.amount ? (
        <Text style={[styles.featuredMetaText, { color: colors.textPrimary, marginTop: 4 }]}>
          Value: {formatLakhs(item.amount)}
        </Text>
      ) : null}

      <View style={styles.featuredActionRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Complete follow-up"
          onPress={(e) => {
            e.stopPropagation();
            onComplete?.();
          }}
          style={({ pressed }) => [
            styles.primaryActionBtn,
            { backgroundColor: colors.brand, opacity: pressed ? 0.9 : 1 },
          ]}
        >
          <Check size={14} color={colors.white} />
          <Text style={styles.primaryActionBtnText}>Complete</Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Snooze follow-up"
          onPress={(e) => {
            e.stopPropagation();
            onSnooze?.();
          }}
          style={({ pressed }) => [
            styles.secondaryActionBtn,
            {
              backgroundColor: pressed ? colors.surfaceActive : colors.surfaceElevated,
              borderColor: colors.borderStrong,
            },
          ]}
        >
          <Clock size={13} color={colors.textPrimary} />
          <Text style={[styles.secondaryActionBtnText, { color: colors.textPrimary }]}>
            Snooze
          </Text>
        </Pressable>
      </View>
    </Pressable>
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
    zIndex: 10,
  },
  userProfileCol: {
    flex: 1,
  },
  greetingText: {
    fontSize: 12,
    fontFamily: typography.caption.fontFamily,
    fontWeight: '500',
    marginBottom: 2,
  },
  userNameText: {
    fontSize: 20,
    fontFamily: typography.heading2.fontFamily,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerIconButton: {
    width: 38,
    height: 38,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  unreadBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
  },
  scrollContent: {
    paddingHorizontal: spacing[4],
    paddingTop: spacing[4],
  },
  quickActionsBar: {
    flexDirection: 'row',
    gap: spacing[3],
    marginBottom: spacing[5],
  },
  quickActionBtn: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[2],
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  quickIconWrap: {
    width: 34,
    height: 34,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  quickActionText: {
    fontSize: 12,
    fontFamily: typography.body.fontFamily,
    fontWeight: '600',
    letterSpacing: -0.1,
  },
  section: {
    marginBottom: spacing[5],
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing[3],
  },
  sectionTitleCol: {
    flex: 1,
    marginRight: spacing[2],
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: typography.sectionTitle.fontFamily,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  sectionSubtitle: {
    fontSize: 12,
    fontFamily: typography.caption.fontFamily,
    fontWeight: '500',
    marginTop: 2,
  },
  seeAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingVertical: 2,
  },
  seeAllText: {
    fontSize: 13,
    fontFamily: typography.caption.fontFamily,
    fontWeight: '600',
  },
  featuredCard: {
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing[3] + 2,
    marginBottom: spacing[3],
  },
  featuredTagRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing[2],
  },
  featuredTag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[2],
    paddingVertical: 2,
    borderRadius: radius.xs,
    gap: 4,
  },
  featuredTagText: {
    fontSize: 10,
    fontFamily: typography.caption.fontFamily,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  featuredDueText: {
    fontSize: 11,
    fontFamily: typography.caption.fontFamily,
    fontWeight: '500',
  },
  featuredCustomerName: {
    fontSize: 16,
    fontFamily: typography.cardTitle.fontFamily,
    fontWeight: '800',
    letterSpacing: -0.2,
    marginBottom: 4,
  },
  featuredAmountRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing[2],
    marginBottom: 4,
  },
  featuredAmount: {
    fontSize: 20,
    fontFamily: typography.display.fontFamily,
    fontWeight: '800',
  },
  featuredAmountSub: {
    fontSize: 12,
    fontFamily: typography.caption.fontFamily,
  },
  featuredTaskTitle: {
    fontSize: 13,
    fontFamily: typography.body.fontFamily,
    lineHeight: 18,
    marginBottom: 4,
  },
  featuredMetaText: {
    fontSize: 11.5,
    fontFamily: typography.caption.fontFamily,
    marginTop: 2,
  },
  featuredActionRow: {
    flexDirection: 'row',
    gap: spacing[2],
    marginTop: spacing[3],
    paddingTop: spacing[2],
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  primaryActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing[2] + 2,
    paddingHorizontal: spacing[3],
    borderRadius: radius.md,
    gap: 5,
  },
  primaryActionBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontFamily: typography.body.fontFamily,
    fontWeight: '700',
  },
  secondaryActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing[2] + 2,
    paddingHorizontal: spacing[3],
    borderRadius: radius.md,
    borderWidth: 1,
    gap: 5,
  },
  secondaryActionBtnText: {
    fontSize: 13,
    fontFamily: typography.body.fontFamily,
    fontWeight: '600',
  },
  emptySectionCard: {
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing[4],
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptySectionText: {
    fontSize: 13,
    fontFamily: typography.body.fontFamily,
    textAlign: 'center',
    lineHeight: 18,
  },
});
