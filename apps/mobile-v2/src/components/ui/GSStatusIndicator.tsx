import React from 'react';
import { View, Text, StyleSheet, type ViewStyle } from 'react-native';
import { useTheme } from '../../design-system/theme';
import { spacing, radius, typography } from '../../design-system/tokens';
import {
  STAGE_LABELS,
  ORDER_STATUS_LABELS,
  PAY_ZONE_LABELS,
  PROJ_STATUS_LABELS,
} from '../../domain/types';

export interface GSStatusIndicatorProps {
  status: string;
  type?: 'lead' | 'order' | 'payZone' | 'projStatus' | 'generic';
  showDot?: boolean;
  style?: ViewStyle;
}

export function GSStatusIndicator({
  status,
  type = 'generic',
  showDot = true,
  style,
}: GSStatusIndicatorProps) {
  const { colors } = useTheme();

  let label = status;
  let color = colors.textSecondary;
  let bg = colors.surfaceMuted;

  if (type === 'lead') {
    label = STAGE_LABELS[status as keyof typeof STAGE_LABELS] || status;
    if (status === 'OrderClosedWon') {
      color = colors.success;
      bg = colors.successSoft;
    } else if (status === 'NegotiationOralConfirmation') {
      color = colors.brand;
      bg = colors.brandSoft;
    } else if (status === 'ClosedLost') {
      color = colors.danger;
      bg = colors.dangerSoft;
    } else {
      color = colors.info;
      bg = colors.infoSoft;
    }
  } else if (type === 'order') {
    label = ORDER_STATUS_LABELS[status as keyof typeof ORDER_STATUS_LABELS] || status;
    if (status === 'DeliveredFromWarehouse') {
      color = colors.success;
      bg = colors.successSoft;
    } else if (status === 'Cancelled') {
      color = colors.danger;
      bg = colors.dangerSoft;
    } else if (status === 'Dispatched') {
      color = colors.info;
      bg = colors.infoSoft;
    } else {
      color = colors.warning;
      bg = colors.warningSoft;
    }
  } else if (type === 'payZone') {
    label = PAY_ZONE_LABELS[status as keyof typeof PAY_ZONE_LABELS] || status;
    if (status === 'Green') {
      color = colors.success;
      bg = colors.successSoft;
    } else if (status === 'Yellow') {
      color = colors.warning;
      bg = colors.warningSoft;
    } else if (status === 'Red' || status === 'Blacklist') {
      color = colors.danger;
      bg = colors.dangerSoft;
    }
  } else if (type === 'projStatus') {
    label = PROJ_STATUS_LABELS[status as keyof typeof PROJ_STATUS_LABELS] || status;
    if (status === 'Completed') {
      color = colors.success;
      bg = colors.successSoft;
    } else if (status === 'NeedsAttention') {
      color = colors.danger;
      bg = colors.dangerSoft;
    } else {
      color = colors.brand;
      bg = colors.brandSoft;
    }
  }

  return (
    <View
      accessibilityLabel={`Status: ${label}`}
      style={[
        styles.badge,
        {
          backgroundColor: bg,
        },
        style,
      ]}
    >
      {showDot && <View style={[styles.dot, { backgroundColor: color }]} />}
      <Text style={[styles.text, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[2] + 2,
    paddingVertical: 3,
    borderRadius: radius.full,
    alignSelf: 'flex-start',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: radius.full,
    marginRight: spacing[1] + 1,
  },
  text: {
    fontSize: typography.micro.fontSize,
    fontWeight: '700',
    lineHeight: typography.micro.lineHeight,
  },
});
