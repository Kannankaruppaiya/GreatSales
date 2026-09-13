import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Search, Users, Sparkles, ShoppingBag, CreditCard, ChevronRight } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../src/design-system/theme';
import { spacing, radius, typography } from '../../src/design-system/tokens';
import { GSHeader, GSSearchBar, GSChip, GSEmptyState } from '../../src/components/ui';
import { CustomerCard, LeadCard, OrderCard, PaymentCard } from '../../src/components/domain';
import { useCustomers, useLeads, useOrders, usePayments } from '../../src/hooks';

export default function GlobalSearchScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [query, setQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'customers' | 'leads' | 'orders' | 'payments'>('all');

  const { data: customers } = useCustomers({ search: query });
  const { data: leads } = useLeads({ search: query });
  const { data: orders } = useOrders({ search: query });
  const { data: payments } = usePayments({ search: query });

  const totalResults =
    (customers?.length || 0) +
    (leads?.length || 0) +
    (orders?.length || 0) +
    (payments?.length || 0);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <GSHeader title="Global Search" showBack />

      <View style={[styles.searchBox, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <GSSearchBar
          value={query}
          onChangeText={setQuery}
          placeholder="Search customers, deals, SO#, invoices..."
          autoFocus
        />

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipScroll}
        >
          <GSChip
            label="All"
            count={query.length > 0 ? totalResults : undefined}
            selected={filterType === 'all'}
            onPress={() => setFilterType('all')}
          />
          <View style={{ width: spacing[2] }} />
          <GSChip
            label="Customers"
            count={query.length > 0 ? (customers?.length || 0) : undefined}
            selected={filterType === 'customers'}
            onPress={() => setFilterType('customers')}
          />
          <View style={{ width: spacing[2] }} />
          <GSChip
            label="Leads"
            count={query.length > 0 ? (leads?.length || 0) : undefined}
            selected={filterType === 'leads'}
            onPress={() => setFilterType('leads')}
          />
          <View style={{ width: spacing[2] }} />
          <GSChip
            label="Orders"
            count={query.length > 0 ? (orders?.length || 0) : undefined}
            selected={filterType === 'orders'}
            onPress={() => setFilterType('orders')}
          />
          <View style={{ width: spacing[2] }} />
          <GSChip
            label="Payments"
            count={query.length > 0 ? (payments?.length || 0) : undefined}
            selected={filterType === 'payments'}
            onPress={() => setFilterType('payments')}
          />
        </ScrollView>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + spacing[6] },
        ]}
      >
        {query.trim().length === 0 ? (
          <View style={styles.recentSearchesBox}>
            <Text style={[styles.recentSearchTitle, { color: colors.textSecondary }]}>
              Recent Searches
            </Text>

            <View
              style={[
                styles.recentListCard,
                {
                  backgroundColor: colors.surfaceElevated,
                  borderColor: colors.borderSubtle,
                },
              ]}
            >
              {[
                { title: 'ABC Industrial Components', type: 'Customer', route: '/(app)/customers/cust_01', iconType: 'customer' },
                { title: 'Kovai Engineering Systems', type: 'Customer', route: '/(app)/customers/cust_02', iconType: 'customer' },
                { title: 'INV-2026-0518', type: 'Invoice', route: '/(app)/payments/pay_01', iconType: 'invoice' },
                { title: 'Kongu Hydraulics', type: 'Customer', route: '/(app)/customers/cust_03', iconType: 'customer' },
                { title: 'SO-2026-0091', type: 'Sales Order', route: '/(app)/orders/so_01', iconType: 'order' },
              ].map((item, idx) => (
                <Pressable
                  key={item.title}
                  accessibilityRole="button"
                  accessibilityLabel={`Open ${item.title}`}
                  onPress={() => router.push(item.route as any)}
                  style={({ pressed }) => [
                    styles.recentItemRow,
                    idx > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.borderSubtle },
                    pressed && { backgroundColor: colors.surfaceInteractive },
                  ]}
                >
                  <View
                    style={[
                      styles.recentIconWrap,
                      {
                        backgroundColor:
                          item.iconType === 'customer'
                            ? colors.brandSoft
                            : item.iconType === 'invoice'
                            ? colors.infoSoft
                            : colors.warningSoft,
                      },
                    ]}
                  >
                    {item.iconType === 'customer' ? (
                      <Users size={16} color={colors.brand} />
                    ) : item.iconType === 'invoice' ? (
                      <CreditCard size={16} color={colors.info} />
                    ) : (
                      <ShoppingBag size={16} color={colors.warning} />
                    )}
                  </View>
                  <View style={styles.recentTextCol}>
                    <Text numberOfLines={1} style={[styles.recentItemTitle, { color: colors.textPrimary }]}>
                      {item.title}
                    </Text>
                    <Text style={[styles.recentItemType, { color: colors.textTertiary }]}>
                      {item.type}
                    </Text>
                  </View>
                  <ChevronRight size={16} color={colors.textTertiary} />
                </Pressable>
              ))}
            </View>
          </View>
        ) : totalResults === 0 ? (
          <GSEmptyState
            title="No Results Found"
            description={`No records found matching "${query}". Try another keyword.`}
          />
        ) : (
          <>
            {/* Customers Section */}
            {(filterType === 'all' || filterType === 'customers') &&
              customers &&
              customers.length > 0 && (
                <View style={styles.section}>
                  <Text style={[styles.sectionHeading, { color: colors.textSecondary }]}>
                    CUSTOMERS ({customers.length})
                  </Text>
                  {customers.map((c) => (
                    <CustomerCard
                      key={c.id}
                      customer={c}
                      onPress={() => router.push(`/(app)/customers/${c.id}` as any)}
                    />
                  ))}
                </View>
              )}

            {/* Leads Section */}
            {(filterType === 'all' || filterType === 'leads') &&
              leads &&
              leads.length > 0 && (
                <View style={styles.section}>
                  <Text style={[styles.sectionHeading, { color: colors.textSecondary }]}>
                    OPPORTUNITIES / LEADS ({leads.length})
                  </Text>
                  {leads.map((l) => (
                    <LeadCard
                      key={l.id}
                      lead={l}
                      onPress={() => router.push(`/(app)/leads/${l.id}` as any)}
                    />
                  ))}
                </View>
              )}

            {/* Orders Section */}
            {(filterType === 'all' || filterType === 'orders') &&
              orders &&
              orders.length > 0 && (
                <View style={styles.section}>
                  <Text style={[styles.sectionHeading, { color: colors.textSecondary }]}>
                    SALES ORDERS ({orders.length})
                  </Text>
                  {orders.map((o) => (
                    <OrderCard
                      key={o.id}
                      order={o}
                      onPress={() => router.push(`/(app)/orders/${o.id}` as any)}
                    />
                  ))}
                </View>
              )}

            {/* Payments Section */}
            {(filterType === 'all' || filterType === 'payments') &&
              payments &&
              payments.length > 0 && (
                <View style={styles.section}>
                  <Text style={[styles.sectionHeading, { color: colors.textSecondary }]}>
                    RECEIVABLES / INVOICES ({payments.length})
                  </Text>
                  {payments.map((p) => (
                    <PaymentCard
                      key={p.id}
                      payment={p}
                      onPress={() => router.push(`/(app)/payments/${p.id}` as any)}
                    />
                  ))}
                </View>
              )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  searchBox: {
    paddingHorizontal: spacing[4],
    paddingTop: spacing[3],
    paddingBottom: spacing[2],
    borderBottomWidth: 1,
  },
  chipScroll: {
    paddingVertical: spacing[2],
  },
  content: {
    padding: spacing[4],
  },
  section: {
    marginBottom: spacing[4],
  },
  sectionHeading: {
    fontSize: typography.micro.fontSize,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: spacing[2],
    marginLeft: 2,
  },
  quickSearchesBox: {
    marginTop: spacing[4],
    paddingHorizontal: spacing[2],
  },
  quickSearchTitle: {
    fontSize: 10,
    fontFamily: typography.micro.fontFamily,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: spacing[2],
  },
  quickSearchPills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
  },
  quickPill: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2] - 2,
    borderRadius: radius.full,
    borderWidth: 1,
  },
  quickPillText: {
    fontSize: typography.bodySmall.fontSize,
    fontFamily: typography.bodySmall.fontFamily,
    fontWeight: '500',
  },
  recentSearchesBox: {
    marginTop: spacing[1],
  },
  recentSearchTitle: {
    fontSize: 14,
    fontFamily: typography.cardTitle.fontFamily,
    fontWeight: '700',
    marginBottom: spacing[2],
  },
  recentListCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  recentItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[3],
  },
  recentIconWrap: {
    width: 32,
    height: 32,
    borderRadius: radius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing[3],
  },
  recentTextCol: {
    flex: 1,
  },
  recentItemTitle: {
    fontSize: 14,
    fontFamily: typography.cardTitle.fontFamily,
    fontWeight: '600',
  },
  recentItemType: {
    fontSize: 11,
    fontFamily: typography.caption.fontFamily,
    marginTop: 2,
  },
});
