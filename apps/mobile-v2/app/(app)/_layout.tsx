import React, { useState } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { Tabs } from 'expo-router';
import { LayoutDashboard, GitFork, Plus, CalendarCheck, MoreHorizontal } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../src/design-system/theme';
import { spacing, radius, typography } from '../../src/design-system/tokens';
import { useFollowUps, useNetworkStatus } from '../../src/hooks';
import { OfflineBanner } from '../../src/components/ui';
import { GlobalCreateSheet, NewFollowUpSheet, RecordPaymentSheet } from '../../src/components/modals';
import { hapticFeedback } from '../../src/utils/haptics';

export default function AppLayout() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { isOnline, isChecking, checkConnectivity } = useNetworkStatus();

  const [isCreateSheetOpen, setIsCreateSheetOpen] = useState(false);
  const [isFollowUpSheetOpen, setIsFollowUpSheetOpen] = useState(false);
  const [isPaymentSheetOpen, setIsPaymentSheetOpen] = useState(false);

  const { data: overdueList } = useFollowUps({ filter: 'overdue' });
  const overdueCount = overdueList?.length || 0;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {!isOnline && (
        <View style={{ paddingTop: insets.top, backgroundColor: colors.dangerSoft }}>
          <OfflineBanner
            isOnline={isOnline}
            onRetry={checkConnectivity}
            isChecking={isChecking}
          />
        </View>
      )}
      <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          height: Platform.OS === 'ios' ? 84 : 64,
          paddingBottom: Platform.OS === 'ios' ? insets.bottom : spacing[2],
          paddingTop: spacing[2],
        },
        tabBarActiveTintColor: colors.brand,
        tabBarInactiveTintColor: colors.textTertiary,
        tabBarLabelStyle: {
          fontSize: typography.micro.fontSize,
          fontWeight: '600',
        },
      }}
    >
      {/* 1. Today Command Center */}
      <Tabs.Screen
        name="today"
        options={{
          title: 'Today',
          tabBarIcon: ({ color, size }) => (
            <LayoutDashboard size={22} color={color} strokeWidth={2.2} />
          ),
        }}
      />

      {/* 2. Pipeline */}
      <Tabs.Screen
        name="pipeline"
        options={{
          title: 'Pipeline',
          tabBarIcon: ({ color, size }) => (
            <GitFork size={22} color={color} strokeWidth={2.2} />
          ),
        }}
      />

      {/* 3. Central Global Creation Action (+) */}
      <Tabs.Screen
        name="new-sale"
        options={{
          tabBarLabel: () => null,
          tabBarAccessibilityLabel: 'Create new item',
          tabBarIcon: () => (
            <View
              style={[
                styles.centralButton,
                {
                  backgroundColor: colors.brand,
                  shadowColor: colors.brand,
                },
              ]}
            >
              <Plus size={24} color="#FFFFFF" strokeWidth={2.8} />
            </View>
          ),
        }}
        listeners={{
          tabPress: (e) => {
            e.preventDefault();
            hapticFeedback('medium');
            setIsCreateSheetOpen(true);
          },
        }}
      />

      {/* 4. Follow-ups */}
      <Tabs.Screen
        name="followups"
        options={{
          title: 'Follow-ups',
          tabBarBadge: overdueCount > 0 ? overdueCount : undefined,
          tabBarBadgeStyle: {
            backgroundColor: colors.danger,
            fontSize: 10,
            fontWeight: '800',
          },
          tabBarIcon: ({ color, size }) => (
            <CalendarCheck size={22} color={color} strokeWidth={2.2} />
          ),
        }}
      />

      {/* 5. More Hub */}
      <Tabs.Screen
        name="more"
        options={{
          title: 'More',
          tabBarIcon: ({ color, size }) => (
            <MoreHorizontal size={22} color={color} strokeWidth={2.2} />
          ),
        }}
      />

      {/* Hidden secondary / detail routes */}
      <Tabs.Screen name="notifications" options={{ href: null, tabBarStyle: { display: 'none' } }} />
      <Tabs.Screen name="search" options={{ href: null, tabBarStyle: { display: 'none' } }} />
      <Tabs.Screen name="new-lead" options={{ href: null, tabBarStyle: { display: 'none' } }} />
      <Tabs.Screen name="new-order" options={{ href: null, tabBarStyle: { display: 'none' } }} />
      <Tabs.Screen name="profile" options={{ href: null, tabBarStyle: { display: 'none' } }} />
      <Tabs.Screen name="edit-profile" options={{ href: null, tabBarStyle: { display: 'none' } }} />
      <Tabs.Screen name="security" options={{ href: null, tabBarStyle: { display: 'none' } }} />
      <Tabs.Screen name="settings" options={{ href: null, tabBarStyle: { display: 'none' } }} />
      <Tabs.Screen name="leads/[id]" options={{ href: null, tabBarStyle: { display: 'none' } }} />
      <Tabs.Screen name="projections/index" options={{ href: null, tabBarStyle: { display: 'none' } }} />
      <Tabs.Screen name="projections/[id]" options={{ href: null, tabBarStyle: { display: 'none' } }} />
      <Tabs.Screen name="customers/index" options={{ href: null, tabBarStyle: { display: 'none' } }} />
      <Tabs.Screen name="customers/[id]" options={{ href: null, tabBarStyle: { display: 'none' } }} />
      <Tabs.Screen name="customers/new" options={{ href: null, tabBarStyle: { display: 'none' } }} />
      <Tabs.Screen name="orders/index" options={{ href: null, tabBarStyle: { display: 'none' } }} />
      <Tabs.Screen name="orders/[id]" options={{ href: null, tabBarStyle: { display: 'none' } }} />
      <Tabs.Screen name="payments/index" options={{ href: null, tabBarStyle: { display: 'none' } }} />
      <Tabs.Screen name="payments/[id]" options={{ href: null, tabBarStyle: { display: 'none' } }} />
      <Tabs.Screen name="mappings/index" options={{ href: null, tabBarStyle: { display: 'none' } }} />
      <Tabs.Screen name="followups/[id]" options={{ href: null, tabBarStyle: { display: 'none' } }} />
      <Tabs.Screen name="followups/new" options={{ href: null, tabBarStyle: { display: 'none' } }} />
      <Tabs.Screen name="leads/new" options={{ href: null, tabBarStyle: { display: 'none' } }} />
      <Tabs.Screen name="orders/new" options={{ href: null, tabBarStyle: { display: 'none' } }} />
      <Tabs.Screen name="reports/index" options={{ href: null, tabBarStyle: { display: 'none' } }} />
    </Tabs>

      {/* Global Creation Action Sheet */}
      <GlobalCreateSheet
        visible={isCreateSheetOpen}
        onClose={() => setIsCreateSheetOpen(false)}
        onOpenFollowUp={() => setIsFollowUpSheetOpen(true)}
        onOpenPayment={() => setIsPaymentSheetOpen(true)}
      />

      {/* Global Follow-up Creator */}
      <NewFollowUpSheet
        visible={isFollowUpSheetOpen}
        onClose={() => setIsFollowUpSheetOpen(false)}
      />

      {/* Global Payment Recorder */}
      <RecordPaymentSheet
        visible={isPaymentSheetOpen}
        onClose={() => setIsPaymentSheetOpen(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  centralButton: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Platform.OS === 'ios' ? 6 : 14,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 6,
  },
});
