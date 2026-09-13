import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../design-system/theme';
import { spacing, radius, typography } from '../../design-system/tokens';
import { GSCard, GSAmountDisplay, GSBadge, GSAvatar } from '../ui';
import type { SalesOrder } from '../../domain/types';
import { formatShortDate, formatLakhs } from '../../domain/formatters';

export interface OrderCardProps {
  order: SalesOrder;
  onPress?: () => void;
}

export function OrderCard({ order, onPress }: OrderCardProps) {
  const { colors } = useTheme();

  const statusVariant =
    order.status === 'DeliveredToCustomer' || order.status === 'CustomerReceiptConfirmed'
      ? 'success'
      : order.status === 'Dispatched' || order.status === 'DeliveredFromWarehouse'
      ? 'brand'
      : order.status === 'Acknowledged' || order.status === 'Created'
      ? 'info'
      : order.status === 'Cancelled'
      ? 'danger'
      : 'warning';

  return (
    <GSCard
      onPress={onPress}
      variant="bordered"
      padding="sm"
      style={[
        styles.card,
        {
          backgroundColor: colors.surfaceElevated,
          borderColor: colors.border,
        },
      ]}
      accessibilityLabel={`Sales Order ${order.code} for ${order.customerName}, Status: ${order.status}`}
    >
      <View style={styles.cardContent}>
        {/* Left: Avatar with customer initials */}
        <GSAvatar name={order.customerName} size="md" style={styles.avatar} />

        {/* Center: Details */}
        <View style={styles.infoCol}>
          {/* Top: Customer Name */}
          <Text numberOfLines={1} style={[styles.customerName, { color: colors.textPrimary }]}>
            {order.customerName}
          </Text>

          {/* Subtitle: Code + Items count */}
          <Text style={[styles.codeSubtitle, { color: colors.textSecondary }]}>
            {order.code} • {order.items.length} {order.items.length === 1 ? 'item' : 'items'}
          </Text>

          {/* Expected Delivery or Transporter */}
          {order.expectedDelivery && (
            <Text style={[styles.deliveryText, { color: colors.textTertiary }]}>
              Exp Delivery: {formatShortDate(order.expectedDelivery)}
            </Text>
          )}
        </View>

        {/* Right: Status & Total */}
        <View style={styles.rightCol}>
          <GSBadge
            label={order.status}
            variant={statusVariant}
            size="sm"
            showDot
          />
          <View style={styles.amountWrapper}>
            <GSAmountDisplay
              amount={order.total}
              size="md"
              variant="default"
              showLakhs
            />
          </View>
        </View>
      </View>
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
    alignItems: 'center',
    paddingVertical: spacing[1],
  },
  avatar: {
    marginRight: spacing[3],
  },
  infoCol: {
    flex: 1,
    paddingRight: spacing[2],
    justifyContent: 'center',
  },
  customerName: {
    fontSize: 15,
    fontFamily: typography.cardTitle.fontFamily,
    fontWeight: '700',
    lineHeight: 20,
    letterSpacing: -0.2,
  },
  codeSubtitle: {
    fontSize: 12,
    fontFamily: typography.caption.fontFamily,
    fontWeight: '500',
    marginTop: 2,
  },
  deliveryText: {
    fontSize: 11,
    fontFamily: typography.caption.fontFamily,
    marginTop: 2,
  },
  rightCol: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  amountWrapper: {
    marginTop: 4,
  },
});
