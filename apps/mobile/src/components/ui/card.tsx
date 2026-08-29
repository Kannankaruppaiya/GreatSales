/**
 * Card — the standard grouped-content surface. Optionally pressable (renders
 * as a button with the right a11y role and a pressed state).
 */
import type { ReactNode } from 'react';
import { Pressable, View, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme/theme-provider';
import type { ElevationLevel } from '@/theme/tokens';

type CardProps = {
  children: ReactNode;
  onPress?: () => void;
  elevation?: ElevationLevel;
  padded?: boolean;
  style?: ViewStyle;
  accessibilityLabel?: string;
};

export function Card({
  children,
  onPress,
  elevation = 1,
  padded = true,
  style,
  accessibilityLabel,
}: CardProps) {
  const theme = useTheme();
  const { colors, radii, spacing } = theme;

  const base: ViewStyle = {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: theme.scheme === 'dark' ? 1 : 0,
    borderColor: colors.border,
    padding: padded ? spacing.lg : 0,
    ...theme.elevation(elevation),
  };

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        style={({ pressed }) => [base, pressed && { backgroundColor: colors.surfaceSunken }, style]}
      >
        {children}
      </Pressable>
    );
  }

  return <View style={[base, style]}>{children}</View>;
}
