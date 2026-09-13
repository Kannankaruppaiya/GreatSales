import React from 'react';
import { View, Text, ScrollView, RefreshControl, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { CheckCheck } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../src/design-system/theme';
import { spacing, radius, typography } from '../../src/design-system/tokens';
import { GSHeader, GSEmptyState, GSSkeleton, GSButton, GSChip } from '../../src/components/ui';
import { NotificationCard } from '../../src/components/domain';
import { useNotifications, useMarkNotificationRead, useMarkAllNotificationsRead } from '../../src/hooks';

export default function NotificationsScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const { data: notifications, isLoading, refetch } = useNotifications();
  const markReadMutation = useMarkNotificationRead();
  const markAllMutation = useMarkAllNotificationsRead();

  const unreadCount = notifications?.filter((n) => !n.read).length || 0;

  const [filterTab, setFilterTab] = React.useState<'all' | 'unread' | 'mentions'>('all');

  const filteredNotifications = React.useMemo(() => {
    if (!notifications) return [];
    if (filterTab === 'unread') return notifications.filter((n) => !n.read);
    if (filterTab === 'mentions') return notifications.filter((n) => n.type === 'stage_change' || n.type === 'order_update');
    return notifications;
  }, [notifications, filterTab]);

  const handleNotificationPress = async (n: any) => {
    if (!n.read) {
      await markReadMutation.mutateAsync(n.id);
    }

    // Deep link based on entityType
    if (n.entityType === 'lead' && n.entityId) {
      router.push(`/(app)/leads/${n.entityId}` as any);
    } else if (n.entityType === 'order' && n.entityId) {
      router.push(`/(app)/orders/${n.entityId}` as any);
    } else if (n.entityType === 'payment' && n.entityId) {
      router.push(`/(app)/payments/${n.entityId}` as any);
    } else if (n.entityType === 'followup' && n.entityId) {
      router.push(`/(app)/followups/${n.entityId}` as any);
    } else if (n.entityType === 'customer' && n.entityId) {
      router.push(`/(app)/customers/${n.entityId}` as any);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <GSHeader
        title="Notifications"
        subtitle="Stay informed"
        showBack
        rightActions={
          unreadCount > 0 ? (
            <GSButton
              title="Mark all read"
              variant="ghost"
              size="sm"
              leftIcon={<CheckCheck size={16} color={colors.brand} />}
              onPress={() => markAllMutation.mutate()}
            />
          ) : undefined
        }
      />

      {/* Filter Chips matching Screen 12 */}
      <View style={[styles.filterBar, { backgroundColor: colors.surface, borderBottomColor: colors.borderSubtle }]}>
        <View style={styles.chipRow}>
          <GSChip
            label="All"
            count={notifications?.length}
            selected={filterTab === 'all'}
            onPress={() => setFilterTab('all')}
          />
          <View style={{ width: spacing[2] }} />
          <GSChip
            label="Unread"
            count={unreadCount}
            selected={filterTab === 'unread'}
            onPress={() => setFilterTab('unread')}
          />
          <View style={{ width: spacing[2] }} />
          <GSChip
            label="Mentions"
            selected={filterTab === 'mentions'}
            onPress={() => setFilterTab('mentions')}
          />
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + spacing[6] },
        ]}
      >
        {isLoading ? (
          <>
            <GSSkeleton height={80} borderRadius={radius.md} style={{ marginBottom: spacing[2] }} />
            <GSSkeleton height={80} borderRadius={radius.md} style={{ marginBottom: spacing[2] }} />
            <GSSkeleton height={80} borderRadius={radius.md} />
          </>
        ) : !filteredNotifications || filteredNotifications.length === 0 ? (
          <GSEmptyState
            title="All Caught Up"
            description="You don't have any notifications for this filter."
          />
        ) : (
          filteredNotifications.map((n) => (
            <NotificationCard
              key={n.id}
              notification={n}
              onPress={() => handleNotificationPress(n)}
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
  content: {
    padding: spacing[4],
  },
  filterBar: {
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    borderBottomWidth: 1,
  },
  chipRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
