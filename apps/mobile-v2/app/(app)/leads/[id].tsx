import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  Phone,
  MessageSquare,
  Sparkles,
  Calendar,
  User,
  ShoppingBag,
  Plus,
  ArrowUpRight,
  Flame,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/design-system/theme';
import { spacing, radius, typography } from '@/design-system/tokens';
import {
  GSHeader,
  GSAmountDisplay,
  GSStatusIndicator,
  GSSkeleton,
  GSErrorState,
  GSButton,
  GSIconButton,
} from '@/components/ui';
import { ActivityTimeline } from '@/components/domain';
import { ChangeLeadStageSheet, AddRemarkSheet } from '@/components/modals';
import { useLead, useCustomer, useEntityActivity } from '@/hooks';
import { formatShortDate, formatPercentage } from '@/domain/formatters';
import { makePhoneCall, openWhatsApp } from '@/utils/communication';

export default function LeadDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const { data: lead, isLoading, isError, refetch } = useLead(id || '');
  const { data: customer } = useCustomer(lead?.customerId || '');
  const { data: activities } = useEntityActivity('lead', id || '');

  const [stageSheetVisible, setStageSheetVisible] = useState(false);
  const [remarkSheetVisible, setRemarkSheetVisible] = useState(false);

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <GSHeader title="Opportunity Detail" showBack />
        <View style={{ padding: spacing[4] }}>
          <GSSkeleton height={160} borderRadius={radius.lg} style={{ marginBottom: spacing[3] }} />
          <GSSkeleton height={100} borderRadius={radius.md} style={{ marginBottom: spacing[3] }} />
          <GSSkeleton height={200} borderRadius={radius.md} />
        </View>
      </View>
    );
  }

  if (isError || !lead) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <GSHeader title="Opportunity Detail" showBack />
        <GSErrorState title="Deal not found" onRetry={refetch} />
      </View>
    );
  }

  const primaryContact =
    customer?.contacts?.[0] ||
    lead.contacts?.[0] ||
    (lead.phone ? { name: lead.contactName || 'Primary Contact', phone: lead.phone } : null);

  const isOralConfirmation = lead.stage === 'NegotiationOralConfirmation';

  const handleCall = () => {
    if (primaryContact?.phone) makePhoneCall(primaryContact.phone);
  };

  const handleWhatsApp = () => {
    if (primaryContact?.phone) openWhatsApp(primaryContact.phone, `Re: Opportunity for ${lead.productName || lead.title}`);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <GSHeader
        title="Opportunity Detail"
        subtitle={lead.title}
        showBack
        rightActions={
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <GSButton
              title="Stage"
              variant="outline"
              size="sm"
              onPress={() => setStageSheetVisible(true)}
              style={{ marginRight: spacing[1] }}
            />
            <GSButton
              title="Remark"
              variant="ghost"
              size="sm"
              onPress={() => setRemarkSheetVisible(true)}
            />
          </View>
        }
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + spacing[8] },
        ]}
      >
        {/* Main Hero Card */}
        <View
          style={[
            styles.heroCard,
            {
              backgroundColor: colors.surfaceElevated,
              borderColor: isOralConfirmation ? colors.brandBorder : colors.border,
            },
          ]}
        >
          {isOralConfirmation && (
            <View style={[styles.oralBanner, { backgroundColor: colors.amberSoft, borderColor: colors.amberBorder, borderWidth: 1 }]}>
              <Flame size={14} color={colors.amberDark} />
              <Text style={[styles.oralBannerText, { color: colors.amberDark }]}>HOT OPPORTUNITY • ORAL CONFIRMATION</Text>
            </View>
          )}

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Open customer ${lead.customerName}`}
            onPress={() => router.push(`/(app)/customers/${lead.customerId}` as any)}
            style={styles.customerLinkRow}
          >
            <Text style={[styles.customerName, { color: colors.brand }]}>
              {lead.customerName}
            </Text>
            <ArrowUpRight size={18} color={colors.brand} />
          </Pressable>

          <Text style={[styles.dealTitle, { color: colors.textPrimary }]}>
            {lead.title}
          </Text>

          {/* Value & Stage Strip */}
          <View
            style={[
              styles.valStrip,
              {
                backgroundColor: colors.surface,
                borderColor: colors.borderSubtle,
              },
            ]}
          >
            <View>
              <Text style={[styles.microLabel, { color: colors.textTertiary }]}>DEAL VALUE</Text>
              <GSAmountDisplay amount={lead.value ?? lead.totalValue ?? 0} size="hero" variant="brand" showLakhs />
            </View>

            <View style={{ alignItems: 'flex-end' }}>
              <Text style={[styles.microLabel, { color: colors.textTertiary }]}>STAGE</Text>
              <GSStatusIndicator status={lead.stage} type="lead" />
            </View>
          </View>

          {/* Probability and Expected Close */}
          <View style={styles.metaGrid}>
            <View style={styles.metaCol}>
              <Text style={[styles.microLabel, { color: colors.textTertiary }]}>PROBABILITY</Text>
              <Text style={[styles.metaVal, { color: colors.textPrimary }]}>
                {formatPercentage(lead.probability)}
              </Text>
            </View>
            <View style={styles.metaCol}>
              <Text style={[styles.microLabel, { color: colors.textTertiary }]}>EXPECTED CLOSE</Text>
              <Text style={[styles.metaVal, { color: colors.textPrimary }]}>
                {formatShortDate(lead.expectedClose)}
              </Text>
            </View>
          </View>

          {/* Move Stage CTA */}
          <GSButton
            title="Update Deal Stage"
            variant="outline"
            size="md"
            onPress={() => setStageSheetVisible(true)}
            style={{ marginTop: spacing[3] }}
          />
        </View>

        {/* Quick Contact Bar */}
        {primaryContact?.phone ? (
          <View style={[styles.contactBar, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
            <View style={styles.contactInfoCol}>
              <Text style={[styles.contactLabel, { color: colors.textSecondary }]}>
                Key Contact: {primaryContact.name}
              </Text>
              <Text style={[styles.contactPhone, { color: colors.textPrimary }]}>
                {primaryContact.phone}
              </Text>
            </View>
            <View style={styles.contactActions}>
              <GSIconButton
                icon={<MessageSquare size={16} color={colors.brand} />}
                variant="subtle"
                size="sm"
                accessibilityLabel="WhatsApp"
                onPress={handleWhatsApp}
              />
              <View style={{ width: spacing[2] }} />
              <GSIconButton
                icon={<Phone size={16} color={colors.white} />}
                variant="brand"
                size="sm"
                accessibilityLabel="Call"
                onPress={handleCall}
              />
            </View>
          </View>
        ) : null}

        {/* Product Details Section */}
        <View style={[styles.sectionCard, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
            Product & Assignment
          </Text>

          <View style={[styles.rowItem, { borderBottomColor: colors.borderSubtle }]}>
            <Text style={[styles.itemLabel, { color: colors.textSecondary }]}>Principal / Brand</Text>
            <Text style={[styles.itemVal, { color: colors.textPrimary }]}>{lead.principalName || '—'}</Text>
          </View>

          <View style={[styles.rowItem, { borderBottomColor: colors.borderSubtle }]}>
            <Text style={[styles.itemLabel, { color: colors.textSecondary }]}>Product</Text>
            <Text style={[styles.itemVal, { color: colors.textPrimary }]}>{lead.productName || '—'}</Text>
          </View>

          <View style={[styles.rowItem, { borderBottomColor: colors.borderSubtle }]}>
            <Text style={[styles.itemLabel, { color: colors.textSecondary }]}>Salesperson</Text>
            <Text style={[styles.itemVal, { color: colors.textPrimary }]}>{lead.salespersonName || 'Assigned'}</Text>
          </View>

          {lead.nextFollowUpDate && (
            <View style={[styles.rowItem, { borderBottomWidth: 0 }]}>
              <Text style={[styles.itemLabel, { color: colors.textSecondary }]}>Next Follow-up</Text>
              <Text style={[styles.itemVal, { color: colors.brand, fontWeight: '700' }]}>
                {formatShortDate(lead.nextFollowUpDate)}
              </Text>
            </View>
          )}
        </View>

        {/* Convert to Sales Order CTA */}
        <GSButton
          title="Create Sales Order From Deal"
          variant="primary"
          size="lg"
          leftIcon={<ShoppingBag size={18} color={colors.white} />}
          onPress={() => router.push('/(app)/new-order')}
          style={{ marginBottom: spacing[5] }}
        />

        {/* Activity Timeline */}
        <View style={styles.timelineSection}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary, marginBottom: spacing[3] }]}>
            Activity History
          </Text>
          <ActivityTimeline activities={activities || []} />
        </View>
      </ScrollView>

      {/* Stage Sheet */}
      <ChangeLeadStageSheet
        visible={stageSheetVisible}
        onClose={() => setStageSheetVisible(false)}
        leadId={lead.id}
        currentStage={lead.stage}
        customerName={lead.customerName}
      />

      {/* Remark Sheet */}
      <AddRemarkSheet
        visible={remarkSheetVisible}
        onClose={() => setRemarkSheetVisible(false)}
        entityType="lead"
        entityId={lead.id}
        customerId={lead.customerId}
        entityTitle={lead.title || lead.customerName}
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
  heroCard: {
    borderRadius: radius.xl,
    borderWidth: 1.5,
    padding: spacing[5],
    marginBottom: spacing[4],
  },
  oralBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[3],
    paddingVertical: 4,
    borderRadius: radius.full,
    alignSelf: 'flex-start',
    marginBottom: spacing[3],
  },
  oralBannerText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginLeft: 4,
  },
  customerLinkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  customerName: {
    fontSize: typography.body.fontSize,
    fontWeight: '700',
    marginRight: 4,
  },
  dealTitle: {
    fontSize: typography.heading2.fontSize,
    fontWeight: '800',
    marginBottom: spacing[4],
  },
  valStrip: {
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
  metaGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[1],
  },
  metaCol: {
    flex: 1,
  },
  metaVal: {
    fontSize: typography.cardTitle.fontSize,
    fontWeight: '700',
  },
  contactBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing[3],
    borderRadius: radius.md,
    borderWidth: 1,
    marginBottom: spacing[4],
  },
  contactInfoCol: {
    flex: 1,
  },
  contactLabel: {
    fontSize: typography.caption.fontSize,
  },
  contactPhone: {
    fontSize: typography.bodySmall.fontSize,
    fontWeight: '700',
    marginTop: 2,
  },
  contactActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing[4],
    marginBottom: spacing[4],
  },
  sectionTitle: {
    fontSize: typography.cardTitle.fontSize,
    fontWeight: '800',
    marginBottom: spacing[3],
  },
  rowItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing[2],
    borderBottomWidth: 1,
  },
  itemLabel: {
    fontSize: typography.bodySmall.fontSize,
  },
  itemVal: {
    fontSize: typography.bodySmall.fontSize,
    fontWeight: '600',
  },
  timelineSection: {
    marginTop: spacing[2],
  },
});
