import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../design-system/theme';
import { spacing, radius, typography } from '../../design-system/tokens';
import { GSCard, GSBadge, GSAmountDisplay, GSButton, GSAvatar } from '../ui';
import type { Payment } from '../../domain/types';
import { formatShortDate, formatLakhs } from '../../domain/formatters';

export interface PaymentCardProps {
  payment: Payment;
  onPress?: () => void;
  onRecordPayment?: () => void;
  onFollowUp?: () => void;
}

export function PaymentCard({ payment, onPress, onRecordPayment, onFollowUp }: PaymentCardProps) {
  const { colors } = useTheme();

  const isRedZone = payment.paymentZone === 'Red' || payment.payZone === 'RedZone' || payment.agingDays > 60;
  const isYellowZone = payment.paymentZone === 'Yellow' || payment.payZone === 'YellowZone' || (payment.agingDays > 30 && payment.agingDays <= 60);

  const statusLabel =
    payment.agingDays > 0
      ? `${payment.agingDays} days overdue`
      : payment.dueDate
      ? `Due ${formatShortDate(payment.dueDate)}`
      : 'Current';

  const statusVariant = isRedZone ? 'danger' : isYellowZone ? 'warning' : 'success';

  return (
    <GSCard
      onPress={onPress}
      variant="bordered"
      padding="sm"
      style={[
        styles.card,
        {
          backgroundColor: colors.surfaceElevated,
          borderColor: isRedZone ? colors.dangerBorder : colors.border,
        },
        isRedZone && { borderLeftWidth: 3, borderLeftColor: colors.danger },
      ]}
      accessibilityLabel={`Invoice ${payment.invoiceCode ?? payment.invoiceNo} for ${payment.customerName}, Outstanding: ${formatLakhs(payment.amount)}`}
    >
      <View style={styles.cardContent}>
        {/* Left: Avatar with initials */}
        <GSAvatar name={payment.customerName} size="md" style={styles.avatar} />

        {/* Center: Details */}
        <View style={styles.infoCol}>
          {/* Line 1: Customer Name */}
          <Text numberOfLines={1} style={[styles.customerName, { color: colors.textPrimary }]}>
            {payment.customerName}
          </Text>

          {/* Line 2: Invoice Code */}
          <Text style={[styles.invoiceCode, { color: colors.textTertiary }]}>
            {payment.invoiceCode ?? payment.invoiceNo}
          </Text>

          {/* Line 3: Amount + Aging Status */}
          <View style={styles.amountStatusRow}>
            <GSAmountDisplay
              amount={payment.amount}
              size="md"
              variant={isRedZone ? 'danger' : 'default'}
              showLakhs
            />

            <View style={styles.badgeWrapper}>
              <GSBadge
                label={statusLabel}
                variant={statusVariant}
                size="sm"
                showDot
              />
            </View>
          </View>
        </View>
      </View>

      {/* Contextual Actions if provided (e.g. in Priority Today) */}
      {(onRecordPayment || onFollowUp) && (
        <View style={[styles.actionRow, { borderTopColor: colors.borderSubtle }]}>
          {onRecordPayment && (
            <GSButton
              title="Record Payment"
              variant="primary"
              size="sm"
              onPress={onRecordPayment}
              style={{ flex: 1, marginRight: onFollowUp ? spacing[2] : 0 }}
            />
          )}
          {onFollowUp && (
            <GSButton
              title="Follow Up"
              variant="outline"
              size="sm"
              onPress={onFollowUp}
              style={{ flex: 1 }}
            />
          )}
        </View>
      )}
    </GSCard>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: spacing[2] + 2,
    borderWidth: 1,
    borderRadius: radius.lg,
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: spacing[1],
  },
  avatar: {
    marginRight: spacing[3],
    marginTop: 2,
  },
  infoCol: {
    flex: 1,
  },
  customerName: {
    fontSize: 15,
    fontFamily: typography.cardTitle.fontFamily,
    fontWeight: '700',
    lineHeight: 20,
    letterSpacing: -0.2,
    marginBottom: 2,
  },
  invoiceCode: {
    fontSize: 12,
    fontFamily: typography.caption.fontFamily,
    fontWeight: '500',
    marginBottom: 6,
  },
  amountStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing[2],
  },
  badgeWrapper: {
    marginLeft: 2,
  },
  actionRow: {
    flexDirection: 'row',
    marginTop: spacing[2],
    paddingTop: spacing[2],
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
