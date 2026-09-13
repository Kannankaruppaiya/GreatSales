import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Edit2, Tag } from 'lucide-react-native';
import { useTheme } from '../../design-system/theme';
import { spacing, radius, typography } from '../../design-system/tokens';
import { GSCard, GSAmountDisplay, GSIconButton } from '../ui';
import type { Mapping } from '../../domain/types';
import { formatCurrencyINR, formatShortDate } from '../../domain/formatters';

export interface MappingCardProps {
  mapping: Mapping;
  onPress?: () => void;
  onEditPrice?: () => void;
  onDelete?: () => void;
}

export function MappingCard({ mapping, onPress, onEditPrice }: MappingCardProps) {
  const { colors } = useTheme();

  const isCustom = mapping.customPrice !== null && mapping.customPrice !== mapping.catalogPrice;

  return (
    <GSCard
      onPress={onPress}
      variant="bordered"
      padding="md"
      style={styles.card}
      accessibilityLabel={`Mapping: ${mapping.customerName} for ${mapping.productName}, Effective: ${formatCurrencyINR(mapping.effectivePrice)}`}
    >
      {/* Top row: Customer, Principal */}
      <View style={styles.topRow}>
        <View style={styles.titleCol}>
          <Text numberOfLines={1} style={[styles.customerName, { color: colors.textPrimary }]}>
            {mapping.customerName}
          </Text>
          <Text numberOfLines={1} style={[styles.productName, { color: colors.textSecondary }]}>
            {mapping.principalName} • {mapping.productName}
          </Text>
        </View>

        {onEditPrice && (
          <GSIconButton
            icon={<Edit2 size={15} color={colors.textSecondary} />}
            variant="subtle"
            size="sm"
            accessibilityLabel="Edit price"
            onPress={onEditPrice}
          />
        )}
      </View>

      {/* Middle row: Catalog Price vs Agreed Price */}
      <View
        style={[
          styles.midRow,
          {
            backgroundColor: colors.surfaceMuted,
            borderColor: colors.border,
          },
        ]}
      >
        <View style={styles.priceCol}>
          <Text style={[styles.microLabel, { color: colors.textTertiary }]}>
            CATALOG PRICE
          </Text>
          <Text
            style={[
              styles.catalogPrice,
              {
                color: colors.textSecondary,
                textDecorationLine: isCustom ? 'line-through' : 'none',
              },
            ]}
          >
            {formatCurrencyINR(mapping.catalogPrice ?? mapping.basePrice ?? 0)}
          </Text>
        </View>

        <View style={styles.priceCol}>
          <Text style={[styles.microLabel, { color: colors.textTertiary }]}>
            EFFECTIVE PRICE
          </Text>
          <GSAmountDisplay
            amount={mapping.effectivePrice}
            size="lg"
            variant={isCustom ? 'brand' : 'default'}
          />
        </View>
      </View>

      {/* Bottom row: Effective Date & Salesperson */}
      <View style={styles.bottomRow}>
        <View style={styles.metaRow}>
          <Tag size={12} color={colors.textTertiary} />
          <Text style={[styles.metaText, { color: colors.textSecondary }]}>
            {mapping.salespersonName || 'Assigned'}
          </Text>
        </View>
        <Text style={[styles.dateText, { color: colors.textTertiary }]}>
          Updated: {formatShortDate(mapping.updatedAt)}
        </Text>
      </View>
    </GSCard>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: spacing[3],
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing[3],
  },
  titleCol: {
    flex: 1,
    marginRight: spacing[2],
  },
  customerName: {
    fontSize: typography.cardTitle.fontSize,
    fontWeight: '700',
    lineHeight: typography.cardTitle.lineHeight,
  },
  productName: {
    fontSize: typography.caption.fontSize,
    marginTop: 2,
  },
  midRow: {
    flexDirection: 'row',
    borderRadius: radius.md,
    borderWidth: 1,
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[3],
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing[3],
  },
  priceCol: {
    flex: 1,
  },
  microLabel: {
    fontSize: typography.micro.fontSize,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  catalogPrice: {
    fontSize: typography.body.fontSize,
    fontWeight: '600',
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaText: {
    fontSize: typography.caption.fontSize,
    marginLeft: 4,
  },
  dateText: {
    fontSize: typography.micro.fontSize,
  },
});
