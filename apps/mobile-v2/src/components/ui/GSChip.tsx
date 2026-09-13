import React from 'react';
import { Pressable, Text, View, StyleSheet, type ViewStyle } from 'react-native';
import { useTheme } from '../../design-system/theme';
import { spacing, radius, typography } from '../../design-system/tokens';
import { hapticFeedback } from '../../utils/haptics';

export interface GSChipProps {
  label: string;
  selected?: boolean;
  onPress: () => void;
  count?: number;
  icon?: React.ReactNode;
  disabled?: boolean;
  style?: ViewStyle;
}

export function GSChip({
  label,
  selected = false,
  onPress,
  count,
  icon,
  disabled = false,
  style,
}: GSChipProps) {
  const { colors, isDark } = useTheme();

  const handlePress = () => {
    if (disabled) return;
    hapticFeedback('light');
    onPress();
  };

  const activeBg = colors.brand;
  const activeBorder = colors.brand;
  const activeTextColor = '#FFFFFF';

  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected, disabled }}
      accessibilityLabel={`${label}${count !== undefined ? `, ${count}` : ''}`}
      onPress={handlePress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: selected
            ? activeBg
            : pressed
            ? colors.surfaceInteractive
            : colors.surfaceElevated,
          borderColor: selected ? activeBorder : colors.border,
          borderRadius: radius.full,
          opacity: disabled ? 0.5 : 1,
          transform: [{ scale: pressed ? 0.97 : 1 }],
        },
        style,
      ]}
    >
      {icon && <View style={styles.icon}>{icon}</View>}
      <Text
        style={[
          styles.label,
          {
            color: selected ? activeTextColor : colors.textSecondary,
            fontFamily: typography.bodySmallMedium.fontFamily,
            fontWeight: selected ? '700' : '500',
          },
        ]}
      >
        {label}
      </Text>
      {count !== undefined && (
        <View
          style={[
            styles.badge,
            {
              backgroundColor: selected
                ? 'rgba(16, 185, 129, 0.2)'
                : colors.surfaceMuted,
            },
          ]}
        >
          <Text
            style={[
              styles.countText,
              {
                color: selected ? activeTextColor : colors.textTertiary,
              },
            ]}
          >
            {count}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing[1] + 2,
    paddingHorizontal: spacing[3],
    borderWidth: 1,
    minHeight: 34,
  },
  icon: {
    marginRight: spacing[1] + 2,
  },
  label: {
    fontSize: typography.bodySmall.fontSize,
  },
  badge: {
    marginLeft: spacing[2],
    paddingHorizontal: spacing[2],
    paddingVertical: 1,
    borderRadius: radius.full,
  },
  countText: {
    fontSize: typography.caption.fontSize,
    fontFamily: typography.caption.fontFamily,
    fontWeight: '600',
  },
});
