import React from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import {
  Target,
  ShoppingBag,
  UserPlus,
  Receipt,
  CalendarPlus,
  ChevronRight,
} from 'lucide-react-native';
import { useTheme } from '../../design-system/theme';
import { spacing, radius, typography } from '../../design-system/tokens';
import { GSBottomSheet } from '../ui/GSBottomSheet';
import { usePermissions } from '../../hooks';
import { hapticFeedback } from '../../utils/haptics';

export interface GlobalCreateSheetProps {
  visible: boolean;
  onClose: () => void;
  onOpenFollowUp?: () => void;
  onOpenPayment?: () => void;
}

export function GlobalCreateSheet({
  visible,
  onClose,
  onOpenFollowUp,
  onOpenPayment,
}: GlobalCreateSheetProps) {
  const { colors } = useTheme();
  const router = useRouter();
  const { can } = usePermissions();

  const handleAction = (item: {
    id: string;
    route?: string;
    action?: () => void;
  }) => {
    hapticFeedback('medium');
    onClose();
    if (item.action) {
      item.action();
    } else if (item.route) {
      router.push(item.route as any);
    }
  };

  const allActionItems = [
    {
      id: 'lead',
      title: 'New Opportunity / Lead',
      subtitle: 'Create deal with customer, stage & probability',
      icon: <Target size={20} color={colors.brand} strokeWidth={2.4} />,
      iconBg: colors.brandSoft,
      route: '/(app)/new-lead',
      permission: 'lead.write' as const,
    },
    {
      id: 'order',
      title: 'New Sales Order',
      subtitle: '5-step order wizard with pricing & 18% GST',
      icon: <ShoppingBag size={20} color={colors.info} strokeWidth={2.4} />,
      iconBg: colors.infoSoft,
      route: '/(app)/new-order',
      permission: 'order.write' as const,
    },
    {
      id: 'customer',
      title: 'Add New Customer',
      subtitle: 'Register company, contacts, credit limit & zone',
      icon: <UserPlus size={20} color={colors.warning} strokeWidth={2.4} />,
      iconBg: colors.warningSoft,
      route: '/(app)/customers/new',
      permission: 'customer.write' as const,
    },
    {
      id: 'followup',
      title: 'New Follow-up Task',
      subtitle: 'Schedule field visit, call, demo or payment check',
      icon: <CalendarPlus size={20} color={colors.brand} strokeWidth={2.4} />,
      iconBg: colors.brandSoft,
      action: onOpenFollowUp,
      route: onOpenFollowUp ? undefined : '/(app)/followups',
      permission: 'lead.write' as const,
    },
    {
      id: 'payment',
      title: 'Record Received Payment',
      subtitle: 'Collect payment against outstanding invoices',
      icon: <Receipt size={20} color={colors.success} strokeWidth={2.4} />,
      iconBg: colors.successSoft,
      action: onOpenPayment,
      route: onOpenPayment ? undefined : '/(app)/payments?action=record',
      permission: 'payment.write' as const,
    },
  ];

  const actionItems = allActionItems.filter(
    (item) => !item.permission || can(item.permission)
  );

  return (
    <GSBottomSheet
      visible={visible}
      onClose={onClose}
      title="Create New"
      subtitle="Select a sales workflow to initiate"
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContainer}
      >
        {actionItems.map((item) => (
          <Pressable
            key={item.id}
            accessibilityRole="button"
            accessibilityLabel={item.title}
            onPress={() => handleAction(item)}
            style={({ pressed }) => [
              styles.actionCard,
              {
                backgroundColor: colors.surfaceElevated,
                borderColor: colors.borderSubtle,
                transform: [{ scale: pressed ? 0.98 : 1 }],
              },
            ]}
          >
            <View style={[styles.iconWrap, { backgroundColor: item.iconBg }]}>
              {item.icon}
            </View>

            <View style={styles.textCol}>
              <Text
                style={[
                  styles.itemTitle,
                  { color: colors.textPrimary },
                ]}
              >
                {item.title}
              </Text>
              <Text
                numberOfLines={1}
                style={[
                  styles.itemSubtitle,
                  { color: colors.textTertiary },
                ]}
              >
                {item.subtitle}
              </Text>
            </View>

            <ChevronRight size={18} color={colors.textTertiary} />
          </Pressable>
        ))}
      </ScrollView>
    </GSBottomSheet>
  );
}

const styles = StyleSheet.create({
  listContainer: {
    paddingBottom: spacing[4],
  },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing[3],
    borderRadius: radius.md,
    borderWidth: 1,
    marginBottom: spacing[2],
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing[3],
  },
  textCol: {
    flex: 1,
    marginRight: spacing[2],
  },
  itemTitle: {
    fontSize: typography.body.fontSize,
    fontFamily: typography.body.fontFamily,
    fontWeight: '700',
    marginBottom: 2,
  },
  itemSubtitle: {
    fontSize: typography.caption.fontSize,
    fontFamily: typography.caption.fontFamily,
  },
});
