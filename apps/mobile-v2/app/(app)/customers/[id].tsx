import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  Phone,
  MessageSquare,
  Mail,
  ChevronRight,
  MapPin,
  Building2,
  CreditCard,
  Tag,
  ShoppingBag,
  Clock,
  Plus,
  Edit2,
  FileText,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/design-system/theme';
import { spacing, radius, typography } from '@/design-system/tokens';
import {
  GSHeader,
  GSBadge,
  GSAmountDisplay,
  GSTabs,
  GSSkeleton,
  GSErrorState,
  GSButton,
  GSIconButton,
  GSEmptyState,
  GSAvatar,
} from '@/components/ui';
import {
  LeadCard,
  OrderCard,
  PaymentCard,
  FollowUpCard,
  MappingCard,
  ActivityTimeline,
} from '@/components/domain';
import { AddRemarkSheet } from '@/components/modals';
import {
  useCustomer,
  useCustomerActivity,
  useMappings,
  useOrders,
  usePayments,
  useFollowUps,
  useLeads,
} from '@/hooks';
import { formatCurrencyINR, formatLakhs } from '@/domain/formatters';
import { makePhoneCall, openWhatsApp } from '@/utils/communication';

export default function Customer360Screen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<'overview' | 'leads' | 'contacts' | 'mappings' | 'orders' | 'payments' | 'followups' | 'activity'>('overview');
  const [remarkSheetVisible, setRemarkSheetVisible] = useState(false);

  const { data: customer, isLoading, isError, refetch } = useCustomer(id || '');
  const { data: activities } = useCustomerActivity(id || '');
  const { data: mappings } = useMappings({ customerId: id });
  const { data: allOrders } = useOrders();
  const { data: allPayments } = usePayments();
  const { data: allFollowUps } = useFollowUps();
  const { data: allLeads } = useLeads();

  const customerOrders = (allOrders || []).filter((o) => o.customerId === id);
  const customerPayments = (allPayments || []).filter((p) => p.customerId === id);
  const customerFollowUps = (allFollowUps || []).filter((f) => f.customerId === id);
  const customerLeads = (allLeads || []).filter((l) => l.customerId === id);

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <GSHeader title="Customer 360" showBack />
        <View style={{ padding: spacing[4] }}>
          <GSSkeleton height={180} borderRadius={radius.xl} style={{ marginBottom: spacing[3] }} />
          <GSSkeleton height={48} borderRadius={radius.md} style={{ marginBottom: spacing[3] }} />
          <GSSkeleton height={200} borderRadius={radius.lg} />
        </View>
      </View>
    );
  }

  if (isError || !customer) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <GSHeader title="Customer 360" showBack />
        <GSErrorState title="Customer not found" onRetry={refetch} />
      </View>
    );
  }

  const primaryContact =
    customer.contacts.find((c) => c.isPrimary) || customer.contacts[0];

  const payZoneVariant =
    (customer.paymentZone === 'Green' || (customer.payZone as string) === 'GreenZone')
      ? 'success'
      : (customer.paymentZone === 'Yellow' || (customer.payZone as string) === 'YellowZone')
      ? 'warning'
      : 'danger';

  const handleCall = (phone?: string | null) => {
    const target = phone || primaryContact?.phone;
    if (target) makePhoneCall(target);
  };

  const handleWhatsApp = (phone?: string | null) => {
    const target = phone || primaryContact?.phone;
    if (target) openWhatsApp(target, `Hello from GreatSales re: ${customer.name}`);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <GSHeader
        title="Customer 360"
        subtitle={customer.name}
        showBack
        rightActions={
          <GSButton
            title="Remark"
            variant="ghost"
            size="sm"
            onPress={() => setRemarkSheetVisible(true)}
          />
        }
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + spacing[8] },
        ]}
      >
        {/* 1. Deep Forest Hero Banner matching Screen 6 */}
        <View
          style={[
            styles.forestHeroCard,
            {
              backgroundColor: colors.brandHero,
              borderColor: colors.brandHeroBorder,
              borderWidth: 1,
            },
          ]}
        >
          <View style={styles.heroTopRow}>
            <GSAvatar name={customer.name} size="lg" style={styles.heroAvatar} variant="identity" />
            <View style={styles.heroTitleCol}>
              <View style={styles.heroNameRow}>
                <Text numberOfLines={1} style={styles.heroCustomerName}>
                  {customer.name}
                </Text>
                <ChevronRight size={18} color="rgba(255,255,255,0.7)" />
              </View>
              <Text numberOfLines={1} style={styles.heroSubtitle}>
                Customer since {customer.createdAt ? new Date(customer.createdAt).getFullYear() : '2024'} • {customer.city} • {customer.industry || 'Industrial'}
              </Text>
            </View>
          </View>

          {/* Contact Action Buttons inside Hero */}
          <View style={styles.heroActionsRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Call primary contact"
              onPress={() => handleCall()}
              style={({ pressed }) => [
                styles.heroActionBtn,
                { opacity: pressed ? 0.8 : 1 },
              ]}
            >
              <View style={styles.heroIconCircle}>
                <Phone size={15} color={colors.white} />
              </View>
              <Text style={styles.heroActionLabel}>Call</Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="WhatsApp primary contact"
              onPress={() => handleWhatsApp()}
              style={({ pressed }) => [
                styles.heroActionBtn,
                { opacity: pressed ? 0.8 : 1 },
              ]}
            >
              <View style={styles.heroIconCircle}>
                <MessageSquare size={15} color={colors.white} />
              </View>
              <Text style={styles.heroActionLabel}>WhatsApp</Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Email contact"
              onPress={() => {
                if (primaryContact?.email) {
                  // handle email
                }
              }}
              style={({ pressed }) => [
                styles.heroActionBtn,
                { opacity: pressed ? 0.8 : 1 },
              ]}
            >
              <View style={styles.heroIconCircle}>
                <Mail size={15} color={colors.white} />
              </View>
              <Text style={styles.heroActionLabel}>Email</Text>
            </Pressable>
          </View>
        </View>

        {/* 2. 6-Box Metrics Grid matching Screen 6 */}
        <View
          style={[
            styles.metricsGridCard,
            {
              backgroundColor: colors.surfaceElevated,
              borderColor: colors.border,
            },
          ]}
        >
          <View style={styles.metricsRow}>
            <View style={styles.metricCell}>
              <Text style={[styles.metricLabel, { color: colors.textTertiary }]}>OUTSTANDING</Text>
              <Text style={[styles.metricValue, { color: customer.outstanding > 0 ? colors.danger : colors.textPrimary }]}>
                {formatLakhs(customer.outstanding)}
              </Text>
            </View>
            <View style={[styles.metricDividerV, { backgroundColor: colors.borderSubtle }]} />
            <View style={styles.metricCell}>
              <Text style={[styles.metricLabel, { color: colors.textTertiary }]}>LEADS</Text>
              <Text style={[styles.metricValue, { color: colors.textPrimary }]}>
                {customerLeads.length}
              </Text>
            </View>
            <View style={[styles.metricDividerV, { backgroundColor: colors.borderSubtle }]} />
            <View style={styles.metricCell}>
              <Text style={[styles.metricLabel, { color: colors.textTertiary }]}>ORDERS</Text>
              <Text style={[styles.metricValue, { color: colors.textPrimary }]}>
                {customerOrders.length}
              </Text>
            </View>
          </View>

          <View style={[styles.metricDividerH, { backgroundColor: colors.borderSubtle }]} />

          <View style={styles.metricsRow}>
            <View style={styles.metricCell}>
              <Text style={[styles.metricLabel, { color: colors.textTertiary }]}>PROJECTION</Text>
              <Text style={[styles.metricValue, { color: colors.brand }]}>
                {formatLakhs(customer.creditLimit || 1874000)}
              </Text>
            </View>
            <View style={[styles.metricDividerV, { backgroundColor: colors.borderSubtle }]} />
            <View style={styles.metricCell}>
              <Text style={[styles.metricLabel, { color: colors.textTertiary }]}>FOLLOW-UPS</Text>
              <Text style={[styles.metricValue, { color: colors.textPrimary }]}>
                {customerFollowUps.length}
              </Text>
            </View>
            <View style={[styles.metricDividerV, { backgroundColor: colors.borderSubtle }]} />
            <View style={styles.metricCell}>
              <Text style={[styles.metricLabel, { color: colors.textTertiary }]}>TIER</Text>
              <Text style={[styles.metricValue, { color: colors.brandGold }]}>
                {customer.tier || 'Gold Tier'}
              </Text>
            </View>
          </View>
        </View>

        {/* 360 Navigation Tabs */}
        <View style={styles.tabsWrapper}>
          <GSTabs
            scrollable
            activeTab={activeTab}
            onChangeTab={(k) => setActiveTab(k as any)}
            tabs={[
              { key: 'overview', label: 'Overview' },
              { key: 'leads', label: 'Leads', count: customerLeads.length },
              { key: 'contacts', label: 'Contacts', count: customer.contacts.length },
              { key: 'mappings', label: 'Pricing', count: mappings?.length },
              { key: 'orders', label: 'Orders', count: customerOrders.length },
              { key: 'payments', label: 'Receivables', count: customerPayments.length },
              { key: 'followups', label: 'Follow-ups', count: customerFollowUps.length },
              { key: 'activity', label: 'Timeline', count: activities?.length },
            ]}
          />
        </View>

        {/* SECTION: LEADS */}
        {activeTab === 'leads' && (
          <View style={styles.tabContent}>
            {customerLeads.length === 0 ? (
              <GSEmptyState
                title="No Opportunities Yet"
                description="No deals or leads are linked to this customer yet."
                actionLabel="Create Opportunity"
                onAction={() => router.push('/(app)/new-lead')}
              />
            ) : (
              customerLeads.map((l) => (
                <LeadCard
                  key={l.id}
                  lead={l}
                  onPress={() => router.push(`/(app)/leads/${l.id}` as any)}
                />
              ))
            )}
          </View>
        )}

        {/* SECTION: OVERVIEW */}
        {activeTab === 'overview' && (
          <View style={styles.tabContent}>
            <View style={[styles.infoCard, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
              <Text style={[styles.infoHeading, { color: colors.textPrimary }]}>
                Account Information
              </Text>

              <View style={[styles.detailRow, { borderBottomColor: colors.borderSubtle }]}>
                <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Industry</Text>
                <Text style={[styles.detailVal, { color: colors.textPrimary }]}>{customer.industry || 'Manufacturing'}</Text>
              </View>

              <View style={[styles.detailRow, { borderBottomColor: colors.borderSubtle }]}>
                <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Account Tier</Text>
                <Text style={[styles.detailVal, { color: colors.textPrimary }]}>{customer.tier || 'Standard'}</Text>
              </View>

              <View style={[styles.detailRow, { borderBottomColor: colors.borderSubtle }]}>
                <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Payment Terms</Text>
                <Text style={[styles.detailVal, { color: colors.textPrimary }]}>{customer.paymentTermsDays} Days Net</Text>
              </View>

              <View style={[styles.detailRow, { borderBottomColor: colors.borderSubtle }]}>
                <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Payment Zone</Text>
                <Text style={[styles.detailVal, { color: colors.textPrimary }]}>{customer.paymentZone} Zone</Text>
              </View>

              <View style={[styles.detailRow, { borderBottomColor: colors.borderSubtle }]}>
                <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Address</Text>
                <Text style={[styles.detailVal, { color: colors.textPrimary, flex: 1, textAlign: 'right' }]}>
                  {customer.address}, {customer.city}
                </Text>
              </View>

              <View style={[styles.detailRow, { borderBottomWidth: 0 }]}>
                <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Sales Representative</Text>
                <Text style={[styles.detailVal, { color: colors.brand, fontWeight: '700' }]}>
                  {customer.salespersonName || 'Assigned'}
                </Text>
              </View>
            </View>

            {/* Quick CTAs */}
            <View style={styles.ctaRow}>
              <GSButton
                title="New Opportunity"
                variant="outline"
                size="md"
                onPress={() => router.push('/(app)/new-lead')}
                style={{ flex: 1, marginRight: spacing[2] }}
              />
              <GSButton
                title="New Sales Order"
                variant="primary"
                size="md"
                onPress={() => router.push('/(app)/new-order')}
                style={{ flex: 1, marginLeft: spacing[2] }}
              />
            </View>
          </View>
        )}

        {/* SECTION: CONTACTS */}
        {activeTab === 'contacts' && (
          <View style={styles.tabContent}>
            {customer.contacts.map((contact) => (
              <View
                key={contact.id}
                style={[
                  styles.contactCard,
                  { backgroundColor: colors.surfaceElevated, borderColor: colors.border },
                ]}
              >
                <View style={styles.contactCardHeader}>
                  <View>
                    <Text style={[styles.contactCardName, { color: colors.textPrimary }]}>
                      {contact.name}
                    </Text>
                    <Text style={[styles.contactCardRole, { color: colors.textSecondary }]}>
                      {contact.designation || 'Key Decision Maker'}
                    </Text>
                  </View>

                  {contact.isPrimary && (
                    <GSBadge label="Primary" variant="brand" size="sm" />
                  )}
                </View>

                <View style={styles.contactDetails}>
                  <Text style={[styles.contactPhoneText, { color: colors.textPrimary }]}>
                    {contact.phone}
                  </Text>
                  {contact.email && (
                    <Text style={[styles.contactEmailText, { color: colors.textSecondary }]}>
                      {contact.email}
                    </Text>
                  )}
                </View>

                <View style={styles.contactCardActions}>
                  <GSIconButton
                    icon={<MessageSquare size={16} color={colors.brand} />}
                    variant="subtle"
                    size="sm"
                    accessibilityLabel="WhatsApp"
                    onPress={() => handleWhatsApp(contact.phone)}
                  />
                  <View style={{ width: spacing[2] }} />
                  <GSIconButton
                    icon={<Phone size={16} color={colors.white} />}
                    variant="brand"
                    size="sm"
                    accessibilityLabel="Call"
                    onPress={() => handleCall(contact.phone)}
                  />
                </View>
              </View>
            ))}
          </View>
        )}

        {/* SECTION: PRICING MAPPINGS */}
        {activeTab === 'mappings' && (
          <View style={styles.tabContent}>
            {!mappings || mappings.length === 0 ? (
              <GSEmptyState
                title="No Pricing Mappings"
                description="No custom product pricing agreements are registered for this account."
              />
            ) : (
              mappings.map((m) => <MappingCard key={m.id} mapping={m} />)
            )}
          </View>
        )}

        {/* SECTION: ORDERS */}
        {activeTab === 'orders' && (
          <View style={styles.tabContent}>
            {customerOrders.length === 0 ? (
              <GSEmptyState
                title="No Orders Yet"
                description="No sales orders have been raised for this customer."
                actionLabel="Create Sales Order"
                onAction={() => router.push('/(app)/new-order')}
              />
            ) : (
              customerOrders.map((o) => (
                <OrderCard
                  key={o.id}
                  order={o}
                  onPress={() => router.push(`/(app)/orders/${o.id}` as any)}
                />
              ))
            )}
          </View>
        )}

        {/* SECTION: PAYMENTS */}
        {activeTab === 'payments' && (
          <View style={styles.tabContent}>
            {customerPayments.length === 0 ? (
              <GSEmptyState
                title="No Pending Invoices"
                description="This customer has clear receivables and zero overdue balances."
              />
            ) : (
              customerPayments.map((p) => (
                <PaymentCard
                  key={p.id}
                  payment={p}
                  onPress={() => router.push(`/(app)/payments/${p.id}` as any)}
                />
              ))
            )}
          </View>
        )}

        {/* SECTION: FOLLOW-UPS */}
        {activeTab === 'followups' && (
          <View style={styles.tabContent}>
            {customerFollowUps.length === 0 ? (
              <GSEmptyState
                title="No Active Follow-ups"
                description="All follow-ups with this customer are up to date."
              />
            ) : (
              customerFollowUps.map((f) => (
                <FollowUpCard
                  key={f.id}
                  followUp={f}
                  onPress={() => router.push(`/(app)/followups/${f.id}` as any)}
                />
              ))
            )}
          </View>
        )}

        {/* SECTION: ACTIVITY TIMELINE */}
        {activeTab === 'activity' && (
          <View style={styles.tabContent}>
            <ActivityTimeline activities={activities || []} />
          </View>
        )}
      </ScrollView>

      {/* Add Remark Modal */}
      <AddRemarkSheet
        visible={remarkSheetVisible}
        onClose={() => setRemarkSheetVisible(false)}
        entityType="customer"
        entityId={customer.id}
        customerId={customer.id}
        entityTitle={customer.name}
      />
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
  forestHeroCard: {
    borderRadius: radius.xl,
    padding: spacing[4],
    marginBottom: spacing[3],
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing[4],
  },
  heroAvatar: {
    marginRight: spacing[3],
  },
  heroTitleCol: {
    flex: 1,
  },
  heroNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  heroCustomerName: {
    fontSize: 18,
    fontFamily: typography.heading2.fontFamily,
    fontWeight: '800',
    color: '#FFFFFF',
    flex: 1,
    marginRight: spacing[1],
  },
  heroSubtitle: {
    fontSize: 12,
    fontFamily: typography.caption.fontFamily,
    color: 'rgba(255,255,255,0.7)',
  },
  heroActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  heroActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
    paddingVertical: spacing[1] + 2,
    paddingHorizontal: spacing[3],
    borderRadius: radius.full,
    gap: 6,
  },
  heroIconCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroActionLabel: {
    color: '#FFFFFF',
    fontSize: 12,
    fontFamily: typography.caption.fontFamily,
    fontWeight: '600',
  },
  metricsGridCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    paddingVertical: spacing[3],
    marginBottom: spacing[4],
  },
  metricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metricCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing[1],
  },
  metricLabel: {
    fontSize: 9,
    fontFamily: typography.micro.fontFamily,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  metricValue: {
    fontSize: 15,
    fontFamily: typography.cardTitle.fontFamily,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  metricDividerV: {
    width: 1,
    height: '65%',
  },
  metricDividerH: {
    height: 1,
    marginVertical: spacing[2],
  },
  heroCard: {
    borderRadius: radius.xl,
    borderWidth: 1,
    padding: spacing[4],
    marginBottom: spacing[4],
  },
  topHeroRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing[3],
  },
  customerName: {
    fontSize: typography.heading2.fontSize,
    fontWeight: '800',
    marginBottom: 4,
  },
  locRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  locText: {
    fontSize: typography.caption.fontSize,
    marginLeft: 4,
  },
  financialStrip: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing[3],
    borderRadius: radius.md,
    borderWidth: 1,
    marginBottom: spacing[3],
  },
  microLabel: {
    fontSize: typography.micro.fontSize,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  creditLimitText: {
    fontSize: typography.body.fontSize,
    fontWeight: '700',
  },
  quickActionsRow: {
    flexDirection: 'row',
  },
  tabsWrapper: {
    marginBottom: spacing[4],
  },
  tabContent: {
    paddingBottom: spacing[4],
  },
  infoCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing[4],
    marginBottom: spacing[4],
  },
  infoHeading: {
    fontSize: typography.cardTitle.fontSize,
    fontWeight: '800',
    marginBottom: spacing[3],
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing[3],
    borderBottomWidth: 1,
  },
  detailLabel: {
    fontSize: typography.bodySmall.fontSize,
  },
  detailVal: {
    fontSize: typography.bodySmall.fontSize,
    fontWeight: '600',
  },
  ctaRow: {
    flexDirection: 'row',
    marginTop: spacing[2],
  },
  contactCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing[4],
    marginBottom: spacing[3],
  },
  contactCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing[2],
  },
  contactCardName: {
    fontSize: typography.cardTitle.fontSize,
    fontWeight: '700',
  },
  contactCardRole: {
    fontSize: typography.caption.fontSize,
    marginTop: 2,
  },
  contactDetails: {
    marginBottom: spacing[3],
  },
  contactPhoneText: {
    fontSize: typography.body.fontSize,
    fontWeight: '600',
  },
  contactEmailText: {
    fontSize: typography.caption.fontSize,
    marginTop: 2,
  },
  contactCardActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
});
