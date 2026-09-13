import React from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import {
  Sparkles,
  ShoppingBag,
  UserPlus,
  DollarSign,
  CalendarPlus,
  X,
  ChevronRight,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/design-system/theme';
import { spacing, radius, typography } from '@/design-system/tokens';
import { GSCard, GSIconButton } from '@/components/ui';
import { hapticFeedback } from '@/utils/haptics';

export default function NewSaleActionScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const handleNavigate = (path: string) => {
    hapticFeedback('medium');
    router.push(path as any);
  };

  const actionItems = [
    {
      id: 'lead',
      title: 'New Lead / Opportunity',
      subtitle: 'Create a deal with customer, product, stage & probability',
      icon: <Sparkles size={22} color={colors.brand} />,
      iconBg: colors.brandSoft,
      route: '/(app)/new-lead',
    },
    {
      id: 'order',
      title: 'New Sales Order',
      subtitle: 'Create line-item order with rates, GST and delivery specs',
      icon: <ShoppingBag size={22} color={colors.info} />,
      iconBg: colors.infoSoft,
      route: '/(app)/new-order',
    },
    {
      id: 'customer',
      title: 'Add New Customer',
      subtitle: 'Register company, contacts, credit terms and zone',
      icon: <UserPlus size={22} color={colors.warning} />,
      iconBg: colors.warningSoft,
      route: '/(app)/customers/new',
    },
    {
      id: 'payment',
      title: 'Record Received Payment',
      subtitle: 'Collect against outstanding receivables or invoices',
      icon: <DollarSign size={22} color={colors.success} />,
      iconBg: colors.successSoft,
      route: '/(app)/payments?action=record',
    },
  ];

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.background,
          paddingTop: insets.top + spacing[3],
        },
      ]}
    >
      {/* Header with dismiss */}
      <View style={styles.header}>
        <View>
          <Text style={[styles.title, { color: colors.textPrimary }]}>
            Create Action
          </Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Select a field workflow to begin
          </Text>
        </View>

        <GSIconButton
          icon={<X size={20} color={colors.textSecondary} />}
          variant="subtle"
          size="sm"
          accessibilityLabel="Close"
          onPress={() => router.back()}
        />
      </View>

      <ScrollView contentContainerStyle={styles.list}>
        {actionItems.map((item) => (
          <Pressable
            key={item.id}
            accessibilityRole="button"
            accessibilityLabel={item.title}
            onPress={() => handleNavigate(item.route)}
            style={({ pressed }) => [
              styles.actionCard,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
              pressed && {
                backgroundColor: colors.surfaceElevated,
                transform: [{ scale: 0.99 }],
              },
            ]}
          >
            <View style={[styles.iconBox, { backgroundColor: item.iconBg }]}>
              {item.icon}
            </View>

            <View style={styles.textCol}>
              <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>
                {item.title}
              </Text>
              <Text style={[styles.cardSubtitle, { color: colors.textSecondary }]}>
                {item.subtitle}
              </Text>
            </View>

            <ChevronRight size={18} color={colors.textTertiary} />
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: spacing[4],
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing[5],
  },
  title: {
    fontSize: typography.heading1.fontSize,
    fontWeight: '800',
  },
  subtitle: {
    fontSize: typography.caption.fontSize,
    marginTop: 2,
  },
  list: {
    gap: spacing[3],
  },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing[4],
    borderRadius: radius.lg,
    borderWidth: 1.2,
  },
  iconBox: {
    width: 46,
    height: 46,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing[3],
  },
  textCol: {
    flex: 1,
    marginRight: spacing[2],
  },
  cardTitle: {
    fontSize: typography.cardTitle.fontSize,
    fontWeight: '700',
    marginBottom: 2,
  },
  cardSubtitle: {
    fontSize: typography.caption.fontSize,
    lineHeight: typography.caption.lineHeight,
  },
});
