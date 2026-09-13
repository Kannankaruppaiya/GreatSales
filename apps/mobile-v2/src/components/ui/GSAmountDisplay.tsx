import React from 'react';
import { Text, View, StyleSheet, type TextStyle } from 'react-native';
import { useTheme } from '../../design-system/theme';
import { typography } from '../../design-system/tokens';
import { formatCurrencyINR, formatLakhs, formatA11yCurrency } from '../../domain/formatters';

export interface GSAmountDisplayProps {
  amount: number;
  size?: 'sm' | 'md' | 'lg' | 'hero';
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'brand';
  showLakhs?: boolean;
  style?: TextStyle;
}

export function GSAmountDisplay({
  amount,
  size = 'md',
  variant = 'default',
  showLakhs = false,
  style,
}: GSAmountDisplayProps) {
  const { colors } = useTheme();

  const formattedText = showLakhs ? formatLakhs(amount) : formatCurrencyINR(amount);
  const a11yLabel = formatA11yCurrency(amount);

  const colorMap = {
    default: colors.textPrimary,
    brand: colors.brand,
    success: colors.success,
    warning: colors.warning,
    danger: colors.danger,
  }[variant];

  const sizeStyle = {
    sm: typography.caption,
    md: typography.body,
    lg: typography.cardTitle,
    hero: typography.display,
  }[size];

  return (
    <Text
      accessibilityLabel={a11yLabel}
      style={[
        {
          color: colorMap,
          fontSize: sizeStyle.fontSize,
          fontWeight: size === 'sm' ? '600' : '700',
          lineHeight: sizeStyle.lineHeight,
        },
        style,
      ]}
    >
      {formattedText}
    </Text>
  );
}
