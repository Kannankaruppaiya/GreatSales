import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Phone, MessageSquare, MapPin, UserCheck } from 'lucide-react-native';
import { useTheme } from '../../design-system/theme';
import { spacing, radius, typography } from '../../design-system/tokens';
import { GSCard, GSBadge, GSAmountDisplay, GSIconButton, GSAvatar } from '../ui';
import type { Customer } from '../../domain/types';
import { formatLakhs } from '../../domain/formatters';
import { makePhoneCall, openWhatsApp } from '../../utils/communication';
import { hapticFeedback } from '../../utils/haptics';

export interface CustomerCardProps {
  customer: Customer;
  onPress?: () => void;
  showActions?: boolean;
}

export function CustomerCard({ customer, onPress, showActions = false }: CustomerCardProps) {
  const { colors } = useTheme();

  const primaryContact =
    customer.contacts?.find((c) => c.isPrimary) || customer.contacts?.[0];

  const isRed = customer.paymentZone === 'Red' || customer.payZone === 'RedZone';
  const isYellow = customer.paymentZone === 'Yellow' || customer.payZone === 'YellowZone';
  const payZoneVariant = isRed ? 'danger' : isYellow ? 'warning' : 'success';
  const payZoneLabel = isRed ? 'Red Zone' : isYellow ? 'Yellow Zone' : 'Green Zone';

  const subtitle = [customer.city, customer.industry].filter(Boolean).join(' · ') || customer.area || 'Customer';

  const handleCall = () => {
    if (primaryContact?.phone) {
      hapticFeedback('medium');
      makePhoneCall(primaryContact.phone);
    }
  };

  const handleWhatsApp = () => {
    if (primaryContact?.phone) {
      hapticFeedback('medium');
      openWhatsApp(primaryContact.phone, `Hello ${primaryContact.name}, from GreatSales:`);
    }
  };

  return (
    <GSCard
      onPress={onPress}
      variant="bordered"
      padding="sm"
      style={[
        styles.card,
        {
          backgroundColor: colors.surfaceElevated,
          borderColor: isRed ? colors.dangerBorder : colors.border,
        },
        isRed && { borderLeftWidth: 3, borderLeftColor: colors.danger },
      ]}
      accessibilityLabel={`Customer ${customer.name}, Outstanding: ${formatLakhs(customer.outstanding)}`}
    >
      <View style={styles.cardContent}>
        {/* Left: Avatar with initials */}
        <GSAvatar name={customer.name} size="md" style={styles.avatar} />

        {/* Center: Name & Subtitle */}
        <View style={styles.infoCol}>
          <Text numberOfLines={1} style={[styles.name, { color: colors.textPrimary }]}>
            {customer.name}
          </Text>
          <Text numberOfLines={1} style={[styles.subtitle, { color: colors.textSecondary }]}>
            {subtitle}
          </Text>
        </View>

        {/* Right: Zone Badge & Outstanding Amount */}
        <View style={styles.rightCol}>
          <GSBadge
            label={payZoneLabel}
            variant={payZoneVariant}
            size="sm"
            showDot
          />
          <View style={styles.amountWrapper}>
            <GSAmountDisplay
              amount={customer.outstanding}
              size="md"
              variant={customer.outstanding > 0 ? (isRed ? 'danger' : 'default') : 'success'}
              showLakhs
            />
          </View>
        </View>
      </View>

      {/* Optional Quick Action Strip if requested */}
      {showActions && primaryContact?.phone && (
        <View style={[styles.actionsRow, { borderTopColor: colors.borderSubtle }]}>
          <Text style={[styles.phoneText, { color: colors.textTertiary }]}>
            {primaryContact.name} • {primaryContact.phone}
          </Text>
          <View style={styles.actionButtons}>
            <GSIconButton
              icon={<Phone size={13} color={colors.brand} />}
              variant="subtle"
              size="sm"
              accessibilityLabel={`Call ${primaryContact.name}`}
              onPress={handleCall}
              style={styles.actionBtn}
            />
            <GSIconButton
              icon={<MessageSquare size={13} color={colors.brand} />}
              variant="subtle"
              size="sm"
              accessibilityLabel={`WhatsApp ${primaryContact.name}`}
              onPress={handleWhatsApp}
              style={styles.actionBtn}
            />
          </View>
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
  name: {
    fontSize: 15,
    fontFamily: typography.cardTitle.fontFamily,
    fontWeight: '700',
    lineHeight: 20,
    letterSpacing: -0.2,
  },
  subtitle: {
    fontSize: 12,
    fontFamily: typography.caption.fontFamily,
    fontWeight: '400',
    marginTop: 2,
  },
  rightCol: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  amountWrapper: {
    marginTop: 4,
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing[2],
    paddingTop: spacing[2],
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  phoneText: {
    fontSize: 11,
    fontFamily: typography.caption.fontFamily,
  },
  actionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  actionBtn: {
    width: 28,
    height: 28,
  },
});
