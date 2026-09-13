import React from 'react';
import { View, Text, StyleSheet, type ViewStyle, type TextStyle } from 'react-native';
import { useTheme } from '../../design-system/theme';
import { spacing, radius, typography } from '../../design-system/tokens';

export interface GSBadgeProps {
  label: string;
  variant?: 'brand' | 'success' | 'warning' | 'danger' | 'info' | 'neutral';
  size?: 'sm' | 'md';
  showDot?: boolean;
  style?: ViewStyle;
}

export function GSBadge({
  label,
  variant = 'neutral',
  size = 'md',
  showDot = false,
  style,
}: GSBadgeProps) {
  const { colors } = useTheme();

  const colorMap = {
    brand: { bg: colors.brandSoft, text: colors.brand, dot: colors.brand },
    success: { bg: colors.successSoft, text: colors.success, dot: colors.success },
    warning: { bg: colors.warningSoft, text: colors.warning, dot: colors.warning },
    danger: { bg: colors.dangerSoft, text: colors.danger, dot: colors.danger },
    info: { bg: colors.infoSoft, text: colors.info, dot: colors.info },
    neutral: { bg: colors.surfaceMuted, text: colors.textSecondary, dot: colors.textTertiary },
  }[variant];

  const pad = size === 'sm' ? { px: spacing[2], py: 2 } : { px: spacing[2] + 2, py: spacing[1] };
  const fontStyle = size === 'sm' ? typography.micro : typography.caption;

  return (
    <View
      accessibilityLabel={`Status: ${label}`}
      style={[
        styles.container,
        {
          backgroundColor: colorMap.bg,
          paddingHorizontal: pad.px,
          paddingVertical: pad.py,
          borderRadius: radius.full,
        },
        style,
      ]}
    >
      {showDot && (
        <View
          style={[
            styles.dot,
            {
              backgroundColor: colorMap.dot,
              width: size === 'sm' ? 5 : 6,
              height: size === 'sm' ? 5 : 6,
            },
          ]}
        />
      )}
      <Text
        style={{
          color: colorMap.text,
          fontSize: fontStyle.fontSize,
          fontWeight: '600',
          lineHeight: fontStyle.lineHeight,
        }}
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
  },
  dot: {
    borderRadius: radius.full,
    marginRight: spacing[1],
  },
});
