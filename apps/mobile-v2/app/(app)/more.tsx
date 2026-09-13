import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import {
  UsersRound,
  Package,
  CreditCard,
  Tags,
  ChartNoAxesCombined,
  TrendingUp,
  Search,
  Bell,
  UserRound,
  Shield,
  Settings,
  LogOut,
  ChevronRight,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/design-system/theme';
import { spacing, radius, typography } from '@/design-system/tokens';
import { GSAvatar, GSDialog } from '@/components/ui';
import { useCurrentUser, useLogout, usePermissions, type Permission } from '@/hooks';
import { hapticFeedback } from '@/utils/haptics';

interface NavItem {
  id: string;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  route: string;
  permission?: Permission;
}

export default function MoreScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const { data: user } = useCurrentUser();
  const { can } = usePermissions();
  const logoutMutation = useLogout();
  const [logoutDialogVisible, setLogoutDialogVisible] = useState(false);

  const handleLogout = async () => {
    await logoutMutation.mutateAsync();
    setLogoutDialogVisible(false);
    router.replace('/(auth)/login');
  };

  const allBusinessModules: NavItem[] = [
    {
      id: 'customers',
      title: 'Customers Directory',
      subtitle: 'Customer 360, contacts and credit terms',
      icon: <UsersRound size={20} color={colors.textSecondary} strokeWidth={2} />,
      route: '/(app)/customers',
      permission: 'customer.read',
    },
    {
      id: 'orders',
      title: 'Sales Orders',
      subtitle: 'Order tracking and delivery fulfillment',
      icon: <Package size={20} color={colors.textSecondary} strokeWidth={2} />,
      route: '/(app)/orders',
      permission: 'order.read',
    },
    {
      id: 'payments',
      title: 'Payments & Receivables',
      subtitle: 'Outstanding balance, aging analysis and reminders',
      icon: <CreditCard size={20} color={colors.textSecondary} strokeWidth={2} />,
      route: '/(app)/payments',
      permission: 'payment.read',
    },
    {
      id: 'mappings',
      title: 'Customer Mapping',
      subtitle: 'Agreed product pricing and catalog margins',
      icon: <Tags size={20} color={colors.textSecondary} strokeWidth={2} />,
      route: '/(app)/mappings',
      permission: 'customer.read',
    },
    {
      id: 'reports',
      title: 'Sales Reports',
      subtitle: 'Performance benchmarks and aging breakdown',
      icon: <ChartNoAxesCombined size={20} color={colors.textSecondary} strokeWidth={2} />,
      route: '/(app)/reports',
      permission: 'report.view',
    },
    {
      id: 'projections',
      title: 'Projections & Commitments',
      subtitle: 'Monthly forecast, targets and brand fulfillment',
      icon: <TrendingUp size={20} color={colors.textSecondary} strokeWidth={2} />,
      route: '/(app)/projections',
      permission: 'report.view',
    },
  ];

  // Enforce role-based permission visibility
  const visibleBusinessModules = allBusinessModules.filter(
    (item) => !item.permission || can(item.permission)
  );

  const tools: NavItem[] = [
    {
      id: 'search',
      title: 'Global Search',
      subtitle: 'Search across all CRM entities and records',
      icon: <Search size={20} color={colors.textSecondary} strokeWidth={2} />,
      route: '/(app)/search',
    },
    {
      id: 'notifications',
      title: 'Notification Center',
      subtitle: 'Overdue alerts, stage updates and activity logs',
      icon: <Bell size={20} color={colors.textSecondary} strokeWidth={2} />,
      route: '/(app)/notifications',
    },
  ];

  const accountItems: NavItem[] = [
    {
      id: 'profile',
      title: 'My Profile',
      subtitle: 'Personal details and avatar management',
      icon: <UserRound size={20} color={colors.textSecondary} strokeWidth={2} />,
      route: '/(app)/profile',
    },
    {
      id: 'security',
      title: 'Security & Active Sessions',
      subtitle: 'PIN, biometric authentication and active devices',
      icon: <Shield size={20} color={colors.textSecondary} strokeWidth={2} />,
      route: '/(app)/security',
    },
    {
      id: 'settings',
      title: 'Settings',
      subtitle: 'Theme, offline sync and preferences',
      icon: <Settings size={20} color={colors.textSecondary} strokeWidth={2} />,
      route: '/(app)/settings',
    },
  ];

  const renderGroup = (title: string, items: NavItem[]) => (
    <View style={styles.groupWrapper}>
      <Text style={[styles.groupHeading, { color: colors.textMuted }]}>{title}</Text>
      <View
        style={[
          styles.cardGroup,
          {
            backgroundColor: colors.surfaceElevated,
            borderColor: colors.borderSubtle,
          },
        ]}
      >
        {items.map((item, idx) => (
          <Pressable
            key={item.id}
            accessibilityRole="button"
            accessibilityLabel={item.title}
            onPress={() => {
              hapticFeedback('light');
              router.push(item.route as any);
            }}
            style={({ pressed }) => [
              styles.itemRow,
              idx < items.length - 1 && {
                borderBottomColor: colors.borderSubtle,
                borderBottomWidth: StyleSheet.hairlineWidth,
              },
              pressed && { backgroundColor: colors.surfaceInteractive },
            ]}
          >
            <View
              style={[
                styles.iconContainer,
                {
                  backgroundColor: colors.surfaceMuted,
                  borderColor: colors.borderSubtle,
                },
              ]}
            >
              {item.icon}
            </View>
            <View style={styles.itemTextCol}>
              <Text
                numberOfLines={1}
                style={[styles.itemTitle, { color: colors.textPrimary }]}
              >
                {item.title}
              </Text>
              <Text
                numberOfLines={1}
                style={[styles.itemSubtitle, { color: colors.textSecondary }]}
              >
                {item.subtitle}
              </Text>
            </View>
            <ChevronRight size={16} color={colors.textMuted} strokeWidth={2} />
          </Pressable>
        ))}
      </View>
    </View>
  );

  const roleDisplay =
    user?.role === 'sales'
      ? 'Field Sales Executive'
      : user?.role === 'mgmt'
      ? 'Sales Management'
      : user?.role === 'admin'
      ? 'Tenant Administrator'
      : user?.role || 'Sales';

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Top Header */}
      <View
        style={[
          styles.headerRow,
          {
            paddingTop: insets.top + spacing[3],
            backgroundColor: colors.surface,
            borderBottomColor: colors.borderSubtle,
          },
        ]}
      >
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>More</Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + spacing[8] },
        ]}
      >
        {/* User Card */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open profile"
          onPress={() => {
            hapticFeedback('light');
            router.push('/(app)/profile');
          }}
          style={({ pressed }) => [
            styles.userCard,
            {
              backgroundColor: colors.surfaceElevated,
              borderColor: colors.borderSubtle,
            },
            pressed && { backgroundColor: colors.surfaceInteractive },
          ]}
        >
          <GSAvatar
            name={user?.name || 'Megala'}
            uri={user?.avatarUrl}
            size="lg"
            showBorder
          />
          <View style={styles.userInfoCol}>
            <Text numberOfLines={1} style={[styles.userName, { color: colors.textPrimary }]}>
              {user?.name || 'Megala'}
            </Text>
            <Text numberOfLines={1} style={[styles.userRole, { color: colors.textSecondary }]}>
              {roleDisplay} • {user?.region || 'Tamil Nadu'}
            </Text>
            {user?.email && (
              <Text numberOfLines={1} style={[styles.userEmail, { color: colors.textMuted }]}>
                {user.email}
              </Text>
            )}
          </View>
          <ChevronRight size={18} color={colors.textMuted} strokeWidth={2} />
        </Pressable>

        {/* Group 1: Business Modules (permission-filtered) */}
        {visibleBusinessModules.length > 0 &&
          renderGroup('BUSINESS MODULES', visibleBusinessModules)}

        {/* Group 2: Tools & Communication */}
        {renderGroup('TOOLS & COMMUNICATION', tools)}

        {/* Group 3: Account & Security */}
        {renderGroup('ACCOUNT & SECURITY', accountItems)}

        {/* Sign Out Button */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Sign out of account"
          onPress={() => {
            hapticFeedback('medium');
            setLogoutDialogVisible(true);
          }}
          style={({ pressed }) => [
            styles.logoutBtn,
            {
              backgroundColor: colors.dangerSoft,
              borderColor: colors.dangerBorder,
            },
            pressed && { opacity: 0.8 },
          ]}
        >
          <LogOut size={16} color={colors.danger} strokeWidth={2} />
          <Text style={[styles.logoutText, { color: colors.danger }]}>Sign Out</Text>
        </Pressable>

        {/* App Version / Build info */}
        <View style={styles.footerInfo}>
          <Text style={[styles.versionText, { color: colors.textMuted }]}>
            GreatSales Mobile • v2.4.0 (Enterprise)
          </Text>
          <Text style={[styles.tenantText, { color: colors.textMuted }]}>
            Tenant: tenant_promech • Secure Session
          </Text>
        </View>
      </ScrollView>

      {/* Logout Confirmation Dialog */}
      <GSDialog
        visible={logoutDialogVisible}
        title="Sign Out?"
        message="Are you sure you want to end your sales session on this device?"
        confirmText="Sign Out"
        destructive
        onConfirm={handleLogout}
        onCancel={() => setLogoutDialogVisible(false)}
        loading={logoutMutation.isPending}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerRow: {
    paddingHorizontal: spacing[4],
    paddingBottom: spacing[3],
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: {
    fontSize: typography.screenTitle.fontSize,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  scrollContent: {
    padding: spacing[4],
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing[4],
    borderRadius: radius.lg,
    borderWidth: 1,
    marginBottom: spacing[5],
  },
  userInfoCol: {
    flex: 1,
    marginLeft: spacing[3],
    marginRight: spacing[2],
  },
  userName: {
    fontSize: typography.cardTitle.fontSize,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  userRole: {
    fontSize: typography.caption.fontSize,
    marginTop: 2,
  },
  userEmail: {
    fontSize: typography.caption.fontSize,
    marginTop: 1,
  },
  groupWrapper: {
    marginBottom: spacing[4],
  },
  groupHeading: {
    fontSize: typography.label.fontSize,
    fontWeight: '700',
    letterSpacing: 0.6,
    marginBottom: spacing[2],
    marginLeft: spacing[1],
  },
  cardGroup: {
    borderRadius: radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[3] + 2,
    minHeight: 56,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing[3],
  },
  itemTextCol: {
    flex: 1,
    marginRight: spacing[2],
  },
  itemTitle: {
    fontSize: typography.body.fontSize,
    fontWeight: '600',
  },
  itemSubtitle: {
    fontSize: typography.caption.fontSize,
    marginTop: 2,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing[3] + 2,
    borderRadius: radius.md,
    borderWidth: 1,
    marginTop: spacing[2],
  },
  logoutText: {
    fontSize: typography.button.fontSize,
    fontWeight: '700',
    marginLeft: spacing[2],
  },
  footerInfo: {
    alignItems: 'center',
    marginTop: spacing[6],
    gap: 2,
  },
  versionText: {
    fontSize: typography.caption.fontSize,
  },
  tenantText: {
    fontSize: typography.caption.fontSize,
  },
});
