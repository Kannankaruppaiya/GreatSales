import React from 'react';
import { Pressable, StyleSheet, type ViewStyle } from 'react-native';
import { useTheme } from '../../design-system/theme';
import { radius } from '../../design-system/tokens';
import { hapticFeedback } from '../../utils/haptics';

export interface GSIconButtonProps {
  icon: React.ReactNode;
  onPress: () => void;
  variant?: 'default' | 'subtle' | 'brand' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  accessibilityLabel: string;
  style?: ViewStyle;
}

export function GSIconButton({
  icon,
  onPress,
  variant = 'default',
  size = 'md',
  disabled = false,
  accessibilityLabel,
  style,
}: GSIconButtonProps) {
  const { colors } = useTheme();

  const handlePress = () => {
    if (disabled) return;
    hapticFeedback('light');
    onPress();
  };

  const dim = { sm: 36, md: 44, lg: 52 }[size];

  const getBackgroundColor = (pressed: boolean) => {
    if (disabled) return colors.surfaceMuted;
    switch (variant) {
      case 'default':
        return pressed ? colors.borderStrong : colors.surfaceElevated;
      case 'subtle':
        return pressed ? colors.border : colors.surfaceMuted;
      case 'brand':
        return pressed ? colors.brandDark : colors.brand;
      case 'danger':
        return pressed ? colors.dangerDark : colors.dangerSoft;
      case 'ghost':
        return pressed ? colors.surfaceElevated : 'transparent';
    }
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={handlePress}
      style={({ pressed }) => [
        styles.base,
        {
          width: dim,
          height: dim,
          borderRadius: radius.full,
          backgroundColor: getBackgroundColor(pressed),
          borderColor: variant === 'default' ? colors.border : 'transparent',
          borderWidth: variant === 'default' ? 1 : 0,
          opacity: disabled ? 0.5 : 1,
        },
        style,
      ]}
    >
      {icon}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
