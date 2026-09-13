import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  Phone,
  MessageSquare,
  Mail,
  Calendar,
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  DollarSign,
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
import { RecordPaymentSheet, PaymentReminderSheet } from '@/components/modals';
import { usePayment, useCustomer } from '@/hooks';
import { formatCurrencyINR, formatShortDate } from '@/domain/formatters';
import { makePhoneCall, openWhatsApp } from '@/utils/communication';

export default function PaymentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const { data: payment, isLoading, isError, refetch } = usePayment(id || '');
  const { data: customer } = useCustomer(payment?.customerId || '');

  const [recordSheetVisible, setRecordSheetVisible] = useState(false);
  const [reminderSheetVisible, setReminderSheetVisible] = useState(false);

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <GSHeader title="Payment Detail" showBack />
        <View style={{ padding: spacing[4] }}>
          <GSSkeleton height={160} borderRadius={radius.xl} style={{ marginBottom: spacing[3] }} />
          <GSSkeleton height={120} borderRadius={radius.md} />
        </View>
      </View>
    );
  }

  if (isError || !payment) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <GSHeader title="Payment Detail" showBack />
        <GSErrorState title="Invoice not found" onRetry={refetch} />
      </View>
    );
  }

  const primaryContact = customer?.contacts?.[0];
  const isCritical = payment.paymentZone === 'Red' || payment.agingDays > 60;
  const isOverdue = payment.status === 'Overdue';

  const handleCall = () => {
    if (primaryContact?.phone) makePhoneCall(primaryContact.phone);
  };

  const handleWhatsApp = () => {
    if (primaryContact?.phone) openWhatsApp(primaryContact.phone, `Re: Invoice ${payment.invoiceCode ?? payment.invoiceNo} for ${formatCurrencyINR(payment.amount)}`);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <GSHeader
        title={payment.invoiceCode ?? payment.invoiceNo ?? 'Invoice'}
        subtitle={payment.customerName}
        showBack
        rightActions={
          <GSButton
            title="Record"
            variant="primary"
            size="sm"
            onPress={() => setRecordSheetVisible(true)}
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
        {/* Outstanding Balance Hero */}
        <View
          style={[
            styles.heroCard,
            {
              backgroundColor: colors.surfaceElevated,
              borderColor: isCritical ? colors.danger : colors.border,
            },
          ]}
        >
          <View style={styles.topRow}>
            <View style={{ flex: 1 }}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Open customer ${payment.customerName}`}
                onPress={() => router.push(`/(app)/customers/${payment.customerId}` as any)}
                style={styles.customerLink}
              >
                <Text style={[styles.customerName, { color: colors.brand }]}>
                  {payment.customerName}
                </Text>
                <ArrowUpRight size={16} color={colors.brand} />
              </Pressable>
              <Text style={[styles.codeText, { color: colors.textSecondary }]}>
                Invoice {payment.invoiceCode ?? payment.invoiceNo}
              </Text>
            </View>

            <GSStatusIndicator status={payment.paymentZone ?? (payment.payZone === 'RedZone' ? 'Red' : payment.payZone === 'YellowZone' ? 'Yellow' : 'Green')} type="payZone" />
          </View>

          {/* Amount Box */}
          <View
            style={[
              styles.amountBox,
              { backgroundColor: colors.surfaceInteractive, borderColor: colors.borderSubtle },
            ]}
          >
            <View>
              <Text style={[styles.microLabel, { color: colors.textTertiary }]}>OUTSTANDING AMOUNT</Text>
              <GSAmountDisplay
                amount={payment.amount}
                size="hero"
                variant={isCritical ? 'danger' : 'default'}
              />
            </View>

            <View style={{ alignItems: 'flex-end' }}>
              <Text style={[styles.microLabel, { color: colors.textTertiary }]}>AGING STATUS</Text>
              <Text
                style={[
                  styles.agingText,
                  { color: isCritical ? colors.danger : colors.textPrimary },
                ]}
              >
                {payment.agingDays} Days Overdue
              </Text>
            </View>
          </View>

          {/* Record Receipt CTA */}
          <GSButton
            title="Record Payment Receipt"
            variant="primary"
            size="lg"
            leftIcon={<DollarSign size={18} color={colors.white} />}
            onPress={() => setRecordSheetVisible(true)}
            style={{ marginTop: spacing[3] }}
          />
        </View>

        {/* Quick Contact & Reminders */}
        {primaryContact?.phone ? (
          <View style={[styles.card, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
              Accounts Contact
            </Text>

            <View style={styles.contactRow}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.contactName, { color: colors.textPrimary }]}>
                  {primaryContact.name} ({primaryContact.designation || 'Accounts'})
                </Text>
                <Text style={[styles.contactPhone, { color: colors.textSecondary }]}>
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
          </View>
        ) : null}

        {/* 4-Stage Reminder Notices */}
        <View style={[styles.card, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
          <View style={styles.sectionHeaderRow}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
              Reminder Notices
            </Text>
            <GSButton
              title="Send Notice"
              variant="outline"
              size="sm"
              leftIcon={<Mail size={14} color={colors.brand} />}
              onPress={() => setReminderSheetVisible(true)}
            />
          </View>

          <View style={styles.noticesGrid}>
            <View style={[styles.noticePill, { backgroundColor: payment.mail1 ? colors.brandSoft : colors.surfaceInteractive }]}>
              <Text style={[styles.noticeText, { color: payment.mail1 ? colors.brand : colors.textTertiary }]}>
                Stage 1 {payment.mail1 ? '✓' : '○'}
              </Text>
            </View>
            <View style={[styles.noticePill, { backgroundColor: payment.mail2 ? colors.brandSoft : colors.surfaceInteractive }]}>
              <Text style={[styles.noticeText, { color: payment.mail2 ? colors.brand : colors.textTertiary }]}>
                Stage 2 {payment.mail2 ? '✓' : '○'}
              </Text>
            </View>
            <View style={[styles.noticePill, { backgroundColor: payment.mail3 ? colors.warningSoft : colors.surfaceInteractive }]}>
              <Text style={[styles.noticeText, { color: payment.mail3 ? colors.warning : colors.textTertiary }]}>
                Stage 3 {payment.mail3 ? '✓' : '○'}
              </Text>
            </View>
            <View style={[styles.noticePill, { backgroundColor: payment.mail4 ? colors.dangerSoft : colors.surfaceInteractive }]}>
              <Text style={[styles.noticeText, { color: payment.mail4 ? colors.danger : colors.textTertiary }]}>
                Stage 4 {payment.mail4 ? '✓' : '○'}
              </Text>
            </View>
          </View>
        </View>

        {/* Invoice Metadata */}
        <View style={[styles.card, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
            Invoice Details
          </Text>

          <View style={[styles.metaRow, { borderBottomColor: colors.borderSubtle }]}>
            <Text style={[styles.metaLabel, { color: colors.textSecondary }]}>Due Date</Text>
            <Text style={[styles.metaVal, { color: colors.textPrimary }]}>{formatShortDate(payment.dueDate)}</Text>
          </View>

          <View style={[styles.metaRow, { borderBottomColor: colors.borderSubtle }]}>
            <Text style={[styles.metaLabel, { color: colors.textSecondary }]}>Credit Window</Text>
            <Text style={[styles.metaVal, { color: colors.textPrimary }]}>{customer?.paymentTermsDays || 30} Days</Text>
          </View>

          <View style={[styles.metaRow, { borderBottomWidth: 0 }]}>
            <Text style={[styles.metaLabel, { color: colors.textSecondary }]}>Sales Representative</Text>
            <Text style={[styles.metaVal, { color: colors.brand, fontWeight: '700' }]}>{payment.salespersonName || 'Assigned'}</Text>
          </View>
        </View>
      </ScrollView>

      {/* Record Payment Sheet */}
      <RecordPaymentSheet
        visible={recordSheetVisible}
        onClose={() => setRecordSheetVisible(false)}
        paymentId={payment.id}
        invoiceCode={payment.invoiceCode ?? payment.invoiceNo ?? ''}
        customerName={payment.customerName}
        outstandingAmount={payment.amount}
      />

      {/* Reminder Notices Sheet */}
      <PaymentReminderSheet
        visible={reminderSheetVisible}
        onClose={() => setReminderSheetVisible(false)}
        payment={payment}
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
    padding: spacing[4],
    marginBottom: spacing[4],
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing[3],
  },
  customerLink: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  customerName: {
    fontSize: typography.body.fontSize,
    fontWeight: '700',
    marginRight: 4,
  },
  codeText: {
    fontSize: typography.cardTitle.fontSize,
    fontWeight: '800',
  },
  amountBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing[3],
    borderRadius: radius.md,
    borderWidth: 1,
  },
  microLabel: {
    fontSize: typography.micro.fontSize,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  agingText: {
    fontSize: typography.cardTitle.fontSize,
    fontWeight: '800',
  },
  card: {
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
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing[3],
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  contactName: {
    fontSize: typography.bodySmall.fontSize,
    fontWeight: '700',
  },
  contactPhone: {
    fontSize: typography.caption.fontSize,
    marginTop: 2,
  },
  contactActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  noticesGrid: {
    flexDirection: 'row',
    gap: spacing[2],
  },
  noticePill: {
    flex: 1,
    paddingVertical: spacing[2],
    alignItems: 'center',
    borderRadius: radius.sm,
  },
  noticeText: {
    fontSize: typography.micro.fontSize,
    fontWeight: '700',
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing[3],
    borderBottomWidth: 1,
  },
  metaLabel: {
    fontSize: typography.bodySmall.fontSize,
  },
  metaVal: {
    fontSize: typography.bodySmall.fontSize,
    fontWeight: '600',
  },
});
